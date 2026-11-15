-- PandaMove web : module Hyrox, objectif, simulations chronométrées et segments (à exécuter APRÈS 0001 à 0014).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- TROIS tables, toutes avec user_id / updated_at / deleted_at (suppression logique, aucun droit DELETE) :
--   hyrox_courses     : l'objectif Hyrox. `date` est FACULTATIVE (on peut se préparer sans course prévue). `categorie` : 'open' ou 'pro' ;
--                       `genre` : 'homme' ou 'femme' ; `objectif_s` : temps visé ; `resultat_s` : temps officiel après la course ;
--                       `repartition_json` : réglage de la répartition (texte JSON, <= 2000 caractères).
--   hyrox_simulations : une simulation chronométrée. `forme` : 'complete' (16 segments), 'partielle' (8 segments) ou 'station' (1 segment) ;
--                       `statut` : 'en_cours', 'terminee' ou 'abandonnee' ; `reference` : 0 ou 1 (sert aux estimations).
--                       `course_id` : objectif visé (facultatif, SANS clé étrangère : l'objectif peut être supprimé).
--   hyrox_segments    : un segment d'une simulation (`rang` 1 à 16, `type` 'course' ou 'station', `station` = clé du catalogue du client,
--                       `cible_s` et `reel_s` en secondes). `simulation_id` sans clé étrangère, comme `course_id`.
-- Types et conventions : ceux de 0001, 0010 et 0014 (horodatages ISO en text posés par le client, durées en secondes).
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : le client valide les mêmes règles avant
-- d'écrire ; ces contraintes ne sont qu'une seconde vérification.
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
  create table if not exists public.hyrox_courses (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    nom text not null check (char_length(nom) between 1 and 200),
    lieu text check (char_length(lieu) <= 200),
    date text check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    categorie text not null default 'open' check (categorie in ('open', 'pro')),
    genre text not null default 'homme' check (genre in ('homme', 'femme')),
    objectif_s integer check (objectif_s between 0 and 604800),
    resultat_s integer check (resultat_s between 0 and 604800),
    repartition_json text check (char_length(repartition_json) <= 2000),
    created_at text not null
  );

  create table if not exists public.hyrox_simulations (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    course_id uuid,
    forme text not null check (forme in ('complete', 'partielle', 'station')),
    categorie text not null default 'open' check (categorie in ('open', 'pro')),
    genre text not null default 'homme' check (genre in ('homme', 'femme')),
    debut_at text not null,
    statut text not null default 'en_cours' check (statut in ('en_cours', 'terminee', 'abandonnee')),
    total_s integer check (total_s between 0 and 604800),
    reference integer not null default 0 check (reference in (0, 1)),
    notes text check (char_length(notes) <= 2000),
    created_at text not null
  );

  create table if not exists public.hyrox_segments (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    simulation_id uuid not null,
    rang integer not null check (rang between 1 and 16),
    type text not null check (type in ('course', 'station')),
    station text check (char_length(station) <= 50),
    cible_s integer check (cible_s between 0 and 604800),
    reel_s integer check (reel_s between 0 and 604800),
    charge_label text check (char_length(charge_label) <= 200),
    created_at text not null
  );

  foreach t in array array['hyrox_courses', 'hyrox_simulations', 'hyrox_segments'] loop
    -- Lecture : lignes vivantes d'un utilisateur, par date de création
    execute format(
      'create index if not exists %I on public.%I (user_id, created_at) where deleted_at is null',
      t || '_user_cree_idx', t
    );

    -- updated_at maintenu par le serveur (modèle de 0001 ; 0006 ne fait que redéfinir la fonction)
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );

    -- Droits (modèle de 0006)
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
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur les tables Hyrox. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que les tables hyrox_* sont couvertes par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
