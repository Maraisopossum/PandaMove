import { useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BarreActionsFlottante } from '../../app/BarreActionsFlottante'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { usePiegeFocus } from '../../core/ui/usePiegeFocus'
import { preparerAudio } from './audio'
import type { Methode } from './methodes'
import { formaterDateHistorique, formaterDuree } from './presentation'
import { useChoixDuree } from './useChoixDuree'
import { useRespiration } from './useRespiration'

type Suppression = { type: 'methode' | 'seance'; id: string; libelle: string }

interface ConfirmationProps {
  titre: string
  libelle: string
  precision: string
  enCours: boolean
  onConfirmer: () => void
  onFermer: () => void
}

// Confirmation d'une suppression (coins arrondis 28 px). Action destructive : le focus initial est sur « Annuler ».
function ConfirmationSuppression({ titre, libelle, precision, enCours, onConfirmer, onFermer }: ConfirmationProps) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer, boutonAnnuler)
  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>{titre}</h2>
        <p>{libelle}</p>
        <p>{precision}</p>
        <div className="formulaire__ligne">
          <button type="button" className="bouton" disabled={enCours} onClick={onConfirmer}>
            Supprimer
          </button>
          <button ref={boutonAnnuler} type="button" className="bouton" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

interface CarteProps {
  methode: Methode
  ouverte: boolean
  onBasculer: () => void
  onSupprimer: () => void
  choix: ReturnType<typeof useChoixDuree>
  onDemarrer: () => void
}

function CarteMethode({ methode, ouverte, onBasculer, onSupprimer, choix, onDemarrer }: CarteProps) {
  const idPanneau = useId()
  const valeur = choix.valeurDe(methode)
  const unite = choix.mode === 'cycles' ? 'cycles' : 'min'
  return (
    <li className="respiration__carte">
      <div className="respiration__entete">
        <button type="button" className="respiration__bascule" aria-expanded={ouverte} aria-controls={idPanneau} onClick={onBasculer}>
          <span className="respiration__emoji" aria-hidden="true">
            {methode.emoji}
          </span>
          <span className="respiration__texte">
            <span className="respiration__nom">{methode.nom}</span>
            <span className="respiration__description">{methode.description}</span>
          </span>
          <span className="respiration__chevron" aria-hidden="true">
            {ouverte ? '▴' : '▾'}
          </span>
        </button>
        {methode.personnalisee && (
          <span className="respiration__actions">
            <Link to={`/breathing/${methode.id}/edit`} className="bouton" aria-label={`Modifier ${methode.nom}`}>
              Modifier
            </Link>
            <button type="button" className="bouton bouton--alerte" aria-label={`Supprimer ${methode.nom}`} onClick={onSupprimer}>
              Supprimer
            </button>
          </span>
        )}
      </div>
      {ouverte && (
        <div id={idPanneau} className="respiration__panneau">
          <div className="respiration__compteur">
            <button type="button" className="bouton" aria-label="Diminuer" disabled={valeur <= choix.bornes.min} onClick={() => choix.changer(methode, -1)}>
              −
            </button>
            <p className="respiration__valeur" role="status" aria-label={`${valeur} ${unite}`}>
              <strong>{valeur}</strong>
              <span className="aide">{unite}</span>
            </p>
            <button type="button" className="bouton" aria-label="Augmenter" disabled={valeur >= choix.bornes.max} onClick={() => choix.changer(methode, 1)}>
              +
            </button>
          </div>
          <button type="button" className="bouton bouton--principal respiration__demarrer" onClick={onDemarrer}>
            Démarrer
          </button>
        </div>
      )}
    </li>
  )
}

// Écran de choix : méthodes intégrées et personnalisées (dépliables pour régler la durée), puis historique repliable.
export default function RespirationScreen() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const data = useRespiration()
  const choix = useChoixDuree()
  const panda = useImagePanda('pose_meditation', { userId: session?.user.id, taille: 'lg' })
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)
  const [aSupprimer, setASupprimer] = useState<Suppression | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const idHistorique = useId()

  const demarrer = (m: Methode) => {
    // Geste de l'utilisateur : c'est le moment d'autoriser le son (la session démarre ensuite sur un autre écran)
    preparerAudio()
    void navigate(`/breathing/session/${m.id}/${choix.cyclesA(m)}`)
  }

  const confirmer = async () => {
    if (!aSupprimer) return
    setSuppressionEnCours(true)
    const ok = aSupprimer.type === 'methode' ? await data.supprimerMethode(aSupprimer.id) : await data.supprimerSeance(aSupprimer.id)
    setSuppressionEnCours(false)
    if (ok && aSupprimer.type === 'methode' && choix.ouverteId === aSupprimer.id) choix.basculer(aSupprimer.id)
    setASupprimer(null)
  }

  return (
    <div className="respiration">
      <div className="respiration__haut">
        <div className="respiration__accroche">
          <h1 className="respiration__titre-page">Un souffle, une pause</h1>
          <p className="respiration__aide">Choisissez une méthode, réglez la durée, laissez le cercle vous guider.</p>
        </div>
        <PandaIllustration image={panda} sizes="120px" decoratif className="respiration__panda" />
      </div>

      {data.erreur && (
        <p role="alert" className="formulaire__erreur">
          {data.erreur}
        </p>
      )}

      <div className="respiration__ligne-titre">
        <h2 className="respiration__titre">Choisissez une méthode</h2>
        <div className="respiration__mode" role="group" aria-label="Durée">
          <button type="button" className="bouton" aria-pressed={choix.mode === 'cycles'} onClick={() => choix.setMode('cycles')}>
            Cycles
          </button>
          <button type="button" className="bouton" aria-pressed={choix.mode === 'minutes'} onClick={() => choix.setMode('minutes')}>
            Minutes
          </button>
        </div>
      </div>
      <ul className="respiration__liste" aria-label="Méthodes de respiration">
        {data.methodes.map((m) => (
          <CarteMethode
            key={m.id}
            methode={m}
            ouverte={choix.ouverteId === m.id}
            choix={choix}
            onBasculer={() => choix.basculer(m.id)}
            onSupprimer={() => setASupprimer({ type: 'methode', id: m.id, libelle: `« ${m.nom} »` })}
            onDemarrer={() => demarrer(m)}
          />
        ))}
      </ul>

      {data.seances.length > 0 && (
        <section className="respiration__historique" aria-labelledby={`${idHistorique}-titre`}>
          <h2 id={`${idHistorique}-titre`} className="respiration__titre">
            <button type="button" className="respiration__bascule" aria-expanded={historiqueOuvert} aria-controls={idHistorique} onClick={() => setHistoriqueOuvert((o) => !o)}>
              <span>Historique ({data.seances.length})</span>
              <span className="respiration__chevron" aria-hidden="true">
                {historiqueOuvert ? '▴' : '▾'}
              </span>
            </button>
          </h2>
          {historiqueOuvert && (
            <ul id={idHistorique} className="respiration__seances">
              {data.seances.map((s) => (
                <li key={s.id} className="respiration__seance">
                  <span className="respiration__texte">
                    <span className="respiration__nom">{s.methodeNom}</span>
                    <span className="aide">
                      {formaterDateHistorique(s.date)} · {formaterDuree(s.dureeSec)} · {s.cycles} cycles
                    </span>
                  </span>
                  <button
                    type="button"
                    className="bouton bouton--alerte"
                    aria-label={`Supprimer la séance ${s.methodeNom} du ${formaterDateHistorique(s.date)}`}
                    onClick={() => setASupprimer({ type: 'seance', id: s.id, libelle: `${s.methodeNom}, ${formaterDateHistorique(s.date)}` })}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <BarreActionsFlottante
        libelle="Actions de la respiration"
        principal={
          <Link to="/breathing/new" className="bouton lien-bouton">
            + Créer ma méthode
          </Link>
        }
      />

      {aSupprimer && (
        <ConfirmationSuppression
          titre={aSupprimer.type === 'methode' ? 'Supprimer la méthode ?' : 'Supprimer la séance ?'}
          libelle={aSupprimer.libelle}
          precision={
            aSupprimer.type === 'methode'
              ? "La méthode sera définitivement supprimée ; l'historique de ses séances est conservé."
              : "Cette séance sera définitivement supprimée de l'historique."
          }
          enCours={suppressionEnCours}
          onConfirmer={() => void confirmer()}
          onFermer={() => setASupprimer(null)}
        />
      )}
    </div>
  )
}
