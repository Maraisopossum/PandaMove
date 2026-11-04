import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import type { Methode } from './methodes'
import { avancement, echelleCercle, INFOS_PHASE, secondesRestantes } from './moteur'
import { formaterDuree, messagePandaAuHasard } from './presentation'
import { useMethodeSession } from './useMethodeSession'
import { useSessionRespiration } from './useSessionRespiration'
import { useVeilleEcran } from './useVeilleEcran'

// Rayon du cercle par rapport à la zone : de 22 % (poumons vides) à 88 % (poumons pleins), comme sur Android.
const ECHELLE_MIN = 0.22
const ECHELLE_MAX = 0.88

interface FinProps {
  methode: Methode
  cycles: number
  dureeSec: number
  erreur: string | null
  onRecommencer: () => void
}

function FinDeSeance({ methode, cycles, dureeSec, erreur, onRecommencer }: FinProps) {
  const { session } = useAuth()
  const panda = useImagePanda('pose_meditation', { userId: session?.user.id, taille: 'lg' })
  const [message] = useState(() => messagePandaAuHasard())
  return (
    <div className="respiration respiration__fin">
      <h1 className="titre-ecran">Séance terminée 🎉</h1>
      <PandaIllustration image={panda} sizes="220px" decoratif className="respiration__panda" />
      <p className="respiration__message">« {message} »</p>
      <div className="respiration__bilan">
        <p className="respiration__nom">{methode.nom}</p>
        <dl>
          <div>
            <dt className="aide">Cycles</dt>
            <dd>{cycles}</dd>
          </div>
          <div>
            <dt className="aide">Durée</dt>
            <dd>{formaterDuree(dureeSec)}</dd>
          </div>
        </dl>
      </div>
      {erreur && (
        <p role="alert" className="formulaire__erreur">
          {erreur}
        </p>
      )}
      <div className="formulaire__ligne">
        <Link to="/breathing" className="bouton">
          Fermer
        </Link>
        <button type="button" className="bouton bouton--principal" onClick={onRecommencer}>
          Recommencer
        </button>
      </div>
    </div>
  )
}

interface ContenuProps {
  methode: Methode
  cycles: number
  onRecommencer: () => void
}

// Séance en cours : décompte, cercle qui suit le souffle, consigne de la phase, pause. Remonté (nouvelle clé) pour recommencer.
function ContenuSession({ methode, cycles, onRecommencer }: ContenuProps) {
  const s = useSessionRespiration(methode, cycles)
  useVeilleEcran(s.statut === 'decompte' || s.statut === 'en_cours' || s.statut === 'pause')

  if (s.statut === 'termine') {
    return <FinDeSeance methode={methode} cycles={cycles} dureeSec={s.dureeSec} erreur={s.erreurEnregistrement} onRecommencer={onRecommencer} />
  }

  const enDecompte = s.statut === 'decompte'
  const info = s.etat ? INFOS_PHASE[s.etat.phase] : null
  const echelle = s.etat ? echelleCercle(s.etat.phase, avancement(s.etat)) : 0
  const couleur = info && !enDecompte ? info.couleur : 'var(--couleur-respiration)'
  const style = {
    '--couleur-phase': couleur,
    '--texte-phase': info && !enDecompte ? info.texte : '#FFFFFF',
    '--echelle': String(ECHELLE_MIN + (ECHELLE_MAX - ECHELLE_MIN) * echelle),
  } as CSSProperties

  return (
    <div className="respiration respiration__session" style={style}>
      <div className="respiration__barre">
        <Link to="/breathing" className="bouton" aria-label="Quitter la séance">
          ✕
        </Link>
        <p className="respiration__nom">{methode.nom}</p>
        <p className="respiration__cycle" aria-label={s.etat ? `Cycle ${s.etat.cycle} sur ${s.etat.cyclesTotal}` : undefined}>
          {s.etat && !enDecompte ? `${s.etat.cycle}/${s.etat.cyclesTotal}` : ''}
        </p>
      </div>

      <div className="respiration__cercle" aria-hidden="true">
        <span className="respiration__halo" />
        <span className="respiration__disque" />
        <span className="respiration__chiffre">{enDecompte ? s.decompte : s.etat ? secondesRestantes(s.etat) : ''}</span>
      </div>

      <div className="respiration__consigne" role="status" aria-live="polite">
        {enDecompte ? (
          <>
            <p className="respiration__phase">Prépare-toi…</p>
            <p className="aide">La séance commence dans {s.decompte} s</p>
          </>
        ) : (
          info && (
            <>
              <p className="respiration__phase">{info.libelle}</p>
              <p className="aide">{info.consigne}</p>
            </>
          )
        )}
      </div>

      {!enDecompte && (
        <button type="button" className="bouton bouton--principal respiration__pause" onClick={s.statut === 'en_cours' ? s.pause : s.reprendre}>
          {s.statut === 'en_cours' ? 'Pause' : 'Reprendre'}
        </button>
      )}
    </div>
  )
}

// `/breathing/session/:id/:cycles` : retrouve la méthode (intégrée ou personnalisée) puis lance la séance.
export default function SessionScreen() {
  const { id = '', cycles: cyclesParam = '' } = useParams()
  const { methode, chargement } = useMethodeSession(id)
  const [essai, setEssai] = useState(0)
  const cycles = Number(cyclesParam)

  if (chargement) return <p role="status">Chargement…</p>
  if (!methode || !Number.isInteger(cycles) || cycles < 1) {
    return (
      <div className="respiration">
        <h1 className="titre-ecran">Séance introuvable</h1>
        <p>Cette méthode n’existe plus ou la durée demandée n’est pas valide.</p>
        <Link to="/breathing" className="bouton">
          Retour à la respiration
        </Link>
      </div>
    )
  }
  return <ContenuSession key={essai} methode={methode} cycles={cycles} onRecommencer={() => setEssai((n) => n + 1)} />
}
