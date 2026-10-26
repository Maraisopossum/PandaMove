import { useCallback, useMemo, useState } from 'react'

export type StatutEnregistrement = 'idle' | 'enCours' | 'enregistre' | 'erreur'

// Brouillon d'un formulaire de configuration : valeur saisie (chaînes), conversion validée,
// aperçu en direct et enregistrement. `lire` et `apercu` doivent être des fonctions stables
// (déclarées hors composant).
export function useBrouillon<D, V>(
  initial: D,
  lire: (brouillon: D) => V | null,
  apercu: (valeur: V) => string[],
  sauver: (valeur: V) => Promise<void>,
) {
  const [brouillon, setBrouillonBrut] = useState<D>(initial)
  const [statut, setStatut] = useState<StatutEnregistrement>('idle')

  const valeur = useMemo(() => lire(brouillon), [lire, brouillon])
  const charges = useMemo(() => (valeur === null ? [] : apercu(valeur)), [apercu, valeur])

  const setBrouillon = useCallback((suivant: D | ((precedent: D) => D)) => {
    setBrouillonBrut(suivant)
    setStatut('idle')
  }, [])

  const enregistrer = useCallback(async () => {
    if (valeur === null) return
    setStatut('enCours')
    try {
      await sauver(valeur)
      setStatut('enregistre')
    } catch (e) {
      console.error('Enregistrement du matériel impossible', e)
      setStatut('erreur')
    }
  }, [valeur, sauver])

  return { brouillon, setBrouillon, valide: valeur !== null, charges, statut, enregistrer }
}
