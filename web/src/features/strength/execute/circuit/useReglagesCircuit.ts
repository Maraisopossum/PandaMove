import { useCallback, useSyncExternalStore } from 'react'
import { analyserReglages, ecrireReglages, lireBrut, type ReglagesCircuit } from './reglages'

// Hook partagé par l'encart de lancement du circuit et la page Profil : les deux lisent et écrivent les
// mêmes réglages (mémorisés par appareil) et restent synchronisés.
const abonnes = new Set<() => void>()
// Dernier état écrit pendant cette session (conservé même si le stockage refuse l'écriture)
let memoire: ReglagesCircuit | null = null
// Mémo de l'analyse du texte stocké : getSnapshot doit renvoyer une référence stable
let dernierBrut: string | null | undefined
let dernierAnalyse: ReglagesCircuit

function instantane(): ReglagesCircuit {
  if (memoire) return memoire
  const brut = lireBrut()
  if (brut !== dernierBrut || dernierAnalyse === undefined) {
    dernierBrut = brut
    dernierAnalyse = analyserReglages(brut)
  }
  return dernierAnalyse
}

function abonner(rappel: () => void) {
  abonnes.add(rappel)
  return () => {
    abonnes.delete(rappel)
    if (abonnes.size === 0) memoire = null
  }
}

export function useReglagesCircuit() {
  const reglages = useSyncExternalStore(abonner, instantane, instantane)
  const changer = useCallback(<K extends keyof ReglagesCircuit>(cle: K, valeur: ReglagesCircuit[K]) => {
    memoire = { ...instantane(), [cle]: valeur }
    ecrireReglages(memoire)
    abonnes.forEach((r) => r())
  }, [])
  return { reglages, changer }
}
