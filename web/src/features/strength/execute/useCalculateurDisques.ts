import { useMemo, useState } from 'react'
import type { EquipmentInventaire } from '../../../core/progression/types'
import { texteNombre } from '../saisie'
import { configurationMateriel, etatCalculateur, type Materiel } from './disques'

// État de la feuille « Calculateur de disques » : barre ou haltère, poids de la barre (celui de « Mon matériel »),
// charge cible (proposée : la prochaine série). Seuls les caractères d'un nombre sont acceptés.
export function useCalculateurDisques(inventaire: EquipmentInventaire, chargeInitiale: number | null) {
  const [materiel, setMateriel] = useState<Materiel>('BARRE')
  const [cible, setCible] = useState(() => texteNombre(chargeInitiale))
  // Un poids de barre saisi à la main prime ; changer de matériel revient au poids déclaré
  const [barreSaisie, setBarreSaisie] = useState<{ materiel: Materiel; texte: string } | null>(null)
  const config = useMemo(() => configurationMateriel(inventaire, materiel), [inventaire, materiel])
  const barre = barreSaisie?.materiel === materiel ? barreSaisie.texte : texteNombre(config.barreKg)
  const filtrer = (t: string) => t.replace(/[^\d.,]/g, '')

  return {
    materiel,
    choisirMateriel: setMateriel,
    barre,
    cible,
    changerBarre: (t: string) => setBarreSaisie({ materiel, texte: filtrer(t) }),
    changerCible: (t: string) => setCible(filtrer(t)),
    etat: etatCalculateur(cible, barre, config),
  }
}
