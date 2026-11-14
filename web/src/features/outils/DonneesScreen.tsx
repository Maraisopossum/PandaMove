import { Link } from 'react-router'
import { MODULES_EXPORT, PERIODES_EXPORT, type FormatExport } from './exportCible'
import type { FrequenceRappel } from './rappelSauvegarde'
import { useDonnees } from './useDonnees'

const FREQUENCES: { id: FrequenceRappel; nom: string }[] = [
  { id: 'jamais', nom: 'Jamais' },
  { id: 'mois', nom: 'Tous les mois' },
  { id: 'trimestre', nom: 'Chaque trimestre' },
]
const FORMATS: { id: FormatExport; nom: string }[] = [
  { id: 'json', nom: 'JSON' },
  { id: 'csv', nom: 'CSV (tableur)' },
]

// Mes données : état de l'appareil et de la synchronisation, vérification d'intégrité, sauvegarde complète avec rappel,
// export d'une partie (modules, période, format) et lien vers l'import. Logique dans useDonnees.
export default function DonneesScreen() {
  const d = useDonnees()
  const { sauvegarde, cible } = d
  return (
    <div className="outils">
      <h1 className="titre-ecran">Mes données</h1>

      <section aria-labelledby="donnees-etat" className="donnees__section">
        <h2 id="donnees-etat">État de vos données</h2>
        {d.synchro && <p className="outils__etat outils__etat--ok">{d.synchro}</p>}
        {d.erreur && <p role="alert">{d.erreur}</p>}
        {d.comptes && (
          <ul className="outils__liste">
            <li>
              <span>Séances types</span>
              <strong>{d.comptes.seances}</strong>
            </li>
            <li>
              <span>Séances terminées</span>
              <strong>{d.comptes.seancesJouees}</strong>
            </li>
            <li>
              <span>Sorties course et vélo</span>
              <strong>{d.comptes.sorties}</strong>
            </li>
            <li>
              <span>Méthodes de respiration</span>
              <strong>{d.comptes.methodes}</strong>
            </li>
            {d.taille && (
              <li>
                <span>Espace utilisé sur l’appareil</span>
                <strong>{d.taille}</strong>
              </li>
            )}
          </ul>
        )}
        <button type="button" className="bouton" aria-busy={d.verification} disabled={d.verification} onClick={() => void d.verifier()}>
          Vérifier l’intégrité
        </button>
        <p className="aide">La vérification relit tout sur l’appareil et signale les séries orphelines ou les séances sans modèle ; elle ne modifie rien.</p>
        <p role="status" className="profil__retour">
          {d.integrite}
        </p>
      </section>

      <section aria-labelledby="donnees-sauvegarde" className="donnees__section">
        <h2 id="donnees-sauvegarde">Sauvegarde</h2>
        <p className={d.derniere && !d.rappel ? 'outils__etat outils__etat--ok' : 'outils__etat'}>
          {d.derniere ? `Dernière sauvegarde : ${d.derniere}` : 'Aucune sauvegarde faite depuis cet appareil.'}
        </p>
        {d.rappel && (
          <p className="donnees__rappel" role="note">
            {d.joursSansSauvegarde === null
              ? 'Vous n’avez pas encore de sauvegarde. Enregistrez-en une pour garder une copie hors de l’application.'
              : `Votre dernière sauvegarde date de ${d.joursSansSauvegarde} jours. Enregistrez-en une pour garder une copie hors de l’application.`}
          </p>
        )}
        <p className="aide">L'export JSON contient le renforcement (séances, séries, exercices, objectifs, matériel). Les sorties et la respiration n'y sont pas encore : « Exporter une partie » les couvre.</p>
        <button type="button" className="bouton bouton--principal" aria-busy={sauvegarde.enCours} disabled={sauvegarde.enCours} onClick={() => void sauvegarde.exporter()}>
          Exporter en JSON
        </button>
        <Link to="/import" className="bouton outils__lien">
          Importer une sauvegarde
        </Link>
        <p role="status" className="profil__retour">
          {sauvegarde.message}
        </p>
        {sauvegarde.erreur && <p role="alert">{sauvegarde.erreur}</p>}

        <fieldset className="donnees__choix">
          <legend>Me rappeler de sauvegarder</legend>
          <div className="outils__periodes">
            {FREQUENCES.map((f) => (
              <button key={f.id} type="button" className="outils__periode" aria-pressed={d.frequence === f.id} onClick={() => d.changerFrequence(f.id)}>
                {f.nom}
              </button>
            ))}
          </div>
          <p className="aide">Le rappel s’affiche ici, sur cet appareil seulement.</p>
        </fieldset>
      </section>

      <section aria-labelledby="donnees-partie" className="donnees__section">
        <h2 id="donnees-partie">Exporter une partie</h2>
        <fieldset className="donnees__choix">
          <legend>Quoi</legend>
          {MODULES_EXPORT.map((m) => (
            <label key={m.id} className="formulaire__case">
              <input type="checkbox" checked={cible.modules.includes(m.id)} onChange={() => cible.basculerModule(m.id)} />
              {m.nom}
            </label>
          ))}
        </fieldset>
        <fieldset className="donnees__choix">
          <legend>Période</legend>
          <div className="outils__periodes">
            {PERIODES_EXPORT.map((p) => (
              <button key={p.id} type="button" className="outils__periode" aria-pressed={cible.periode === p.id} onClick={() => cible.setPeriode(p.id)}>
                {p.nom}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="donnees__choix">
          <legend>Format</legend>
          <div className="outils__periodes">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" className="outils__periode" aria-pressed={cible.format === f.id} onClick={() => cible.setFormat(f.id)}>
                {f.nom}
              </button>
            ))}
          </div>
          <p className="aide">Un export partiel sert à analyser ou partager ; il ne se réimporte pas. Les traces GPS n’y figurent pas.</p>
        </fieldset>
        <p className="aide" aria-live="polite">
          {cible.modules.length === 0 ? 'Choisissez au moins un module.' : cible.apercu ? `Export prévu : ${cible.apercu}.` : ''}
        </p>
        <button type="button" className="bouton bouton--principal" disabled={cible.modules.length === 0} onClick={() => void cible.exporter()}>
          Exporter la sélection
        </button>
        <p role="status" className="profil__retour">
          {cible.message}
        </p>
        {cible.erreur && <p role="alert">{cible.erreur}</p>}
      </section>
    </div>
  )
}
