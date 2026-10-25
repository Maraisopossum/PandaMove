import { useId } from 'react'
import { capacites } from './retours'
import type { ReglagesCircuit } from './reglages'
import { useReglagesCircuit } from './useReglagesCircuit'

interface Ligne {
  cle: keyof ReglagesCircuit
  libelle: string
  aide?: string
}

// Trois interrupteurs (Son, Vibration, Voix) + le compte à rebours parlé, mémorisés par appareil.
// Partagé par l'encart de lancement du circuit et la page Profil. Présentation seule.
export function ReglagesRetours() {
  const { reglages, changer } = useReglagesCircuit()
  const dispo = capacites()
  const idAide = useId()
  const lignes: Ligne[] = [
    { cle: 'son', libelle: 'Son' },
    { cle: 'vibration', libelle: 'Vibration', aide: dispo.vibration ? undefined : 'Vibration indisponible sur cet appareil (par exemple iOS Safari).' },
    { cle: 'voix', libelle: 'Voix', aide: dispo.voix ? 'Annonce l’exercice suivant, « Allez ! », le repos et la fin. Inutile avec un lecteur d’écran.' : 'Voix indisponible sur cet appareil.' },
  ]
  return (
    <fieldset className="reglages-retours">
      <legend>Retours du circuit</legend>
      {lignes.map((l) => (
        <div key={l.cle}>
          <label className="interrupteur">
            <input
              type="checkbox"
              role="switch"
              checked={reglages[l.cle]}
              aria-describedby={l.aide ? `${idAide}-${l.cle}` : undefined}
              onChange={(e) => changer(l.cle, e.target.checked)}
            />
            {l.libelle}
          </label>
          {l.aide && (
            <p id={`${idAide}-${l.cle}`} className="aide reglages-retours__aide">
              {l.aide}
            </p>
          )}
        </div>
      ))}
      <label className="interrupteur interrupteur--sous">
        <input
          type="checkbox"
          role="switch"
          checked={reglages.voixCompte}
          disabled={!reglages.voix}
          onChange={(e) => changer('voixCompte', e.target.checked)}
        />
        Compter 3-2-1 à voix haute
      </label>
    </fieldset>
  )
}
