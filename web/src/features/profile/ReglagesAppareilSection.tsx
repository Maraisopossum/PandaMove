import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { lireMethodes } from '../../core/db/repos/respiration'
import { lireFavorite } from '../respiration/reglages'
import { DialogueConfirmation } from '../strength/edition/DialogueConfirmation'
import { lireExerciceDefaut } from '../stats/exerciceDefaut'
import { lireLignesReglages, reinitialiserReglages, type NomsReglages } from './reglagesAppareil'

// « Réglages de cet appareil » du profil : valeur et accès de chaque réglage d'appareil, et remise à zéro après confirmation. Les
// noms de l'exercice et de la méthode favorite sont lus en base ; un réglage qui pointe vers quelque chose de supprimé s'affiche
// comme absent.
export function ReglagesAppareilSection({ db }: { db?: DbLecture }) {
  const [noms, setNoms] = useState<NomsReglages>({ exercice: null, methode: null })
  const [version, setVersion] = useState(0)
  const [confirmer, setConfirmer] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    const exerciceId = lireExerciceDefaut()
    const favorite = lireFavorite()
    Promise.all([
      exerciceId ? base.getOptional<{ name: string }>('SELECT name FROM exercises WHERE id = ? AND deleted_at IS NULL', [exerciceId]) : Promise.resolve(null),
      favorite ? lireMethodes(base) : Promise.resolve([]),
    ])
      .then(([exercice, methodes]) => {
        if (!annule) setNoms({ exercice: exercice?.name ?? null, methode: methodes.find((m) => m.id === favorite)?.nom ?? null })
      })
      .catch((e: unknown) => console.error('Noms des réglages impossibles', e))
    return () => {
      annule = true
    }
  }, [db, version])

  const lignes = lireLignesReglages(noms)
  return (
    <section className="profil__carte" aria-labelledby="profil-reglages">
      <div className="profil__carte-tete">
        <h2 id="profil-reglages">Réglages de cet appareil</h2>
        <span className="aide">non synchronisés</span>
      </div>
      <ul className="profil__reglages">
        {lignes.map((l) => (
          <li key={l.id}>
            <Link to={l.vers} className="profil__reglage">
              <span className="profil__reglage-texte">
                <span className="profil__reglage-nom">{l.nom}</span>
                <span className="aide">{l.detail}</span>
              </span>
              <span className="profil__reglage-valeur">{l.valeur}</span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="profil__lien-texte-bouton profil__lien-texte-bouton--alerte" onClick={() => setConfirmer(true)}>
        Rétablir les réglages par défaut
      </button>
      {message && (
        <p role="status" className="aide">
          {message}
        </p>
      )}

      {confirmer && (
        <DialogueConfirmation
          titre="Rétablir les réglages par défaut ?"
          libelleConfirmer="Rétablir"
          libelleAnnuler="Annuler"
          onAnnuler={() => setConfirmer(false)}
          onConfirmer={() => {
            const n = reinitialiserReglages()
            setConfirmer(false)
            setVersion((v) => v + 1)
            setMessage(n === 0 ? 'Aucun réglage n’avait été modifié.' : `${n} réglage${n > 1 ? 's' : ''} rétabli${n > 1 ? 's' : ''}.`)
          }}
        >
          <p>
            L’exercice affiché en premier, la méthode favorite, la FTP et la FC max, la période des statistiques et le dernier choix de mobilité
            reviennent à leur valeur d’origine. Les objectifs, le poids, les rappels, le mode sombre et vos données ne changent pas.
          </p>
        </DialogueConfirmation>
      )}
    </section>
  )
}
