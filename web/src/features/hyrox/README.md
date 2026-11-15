# Module Hyrox

Préparation à la course Hyrox (8 × 1 km de course, chacun suivi d'une station). **La date de course est facultative** : on peut
chronométrer des simulations sans course prévue (compte à rebours et jour J apparaissent seulement si une date est fixée).

| Écran | Route | Contenu |
|---|---|---|
| Accueil | `/hyrox` | objectif, estimation (± 3 % d'après la référence ou la dernière simulation complète), simulation en cours, dernières simulations |
| Objectif | `/hyrox/objectif` | catégorie (Open, Pro), genre, date et lieu facultatifs, temps visé, part des courses (30 à 70 %, 55 % par défaut), répartition calculée |
| Stations | `/hyrox/stations` | les 8 stations, charge selon la catégorie et le genre, conseil, record, cible |
| Simulation | `/hyrox/simulation` | complète (16 segments), partielle (8) ou une station ; écran sombre gardé allumé, bouton « Segment suivant » de 72 px, bips |
| Bilan | `/hyrox/bilan/:id` | total, écart, dérive de course, écart par segment, forts et faibles, notes, référence |
| Records | `/hyrox/records` | meilleur temps par station, meilleur kilomètre, progression des simulations complètes |
| Détail d'une station | `/hyrox/stations/:cle` | charge, évolution des temps, points clés, erreurs fréquentes, simulation de cette station |
| Plan de préparation | `/hyrox/plan` | plan **entièrement réglable** (semaines de 2 à 52, 2 à 6 séances par semaine, affûtage 0 à 3 semaines, semaine allégée, simulations, début ou fin sur la date de course) ; recalculé à chaque réglage, seuls les réglages sont enregistrés (champ `plan` de `repartition_json` de l'objectif) |
| Jour J | `/hyrox/jour-j` | liste de préparation (gardée sur l'appareil), plan de course (partage, impression), résultat officiel par segment saisi à la main |

- Règles pures : `simulation.ts` (formes, répartition, bilan, records, formats), catalogue : `stations.ts` (jamais en base).
- Données : `core/db/repos/hyrox.ts`, tables `hyrox_courses`, `hyrox_simulations`, `hyrox_segments` (migration `0015_hyrox.sql`).
- Le chrono ne dépend d'aucune minuterie : un segment part de la fin du précédent (début de la simulation + temps déjà enregistrés), donc une simulation en cours se reprend après un rechargement. Pas de pause pour l'instant.
- **Charges officielles à vérifier avec le règlement de la saison** avant de s'y fier (elles changent parfois d'une saison à l'autre).
- Le résultat officiel est enregistré comme une simulation complète terminée (notes « Course officielle ») : records et estimation en profitent. Si les 16 temps sont saisis, le résultat de l'objectif est aussi renseigné.
- Agenda : « Appliquer à l'agenda » (page du plan) crée des séances de course titrées « Hyrox · … » (à venir seulement, réappliquer remplace les non faites, jamais les faites) ; le module Plans les écarte de son plan d'endurance (préfixe `PREFIXE_SEANCE_HYROX`).
- Pas encore fait : « Ajouter à ma semaine » depuis le détail d'une station, intégrations (agenda, sorties de course, rappels).
