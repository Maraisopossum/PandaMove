# Audit de la WebApp PandaMove — 12 novembre 2026

Périmètre : code de `web/` sur `main` après la fusion des PR 34 (Mobilité) et 35 (chrono collant).
Non couvert : parcours de l'app connectée écran par écran (pas d'accès au compte), Lighthouse, scénarios
Playwright (jamais lancés en CI).

## Bilan

L'app est saine. Lint, typage et build passent sans erreur, et `npm audit --omit=dev` ne trouve aucune
vulnérabilité. 2 634 tests unitaires passent. La RLS est active sur toutes les tables, limitée au
propriétaire. Aucun `innerHTML` ni `eval`, aucun TODO. Le plus gros fichier source fait 562 lignes.

## Constats et suites données

| # | Constat | Gravité | Suite |
|---|---|---|---|
| 1 | `app.css` : 3 271 lignes (29 %) recopiées à l'identique, donc une retouche dans la 1re copie était écrasée par la 2e | Haute (maintenance) | Corrigé : 1re copie retirée, sans effet sur le rendu (la 2e l'emportait déjà). Le CSS livré ne baisse que de 0,7 Ko, car le minifieur dédoublonnait déjà |
| 2 | Précache PWA de 10,3 Mo, dont les 4 variantes du wasm SQLite alors que seule `wa-sqlite-async` est chargée (VFS IndexedDB, sans chiffrement) | Haute (installation, mises à jour) | Corrigé : 5,4 Mo. Images du panda et de la mobilité mises en cache à la première vue (hors ligne ensuite) |
| 3 | Tests instables : `ExecuteCircuit` en CI, `schema-rls` proche de la limite de 20 s | Moyenne | Corrigé : le test du circuit attend le démarrage réel ; `schema-rls` a un délai de 60 s |
| 4 | Aucun en-tête de sécurité HTTP (CSP, framing, referrer) | Moyenne | Corrigé : `web/public/_headers`, vérifié sous `wrangler dev` (wasm, workers et page OK). La connexion réelle reste à vérifier en production |
| 5 | Manifeste daté (« renforcement » seul, couleurs blanches provisoires) ; `index.html` sans description ni theme-color | Basse | Corrigé |
| 6 | CI Android lancée sur chaque PR alors que l'app est abandonnée | Basse | Corrigé : ignorée quand seuls `web/` ou `docs/` changent |
| 7 | Données conservées uniquement sur l'appareil (localStorage) : historique de mobilité, rappels, certains réglages | Basse | À décider : synchroniser ou assumer |
| 8 | Scénarios e2e Playwright absents de la CI (`cardio-agenda` jamais lancé) | Moyenne | Ouvert |
| 9 | `CLAUDE.md` et `docs/ai/` décrivent l'app Android | Basse | Corrigé : `CLAUDE.md` réécrit pour la WebApp, `web/README.md` à jour (migrations 0008 à 0011, Course/Vélo, Mobilité, en-têtes), `docs/ai/`, `AGENTS.md` et `DESIGN.md` racine marqués comme archive Android |
| 10 | Bundle initial : `index` 120 Ko gzip + client 91 Ko gzip + schémas zod 93 Ko préchargés | Basse | En partie corrigé : l'installation du catalogue (catalogue JSON + zod) est chargée à la demande, JS au démarrage 248 → 215 Ko gzip. Reste : modules Supabase inutilisés (realtime, storage, ~25 Ko gzip), à retirer seulement avec un test de connexion réel |
| 11 | 7 branches distantes fusionnées non supprimées | Ménage | À faire par Benoît |

## Points solides

- **Synchronisation** : les rejets définitifs du serveur sont écartés et signalés, sans bloquer la file d'envoi.
- **Accessibilité** : langue déclarée, zoom autorisé, focus visible partout où l'outline est retiré, `prefers-reduced-motion` respecté.
- **Chargement** : écrans chargés à la demande, décodeur FIT (294 Ko) chargé seulement à l'import.
