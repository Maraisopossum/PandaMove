# Fonction `analyser-assiette`

Estime le contenu nutritionnel d'une photo de repas avec un modèle de vision (API Anthropic). Appelée par l'écran « Photo de l'assiette » du module Nutrition avec le jeton de l'utilisateur connecté.

## Requête
`POST` JSON : `{ image: <base64 sans préfixe>, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', indication?: <texte, 200 caractères> }`
Réponse : `{ estUnRepas, aliments: [{ nom, quantiteG, kcal100, proteines100, glucides100, lipides100, fibres100, confiance }], remarque }`
Les valeurs sont **bornées et nettoyées** côté serveur (`analyse.ts`) ; l'application les montre modifiables avant toute écriture.

## Sécurité et coût
- Connexion obligatoire (jeton vérifié par la plateforme puis par `getUser`).
- Plafond par compte et par jour : 30 par défaut (`ANALYSES_PAR_JOUR`), compté dans `analyses_assiette` (migration `0020`) **avant** l'appel au modèle (un échec compte aussi).
- Photo limitée à 4 M caractères base64 ; le client la réduit à ≈ 200 Ko.
- La photo n'est ni stockée ni journalisée ; la clé de l'API ne quitte jamais la fonction. Le texte « précision » de l'utilisateur est transmis comme une indication, pas comme une consigne.

## Déploiement (à la main, dans cet ordre)
1. Migration `web/supabase/migrations/0020_nutrition.sql` (crée aussi `analyses_assiette`).
2. Secret : `npx supabase@latest secrets set ANTHROPIC_API_KEY=<clé>` (facultatifs : `ANALYSE_MODELE`, défaut `claude-sonnet-5-5` ; `ANALYSES_PAR_JOUR`).
3. `npx supabase@latest functions deploy analyser-assiette --use-api`
4. Fusionner le client.
Sans la clé, la fonction répond 503 « pas encore configurée » et l'application propose la saisie manuelle : rien d'autre n'est bloqué.

## Tests
`src/core/nutrition/fonctionAnalyserAssiette.test.ts` : validation de la demande, nettoyage de la réponse, plafond, quota consommé même en cas d'échec.
