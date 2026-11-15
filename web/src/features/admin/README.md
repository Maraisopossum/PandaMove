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
- **Actions** (`/admin/comptes`) : inviter, suspendre, rétablir, lien de réinitialisation, supprimer (adresse retapée). Elles passent par la fonction `supabase/functions/admin-comptes` (clé de service, rôle admin vérifié, garde-fous, journal d'audit) : voir son README pour le déploiement manuel.
- **Santé de la synchro** (`/admin/synchro`, migration `0017`) : le battement transporte aussi des **compteurs** d'envois rejetés définitivement (table + code d'erreur + nombre, jamais le contenu de la ligne) ; l'écran les regroupe et liste les comptes sans synchro depuis 7 jours ou plus. **Déconnexion forcée** : action « Déconnecter » (supprime les sessions du compte via `admin_revoquer_sessions`, réservée à la clé de service).
- **Double authentification (MFA)** : application d'authentification (TOTP, code à 6 chiffres) par Supabase Auth. Facultative pour tous (Profil > « Double authentification » : QR code puis code), elle ajoute une étape à la connexion (`GardeMfa`, lue dans la session locale : l'application démarre hors ligne). **Exigée pour l'administration** : `est_admin()` (migration `0018`) et la fonction `admin-comptes` demandent un jeton `aal2` ; `GardeAdmin` explique comment l'activer.
  **Ordre de déploiement** : 1) fusionner le client ; 2) activer la double authentification dans le profil et se reconnecter avec le code ; 3) seulement alors appliquer `0018_admin_mfa.sql` et redéployer `admin-comptes`. Appliquée trop tôt, la migration ne coupe que l'administration (jamais l'application) : activer la double authentification dans le profil suffit à la retrouver. Code perdu : retirer le facteur dans Supabase (Authentication > Users > compte > Factors).
- **Codes de secours** : 8 codes à usage unique (Profil > Double authentification), générés par la fonction `codes-secours` (migration `0019`). Sur l'écran du code à 6 chiffres, « Téléphone perdu ? » permet de saisir un code : il retire le second facteur, à réinscrire ensuite. Voir `supabase/functions/codes-secours/README.md`.
- **Pas encore fait** : une déconnexion forcée n'invalide pas le jeton d'accès déjà émis (une heure au plus).
