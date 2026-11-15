-- PandaMove web : administration technique (à exécuter APRÈS 0001 à 0015).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, create or replace, drop ... if exists avant create).
--
-- Une administration TECHNIQUE seulement : comptes, activité, version de l'application. Aucune donnée d'entraînement n'est lue ni exposée
-- (séances, séries, poids, sorties, traces, notes, objectifs restent protégés par leur RLS `<table>_proprietaire`).
--
-- Rôle administrateur : `app_metadata.role = 'admin'` du JWT (non modifiable par l'utilisateur). À poser à la main pour votre compte,
-- dans le tableau de bord Supabase (Authentication > Users > votre compte > Raw app meta data) :  {"role": "admin"}
-- puis vous reconnecter pour que le jeton le porte. Aucun rôle n'est stocké dans une table lisible.
--
-- Tables (NON synchronisées par PowerSync : les métadonnées passent par Supabase directement) :
--   profils       : une ligne par compte (statut actif/suspendu, dernière connexion, dernière synchro, version de l'application).
--                   Lecture de SA ligne seulement ; AUCUNE écriture directe : la ligne est tenue par la fonction enregistrer_battement.
--   journal_admin : journal d'audit des actions administrateur, insertion seulement (modification et suppression refusées par un
--                   déclencheur), aucun accès direct pour les clients ; lecture par admin_lire_journal.
--
-- Fonctions (SECURITY DEFINER, droit d'exécution aux seuls utilisateurs connectés ; les fonctions admin_* refusent tout compte sans le rôle) :
--   est_admin()                              : vrai si le JWT porte le rôle administrateur.
--   enregistrer_battement(version, synchro)  : l'application l'appelle à l'ouverture (et après synchro) : version et horodatages, RIEN d'autre.
--   admin_lister_comptes()                   : identifiant, e-mail, inscription, dernière connexion, dernière synchro, version, statut.
--   admin_resume()                           : inscrits, actifs sur 7 et 30 jours, comptes suspendus.
--   admin_lire_journal(limite)               : dernières entrées du journal d'audit.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) poser le rôle admin sur votre compte et vous reconnecter ; 3) nouveau client.
-- Aucune règle PowerSync à changer. Un client qui appelle enregistrer_battement avant la migration reçoit une erreur ignorée sans conséquence.
-- Retour arrière : redéployer l'ancien client ; les tables et fonctions restent en place, inertes (pas de `drop`).

begin;

create table if not exists public.profils (
  user_id uuid primary key default auth.uid(),
  statut text not null default 'actif' check (statut in ('actif', 'suspendu')),
  derniere_connexion_at timestamptz,
  derniere_synchro_at timestamptz,
  version_app text check (char_length(version_app) <= 50),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_admin (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null check (char_length(action) between 1 and 100),
  cible_user_id uuid,
  at timestamptz not null default now(),
  detail text check (char_length(detail) <= 1000)
);

-- Droits : aucun accès aux clients, sauf la lecture de sa propre ligne de profil
revoke all on table public.profils from anon;
revoke all on table public.profils from authenticated;
grant select on table public.profils to authenticated;
revoke all on table public.journal_admin from anon;
revoke all on table public.journal_admin from authenticated;

alter table public.profils enable row level security;
drop policy if exists profils_lecture_proprietaire on public.profils;
create policy profils_lecture_proprietaire on public.profils for select to authenticated
  using (user_id = (select auth.uid()));

-- RLS active et aucune politique sur le journal : seul le propriétaire de la table (les fonctions ci-dessous) y accède
alter table public.journal_admin enable row level security;

-- Journal non modifiable : toute modification ou suppression est refusée, même pour le propriétaire de la table
create or replace function public.journal_admin_immuable() returns trigger language plpgsql as $$
begin
  raise exception 'Le journal d''audit est en insertion seulement.' using errcode = '42501';
end;
$$;
drop trigger if exists journal_admin_immuable on public.journal_admin;
create trigger journal_admin_immuable before update or delete on public.journal_admin
  for each row execute function public.journal_admin_immuable();

create or replace function public.est_admin() returns boolean
language sql stable
as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) $$;

create or replace function public.enregistrer_battement(p_version text, p_synchro boolean default false) returns void
language plpgsql security definer set search_path = public
as $$
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
end;
$$;

create or replace function public.admin_lister_comptes()
returns table (user_id uuid, email text, inscrit_at timestamptz, derniere_connexion_at timestamptz, derniere_synchro_at timestamptz, version_app text, statut text)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.created_at,
           coalesce(p.derniere_connexion_at, u.last_sign_in_at), p.derniere_synchro_at, p.version_app, coalesce(p.statut, 'actif')
    from auth.users u left join public.profils p on p.user_id = u.id
    order by u.created_at, u.id;
end;
$$;

create or replace function public.admin_resume()
returns table (inscrits integer, actifs_7j integer, actifs_30j integer, suspendus integer)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  return query
    select (select count(*)::integer from auth.users),
           (select count(*)::integer from public.profils where derniere_connexion_at >= now() - interval '7 days'),
           (select count(*)::integer from public.profils where derniere_connexion_at >= now() - interval '30 days'),
           (select count(*)::integer from public.profils where statut = 'suspendu');
end;
$$;

create or replace function public.admin_lire_journal(p_limite integer default 100)
returns table (id uuid, admin_id uuid, action text, cible_user_id uuid, at timestamptz, detail text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  return query select j.id, j.admin_id, j.action, j.cible_user_id, j.at, j.detail
    from public.journal_admin j order by j.at desc, j.id limit greatest(1, least(coalesce(p_limite, 100), 500));
end;
$$;

-- Exécution : utilisateurs connectés seulement (jamais anon ni public) ; les fonctions admin_* se protègent elles-mêmes
revoke all on function public.est_admin() from public, anon;
revoke all on function public.enregistrer_battement(text, boolean) from public, anon;
revoke all on function public.admin_lister_comptes() from public, anon;
revoke all on function public.admin_resume() from public, anon;
revoke all on function public.admin_lire_journal(integer) from public, anon;
grant execute on function public.est_admin() to authenticated;
grant execute on function public.enregistrer_battement(text, boolean) to authenticated;
grant execute on function public.admin_lister_comptes() to authenticated;
grant execute on function public.admin_resume() to authenticated;
grant execute on function public.admin_lire_journal(integer) to authenticated;

commit;
