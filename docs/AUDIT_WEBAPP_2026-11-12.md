# Audit de la WebApp PandaMove — 12 novembre 2026

Périmètre : code de `web/` sur `main` après la fusion des PR 34 (Mobilité) et 35 (chrono collant).
Non couvert au moment de l'audit : parcours de l'app connectée écran par écran (pas d'accès au compte), Lighthouse,
scénarios Playwright (jamais lancés).

**État au soir du 12 novembre : les 11 constats sont traités** (PR 36 à 46, toutes fusionnées). Un seul point reste à
vérifier à la main : la politique de sécurité (CSP) sur le site déployé (constat 4).

## Bilan

L'app est saine. Lint, typage et build passent sans erreur, et `npm audit --omit=dev` ne trouve aucune vulnérabilité.
La RLS est active sur toutes les tables, limitée au propriétaire. Aucun `innerHTML` ni `eval`, aucun TODO. Le plus gros
fichier source fait 562 lignes.

| Mesure | Avant l'audit | Après les corrections |
|---|---|---|
| Tests unitaires | 2 634 | 2 668 |
| Scénarios de bout en bout en CI | 0 | 6, sur chaque PR qui touche `web/` |
| JS téléchargé avant le premier affichage (gzip) | 248 Ko | 189 Ko (−24 %) |
| Cache hors ligne installé (précache PWA) | 10,3 Mo | 5,4 Mo |
| `app.css` | 11 342 lignes, dont 3 271 en double | 8 090 lignes |

## Constats et suites données

| # | Constat | Gravité | Suite | PR |
|---|---|---|---|---|
| 1 | `app.css` : 3 271 lignes (29 %) recopiées à l'identique, donc une retouche dans la 1re copie était écrasée par la 2e | Haute (maintenance) | Corrigé : 1re copie retirée, sans effet sur le rendu (la 2e l'emportait déjà). Le CSS livré ne baisse que de 0,7 Ko, car le minifieur dédoublonnait déjà | 36 |
| 2 | Précache PWA de 10,3 Mo, dont les 4 variantes du wasm SQLite alors que seule `wa-sqlite-async` est chargée (VFS IndexedDB, sans chiffrement) | Haute (installation, mises à jour) | Corrigé : 5,4 Mo. Images du panda et de la mobilité mises en cache à la première vue (hors ligne ensuite) | 36 |
| 3 | Tests instables : `ExecuteCircuit` en CI, `schema-rls` proche de la limite de 20 s | Moyenne | Corrigé : les tests du circuit attendent le démarrage et les écritures en base ; `schema-rls` a un délai de 60 s. Le test du récap de progression, devenu instable après la PR 43, attend désormais le focus et le piège du dialogue | 36, 42, 46, 47 |
| 4 | Aucun en-tête de sécurité HTTP (CSP, framing, referrer) | Moyenne | Corrigé : `web/public/_headers`, vérifié sous `wrangler dev` (wasm, workers et page OK). **À vérifier sur le site déployé** : les e2e tournent sur `vite preview`, qui ne sert pas `_headers`, donc ils ne testent pas la CSP | 36 |
| 5 | Manifeste daté (« renforcement » seul, couleurs blanches provisoires) ; `index.html` sans description ni theme-color | Basse | Corrigé | 36 |
| 6 | CI Android lancée sur chaque PR alors que l'app est abandonnée | Basse | Corrigé : ignorée quand seuls `web/` ou `docs/` changent ; branche `sauvegarde-panda-stable` retirée de ses déclencheurs | 36, 41 |
| 7 | Données conservées uniquement sur l'appareil (localStorage) : historique de mobilité, rappels, certains réglages | Basse | Corrigé (migration 0012, appliquée) : historique de mobilité (table `seances_mobilite`, reprise unique de l'ancien historique) et heures des rappels synchronisés. L'interrupteur des rappels reste par appareil (l'autorisation de notifier se donne appareil par appareil) | 40 |
| 8 | Scénarios e2e Playwright absents de la CI (`cardio-agenda` jamais lancé) | Moyenne | Corrigé : workflow `e2e.yml` sur le vrai Supabase avec deux comptes de test (secrets GitHub), 6 scénarios verts. Dépôt public : ni trace ni rapport HTML publiés, seulement les captures d'écran des échecs | 42, 44 |
| 9 | `CLAUDE.md` et `docs/ai/` décrivent l'app Android | Basse | Corrigé : `CLAUDE.md` réécrit pour la WebApp, `web/README.md` à jour, `docs/ai/`, `AGENTS.md` et `DESIGN.md` racine marqués comme archive Android | 37 |
| 10 | Bundle initial : `index` 120 Ko gzip + client 91 Ko gzip + schémas zod préchargés | Basse | Corrigé : installation du catalogue (JSON + zod) chargée à la demande (248 → 215 Ko), puis client Supabase allégé (`auth-js` + `postgrest-js`, sans temps réel, stockage ni fonctions ; même clé de session) : 215 → 189 Ko | 38, 45 |
| 11 | Branches distantes fusionnées non supprimées | Ménage | Corrigé : toutes supprimées, seule reste `main` | — |

## Défaut trouvé pendant les corrections

Le premier passage réel des e2e a révélé un défaut de l'app. Sur un appareil neuf, une séance de renforcement ouverte
par un lien direct, avant la fin de la première synchronisation, restait « Séance introuvable » tant qu'on ne rechargeait
pas la page. L'exécution, la correction et le rapport attendent maintenant la fin de cette synchronisation avant de lire
la séance. Le scénario `strength-flow` le vérifie sans rechargement (PR 43, 44).

## Hors audit, même journée

- Heatmap musculaire : découpage corrigé, surtout pour la version féminine. Un muscle peut maintenant figurer sur les deux
  vues (PR 47).
- Panda de l'en-tête Course / Vélo replacé dans la carte (PR 39).

## Points solides

- **Synchronisation** : les rejets définitifs du serveur sont écartés et signalés, sans bloquer la file d'envoi.
- **Isolation entre comptes** : vérifiée sur le vrai Supabase à chaque PR (scénario `rls-live`), dans la base comme dans l'app.
- **Accessibilité** : langue déclarée, zoom autorisé, focus visible partout où l'outline est retiré, `prefers-reduced-motion` respecté.
- **Chargement** : écrans chargés à la demande, décodeur FIT (294 Ko) chargé seulement à l'import.
