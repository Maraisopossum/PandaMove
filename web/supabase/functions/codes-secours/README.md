# Fonction `codes-secours`

Codes de secours à usage unique de la double authentification (TOTP).

| Action | Qui | Effet |
| --- | --- | --- |
| `generer` | session qui a passé le code à 6 chiffres (`aal2`) | crée 8 codes, remplace les précédents, renvoie les codes en clair **une seule fois** |
| `utiliser` | connexion par mot de passe seule (`aal1`) | consomme un code et retire le second facteur du compte (le client rafraîchit ensuite la session) |

## Sécurité
- Seule l'empreinte SHA-256 `user_id:CODE` est stockée (table `mfa_codes_secours`, migration `0019`, sans accès direct pour les clients).
- Un code = 10 caractères d'un alphabet de 32 symboles (50 bits), sans caractère ambigu.
- Un code ne sert qu'une fois (mise à jour conditionnelle `utilise_at is null`, sûre en cas d'appels simultanés).
- Utiliser un code retire la double authentification : l'utilisateur la réinscrit dans le profil (et génère de nouveaux codes).
- Limite connue : pas de plafond d'essais par compte (50 bits rendent une attaque en ligne irréaliste ; à ajouter si besoin).

## Déploiement (à la main)
1. Exécuter `web/supabase/migrations/0019_mfa_codes_secours.sql`.
2. `npx supabase@latest functions deploy codes-secours --use-api`
3. Fusionner le client (sinon l'écran de code de secours n'existe pas encore).

Secrets : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par la plateforme.
