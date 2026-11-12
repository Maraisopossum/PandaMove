import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { BarreActionsFlottante } from '../../app/BarreActionsFlottante'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda, usePandaVariante } from '../../core/images/usePandaVariante'
import { libelleZone } from './donnees'
import type { PlanSeance } from './generer'
import { formaterChrono, formaterMinutes, urlExercice } from './presentation'
import { lirePlan } from './stockage'
import { useSeanceMobilite } from './useSeanceMobilite'

// Séance de mobilité en cours : exercice, côté, chronomètre, consigne, exercice à suivre, pause, précédent / suivant, son.
// Logique dans useSeanceMobilite. Sans séance préparée, retour au choix.
export default function SeanceMobiliteScreen() {
  const [lu] = useState(lirePlan)
  if (!lu) return <Navigate to="/mobility" replace />
  return <Seance plan={lu} />
}

function Seance({ plan: lu }: { plan: PlanSeance }) {
  const { session } = useAuth()
  const panda = useImagePanda('joy', { userId: session?.user.id, taille: 'sm' })
  const variante = usePandaVariante({ userId: session?.user.id })
  const s = useSeanceMobilite(lu)

  if (s.termine) {
    return (
      <div className="mobilite mobilite__fin">
        <PandaIllustration image={panda} sizes="140px" decoratif className="mobilite__panda mobilite__panda--grand" />
        <h1 className="titre-ecran">Bravo, séance terminée</h1>
        <p>
          {formaterMinutes(lu.dureeTotaleS)} de mobilité, {lu.etapes.length} exercices. Enregistrée dans votre historique.
        </p>
        <Link to="/mobility" className="bouton bouton--principal lien-bouton">
          Terminer
        </Link>
      </div>
    )
  }

  const enPreparation = s.phase?.type === 'preparation'
  const enTransition = s.phase?.type === 'transition'
  const apercu = enPreparation || enTransition ? s.etape : null

  return (
    <div className="mobilite mobilite__seance">
      <div className="mobilite__barre">
        <Link to="/mobility" className="bouton mobilite__quitter" aria-label="Quitter la séance">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <p className="mobilite__compteur">
          Exercice {s.numeroEtape} sur {s.nbEtapes}
        </p>
        <button type="button" className="bouton mobilite__son" aria-pressed={s.son} aria-label={s.son ? 'Couper le son' : 'Activer le son'} onClick={s.basculerSon}>
          {s.son ? 'Son' : 'Muet'}
        </button>
      </div>

      <div
        className="mobilite__progression"
        role="progressbar"
        aria-label="Avancement de la séance"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.progression * 100)}
      >
        <span style={{ width: `${Math.round(s.progression * 100)}%` }} />
      </div>

      {(apercu ?? s.etape) && variante && <img className="mobilite__illustration" src={urlExercice((apercu ?? s.etape)!.exercice.id, variante ?? 'male')} alt="" width={144} height={144} decoding="async" />}
      <div className={`mobilite__cadran${enPreparation || enTransition ? ' mobilite__cadran--pause' : ''}`} role="timer" aria-label="Temps restant">
        <span className="mobilite__chrono">{formaterChrono(s.restantS)}</span>
      </div>

      <div role="status" aria-live="polite" className="mobilite__consigne">
        {enPreparation && <p className="mobilite__phase">Préparez-vous</p>}
        {enTransition && <p className="mobilite__phase">Changez de position</p>}
        {!enPreparation && !enTransition && s.phase?.cote && <p className="mobilite__phase">Côté {s.phase.cote}</p>}
        <h1 className="mobilite__nom">{apercu ? `À suivre : ${apercu.exercice.nom}` : s.etape?.exercice.nom}</h1>
        {(apercu ?? s.etape) && <p className="mobilite__zones-seance">{(apercu ?? s.etape)?.exercice.zones.map(libelleZone).join(' · ')}</p>}
        {!apercu && s.etape && <p className="mobilite__texte">{s.etape.exercice.consigne}</p>}
        {apercu && <p className="mobilite__texte">{apercu.exercice.consigne}</p>}
        {s.prochaine && !apercu && <p className="mobilite__suivante">Ensuite : {s.prochaine.exercice.nom}</p>}
      </div>

      <BarreActionsFlottante
        libelle="Commandes de la séance"
        secondaire={
          <button type="button" className="bouton" onClick={s.precedent} aria-label="Exercice précédent">
            Précédent
          </button>
        }
        principal={
          <div className="mobilite__commandes">
            <button type="button" className="bouton bouton--principal" onClick={s.basculerPause}>
              {s.enPause ? 'Reprendre' : 'Pause'}
            </button>
            <button type="button" className="bouton" onClick={s.suivant} aria-label="Exercice suivant">
              Suivant
            </button>
          </div>
        }
      />
    </div>
  )
}
