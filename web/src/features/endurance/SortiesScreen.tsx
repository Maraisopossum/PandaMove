import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import type { Sport } from '../../core/db/repos/sorties'
import { CHEMIN_SPORT } from './chemins'
import { distanceKm, formaterDateCourte, formaterDuree, formaterRythme } from './presentation'
import { StatsSortiesBloc } from './StatsSortiesBloc'
import { MiniTrace } from './MiniTrace'
import { LienSeanceImport } from './importFit/LienSeanceImport'
import { useImportFit } from './importFit/useImportFit'
import { useSorties } from './useSorties'

const trace = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

// Liste des sorties d'un sport (`/running` ou `/cycling`), les plus récentes d'abord. Chaque carte : titre et date, puis
// la distance en grand, la durée et le rythme (allure ou vitesse) ; le reste est dans le détail.
export default function SortiesScreen({ sport }: { sport: Sport }) {
  const { session } = useAuth()
  const panda = useImagePanda(sport === 'course' ? 'course' : 'velo', { userId: session?.user.id, taille: 'lg' })
  const { sorties, charge, erreur, recharger } = useSorties(sport)
  const importFit = useImportFit({ apres: () => void recharger() })
  const chemin = CHEMIN_SPORT[sport]
  return (
    <div className={`sorties sorties--${sport}`}>
      <header className="sorties__hero">
        <h1 className="titre-ecran">{sport === 'course' ? 'Course à pied' : 'Vélo'}</h1>
        <PandaIllustration image={panda} sizes="96px" decoratif className="sorties__panda" />
      </header>
      <div className="sorties__actions-haut">
        <Link to={`${chemin}/new`} className="sorties__ajout">
          <svg width="18" height="18" viewBox="0 0 24 24" {...trace} strokeWidth={2.4} aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Ajouter une sortie
        </Link>
        <label className="sorties__import">
          <input
            type="file"
            accept=".fit,.zip"
            multiple
            disabled={importFit.enCours}
            aria-label="Importer des fichiers FIT ou zip (Suunto, Garmin, MyWoosh)"
            onChange={(e) => {
              const fichiers = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (fichiers.length > 0) void importFit.importer(fichiers)
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" {...trace} strokeWidth={2.2} aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          <span>{importFit.enCours ? 'Import…' : 'Importer'}</span>
        </label>
      </div>
      {importFit.erreurLien && <p role="alert">{importFit.erreurLien}</p>}
      {importFit.resultats.length > 0 && (
        <ul className="sorties__import-resultats">
          {importFit.resultats.map((r) => (
            <li key={r.nom} className={`sorties__import-resultat sorties__import-resultat--${r.etat}`}>
              <p role="status" className="sorties__import-message">
                <strong>{r.nom}</strong> : {r.message}
                {r.etat === 'importee' && r.sport !== undefined && r.sport !== sport && ' (dans l’autre sport)'}
              </p>
              <LienSeanceImport resultat={r} onLier={importFit.lier} />
            </li>
          ))}
        </ul>
      )}

      {charge && !erreur && <StatsSortiesBloc sorties={sorties} />}

      {erreur && <p role="alert">{erreur}</p>}
      {!charge && !erreur && <p role="status">Chargement…</p>}
      {charge && !erreur && sorties.length === 0 && (
        <div className="sorties__vide">
          <span className="sorties__vide-icone" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" {...trace}>
              <circle cx="6" cy="18" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" />
            </svg>
          </span>
          <p className="sorties__vide-titre">Aucune sortie pour l’instant</p>
          <p className="aide">
            {sport === 'course'
              ? 'Enregistre ta première course : distance, durée et fréquence cardiaque suffisent pour commencer.'
              : 'Enregistre ta première sortie : distance et durée suffisent pour commencer.'}
          </p>
        </div>
      )}

      <ul className="sorties__liste">
        {sorties.map((s) => {
          const rythme = formaterRythme(s)
          return (
            <li key={s.id}>
              <Link to={`${chemin}/${s.id}`} className="sorties__carte">
                <MiniTrace sortie={s} />
                <span className="sorties__corps">
                <span className="sorties__ligne">
                  <span className="sorties__titre">{s.titre}</span>
                  <span className="sorties__date">{formaterDateCourte(s.date)}</span>
                </span>
                <span className="sorties__chiffres">
                  <span className="sorties__distance">
                    {s.distanceM !== null ? (
                      <>
                        <span className="visuellement-cache">Distance : </span>
                        {distanceKm(s.distanceM)}
                        <span className="sorties__unite">km</span>
                      </>
                    ) : (
                      <span className="visuellement-cache">Distance non renseignée</span>
                    )}
                  </span>
                  <span className="sorties__secondaires">
                    {s.dureeS !== null && (
                      <span>
                        <span className="visuellement-cache">Durée : </span>
                        {formaterDuree(s.dureeS)}
                      </span>
                    )}
                    {s.fcMoy !== null && (
                      <span>
                        <span className="visuellement-cache">Fréquence cardiaque : </span>
                        {s.fcMoy} bpm
                      </span>
                    )}
                    {rythme && (
                      <span>
                        <span className="visuellement-cache">{sport === 'course' ? 'Allure' : 'Vitesse'} : </span>
                        {rythme}
                      </span>
                    )}
                  </span>
                </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
