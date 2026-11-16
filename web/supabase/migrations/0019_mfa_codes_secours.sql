-- PandaMove web : codes de secours de la double authentification (à exécuter APRÈS 0001 à 0018).
-- Idempotente : peut être rejouée sans erreur.
--
-- Un compte qui perd son application d'authentification peut retirer son second facteur avec un code de secours à usage unique, sans passer par
-- un administrateur Supabase. Les codes sont générés et consommés par la fonction `codes-secours` (clé de service) ; seule l'empreinte (SHA-256
-- liée au compte) est conservée, jamais le code lui-même.
--   mfa_codes_secours           : une ligne par code (empreinte, date d'utilisation). Aucun accès direct pour les clients. Non synchronisée par
--                                 PowerSync (absente du schéma local et des règles).
--   mfa_codes_secours_restants(): nombre de codes encore utilisables du compte connecté (seul accès ouvert aux clients).
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) `supabase functions deploy codes-secours --use-api` ; 3) nouveau client.
-- Retour arrière : redéployer l'ancien client ; les objets restent en place, inertes (pas de `drop`).

begin;

create table if not exists public.mfa_codes_secours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null check (char_length(code_hash) = 64),
  utilise_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);

create index if not exists mfa_codes_secours_user_idx on public.mfa_codes_secours (user_id) where utilise_at is null;

revoke all on table public.mfa_codes_secours from anon;
revoke all on table public.mfa_codes_secours from authenticated;
alter table public.mfa_codes_secours enable row level security;

create or replace function public.mfa_codes_secours_restants() returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer from public.mfa_codes_secours where user_id = auth.uid() and utilise_at is null
$$;

revoke all on function public.mfa_codes_secours_restants() from public;
revoke all on function public.mfa_codes_secours_restants() from anon;
grant execute on function public.mfa_codes_secours_restants() to authenticated;

commit;
