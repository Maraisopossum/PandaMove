# Fonction `widget-nutrition`

Totaux du jour pour le **widget Android** de nutrition, et ajout d'eau depuis le widget. Le widget ne se connecte jamais avec le mot de passe ni la session de l'utilisateur :
il porte un **jeton** créé dans Profil > Widget Android, qui ne donne accès qu'à cette fonction.

## Requêtes
En-tête obligatoire : `Authorization: Bearer pmw_<64 caractères hexadécimaux>`.

`GET ?date=YYYY-MM-DD` : hier, aujourd'hui ou demain (date du serveur en UTC) seulement. Réponse (contrat v1, aucun nom d'aliment) :
```json
{ "v": 1, "date": "2026-11-15", "genereLe": "2026-11-15T12:40:03.000Z",
  "objectifs": { "kcal": 2400, "proteinesG": 150, "glucidesG": 280, "lipidesG": 75, "eauMl": 2500 },
  "consomme": { "kcal": 1240, "proteines": 98, "glucides": 148, "lipides": 41, "eauMl": 1250 },
  "repas": { "petit_dejeuner": 281, "dejeuner": 960, "collation": 0, "diner": 0 } }
```
`objectifs` vaut `null` sans objectif défini. L'eau n'entre ni dans `consomme.kcal` ni dans `repas`.

`POST { "date": "2026-11-15", "ml": 250, "cle": "<8 à 64 caractères A-Z a-z 0-9 _ ->" }` : ajoute de l'eau. Exige l'option « eau » sur le jeton. `ml` de 50 à 1 500, au plus
5 000 ml par jour. `cle` rend l'appel **idempotent** (un widget la génère à chaque appui, la renvoie telle quelle en cas de nouvel essai) :
`{ "v": 1, "ajoute": true, "eauMl": 1500 }` (`ajoute: false` si cet appel avait déjà été traité).

## Erreurs (corps `{ erreur, code }`)
| Statut | `code` | Sens |
| --- | --- | --- |
| 400 | `date_invalide`, `quantite_invalide`, `cle_invalide`, `demande_invalide` | requête mal formée |
| 401 | `jeton_invalide` | jeton absent, mal formé ou inconnu |
| 401 | `jeton_revoque` | révoqué dans le Profil : le widget efface son cache et propose de relier |
| 403 | `ecriture_refusee` | le jeton n'a pas l'option « eau » |
| 422 | `plafond_eau` | 5 000 ml atteints pour ce jour |
| 429 | `trop_vite` | une lecture toutes les 20 s au plus par jeton (`Retry-After: 20`) |

## Sécurité
- Seule l'empreinte SHA-256 du jeton est stockée (table `jetons_widget`, migration `0021`) ; le jeton n'est montré qu'une fois. Révocation immédiate, vérifiée à chaque appel.
- Chaque lecture est filtrée sur le `user_id` du jeton (clé de service côté fonction). Aucune lecture d'un autre jour que hier, aujourd'hui, demain.
- Aucun jeton n'est écrit dans les journaux. Réponses `Cache-Control: no-store`.

## Déploiement (à la main, dans cet ordre)
1. Migration `web/supabase/migrations/0021_jetons_widget.sql`.
2. `npx supabase@latest functions deploy widget-nutrition --no-verify-jwt --use-api` (**`--no-verify-jwt` obligatoire** : le jeton du widget n'est pas un JWT).
3. Fusionner le client (section « Widget Android » du Profil).

## Tests
`src/core/nutrition/fonctionWidget.test.ts` : jeton, dates, contrat, limites, idempotence ; migration sous PGlite dans `supabase/tests/schema-rls.test.ts`.
