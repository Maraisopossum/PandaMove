-- PandaMove web : historique de mobilité et réglages des rappels synchronisés (à exécuter APRÈS 0001 à 0011).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, add column if not exists, drop ... if exists).
--
-- Jusqu'ici ces données ne vivaient que dans le navigateur (localStorage) : perdues en changeant d'appareil.
--
-- 1) Table seances_mobilite : une ligne = une séance de mobilité menée jusqu'au bout.
--   date        : jour local au format yyyy-MM-dd (text, comme seances_respiration.date ; seul le format est vérifié).
--   duree_sec   : durée de la séance prévue (1 à 86400) ; exercices : nombre d'exercices (1 à 200).
--   zones       : zones du corps couvertes, texte JSON (tableau d'identifiants, 1000 caractères au plus).
--   sport       : séance type choisie ('course', 'velo', 'renforcement', 'bureau') ou NULL.
--   created_at  : horodatage ISO en text, posé par le client.
--
-- 2) Colonne user_settings.rappels_json : réglages des rappels de séance (veille / jour même, heures), texte JSON,
--    500 caractères au plus, NULL = jamais réglé. L'interrupteur général et la liste des rappels déjà envoyés restent
--    propres à chaque appareil (l'autorisation de notifier se donne appareil par appareil).
--    Un client qui écrit rappels_json avant cette migration reçoit PGRST204 : le connecteur renvoie alors la ligne sans
--    cette colonne (voir COLONNES_TOLEREES dans src/core/sync/connector.ts), la file d'envoi n'est pas bloquée.
--
-- Un rejet de contrainte (code 23514) est classé « définitif » par le connecteur de synchro : la ligne locale est
-- abandonnée. Le client valide donc les mêmes règles avant d'écrire ; ces contraintes ne sont qu'une seconde vérification.
--
-- Droits, RLS, rôle de réplication et publication PowerSync : mêmes règles et mêmes explications que 0008 et 0009.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration (lire les NOTICE) ; 2) règles de synchro PowerSync
-- (powersync/sync-rules.yaml, à recoller dans le tableau de bord PowerSync Cloud puis déployer) ; 3) nouveau client.
-- Un client qui écrit dans seances_mobilite avant la migration voit ses envois relancés sans fin (table inconnue) et
-- bloque la file d'envoi de l'appareil, renforcement compris.
-- Retour arrière : redéployer l'ancien client ; la table et la colonne restent en place, inertes.

begin;

alter table public.user_settings add column if not exists rappels_json text;
alter table public.user_settings drop constraint if exists user_settings_rappels_json_check;
alter table public.user_settings add constraint user_settings_rappels_json_check
  check (rappels_json is null or char_length(rappels_json) <= 500);

do $$
declare
  t text;
  r text;
  roles_accordes int := 0;
begin
  create table if not exists public.seances_mobilite (
    id uuid primary key,
    user_id uuid not null default auth.uid(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    duree_sec integer not null check (duree_sec between 1 and 86400),
    exercices integer not null check (exercices between 1 and 200),
    zones text not null default '[]' check (char_length(zones) <= 1000),
    sport text check (sport is null or sport in ('course', 'velo', 'renforcement', 'bureau')),
    created_at text not null
  );

  foreach t in array array['seances_mobilite'] loop
    execute format(
      'create index if not exists %I on public.%I (user_id, created_at) where deleted_at is null',
      t || '_user_created_idx', t
    );

    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );

    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprietaire', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_proprietaire', t
    );

    for r in
      select rolname from pg_roles
      where rolname = 'powersync_role' or (rolname like 'powersync\_%' and rolreplication)
    loop
      execute format('grant select on table public.%I to %I', t, r);
      roles_accordes := roles_accordes + 1;
    end loop;

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
    raise notice 'Aucun rôle de réplication PowerSync trouvé (powersync_role, ou powersync_<suffixe> avec réplication) : SELECT non accordé sur seances_mobilite. Accordez-le au rôle réel (voir l''en-tête de la migration 0008).';
  end if;
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    raise notice 'Publication powersync introuvable : vérifiez que seances_mobilite est couverte par la publication utilisée par PowerSync.';
  end if;
end;
$$;

commit;
