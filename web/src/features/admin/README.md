# Administration technique

Étape 1 de la réflexion `docs/superpowers/specs/2026-11-14-pandamove-mode-administrateur-reflexion.md` : **métadonnées des comptes seulement**,
aucun accès au contenu (séances, poids, sorties, traces, notes restent protégés par leur RLS).

- **Rôle** : `app_metadata.role = 'admin'` du JWT, posé à la main dans Supabase (Authentication > Users > compte > Raw app meta data :
  `{"role": "admin"}`), puis se reconnecter. `estAdmin(session)` ne sert qu'à masquer l'entrée du profil et à rediriger (`GardeAdmin`) ;
  le vrai contrôle est celui des fonctions serveur, qui refusent tout compte sans le rôle.
- **Données** (migration `0016_administration.sql`, non synchronisées par PowerSync) : `profils` (statut, dernière connexion, dernière synchro,
  version), `journal_admin` (insertion seulement, déclencheur qui refuse toute modification), fonctions `enregistrer_battement`, `admin_lister_comptes`,
  `admin_resume`, `admin_lire_journal`.
- **Battement** (`core/admin/useBattement.ts`) : à l'ouverture puis après une synchro réussie (au plus toutes les 15 minutes), l'application envoie sa
  version (empreinte du commit, `__APP_VERSION__` de `vite.config.ts`) et l'heure. Rien d'autre. Annoncé dans le profil (« Confidentialité »).
- **Écrans** (chargés à la demande, redirigés sans rôle) : `/admin` (compteurs, versions), `/admin/comptes` (liste filtrable), `/admin/journal`.
- **Pas encore fait** : actions (inviter, suspendre, réinitialiser, supprimer avec export préalable) via une Edge Function à clé de service ;
  santé de la synchro ; MFA pour le compte administrateur.
