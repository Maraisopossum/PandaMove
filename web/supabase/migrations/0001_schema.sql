-- PandaMove web : schéma Postgres synchronisé (Supabase + PowerSync).
-- Colonnes métier = colonnes Room v27 en snake_case (INTEGER booléens -> boolean, clés -> uuid).
-- Les identifiants sont fournis par les clients (uuid), pas de valeur par défaut sur id.
--
-- Pas de FOREIGN KEY : en mode hors-ligne, les lignes créées sur un appareil arrivent via
-- la synchro dans un ordre quelconque (ex. une série avant son exercice) ; une contrainte
-- référentielle rejetterait ces lignes. L'intégrité est portée par l'application.
--
-- Note : Room a déjà une colonne `updated_at` sur `seances` ; elle est fusionnée avec la
-- colonne de synchro `updated_at timestamptz` (maintenue par le trigger set_updated_at).
-- Les dates Room restent en text (ISO) telles quelles : created_at, date, completed_at, derniere_maj.

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  category text not null,
  muscle_groups text not null,
  description text not null,
  is_favorite boolean not null,
  is_custom boolean not null,
  image_url text,
  exercise_type text not null,
  equipment text not null,
  muscle_primary text not null,
  is_bodyweight boolean not null
);
create trigger set_updated_at before update on exercises
  for each row execute function set_updated_at();

create table seances (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  nom text not null,
  groupes_musculaires text not null,
  duree_estimee_min integer not null,
  notes text not null,
  seance_category text not null,
  created_at text not null,
  is_archived boolean not null
);
create trigger set_updated_at before update on seances
  for each row execute function set_updated_at();

create table blocs_seance (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  seance_id uuid not null,
  nom text not null,
  type text not null,
  position integer not null,
  duree_min integer,
  description text not null,
  temps_repos_inter_sec integer not null,
  temps_repos_fin_round_sec integer not null,
  instance_seance_id uuid,
  bloc_source_id uuid
);
create trigger set_updated_at before update on blocs_seance
  for each row execute function set_updated_at();

create table exercices_seance (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  seance_id uuid not null,
  exercise_id uuid not null,
  bloc_id uuid,
  superset_groupe text,
  position integer not null,
  nombre_series_prevues integer not null,
  reps_cibles text not null,
  charge_cible text not null,
  tempo text not null,
  reps_type text not null check (reps_type in ('REPS', 'DURATION')),
  temps_repos_sec integer not null,
  consigne_cle text not null,
  equipement text not null,
  avertissement text not null,
  instance_seance_id uuid,
  exercice_source_id uuid,
  is_bilateral boolean not null,
  progression_activee boolean not null,
  systeme_progression text,
  reps_min integer,
  reps_max integer,
  increment_kg double precision,
  increment_duree_sec integer not null,
  seuil_deload integer not null,
  type_exercice text check (type_exercice in ('COMPOSE_BAS', 'COMPOSE_HAUT', 'ISOLATION', 'MACHINE', 'PDC') or type_exercice is null),
  increment_pct double precision,
  is_bodyweight boolean not null
);
create trigger set_updated_at before update on exercices_seance
  for each row execute function set_updated_at();

create table instances_seance (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  seance_id uuid not null,
  date text not null,
  notes text not null,
  is_completed boolean not null,
  completed_at text,
  duration_seconds integer not null,
  created_at text not null
);
create trigger set_updated_at before update on instances_seance
  for each row execute function set_updated_at();

create table series_realisees (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  instance_seance_id uuid not null,
  exercice_seance_id uuid not null,
  numero_serie integer not null,
  reps_realisees integer,
  charge_kg double precision,
  charge_label text,
  rpe double precision,
  notes text not null,
  is_completed boolean not null
);
create trigger set_updated_at before update on series_realisees
  for each row execute function set_updated_at();

create table objectifs_progression (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  seance_id uuid not null,
  exercise_id uuid not null,
  charge_cible double precision,
  reps_cible integer,
  duree_cible_sec integer,
  compteur_echec integer not null,
  derniere_maj text,
  nombre_series_cible integer
);
create trigger set_updated_at before update on objectifs_progression
  for each row execute function set_updated_at();

create table user_settings (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  equipment_json text,
  panda_variant text not null default 'male' check (panda_variant in ('male', 'female')),
  dark_mode boolean not null default false
);
create trigger set_updated_at before update on user_settings
  for each row execute function set_updated_at();

-- Anti-duplication de la copie template -> instance (voir isolation template/instance) :
-- une seule ligne vivante par (instance, ligne source), y compris si deux appareils copient hors-ligne.
create unique index exercices_seance_instance_source_uniq
  on exercices_seance (instance_seance_id, exercice_source_id)
  where instance_seance_id is not null and deleted_at is null;
