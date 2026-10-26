-- PandaMove web : renommer une séance jouée et noter un exercice (à exécuter APRÈS 0001 à 0006).
-- Idempotente : peut être rejouée sans erreur (add column if not exists).
--
--   instances_seance.nom     : nom propre de LA SÉANCE JOUÉE (menu « Modifier le nom » de l'exécution). NULL = nom du
--                              modèle. Le modèle (seances.nom) n'est jamais modifié par un renommage (isolation
--                              template / instance).
--   exercices_seance.notes   : note libre de l'utilisateur sur un exercice, saisie pendant la séance. Écrite sur la
--                              ligne D'INSTANCE uniquement, jamais copiée depuis le modèle. NULL = aucune note.
--
-- Colonnes nullables sans défaut : aucune ligne existante n'est réécrite, la RLS et les droits (0006) s'appliquent
-- déjà à ces tables. La publication PowerSync (sans liste de colonnes) les inclut d'office.
alter table public.instances_seance add column if not exists nom text;
alter table public.exercices_seance add column if not exists notes text;
