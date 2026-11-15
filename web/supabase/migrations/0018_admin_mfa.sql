-- PandaMove web : double authentification obligatoire pour l'administration (à exécuter APRÈS 0001 à 0017).
-- Idempotente : peut être rejouée sans erreur (create or replace).
--
-- est_admin() exige désormais, en plus du rôle `app_metadata.role = 'admin'`, un jeton de niveau `aal2` : la session a passé le code à
-- 6 chiffres de l'application d'authentification (Supabase Auth, TOTP). Toutes les fonctions admin_* de 0016 et 0017 s'appuient sur est_admin()
-- et sont donc protégées d'un seul coup. Aucun changement de table.
--
-- ⚠ ORDRE DE DÉPLOIEMENT (sinon vous perdez l'accès à l'administration, sans perdre l'application) :
--   1) fusionner et déployer le client (Profil > « Double authentification » apparaît) ;
--   2) dans le profil, activer la double authentification avec votre application d'authentification, puis vous reconnecter (code demandé) ;
--   3) seulement alors, appliquer cette migration et redéployer la fonction admin-comptes (elle exige aussi aal2).
-- Si vous avez appliqué la migration trop tôt : activez la double authentification dans le profil (ça n'exige pas l'administration), reconnectez-vous
-- avec le code ; l'accès revient. Retour arrière : réexécuter la définition de est_admin() de la migration 0016.

begin;

create or replace function public.est_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     and coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;

commit;
