-- PandaMove web : unités de mesure des aliments et quantité saisie du journal (à exécuter APRÈS 0001 à 0021).
-- Idempotente : peut être rejouée sans erreur.
--
-- On compte comme on mange : à la pièce, au verre, à la cuillère ou au poids.
--   aliments.unite_base     : 'g' (valeurs pour 100 g) ou 'ml' (valeurs pour 100 ml). Jamais de conversion entre les deux.
--   aliments.mesures_json   : liste JSON des mesures de l'aliment, chacune ramenée à la base :
--                             [{"id":"oeuf","libelle":"œuf","pluriel":"œufs","base":60}, …]. La première est proposée par défaut.
--                             Reprise : un aliment existant reçoit une mesure « portion » tirée de portion_g / portion_label.
--   repas_entrees.quantite_saisie, unite_saisie : ce que l'utilisateur a saisi (2 et « oeuf »), à côté de quantite_g, qui reste la
--                             quantité de base (g ou ml) utilisée pour les calculs. Nulles pour les entrées existantes (affichées en grammes).
-- Les deux tables sont déjà synchronisées (sync-rules : SELECT *) : rien à changer côté PowerSync.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) nouveau client. Un ancien client ignore les nouvelles colonnes.
-- Retour arrière : redéployer l'ancien client ; les colonnes restent en place, inertes.

begin;

alter table public.aliments
  add column if not exists unite_base text not null default 'g' check (unite_base in ('g', 'ml'));
alter table public.aliments
  add column if not exists mesures_json text check (char_length(mesures_json) <= 4000);

alter table public.repas_entrees
  add column if not exists quantite_saisie real check (quantite_saisie >= 0 and quantite_saisie <= 20000);
alter table public.repas_entrees
  add column if not exists unite_saisie text check (char_length(unite_saisie) between 1 and 40);

-- Reprise des portions : une mesure « portion » pour chaque aliment qui en déclarait une (libellé ou portion différente de 100 g)
update public.aliments
set mesures_json = json_build_array(
      json_strip_nulls(json_build_object('id', 'portion', 'libelle', 'portion', 'pluriel', 'portions', 'base', portion_g, 'detail', portion_label))
    )::text
where mesures_json is null
  and (portion_label is not null or portion_g <> 100);

commit;
