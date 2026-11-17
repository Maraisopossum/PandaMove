# Module Nutrition

Journal alimentaire (énergie, protéines, glucides, lipides, eau), aliments personnels, objectifs, bilan, et **photo de l'assiette** analysée par un modèle de vision. Couleur du module : vert émeraude `#047857` (le `#059669` du design reste l'accent non textuel : texte blanc 3,8:1 seulement).

## Écrans (routes)
| Route | Écran | Rôle |
| --- | --- | --- |
| `/nutrition` | `NutritionScreen` | journal du jour (`?date=`) : anneau d'énergie, 3 jauges de macros, hydratation (+250/+500 ml, annuler), 4 repas, « Copier celui d'hier » |
| `/nutrition/ajouter` | `AjouterAlimentScreen` | `?repas=&date=` : fréquents, mes favoris, base intégrée, Open Food Facts (sur demande), code-barres (saisie ou caméra), saisie rapide |
| `/nutrition/photo` | `PhotoAssietteScreen` | photo → estimation → correction ligne par ligne → ajout au repas |
| `/nutrition/entree/:id` | `EntreeScreen` | corriger la quantité (macros recalculées en proportion), le repas, supprimer |
| `/nutrition/objectifs` | `ObjectifsNutritionScreen` | calculateur (Mifflin-St Jeor, activité, but) + objectifs modifiables |
| `/nutrition/bilan` | `BilanNutritionScreen` | 7 ou 30 jours : énergie par jour, moyennes sur les jours saisis, jours dans la cible (±10 %), eau |
| `/nutrition/aliments[/new|/:id]` | `MesAlimentsScreen`, `AlimentFormScreen` | catalogue personnel, favoris |

## Données
- Tables synchronisées (migration `0020`) : `aliments` (pour 100 g), `repas_entrees` (journal **et** eau : `repas = 'eau'`, `quantite_g` = ml), `objectifs_nutrition` (une ligne vivante par compte, `profil_json` = entrées du calculateur). Accès par `core/db/repos/nutrition.ts`.
- **Instantané** : une ligne du journal porte les valeurs de la *quantité mangée*. Modifier ou supprimer un aliment ne réécrit jamais l'historique.
- Table non synchronisée `analyses_assiette` : une ligne par analyse de photo (quota quotidien), accessible à la fonction seule.
- Export / import : les trois tables font partie du complément web de la sauvegarde.
- Base intégrée : `core/nutrition/baseAliments.ts` (≈ 85 aliments courants, valeurs moyennes, hors ligne). Règles de calcul : `core/nutrition/calculs.ts`.

## Photo de l'assiette
1. `reduireImage` (canvas) ramène la photo à 1 280 px, JPEG 80 % (≈ 200 Ko) **sur l'appareil**.
2. La fonction Supabase `analyser-assiette` (`supabase/functions/analyser-assiette/`) l'envoie au service d'IA choisi par l'utilisateur (Claude, Gemini ou ChatGPT, parmi les clés configurées ; le choix est mémorisé sur l'appareil, `pandamove.nutrition.ia`) avec un appel d'outil forcé `enregistrer_repas` et renvoie des aliments avec quantité et valeurs pour 100 g, plus un niveau de confiance.
3. L'écran montre les lignes **modifiables** (nom, quantité par pas de 10/50 g, retrait) : rien n'est écrit au journal avant « Ajouter ». Les lignes à confiance faible sont marquées « À vérifier » ; la matière grasse de cuisson est signalée comme incertaine.
4. La photo n'est ni conservée ni journalisée. Plafond de 30 analyses par compte et par jour (`ANALYSES_PAR_JOUR`).
Sans la fonction ou sans clé, l'écran explique que la photo n'est pas configurée et renvoie vers la saisie manuelle.

## Open Food Facts
Recherche texte et code-barres directement depuis le navigateur (`core/nutrition/openFoodFacts.ts`, CSP `connect-src` ouverte à `world.openfoodfacts.org`). Seul le texte ou le numéro quitte l'appareil, et seulement quand l'utilisateur lance la recherche. Un produit choisi peut être gardé dans « Mes aliments » (utilisable hors ligne ensuite). La caméra pour scanner n'existe que là où `BarcodeDetector` est disponible (Chrome Android surtout) ; ailleurs, on saisit le numéro. `Permissions-Policy` : `camera=(self)`.

## Décisions
- Pas de décompte « net » avec le sport : l'énergie dépensée par les séances n'est pas comptée (trop imprécise) ; l'activité entre dans le calcul de l'objectif.
- Les objectifs sont un point de départ : l'écran invite à ajuster selon l'évolution du poids (pas de suivi du poids dans l'application pour l'instant).
- Pas de micronutriments ni de score alimentaire : le journal reste rapide à remplir.

## Pas encore fait
Rappels de saisie, repas types (enregistrer un repas complet), lien avec l'accueil, suivi du poids.

## Illustrations du panda (refonte 2026-11-17)
Le journal est accompagné de dessins du panda faits avec Gemini (`gemini-3-pro-image`, master du personnage en référence, fond magenta détouré) : `nutri_petitdej`, `nutri_dejeuner`, `nutri_collation`, `nutri_diner` (un par repas), `nutri_eau` (hydratation), `nutri_photo` (analyse d'une photo), `nutri_objectif` (objectif atteint à 10 % près). Sources dans `assets/13_Nutrition/`, déclarées dans `scripts/build-images.mjs` (`npm run images`). `usePandaNutrition()` donne l'image de la variante du profil ; les images sont décoratives (`alt=""`).
- Suppression : un bouton « Supprimer » sur chaque ligne du journal, immédiat, avec « Annuler » pendant 8 s (`restaurerEntree` rétablit la ligne supprimée logiquement).
- Bilan : `bilanDuJour` (objectif atteint entre 90 % et 110 %, ton bienveillant au-dessus), `salutDuJour`, `messageEau` dans `outils.ts`.
- Les pictogrammes dessinés sont volontairement absents (seules les flèches du sélecteur de jour restent) : l'illustration porte le décor.
