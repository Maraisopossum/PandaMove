-- PandaMove web : santé de la synchro et déconnexion forcée (à exécuter APRÈS 0001 à 0016).
-- Idempotente : peut être rejouée sans erreur.
--
-- Ajoute à l'administration technique (0016), toujours SANS accès au contenu d'un compte :
--   synchro_rejets          : compteurs des envois rejetés définitivement par le serveur (table concernée + code d'erreur + nombre + dernier
--                             constat). Aucune donnée d'entraînement : jamais le contenu de la ligne rejetée. Non synchronisée par PowerSync.
--                             Aucun accès direct pour les clients : alimentée par enregistrer_battement, lue par admin_sante_synchro.
--   enregistrer_battement   : redéfinie avec un 3e paramètre facultatif (liste des rejets constatés depuis le dernier battement). Un
--                             ancien client qui l'appelle avec deux paramètres continue de fonctionner.
--   admin_sante_synchro()   : par compte : dernière synchro, ancienneté en jours, version, rejets (total et détail). Réservée au rôle admin.
--   admin_revoquer_sessions : coupe les sessions d'un compte (déconnexion forcée). Réservée à la clé de service (appelée par la fonction
--                             admin-comptes) : aucun droit d'exécution pour les utilisateurs connectés.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) nouvelle version de la fonction admin-comptes (`supabase functions deploy admin-comptes`) ;
-- 3) nouveau client. Aucune règle PowerSync à changer.
-- Retour arrière : redéployer l'ancien client ; les objets restent en place, inertes (pas de `drop`).

begin;

create table if not exists public.synchro_rejets (
  user_id uuid not null,
  table_nom text not null check (char_length(table_nom) between 1 and 50),
  code text not null check (char_length(code) between 1 and 10),
  nb integer not null check (nb >= 1),
  dernier_at timestamptz not null default now(),
  primary key (user_id, table_nom, code)
);

revoke all on table public.synchro_rejets from anon;
revoke all on table public.synchro_rejets from authenticated;
alter table public.synchro_rejets enable row level security;

-- Remplace la version à deux paramètres (sinon deux surcharges rendraient l'appel ambigu pour PostgREST)
drop function if exists public.enregistrer_battement(text, boolean);

create or replace function public.enregistrer_battement(p_version text, p_synchro boolean default false, p_rejets jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  insert into public.profils (user_id, version_app, derniere_connexion_at, derniere_synchro_at)
  values (auth.uid(), left(p_version, 50), now(), case when p_synchro then now() end)
  on conflict (user_id) do update set
    version_app = excluded.version_app,
    derniere_connexion_at = excluded.derniere_connexion_at,
    derniere_synchro_at = case when p_synchro then now() else public.profils.derniere_synchro_at end;

  -- Rejets constatés : au plus 20 entrées par battement, valeurs bornées, tout ce qui est mal formé est ignoré
  if jsonb_typeof(p_rejets) = 'array' then
    for r in select * from jsonb_array_elements(p_rejets) loop
      exit when n >= 20;
      n := n + 1;
      if jsonb_typeof(r) = 'object'
         and jsonb_typeof(r -> 'table') = 'string' and jsonb_typeof(r -> 'code') = 'string' and jsonb_typeof(r -> 'nb') = 'number'
         and char_length(r ->> 'table') between 1 and 50 and char_length(r ->> 'code') between 1 and 10
         and (r ->> 'nb')::numeric between 1 and 1000 and (r ->> 'nb')::numeric = trunc((r ->> 'nb')::numeric)
      then
        insert into public.synchro_rejets (user_id, table_nom, code, nb)
        values (auth.uid(), r ->> 'table', r ->> 'code', (r ->> 'nb')::integer)
        on conflict (user_id, table_nom, code) do update set
          nb = public.synchro_rejets.nb + excluded.nb, dernier_at = now();
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.admin_sante_synchro()
returns table (user_id uuid, email text, derniere_synchro_at timestamptz, jours_sans_synchro integer, version_app text, rejets_total integer, rejets jsonb)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.derniere_synchro_at,
           case when p.derniere_synchro_at is null then null else floor(extract(epoch from (now() - p.derniere_synchro_at)) / 86400)::integer end,
           p.version_app,
           coalesce((select sum(s.nb)::integer from public.synchro_rejets s where s.user_id = u.id), 0),
           coalesce((select jsonb_agg(jsonb_build_object('table', s.table_nom, 'code', s.code, 'nb', s.nb, 'dernier_at', s.dernier_at) order by s.nb desc)
                     from public.synchro_rejets s where s.user_id = u.id), '[]'::jsonb)
    from auth.users u left join public.profils p on p.user_id = u.id
    order by u.created_at, u.id;
end;
$$;

create or replace function public.admin_revoquer_sessions(p_user uuid) returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare
  n integer;
begin
  -- Les jetons de rafraîchissement suivent la session (suppression en cascade) : le compte ne peut plus renouveler sa connexion
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.enregistrer_battement(text, boolean, jsonb) from public, anon;
revoke all on function public.admin_sante_synchro() from public, anon;
revoke all on function public.admin_revoquer_sessions(uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_battement(text, boolean, jsonb) to authenticated;
grant execute on function public.admin_sante_synchro() to authenticated;
-- admin_revoquer_sessions : propriétaire et clé de service seulement (service_role existe sur Supabase ; ignoré ailleurs)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.admin_revoquer_sessions(uuid) to service_role;
  end if;
end;
$$;

commit;
