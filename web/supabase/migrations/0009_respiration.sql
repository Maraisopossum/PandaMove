-- PandaMove web : module Respiration (à exécuter APRÈS 0001 à 0008).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- Deux tables :
--   methodes_respiration : méthodes créées par l'utilisateur (les quatre méthodes intégrées vivent dans le code).
--   seances_respiration  : historique des séances menées jusqu'au bout (une ligne = une séance terminée).
--
-- Colonnes de methodes_respiration (types et défauts : mêmes conventions que 0001) :
--   nom (1 à 100 car.), emoji (1 à 16 car.), created_at : horodatage ISO en text, posé par le client.
--   inspire_sec, expire_sec : 1 à 60 ; retention_pleine_sec, retention_vide_sec : 0 à 60 (0 = phase absente) ;
--   cycles_defaut : 1 à 120.
-- Colonnes de seances_respiration :
--   methode_id  : identifiant de la méthode jouée (« coherence_cardiaque », « 4_7_8 »... ou l'uuid d'une méthode
--                 personnalisée) ; volontairement SANS clé étrangère : une méthode supprimée laisse son historique.
--   methode_nom : nom de la méthode au moment de la séance (1 à 100 car.), conservé tel quel.
--   cycles (1 à 1000 : une séance de 90 min sur une méthode rapide dépasse 120 cycles), duree_sec (1 à 86400), date : jour au format yyyy-MM-dd (text, comme instances_seance.date ;
--   la contrainte n'en vérifie que le format), created_at.
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : la ligne locale est
-- abandonnée. Le client valide donc les mêmes règles avant d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- Droits et RLS : mêmes règles que 0006 et 0008 (anon sans aucun droit ; authenticated en SELECT / INSERT / UPDATE,
-- jamais DELETE ; politique `<table>_proprietaire` réservée à authenticated, sur `(select auth.uid())`).
-- Rôle de réplication et publication PowerSync : mêmes explications et mêmes vérifications que l'en-tête de 0008
-- (SELECT explicite aux rôles `powersync_role` / `powersync_<suffixe>` ; ajout à la publication `powersync` si elle
-- liste ses tables ; un NOTICE signale tout ce qui n'a pas pu être fait).
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration (puis vérifier que PostgREST voit les tables) ; 2) lire les NOTICE ;
-- 3) règles de synchro PowerSync (powersync/sync-rules.yaml, aussi collées dans le tableau de bord PowerSync Cloud) ;
-- 4) nouveau client. Un client qui écrit dans ces tables avant la migration voit ses envois relancés sans fin
-- (table inconnue) et bloque la file d'envoi, renforcement compris.
-- Retour arrière : redéployer l'ancien client ; les tables restent en place, inertes (pas de `drop table`).

begin;

do $$
declare
  t text;
  r text;
  roles_accordes int := 0;
begin
  -- Tables
  create table if not exists public.methodes_respiration (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    nom text not null check (char_length(nom) between 1 and 100),
    emoji text not null check (char_length(emoji) between 1 and 16),
    inspire_sec integer not null check (inspire_sec between 1 and 60),
    retention_pleine_sec integer not null default 0 check (retention_pleine_sec between 0 and 60),
    expire_sec integer not null check (expire_sec between 1 and 60),
    retention_vide_sec integer not null default 0 check (retention_vide_sec between 0 and 60),
    cycles_defaut integer not null check (cycles_defaut between 1 and 120),
    created_at text not null
  );

  create table if not exists public.seances_respiration (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    methode_id text not null check (char_length(methode_id) between 1 and 100),
    methode_nom text not null check (char_length(methode_nom) between 1 and 100),
    cycles integer not null check (cycles between 1 and 1000),
    duree_sec integer not null check (duree_sec between 1 and 86400),
    date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    created_at text not null
  );

  foreach t in array array['methodes_respiration', 'seances_respiration'] loop
    -- Lecture : lignes vivantes d'un utilisateur (historique : les plus récentes en premier)
    execute format(
      'create index if not exists %I on public.%I (user_id, created_at) where deleted_at is null',
      t || '_user_created_idx', t
    );

    -- updated_at maintenu par le serveur (modèle de 0001 ; 0006 ne fait que redéfinir la fonction)
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );

    -- Droits (modèle de 0006) : les droits par défaut de Supabase sont larges, on les retire puis on accorde le strict nécessaire
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);

    -- RLS (modèle de 0006)
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprietaire', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_proprietaire', t
    );

    -- Rôles de réplication PowerSync : SELECT explicite (voir l'en-tête de 0008)
    for r in
      select rolname from pg_roles
      where rolname = 'powersync_role' or (rolname like 'powersync\_%' and rolreplication)
    loop
      execute format('grant select on table public.%I to %I', t, r);
      roles_accordes := roles_accordes + 1;
    end loop;

    -- Publication PowerSync qui liste ses tables : y ajouter la table si elle n'en est pas déjà membre
    if exists (select 1 from pg_publication where pubname = 'powersync' and not puballtables)
       and not exists (
         select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = t
       )
    then
      begin
        execute format('alter publication powersync add table public.%I', t);
      exception when insufficient_privilege then
        raise notice 'Droits insuffisants pour modifier la publication powersync : exécutez « alter publication powersync add table public.% » avec un rôle propriétaire.', t;
      end;
    end if;
  end loop;

  if roles_accordes = 0 then
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur methodes_respiration et seances_respiration. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que methodes_respiration et seances_respiration sont couvertes par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
