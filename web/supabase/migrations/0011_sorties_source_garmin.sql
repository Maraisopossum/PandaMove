-- PandaMove web : la source d'une sortie peut aussi être 'garmin' (fichiers FIT exportés de Garmin Connect).
-- À exécuter APRÈS 0010. Idempotente : peut être rejouée sans erreur.
--
-- 0010 limitait `sorties.source` à 'manuel', 'suunto' et 'mywoosh'. Un fichier Garmin importé serait rejeté par la
-- contrainte (code 23514, classé « définitif » par le connecteur de synchro : la ligne locale serait abandonnée).
-- Cette migration remplace la contrainte par une version qui accepte aussi 'garmin'. Aucune donnée n'est modifiée.
--
-- ORDRE DE DÉPLOIEMENT : 1) cette migration ; 2) ensuite seulement le client qui sait importer les fichiers Garmin.
-- Retour arrière : redéployer l'ancien client (les lignes 'garmin' déjà écrites resteraient valides côté serveur).

begin;

alter table public.sorties drop constraint if exists sorties_source_check;
alter table public.sorties
  add constraint sorties_source_check check (source in ('manuel', 'suunto', 'mywoosh', 'garmin'));

commit;
