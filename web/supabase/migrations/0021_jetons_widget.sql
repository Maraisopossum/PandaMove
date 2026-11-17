-- PandaMove web : jetons du widget Android de nutrition (à exécuter APRÈS 0001 à 0020).
-- Idempotente : peut être rejouée sans erreur.
--
-- Le widget Android n'utilise jamais le mot de passe ni la session de l'utilisateur : il porte un JETON créé dans le Profil. Ce jeton ne
-- donne accès qu'à la fonction `widget-nutrition` : lire les TOTAUX d'un jour (énergie, macros, eau, objectifs : aucun nom d'aliment) et,
-- si l'option est cochée, ajouter de l'eau. Il se révoque à tout moment ; seule son empreinte SHA-256 est conservée (le jeton lui-même
-- n'est montré qu'une fois, à sa création).
--   jetons_widget : un widget relié par ligne. Non synchronisée par PowerSync (absente du schéma local et des règles).
--                   Les clients lisent la liste (nom, dates, option eau) SANS l'empreinte (droit SELECT par colonnes) ; ils n'écrivent
--                   jamais directement : création, révocation et option passent par les fonctions SQL ci-dessous.
--   creer_jeton_widget(nom, ecriture_eau) : crée le jeton et le rend UNE fois (« pmw_ » + 64 caractères hexadécimaux). 5 jetons actifs au plus.
--   revoquer_jeton_widget(id)             : révoque (le serveur refuse le jeton dès la lecture suivante).
--   regler_eau_jeton_widget(id, actif)    : accorde ou retire le droit d'ajouter de l'eau.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) `supabase functions deploy widget-nutrition --no-verify-jwt --use-api` (le jeton du widget
-- n'est pas un JWT) ; 3) nouveau client (section « Widget Android » du Profil) ; 4) application Android.
-- Retour arrière : redéployer l'ancien client ; les objets restent en place, inertes (pas de `drop`).

begin;

create table if not exists public.jetons_widget (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nom text not null check (char_length(nom) between 1 and 60),
  hash char(64) not null unique,
  ecriture_eau boolean not null default false,
  created_at timestamptz not null default now(),
  derniere_lecture_at timestamptz,
  revoque_at timestamptz
);

create index if not exists jetons_widget_user_idx on public.jetons_widget (user_id, created_at desc);

revoke all on table public.jetons_widget from anon;
revoke all on table public.jetons_widget from authenticated;
-- Lecture par colonnes : l'empreinte reste inaccessible aux clients
grant select (id, nom, ecriture_eau, created_at, derniere_lecture_at, revoque_at) on table public.jetons_widget to authenticated;
alter table public.jetons_widget enable row level security;
drop policy if exists jetons_widget_proprietaire on public.jetons_widget;
create policy jetons_widget_proprietaire on public.jetons_widget for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.creer_jeton_widget(p_nom text, p_ecriture_eau boolean default false) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_nom text := btrim(coalesce(p_nom, ''));
  v_jeton text;
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  if char_length(v_nom) not between 1 and 60 then
    raise exception 'Donnez un nom au widget (60 caractères au plus).' using errcode = '22023';
  end if;
  if (select count(*) from public.jetons_widget where user_id = v_user and revoque_at is null) >= 5 then
    raise exception 'Cinq widgets sont déjà reliés : révoquez-en un avant d''en relier un autre.' using errcode = '54000';
  end if;
  -- Deux UUID aléatoires (CSPRNG du serveur) : 244 bits, sans extension nécessaire
  v_jeton := 'pmw_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.jetons_widget (user_id, nom, hash, ecriture_eau)
  values (v_user, v_nom, encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), coalesce(p_ecriture_eau, false));
  return v_jeton;
end;
$$;

create or replace function public.revoquer_jeton_widget(p_id uuid) returns void
language sql security definer set search_path = public
as $$
  update public.jetons_widget set revoque_at = now() where id = p_id and user_id = auth.uid() and revoque_at is null
$$;

create or replace function public.regler_eau_jeton_widget(p_id uuid, p_actif boolean) returns void
language sql security definer set search_path = public
as $$
  update public.jetons_widget set ecriture_eau = coalesce(p_actif, false) where id = p_id and user_id = auth.uid() and revoque_at is null
$$;

revoke all on function public.creer_jeton_widget(text, boolean) from public;
revoke all on function public.creer_jeton_widget(text, boolean) from anon;
grant execute on function public.creer_jeton_widget(text, boolean) to authenticated;
revoke all on function public.revoquer_jeton_widget(uuid) from public;
revoke all on function public.revoquer_jeton_widget(uuid) from anon;
grant execute on function public.revoquer_jeton_widget(uuid) to authenticated;
revoke all on function public.regler_eau_jeton_widget(uuid, boolean) from public;
revoke all on function public.regler_eau_jeton_widget(uuid, boolean) from anon;
grant execute on function public.regler_eau_jeton_widget(uuid, boolean) to authenticated;

commit;
