-- PandaMove web : sorties d'endurance réalisées, course et vélo (à exécuter APRÈS 0001 à 0009).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- UNE table `sorties` : une ligne = une activité réellement faite (par opposition aux séances PLANIFIÉES de 0008).
-- Les statistiques de course et de vélo se calculent sur cette table, jamais sur seances_course / seances_velo.
-- Le sport est une colonne : les métriques sont les mêmes et les statistiques croisent les deux sports.
--
-- Colonnes (types et défauts : mêmes conventions que 0001) :
--   sport           : 'course' ou 'velo'.
--   date            : jour (yyyy-MM-dd, le jour local de la sortie) ; debut_at : instant de départ ISO (facultatif).
--   duree_s (>= 0), duree_deplacement_s (en mouvement), distance_m, denivele_pos_m, denivele_neg_m : volume (facultatifs).
--   fc_moy, fc_max (30 à 260), rpe (1 à 10) : intensité.
--   puissance_moy_w, puissance_max_w, puissance_norm_w, cadence_moy : capteurs (home-trainer, MyWoosh).
--   en_salle        : sortie sans GPS (home-trainer).
--   titre (1 à 200), notes (<= 2000), lien (NULL ou https://, <= 2048).
--   source          : 'manuel', 'suunto' ou 'mywoosh'.
--   empreinte       : sport + début + durée, anti-doublon à l'import de fichier.
--   seance_course_id / seance_velo_id : séance planifiée dont la sortie est le résultat (facultatif, SANS clé étrangère :
--                     la séance peut être supprimée ; à terme séance et sortie fusionneront).
--   tours, serie, trace : texte JSON simplifié (tours / kilomètres, échantillons réduits, polyligne réduite).
--   created_at      : horodatage ISO en text, posé par le client.
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : la ligne locale est
-- abandonnée. Le client valide donc les mêmes règles avant d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- Droits, RLS, rôle de réplication et publication PowerSync : mêmes règles et mêmes vérifications que 0008 et 0009
-- (voir l'en-tête de 0008 ; un NOTICE signale tout ce qui n'a pas pu être fait).
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
  create table if not exists public.sorties (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    sport text not null check (sport in ('course', 'velo')),
    date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    debut_at text,
    duree_s integer check (duree_s between 0 and 604800),
    duree_deplacement_s integer check (duree_deplacement_s between 0 and 604800),
    distance_m double precision check (distance_m between 0 and 10000000),
    denivele_pos_m double precision check (denivele_pos_m between 0 and 20000),
    denivele_neg_m double precision check (denivele_neg_m between 0 and 20000),
    fc_moy integer check (fc_moy between 30 and 260),
    fc_max integer check (fc_max between 30 and 260),
    rpe integer check (rpe between 1 and 10),
    puissance_moy_w integer check (puissance_moy_w between 0 and 3000),
    puissance_max_w integer check (puissance_max_w between 0 and 5000),
    puissance_norm_w integer check (puissance_norm_w between 0 and 3000),
    cadence_moy integer check (cadence_moy between 0 and 300),
    en_salle boolean not null default false,
    titre text not null check (char_length(titre) between 1 and 200),
    notes text check (char_length(notes) <= 2000),
    lien text check (char_length(lien) <= 2048 and lien ~ '^https://'),
    source text not null default 'manuel' check (source in ('manuel', 'suunto', 'mywoosh')),
    empreinte text check (char_length(empreinte) <= 200),
    seance_course_id uuid,
    seance_velo_id uuid,
    tours text,
    serie text,
    trace text,
    created_at text not null
  );

  foreach t in array array['sorties'] loop
    -- Lecture par sport et par période : lignes vivantes d'un utilisateur, par date
    execute format(
      'create index if not exists %I on public.%I (user_id, sport, date) where deleted_at is null',
      t || '_user_sport_date_idx', t
    );

    -- Anti-doublon d'import : recherche d'une empreinte parmi les lignes vivantes d'un utilisateur
    execute format(
      'create index if not exists %I on public.%I (user_id, empreinte) where deleted_at is null and empreinte is not null',
      t || '_user_empreinte_idx', t
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
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur sorties. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que sorties est couverte par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
