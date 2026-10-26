-- Marqueur de progression par instance (récap de surcharge progressive) :
-- progression_json = { "evaluee": true, "decisions": { "<exerciceId>": "acceptee" | "refusee" | "ajustee" } }.
-- evaluee : l'évaluation de fin de séance (échecs simples) a été appliquée, une seule fois ;
-- decisions : choix Oui / Non / Ajuster enregistrés, jamais rejoués. NULL : pas encore évaluée
-- (instance planifiée, ou terminée avant cette migration).
alter table instances_seance add column progression_json text;
