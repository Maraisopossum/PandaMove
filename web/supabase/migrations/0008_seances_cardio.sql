-- PandaMove web : séances de cardio (course et vélo) dans l'agenda (à exécuter APRÈS 0001 à 0007).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- Deux tables de même forme, `seances_course` et `seances_velo`. Une ligne = une séance posée dans l'agenda
-- (titre, consigne, détail « durée · zone » non découpé, date, jalon, lien vers la page de statistiques
-- Strava / Suunto / MyWoosh, état validé). Aucun résultat n'est saisi : les données réelles restent sur ces services.
-- Les statistiques de l'application ne lisent jamais ces tables.
--
-- Colonnes (types et défauts : mêmes conventions que 0001) :
--   titre (1 à 200 car.), consigne (<= 2000), detail (<= 100), jalon (<= 100) : texte ; consigne, detail, jalon facultatifs.
--   date            : jour au format yyyy-MM-dd (text, comme instances_seance.date) ; la validité réelle du jour
--                     (30 février...) est contrôlée côté client, la contrainte n'en vérifie que le format.
--   optionnelle     : simple mention d'affichage, sans effet ; is_validated : séance validée (sans date de validation).
--   lien            : NULL ou adresse en https:// (<= 2048 car.), sensible à la casse. Le client enregistre NULL (jamais '')
--                     et la forme normalisée renvoyée par lienValide (schéma en minuscules).
--   created_at      : horodatage ISO en text, posé par le client (comme instances_seance.created_at).
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : la ligne locale est
-- abandonnée. Le client valide donc les mêmes règles avant d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- Droits et RLS : mêmes règles que 0006 (anon sans aucun droit ; authenticated en SELECT / INSERT / UPDATE, jamais DELETE ;
-- politique `<table>_proprietaire` réservée à authenticated, sur `(select auth.uid())`).
--
-- RÔLE DE RÉPLICATION POWERSYNC : le `grant select on all tables` fait à la mise en place ne couvre QUE les tables
-- qui existaient à ce moment-là. Cette migration accorde donc explicitement SELECT sur les deux nouvelles tables aux
-- rôles de réplication PowerSync : `powersync_role` (guide Supabase + PowerSync, développement) et tout rôle
-- `powersync_<suffixe>` portant l'attribut de réplication (PowerSync Cloud génère un nom du type
-- powersync_139f8681431505f8ca4df3c4, propre au compte). Aucun autre rôle n'est concerné. Si aucun rôle ne correspond,
-- un NOTICE le signale et RIEN ne se réplique, sans erreur visible : contrôler après l'exécution :
--   select rolname from pg_roles where rolreplication and rolname not like 'supabase\_%' and rolname <> 'postgres';
--   select has_table_privilege('<role>', 'public.seances_course', 'SELECT'),
--          has_table_privilege('<role>', 'public.seances_velo',   'SELECT');
--
-- PUBLICATION POWERSYNC : si la publication `powersync` existe et LISTE ses tables, la migration y ajoute les deux
-- nouvelles (seulement celles qui n'en sont pas déjà membres : un ajout en double est une erreur 42710). Une publication
-- « toutes les tables » (cas du développement) couvre déjà les nouvelles tables et n'est pas touchée. Si l'exécutant
-- n'est pas propriétaire de la publication, ou si elle n'existe pas, un NOTICE le signale et la migration continue :
--   select pubname, puballtables from pg_publication;
--   alter publication powersync add table public.seances_course, public.seances_velo;   -- à faire alors à la main
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration (puis vérifier que PostgREST voit les tables) ; 2) lire les NOTICE de la
-- migration (rôle de réplication, publication) ; 3) règles de synchro PowerSync (powersync/sync-rules.yaml, aussi
-- collées dans le tableau de bord PowerSync Cloud) ; 4) nouveau client. Un client qui écrit dans ces tables avant la
-- migration voit ses envois relancés sans fin (table inconnue) et bloque la file d'envoi, renforcement compris.
-- Retour arrière : redéployer l'ancien client ; les tables restent en place, inertes (pas de `drop table`).

begin;

do $$
declare
  t text;
  r text;
  roles_accordes int := 0;
begin
  foreach t in array array['seances_course', 'seances_velo'] loop
    -- Table
    execute format($f$
      create table if not exists public.%1$I (
        id uuid primary key,
        user_id uuid not null default auth.uid(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        titre text not null check (char_length(titre) between 1 and 200),
        consigne text check (char_length(consigne) <= 2000),
        detail text check (char_length(detail) <= 100),
        date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
        optionnelle boolean not null default false,
        jalon text check (char_length(jalon) <= 100),
        lien text check (char_length(lien) <= 2048 and lien ~ '^https://'),
        is_validated boolean not null default false,
        created_at text not null
      )$f$, t);

    -- Lecture d'un mois et des prochaines séances : lignes vivantes d'un utilisateur, par date
    execute format(
      'create index if not exists %I on public.%I (user_id, date) where deleted_at is null',
      t || '_user_date_idx', t
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

    -- Rôles de réplication PowerSync : SELECT explicite (voir l'en-tête)
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
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur seances_course et seances_velo. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que seances_course et seances_velo sont couvertes par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
