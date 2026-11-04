import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { ecrireSonActif, lireSonActif } from './audio'
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
      <div className="respiration__actions-bas respiration__actions-bas--fin">
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
  const [son, setSon] = useState(lireSonActif)
  const basculerSon = () => {
    ecrireSonActif(!son)
    setSon(!son)
  }

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
        <Link to="/breathing" className="bouton respiration__quitter" aria-label="Quitter la séance">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <p className="respiration__nom">{methode.nom}</p>
        <p className="respiration__cycle" aria-label={s.etat ? `Cycle ${s.etat.cycle} sur ${s.etat.cyclesTotal}` : undefined}>
          {s.etat && !enDecompte ? `${s.etat.cycle}/${s.etat.cyclesTotal}` : ''}
        </p>
      </div>

      {/* Deux anneaux qui pulsent : l'anneau extérieur suit le disque avec un léger retard et respire en continu ;
          pendant les rétentions, le disque pulse à peine. Pas de petit cercle au centre. */}
      <div className={`respiration__cercle${s.etat && (s.etat.phase === 'retention_pleine' || s.etat.phase === 'retention_vide') ? ' respiration__cercle--retenue' : ''}`} aria-hidden="true">
        <span className="respiration__halo">
          <span className="respiration__pulsation" />
        </span>
        <span className="respiration__disque">
          <span className="respiration__pulsation" />
        </span>
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

      <div className="respiration__controles">
        {!enDecompte && (
          <button type="button" className="bouton bouton--principal respiration__pause" onClick={s.statut === 'en_cours' ? s.pause : s.reprendre}>
            {s.statut === 'en_cours' ? 'Pause' : 'Reprendre'}
          </button>
        )}
        <button type="button" className="bouton respiration__son" aria-label={son ? 'Son activé' : 'Son coupé'} aria-pressed={son} onClick={basculerSon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M11 5L6 9H3v6h3l5 4V5z" />
            {son ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}
          </svg>
        </button>
      </div>
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
