-- PandaMove web : durcissement de la sécurité et de l'intégrité (à exécuter APRÈS 0001 à 0005).
-- Idempotente : peut être rejouée sans erreur (drop ... if exists, create ... if not exists).
--
-- Ce que fait cette migration :
--   1. Droits : le rôle `anon` (clé publique, utilisateur non connecté) perd TOUT accès aux tables ;
--      `authenticated` ne garde que SELECT / INSERT / UPDATE (la suppression est logique : deleted_at,
--      jamais un DELETE). La RLS reste la protection ligne à ligne ; les droits sont une seconde barrière.
--   2. Politiques RLS recréées `to authenticated` avec `(select auth.uid())` (évaluée une fois par
--      requête au lieu d'une fois par ligne, recommandation Supabase).
--   3. set_updated_at avec `search_path = ''` (pas de détournement par un objet homonyme).
--   4. Index uniques partiels incluant user_id (un utilisateur ne peut pas bloquer les écritures d'un
--      autre), anti-doublon de la copie des blocs d'instance, une seule ligne user_settings vivante
--      par utilisateur.
--
-- PowerSync : AUCUN droit n'est retiré au rôle de réplication (ex. powersync_role, ou postgres), ni à
-- postgres / service_role. Seuls `anon` et `authenticated` sont concernés. La publication `powersync`
-- n'est pas modifiée.

begin;

-- ── 0. Garde : refuser la migration si des doublons empêcheraient la création des index uniques ──
do $$
begin
  if exists (
    select 1 from public.user_settings where deleted_at is null group by user_id having count(*) > 1
  ) then
    raise exception 'Migration 0006 interrompue : plusieurs lignes user_settings vivantes pour un même utilisateur. '
      'Repérez-les avec : select user_id, count(*) from user_settings where deleted_at is null group by user_id having count(*) > 1; '
      'puis renseignez deleted_at sur les lignes en trop avant de relancer.';
  end if;
  if exists (
    select 1 from public.blocs_seance
    where instance_seance_id is not null and bloc_source_id is not null and deleted_at is null
    group by user_id, instance_seance_id, bloc_source_id having count(*) > 1
  ) then
    raise exception 'Migration 0006 interrompue : blocs d''instance en double (même instance, même bloc source). '
      'Repérez-les avec : select instance_seance_id, bloc_source_id, count(*) from blocs_seance where instance_seance_id is not null '
      'and bloc_source_id is not null and deleted_at is null group by 1, 2 having count(*) > 1; puis renseignez deleted_at sur les doublons.';
  end if;
end;
$$;

-- ── 1. Droits sur les tables ──
revoke all on table
  public.exercises, public.seances, public.blocs_seance, public.exercices_seance,
  public.instances_seance, public.series_realisees, public.objectifs_progression, public.user_settings
from anon;

revoke all on table
  public.exercises, public.seances, public.blocs_seance, public.exercices_seance,
  public.instances_seance, public.series_realisees, public.objectifs_progression, public.user_settings
from authenticated;

-- Upsert PostgREST = INSERT ... ON CONFLICT DO UPDATE : il faut INSERT et UPDATE.
grant select, insert, update on table
  public.exercises, public.seances, public.blocs_seance, public.exercices_seance,
  public.instances_seance, public.series_realisees, public.objectifs_progression, public.user_settings
to authenticated;

-- Tables créées plus tard par ce même rôle : plus aucun droit implicite pour anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ── 2. Politiques RLS : réservées à authenticated, auth.uid() évalué une fois par requête ──
do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'seances', 'blocs_seance', 'exercices_seance',
    'instances_seance', 'series_realisees', 'objectifs_progression', 'user_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprietaire', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_proprietaire', t
    );
  end loop;
end;
$$;

-- ── 3. Trigger updated_at : search_path vide, références qualifiées ──
-- (create or replace conserve les triggers existants qui pointent sur la fonction)
create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
-- Un trigger s'exécute sans vérifier EXECUTE : personne n'a besoin d'appeler la fonction directement.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ── 4. Index uniques partiels (par utilisateur) ──
-- Copie template -> instance : une seule ligne vivante par (utilisateur, instance, ligne source).
-- Le nouvel index est créé avant la suppression de l'ancien (0001, sans user_id) : aucune fenêtre.
create unique index if not exists exercices_seance_user_instance_source_uniq
  on public.exercices_seance (user_id, instance_seance_id, exercice_source_id)
  where instance_seance_id is not null and exercice_source_id is not null and deleted_at is null;
drop index if exists public.exercices_seance_instance_source_uniq;

create unique index if not exists blocs_seance_user_instance_source_uniq
  on public.blocs_seance (user_id, instance_seance_id, bloc_source_id)
  where instance_seance_id is not null and bloc_source_id is not null and deleted_at is null;

-- Une seule ligne de réglages vivante par utilisateur (le client utilise déjà un id déterministe).
create unique index if not exists user_settings_user_uniq
  on public.user_settings (user_id)
  where deleted_at is null;

commit;
