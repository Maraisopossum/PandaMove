# Fonction `analyser-assiette`

Estime le contenu nutritionnel d'une photo de repas avec un modèle de vision AU CHOIX de l'utilisateur : Claude (Anthropic), Gemini (Google) ou ChatGPT (OpenAI), parmi les services dont la clé est configurée. Appelée par l'écran « Photo de l'assiette » du module Nutrition avec le jeton de l'utilisateur connecté.

## Requêtes
`POST` JSON `{ action: 'fournisseurs' }` : rend `{ defaut, fournisseurs: [{ id, libelle, modele }] }` (jamais les clés). L'application n'affiche le choix que s'il y a plusieurs services.

### Analyse
`POST` JSON : `{ image: <base64 sans préfixe>, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', indication?: <texte, 200 caractères>, fournisseur?: 'anthropic' | 'gemini' | 'openai' }`
Sans `fournisseur` : `ANALYSE_FOURNISSEUR_DEFAUT`, sinon le premier configuré. Un service non configuré donne 400.
Réponse : `{ estUnRepas, aliments: [{ nom, quantiteG, kcal100, proteines100, glucides100, lipides100, fibres100, confiance }], remarque }`
Les valeurs sont **bornées et nettoyées** côté serveur (`analyse.ts`) ; l'application les montre modifiables avant toute écriture.

## Sécurité et coût
- Connexion obligatoire (jeton vérifié par la plateforme puis par `getUser`).
- Plafond par compte et par jour : 30 par défaut (`ANALYSES_PAR_JOUR`), compté dans `analyses_assiette` (migration `0020`) **avant** l'appel au modèle (un échec compte aussi).
- Photo limitée à 4 M caractères base64 ; le client la réduit à ≈ 200 Ko.
- La photo n'est ni stockée ni journalisée ; les clés des API ne quittent jamais la fonction (celle de Gemini passe en en-tête, jamais dans l'adresse). La photo part chez le service choisi : c'est dit à l'utilisateur sur l'écran. Le texte « précision » de l'utilisateur est transmis comme une indication, pas comme une consigne.

## Déploiement (à la main, dans cet ordre)
1. Migration `web/supabase/migrations/0020_nutrition.sql` (crée aussi `analyses_assiette`).
2. Secrets, au moins UNE clé (les trois si tu veux le choix) :
   ```bash
   npx supabase@latest secrets set ANTHROPIC_API_KEY=<clé> GEMINI_API_KEY=<clé> OPENAI_API_KEY=<clé>
   ```
   Facultatifs : `ANALYSE_MODELE_ANTHROPIC` (défaut `claude-sonnet-5-5`), `ANALYSE_MODELE_GEMINI` (défaut `gemini-3.8-flash`), `ANALYSE_MODELE_OPENAI` (défaut `gpt-4o`), `ANALYSE_FOURNISSEUR_DEFAUT`, `ANALYSES_PAR_JOUR`. Les modèles se changent par secret, sans redéployer.
3. `npx supabase@latest functions deploy analyser-assiette --use-api`
4. Fusionner le client.
Sans aucune clé, la fonction répond 503 « pas encore configurée » et l'application propose la saisie manuelle : rien d'autre n'est bloqué.

## Tests
`src/core/nutrition/fonctionAnalyserAssiette.test.ts` et `fournisseursIa.test.ts` (choix du service, requêtes et réponses de chaque fournisseur) : validation de la demande, nettoyage de la réponse, plafond, quota consommé même en cas d'échec.
