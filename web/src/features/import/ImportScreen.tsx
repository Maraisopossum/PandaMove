import { useEffect, useRef, type ChangeEvent } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { useImport } from './useImport'

const AVERTISSEMENT =
  "Le contenu du fichier remplace les éléments correspondants déjà présents (sauvegarde PandaMove de ce compte, ou " +
  "export Android déjà importé) ; les autres éléments sont ajoutés. Réimporter le même fichier ne crée pas de doublon."

// Écran d'import d'un export JSON PandaFit (Android). Toute la logique vit dans useImport.
export default function ImportScreen() {
  const { session } = useAuth()
  const { preview, error, load, confirm, status, resultat, reset } = useImport({ userId: session?.user.id })
  const zoneResultat = useRef<HTMLDivElement>(null)

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
      <p className="import__intro">Importez un export JSON de l'application Android (séances, exercices, matériel).</p>

      <div className="import__carte">
        <div className="import__champ">
          <span className="import__icone" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
          </span>
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
  )
}
