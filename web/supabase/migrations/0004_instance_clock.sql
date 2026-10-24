-- Horloge de la séance en cours, stockée dans l'instance pour survivre au rechargement de la page :
-- started_at = instant du « Démarrer » ; paused_json = tableau JSON [{ "fromMs": n, "toMs": n | null }]
-- (epoch ms, une pause ouverte a toMs null). Le temps écoulé est toujours recalculé depuis ces horodatages.
alter table instances_seance add column started_at timestamptz;
alter table instances_seance add column paused_json text;
