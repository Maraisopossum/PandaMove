import { useEffect, useRef, type ChangeEvent } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { TABLES_COMPLEMENT } from '../../core/export/complementWeb'
import { libelleComplement } from '../../core/import/complementWeb'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import ImportIaPanel from './ImportIaPanel'
import { useSourceSynchro } from '../calendar/seancesCardio/useSourceSynchro'
import ImportProgrammePanel from './ImportProgrammePanel'
import { useImport } from './useImport'
import { idOnglet, idPanneau, useOngletsImport, type OngletImport } from './useOngletsImport'

const AVERTISSEMENT =
  "Le contenu du fichier remplace les éléments correspondants déjà présents (sauvegarde PandaMove de ce compte, ou " +
  "export Android déjà importé) ; les autres éléments sont ajoutés. Réimporter le même fichier ne crée pas de doublon."

// Branche l'onglet « Programme 2027 » sur la synchronisation réelle. Séparé de l'écran pour que les autres onglets ne
// lisent pas l'état de synchronisation.
function PanneauProgramme({ userId }: { userId?: string }) {
  return <ImportProgrammePanel userId={userId} synchro={useSourceSynchro()} />
}

const ONGLETS: { id: OngletImport; libelle: string }[] = [
  { id: 'android', libelle: 'Export Android' },
  { id: 'ia', libelle: 'Séances créées par une IA' },
  { id: 'programme', libelle: 'Programme 2027' },
]

// Écran d'import : export JSON PandaFit (Android, logique dans useImport), séances créées par une IA (ImportIaPanel)
// ou programme de cardio 2027 (ImportProgrammePanel).
export default function ImportScreen() {
  const { session } = useAuth()
  const panda = useImagePanda('pose_sitting', { userId: session?.user.id, taille: 'sm' })
  const { preview, error, load, confirm, status, resultat, reset } = useImport({ userId: session?.user.id })
  const zoneResultat = useRef<HTMLDivElement>(null)
  const { onglet, setOnglet, surTouche } = useOngletsImport()

  // Le focus suit le résultat (erreur ou succès) pour que les lecteurs d'écran l'annoncent
  useEffect(() => {
    if (status === 'done' || status === 'error') zoneResultat.current?.focus()
  }, [status])

  const choisir = (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (fichier) void load(fichier)
    e.target.value = '' // permet de re-sélectionner le même fichier après une erreur
  }

  const importer = () => {
    // L'échec est déjà exposé par le hook (message dans `error`) : on évite un rejet non géré
    confirm().catch(() => {})
  }

  const enCours = status === 'importing'

  return (
    <>
      <h1 className="titre-ecran">Import</h1>
      <div role="tablist" aria-label="Type d'import" className="import__onglets" onKeyDown={surTouche}>
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            id={idOnglet(o.id)}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            aria-controls={idPanneau(o.id)}
            tabIndex={onglet === o.id ? 0 : -1}
            className="import__onglet"
            onClick={() => setOnglet(o.id)}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={idPanneau(onglet)} aria-labelledby={idOnglet(onglet)}>
        {onglet === 'ia' ? (
          <ImportIaPanel userId={session?.user.id} />
        ) : onglet === 'programme' ? (
          <PanneauProgramme userId={session?.user.id} />
        ) : (
          <>
          <p className="import__intro">
            Importez une sauvegarde PandaMove (renforcement, sorties de course et de vélo, séances de cardio planifiées, respiration, mobilité, rappels) ou un export JSON de l'application Android (séances, exercices, matériel).
          </p>

          <div className="import__carte">
            <div className="import__champ">
              <PandaIllustration image={panda} sizes="76px" decoratif className="import__panda" />
              <label htmlFor="import-fichier">Fichier d'export (.json)</label>
              <input id="import-fichier" type="file" accept=".json,application/json" onChange={choisir} disabled={enCours} />
            </div>

            <div ref={zoneResultat} tabIndex={-1} className="import__resultat">
              {error && (
                <p role="alert" className="import__erreur">
                  {error}
                </p>
              )}
              {resultat && (
                <section aria-labelledby="import-succes">
                  <h2 id="import-succes">Import terminé</h2>
                  <p role="status">
                    {resultat.seances} séance(s), {resultat.instances} séance(s) jouée(s), {resultat.series} série(s),{' '}
                    {resultat.exercises} exercice(s) et {resultat.objectifs} objectif(s) de progression importés.
                    {resultat.complement > 0 && ` ${resultat.complement} élément(s) d'endurance, de respiration ou de mobilité importés.`}
                  </p>
                  {resultat.ignores.length > 0 && (
                    <>
                      <h3>Remarques</h3>
                      <ul>
                        {resultat.ignores.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <button type="button" className="bouton" onClick={reset}>
                    Importer un autre fichier
                  </button>
                </section>
              )}
            </div>

            {preview && status !== 'done' && (
              <section aria-labelledby="import-apercu">
                <h2 id="import-apercu">Aperçu</h2>
                <ul>
                  <li>{preview.seances} séance(s)</li>
                  <li>{preview.instances} séance(s) jouée(s)</li>
                  <li>{preview.series} série(s)</li>
                  <li>{preview.exercises} exercice(s)</li>
                  {preview.complement &&
                    TABLES_COMPLEMENT.filter((t) => preview.complement!.resume[t] > 0).map((t) => (
                      <li key={t}>
                        {preview.complement!.resume[t]} {libelleComplement(t)}
                      </li>
                    ))}
                  {preview.complement?.rappelsJson && <li>Réglages des rappels</li>}
                </ul>
                {preview.ignores.length > 0 && (
                  <>
                    <h3>Éléments ignorés</h3>
                    <ul>
                      {preview.ignores.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="import__avertissement">
                  <strong>Attention : </strong>
                  {AVERTISSEMENT}
                </p>
                <button type="button" className="bouton bouton--import" onClick={importer} disabled={enCours}>
                  {enCours ? 'Import en cours…' : "Confirmer l'import"}
                </button>
              </section>
            )}
          </div>

          <aside className="import__info" aria-label="À savoir">
            <span className="import__info-icone" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            </span>
            <p>
              <strong>Sans doublon</strong>
              Réimporter le même fichier ne crée pas de doublon : les éléments déjà présents sont mis à jour, les autres sont ajoutés.
            </p>
          </aside>
          </>
        )}
      </div>
    </>
  )
}
