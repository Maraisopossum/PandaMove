import { Feuille } from './Feuille'
import { PRESETS_MANUEL, texteDuree } from './minuteurRepos'
import { useSelectionMinuteur } from './useSelectionMinuteur'
import { formaterDuree } from './vue'

interface Props {
  /** Repos / minuteur en cours (ms), null sinon */
  restantMs: number | null
  derniereSec: number
  onDemarrer: (sec: number) => void
  onAllonger: () => void
  onEcourter: () => void
  onArreter: () => void
  onFermer: () => void
}

// Feuille « Minuteur » (ManualTimerSheet Android) : à l'arrêt, préréglages + ± 5 s + Démarrer ; en marche, le décompte
// avec −30 s / +30 s / Arrêter. Le décompte est celui du repos (un seul minuteur, comme sur Android).
export function FeuilleMinuteur({ restantMs, derniereSec, onDemarrer, onAllonger, onEcourter, onArreter, onFermer }: Props) {
  const choix = useSelectionMinuteur(derniereSec)
  const enMarche = restantMs !== null && restantMs > 0
  return (
    <Feuille titre="Minuteur" onFermer={onFermer}>
      {enMarche ? (
        <>
          <p className="minuteur__temps minuteur__temps--marche" role="timer" aria-live="off">
            {formaterDuree(restantMs)}
          </p>
          <div className="formulaire__ligne">
            <button type="button" className="bouton minuteur__action" onClick={onEcourter}>
              −30 s
            </button>
            <button type="button" className="bouton minuteur__action" onClick={onAllonger}>
              +30 s
            </button>
            <button
              type="button"
              className="bouton bouton--alerte minuteur__action"
              onClick={() => {
                onArreter()
                onFermer()
              }}
            >
              Arrêter
            </button>
          </div>
        </>
      ) : (
        <>
          <div role="group" aria-label="Durées proposées" className="minuteur__presets">
            {PRESETS_MANUEL.map((p) => (
              <button key={p.sec} type="button" className="bouton" aria-pressed={choix.sec === p.sec} onClick={() => choix.choisir(p.sec)}>
                {p.libelle}
              </button>
            ))}
          </div>
          <div className="minuteur__reglage">
            <button type="button" className="bouton minuteur__pas" aria-label="Retirer 5 secondes" onClick={choix.moins}>
              −
            </button>
            <p className="minuteur__temps" aria-live="polite" aria-label={`Durée : ${texteDuree(choix.sec)}`}>
              {formaterDuree(choix.sec * 1000)}
            </p>
            <button type="button" className="bouton minuteur__pas" aria-label="Ajouter 5 secondes" onClick={choix.plus}>
              +
            </button>
          </div>
          <button
            type="button"
            className="bouton bouton--principal minuteur__demarrer"
            onClick={() => {
              onDemarrer(choix.sec)
              onFermer()
            }}
          >
            Démarrer {texteDuree(choix.sec)}
          </button>
        </>
      )}
    </Feuille>
  )
}
