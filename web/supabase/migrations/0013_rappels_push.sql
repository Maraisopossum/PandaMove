-- PandaMove web : rappels de séance par notification push, même application fermée (à exécuter APRÈS 0001 à 0012).
-- Idempotente : peut être rejouée sans erreur (create ... if not exists, drop ... if exists avant create).
--
-- Deux tables, volontairement HORS synchronisation PowerSync (rien dans powersync/sync-rules.yaml, rien dans le schéma local) :
-- elles ne servent qu'au serveur d'envoi (fonction `envoyer-rappels`, voir web/supabase/functions/envoyer-rappels/README.md).
--
-- push_abonnements : un abonnement Web Push par appareil et par navigateur.
--   endpoint  : adresse du service push du navigateur (unique : un appareil = une ligne).
--   cle_p256dh, cle_auth : clés de chiffrement de l'abonnement (fournies par le navigateur).
--   fuseau    : fuseau horaire IANA de l'appareil (« Europe/Paris ») : les heures de rappel sont des heures locales.
--   Le client écrit et supprime SES lignes (RLS : propriétaire seulement). Contrairement aux tables synchronisées, la
--   suppression physique est accordée : se désabonner efface la ligne, et le serveur supprime lui-même un abonnement que le
--   service push déclare expiré.
--
-- rappels_push_envoyes : mémoire anti-doublon du serveur (un rappel = une clé par abonnement). Aucun accès pour les clients
--   (RLS activée, aucune politique, aucun droit) : seule la fonction, avec la clé de service, y lit et écrit.
--
-- Un client qui s'abonne avant cette migration reçoit une erreur « table inconnue » : l'écran Rappels l'affiche, rien d'autre
-- n'est touché (aucune file d'envoi PowerSync n'est concernée, les écritures se font directement vers Supabase).
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) secrets et fonction (README de la fonction) ; 3) tâche planifiée ; 4) variable
-- de build VITE_VAPID_PUBLIC_KEY puis nouveau client (sans elle, l'option n'apparaît pas dans l'application).
-- Retour arrière : retirer la tâche planifiée ; les tables restent en place, inertes.

begin;

create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  endpoint text not null check (char_length(endpoint) between 20 and 2048),
  cle_p256dh text not null check (char_length(cle_p256dh) between 1 and 256),
  cle_auth text not null check (char_length(cle_auth) between 1 and 256),
  fuseau text not null default 'Europe/Paris' check (char_length(fuseau) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_abonnements_endpoint_uniq on public.push_abonnements (endpoint);
create index if not exists push_abonnements_user_idx on public.push_abonnements (user_id);

-- updated_at maintenu par le serveur (fonction définie en 0001)
drop trigger if exists set_updated_at on public.push_abonnements;
create trigger set_updated_at before update on public.push_abonnements
  for each row execute function public.set_updated_at();

revoke all on table public.push_abonnements from anon;
revoke all on table public.push_abonnements from authenticated;
grant select, insert, update, delete on table public.push_abonnements to authenticated;

alter table public.push_abonnements enable row level security;
drop policy if exists push_abonnements_proprietaire on public.push_abonnements;
create policy push_abonnements_proprietaire on public.push_abonnements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.rappels_push_envoyes (
  user_id uuid not null,
  cle text not null check (char_length(cle) between 1 and 400),
  envoye_le timestamptz not null default now(),
  primary key (user_id, cle)
);

create index if not exists rappels_push_envoyes_date_idx on public.rappels_push_envoyes (envoye_le);

revoke all on table public.rappels_push_envoyes from anon;
revoke all on table public.rappels_push_envoyes from authenticated;
alter table public.rappels_push_envoyes enable row level security;
drop policy if exists rappels_push_envoyes_aucun on public.rappels_push_envoyes;

commit;
