-- PandaMove web : module Nutrition, journal alimentaire, aliments personnels, objectifs (à exécuter APRÈS 0001 à 0019).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- TROIS tables synchronisées, toutes avec user_id / updated_at / deleted_at (suppression logique, aucun droit DELETE) :
--   aliments            : aliments personnels (créés à la main, importés d'Open Food Facts ou issus d'une photo). Valeurs pour 100 g (ou 100 ml).
--                         `portion_g` : portion habituelle ; `favori` : 0 ou 1.
--   repas_entrees       : une ligne du journal. `date` = jour (yyyy-MM-dd), `repas` : petit_dejeuner, dejeuner, collation, diner ou eau
--                         (hydratation : quantite_g = millilitres, énergie et macros à 0). Les valeurs sont celles de la QUANTITÉ mangée
--                         (instantané : modifier un aliment ne réécrit jamais l'historique). `aliment_id` sans clé étrangère.
--   objectifs_nutrition : objectifs du jour (énergie, macros, eau) ; le plus récent s'applique. `profil_json` : entrées du calculateur (JSON, <= 2000).
-- UNE table non synchronisée :
--   analyses_assiette   : une ligne par analyse de photo (plafond quotidien appliqué par la fonction `analyser-assiette`). Aucun accès pour
--                         les clients : seule la clé de service (fonction) l'écrit et la lit. Aucun contenu de photo n'est conservé.
-- Types et conventions : ceux de 0001, 0010 et 0015 (horodatages ISO en text posés par le client).
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : le client valide les mêmes règles avant
-- d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration (puis vérifier que PostgREST voit les tables) ; 2) lire les NOTICE ;
-- 3) règles de synchro PowerSync (powersync/sync-rules.yaml, aussi collées dans le tableau de bord PowerSync Cloud) ;
-- 4) fonction `analyser-assiette` + secret ANTHROPIC_API_KEY (facultatif : sans eux, seule la photo est indisponible) ; 5) nouveau client.
-- Un client qui écrit dans ces tables avant la migration voit ses envois relancés sans fin (table inconnue) et bloque la file d'envoi.
-- Retour arrière : redéployer l'ancien client ; les tables restent en place, inertes (pas de `drop table`).

begin;

do $$
declare
  t text;
  r text;
  roles_accordes int := 0;
begin
  create table if not exists public.aliments (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    nom text not null check (char_length(nom) between 1 and 200),
    marque text check (char_length(marque) <= 200),
    code_barres text check (char_length(code_barres) <= 32),
    portion_g real not null default 100 check (portion_g > 0 and portion_g <= 5000),
    portion_label text check (char_length(portion_label) <= 100),
    kcal_100 real not null check (kcal_100 between 0 and 1000),
    proteines_100 real not null default 0 check (proteines_100 between 0 and 100),
    glucides_100 real not null default 0 check (glucides_100 between 0 and 100),
    lipides_100 real not null default 0 check (lipides_100 between 0 and 100),
    fibres_100 real check (fibres_100 between 0 and 100),
    favori integer not null default 0 check (favori in (0, 1)),
    source text not null default 'manuel' check (source in ('manuel', 'off', 'ia')),
    created_at text not null
  );

  create table if not exists public.repas_entrees (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    repas text not null check (repas in ('petit_dejeuner', 'dejeuner', 'collation', 'diner', 'eau')),
    nom text not null check (char_length(nom) between 1 and 200),
    quantite_g real not null check (quantite_g >= 0 and quantite_g <= 20000),
    kcal real not null check (kcal between 0 and 20000),
    proteines real not null default 0 check (proteines between 0 and 2000),
    glucides real not null default 0 check (glucides between 0 and 2000),
    lipides real not null default 0 check (lipides between 0 and 2000),
    fibres real check (fibres between 0 and 2000),
    aliment_id uuid,
    source text not null default 'manuel' check (source in ('base', 'off', 'manuel', 'ia', 'copie', 'eau')),
    created_at text not null
  );

  create table if not exists public.objectifs_nutrition (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    kcal integer not null check (kcal between 500 and 10000),
    proteines_g integer not null check (proteines_g between 0 and 1000),
    glucides_g integer not null check (glucides_g between 0 and 2000),
    lipides_g integer not null check (lipides_g between 0 and 1000),
    eau_ml integer not null default 2000 check (eau_ml between 0 and 20000),
    profil_json text check (char_length(profil_json) <= 2000),
    created_at text not null
  );

  foreach t in array array['aliments', 'repas_entrees', 'objectifs_nutrition'] loop
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

  -- Journal d'une journée : lecture par jour
  create index if not exists repas_entrees_user_date_idx on public.repas_entrees (user_id, date) where deleted_at is null;

  if roles_accordes = 0 then
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur les tables de nutrition. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que les tables de nutrition sont couvertes par la publication utilisée par PowerSync.';
  end if;
end;
$$;

-- Quota des analyses de photo : non synchronisée, aucun accès pour les clients (clé de service uniquement)
create table if not exists public.analyses_assiette (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists analyses_assiette_user_idx on public.analyses_assiette (user_id, created_at desc);
revoke all on table public.analyses_assiette from anon;
revoke all on table public.analyses_assiette from authenticated;
alter table public.analyses_assiette enable row level security;

commit;
