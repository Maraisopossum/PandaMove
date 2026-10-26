import { useCallback, useState } from 'react'
import { conseilCharge } from './bilan'
import type { LigneRecap } from './useEcranBilan'
import type { ChoixRecap } from './useReport'

type Choix = ChoixRecap['choix']

// Brouillon des choix du récap (miroir de `decisions` / `ajustements` du ProgressionRecapDialog Android) :
// « Oui » est présélectionné pour chaque exercice ; la charge saisie d'un « Ajuster » est conservée si
// l'utilisateur change d'avis puis revient. Aucune écriture ici : tout part au clic sur « Valider ».
export function useChoixRecap(lignes: LigneRecap[]) {
  const [choix, setChoix] = useState<Record<string, Choix>>({})
  const [charges, setCharges] = useState<Record<string, number | null>>({})

  const ligne = useCallback((id: string) => lignes.find((l) => l.exerciceId === id), [lignes])
  const choixDe = useCallback((id: string): Choix => choix[id] ?? 'oui', [choix])
  const chargeDe = useCallback(
    (id: string): number | null => (id in charges ? charges[id] : (ligne(id)?.chargeProposee ?? null)),
    [charges, ligne],
  )
  // Charge composable la plus proche, uniquement pendant un ajustement
  const conseilDe = useCallback(
    (id: string): number | null => (choixDe(id) === 'ajuster' ? conseilCharge(ligne(id)?.chargesAtteignables ?? [], chargeDe(id)) : null),
    [choixDe, chargeDe, ligne],
  )

  return {
    choixDe,
    chargeDe,
    conseilDe,
    choisir: (id: string, c: Choix) => setChoix((m) => ({ ...m, [id]: c })),
    saisirCharge: (id: string, kg: number | null) => setCharges((m) => ({ ...m, [id]: kg })),
    arrondir: (id: string) => {
      const proche = conseilDe(id)
      if (proche !== null) setCharges((m) => ({ ...m, [id]: proche }))
    },
    /** Choix à envoyer : une entrée par exercice encore à décider */
    lot: (): ChoixRecap[] =>
      lignes
        .filter((l) => l.actionnable && l.etat === 'en_attente')
        .map((l) => {
          const c = choixDe(l.exerciceId)
          return { exerciceId: l.exerciceId, choix: c, chargeKg: c === 'ajuster' ? chargeDe(l.exerciceId) : null }
        }),
  }
}
