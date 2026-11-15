-- PandaMove web : objectifs et jalons des plans d'endurance (à exécuter APRÈS 0001 à 0013).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- UNE table `objectifs_plan` : une ligne = une échéance visée (course, sortie vélo, Hyrox) avec sa date, sa priorité et, après coup,
-- son résultat. Les jalons déjà inscrits dans les séances de cardio (colonne `jalon` de 0008) restent la source du plan : cette
-- table ne les remplace pas, elle accueille les objectifs saisis à la main et le résultat d'un jalon.
--
-- Colonnes (types et défauts : mêmes conventions que 0001 et 0010) :
--   nom        : 1 à 200 caractères.
--   discipline : 'course', 'velo' ou 'hyrox'.
--   date       : jour de l'échéance (yyyy-MM-dd).
--   distance_m : distance (facultative), 0 à 10 000 000.
--   cible_s    : temps visé en secondes (facultatif), 0 à 604 800.
--   priorite   : 'A' (objectif principal), 'B' ou 'C'.
--   statut     : 'prevu', 'fait' ou 'abandonne'.
--   resultat_s : temps réel en secondes (facultatif), 0 à 604 800.
--   seance_id  : séance de cardio-jalon dont l'objectif reprend le jalon (facultatif, SANS clé étrangère : la séance peut être supprimée).
--   notes      : <= 2000 caractères.
--   created_at : horodatage ISO en text, posé par le client.
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : le client valide les mêmes règles avant
-- d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- Droits, RLS, rôle de réplication et publication PowerSync : mêmes règles et mêmes vérifications que 0008 à 0012 (un NOTICE signale
-- tout ce qui n'a pas pu être fait). Suppression logique seulement (deleted_at) : aucun droit DELETE.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration (puis vérifier que PostgREST voit la table) ; 2) lire les NOTICE ;
-- 3) règles de synchro PowerSync (powersync/sync-rules.yaml, aussi collées dans le tableau de bord PowerSync Cloud) ;
-- 4) nouveau client. Un client qui écrit dans cette table avant la migration voit ses envois relancés sans fin
-- (table inconnue) et bloque la file d'envoi, renforcement compris.
-- Retour arrière : redéployer l'ancien client ; la table reste en place, inerte (pas de `drop table`).

begin;

do $$
declare
  t text;
  r text;
  roles_accordes int := 0;
begin
  create table if not exists public.objectifs_plan (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    nom text not null check (char_length(nom) between 1 and 200),
    discipline text not null check (discipline in ('course', 'velo', 'hyrox')),
    date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    distance_m double precision check (distance_m between 0 and 10000000),
    cible_s integer check (cible_s between 0 and 604800),
    priorite text not null default 'B' check (priorite in ('A', 'B', 'C')),
    statut text not null default 'prevu' check (statut in ('prevu', 'fait', 'abandonne')),
    resultat_s integer check (resultat_s between 0 and 604800),
    seance_id uuid,
    notes text check (char_length(notes) <= 2000),
    created_at text not null
  );

  foreach t in array array['objectifs_plan'] loop
    -- Lecture par échéance : lignes vivantes d'un utilisateur, par date
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
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur objectifs_plan. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que objectifs_plan est couverte par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
