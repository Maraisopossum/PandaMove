import { useEffect, useRef, type ChangeEvent } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { useImport } from './useImport'

const AVERTISSEMENT =
  "L'import remplace les séances, exercices et séries ayant le même identifiant par le contenu du fichier."

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
      <h1>Import</h1>
      <p>Importez un export JSON de l'application Android (séances, exercices, matériel).</p>

      <div className="import__champ">
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
          <button type="button" className="bouton" onClick={importer} disabled={enCours}>
            {enCours ? 'Import en cours…' : "Confirmer l'import"}
          </button>
        </section>
      )}
    </>
  )
}
