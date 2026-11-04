# Respiration Blueprint

## System Overview

Module Respiration de PandaMove, repris de l'application Android (`feature/breathing`) : choix d'une méthode, réglage de la durée, séance guidée (décompte, cercle, sons, pause), fin de séance, historique. Les écrans lisent et écrivent la base locale PowerSync via `core/db` ; la synchronisation est assurée ailleurs.

## Local Interface & Invariants

- **Écrans (export default)** : `RespirationScreen` (`/breathing` : liste des méthodes, historique), `MethodeFormScreen` (`/breathing/new` et `/breathing/:id/edit`), `SessionScreen` (`/breathing/session/:id/:cycles`).
- **Hooks** : `useRespiration` (liste, historique, suppressions), `useChoixDuree` (méthode dépliée, mode cycles / minutes), `useMethodeForm`, `useMethodeSession` (méthode de l'URL), `useSessionRespiration` (décompte, séance, pause, enregistrement), `useVeilleEcran` (écran allumé).
- **Logique pure** : `moteur.ts` (`etatA(config, ecouleMs)`, phases, cercle), `methodes.ts` (catalogue intégré, conversions durée ↔ cycles), `presentation.ts`. Aucun SQL dans cette feature : tout passe par `core/db/repos/respiration.ts`.
- **Invariants** :
  - L'état d'une séance se déduit du **temps de respiration écoulé** (hors pauses), jamais d'un compteur de ticks : un onglet ralenti ne fait pas dériver la séance.
  - Les phases à durée 0 n'existent pas ; l'ordre est inspiration → rétention pleine → expiration → rétention vide.
  - Une séance n'est enregistrée qu'une fois, et seulement si elle va jusqu'au bout. Sa durée est celle de la respiration (pauses exclues), arrondie à la seconde. Android comptait aussi les pauses.
  - Les méthodes intégrées vivent dans le code (non modifiables, non synchronisées) ; seules les personnalisées sont en base. L'historique garde le nom de la méthode et survit à sa suppression (pas de clé étrangère).
  - Le son démarre sur un geste de l'utilisateur (`preparerAudio` au clic sur « Démarrer ») : les navigateurs refusent l'audio sans geste.
  - Le chiffre du cercle prend une couleur lisible sur chaque couleur de phase (`INFOS_PHASE.texte`).
  - Les suppressions sont logiques (`deleted_at`).

## Données et synchronisation

Deux tables créées par `web/supabase/migrations/0009_respiration.sql`, déclarées dans `core/db/schema.ts` et listées dans `web/powersync/sync-rules.yaml` (`core/db/coherenceTables.test.ts` vérifie que ces listes concordent). **Ordre de déploiement** : 1) la migration, 2) la vérification de la publication et du rôle de réplication (messages NOTICE), 3) les règles de synchro PowerSync, 4) le nouveau client. Un client qui écrit avant la migration voit ses envois relancés sans fin. Retour arrière : redéployer l'ancien client ; les tables restent en place, inertes.
