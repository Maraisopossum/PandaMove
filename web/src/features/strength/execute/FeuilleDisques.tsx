import { useId } from 'react'
import type { EquipmentInventaire } from '../../../core/progression/types'
import { detailDisques, texteDisques, texteKg, type EtatCalculateur, type Materiel } from './disques'
import { Feuille } from './Feuille'
import { useCalculateurDisques } from './useCalculateurDisques'

interface Props {
  inventaire: EquipmentInventaire
  chargeInitiale: number | null
  onFermer: () => void
}

const MATERIELS: { id: Materiel; libelle: string }[] = [
  { id: 'BARRE', libelle: 'Barre' },
  { id: 'HALTERE', libelle: 'Haltère' },
]

// Feuille « Calculateur de disques » (PlateCalculatorSheet Android) : barre ou haltère chargeable, poids de la barre,
// charge visée, disques à poser de chaque côté avec les disques possédés. Présentation seule : calcul dans disques.ts.
export function FeuilleDisques({ inventaire, chargeInitiale, onFermer }: Props) {
  const c = useCalculateurDisques(inventaire, chargeInitiale)
  const idBarre = useId()
  const idCible = useId()
  return (
    <Feuille titre="Calculateur de disques" onFermer={onFermer}>
      <div role="group" aria-label="Matériel" className="disques__materiel">
        {MATERIELS.map((m) => (
          <button key={m.id} type="button" className="bouton" aria-pressed={c.materiel === m.id} onClick={() => c.choisirMateriel(m.id)}>
            {m.libelle}
          </button>
        ))}
      </div>
      <div className="disques__champs">
        <div className="formulaire__champ">
          <label htmlFor={idBarre}>{c.materiel === 'BARRE' ? 'Barre (kg)' : 'Haltère vide (kg)'}</label>
          <input id={idBarre} type="text" inputMode="decimal" value={c.barre} onChange={(e) => c.changerBarre(e.target.value)} />
        </div>
        <div className="formulaire__champ">
          <label htmlFor={idCible}>Poids total (kg)</label>
          <input id={idCible} type="text" inputMode="decimal" value={c.cible} onChange={(e) => c.changerCible(e.target.value)} />
        </div>
      </div>
      <Resultat etat={c.etat} haltere={c.materiel === 'HALTERE'} />
    </Feuille>
  )
}

function Resultat({ etat, haltere }: { etat: EtatCalculateur; haltere: boolean }) {
  if (etat.type === 'invite') return <p className="aide">Saisissez un poids cible</p>
  if (etat.type === 'barre') {
    return (
      <p role="alert" className="import__erreur">
        Poids de barre invalide
      </p>
    )
  }
  if (etat.type === 'impossible') {
    return (
      <p role="alert" className="import__erreur">
        Impossible avec les disques disponibles
      </p>
    )
  }
  const { resultat, barreKg, cibleKg } = etat
  const d = detailDisques(resultat, barreKg)
  return (
    <div className="disques__resultat" aria-live="polite">
      {resultat.approximatif && (
        <p role="status" className="import__erreur">
          {texteKg(cibleKg)} impossible → {texteKg(resultat.chargeKg)} avec votre matériel
        </p>
      )}
      <p className="aide">{haltere ? 'Disques de chaque côté de l’haltère' : 'Disques de chaque côté'}</p>
      <p className="disques__disques">
        {resultat.disques.length === 0
          ? haltere
            ? 'Aucun disque : l’haltère seul suffit'
            : 'Aucun disque : la barre seule suffit'
          : texteDisques(resultat.disques)}
      </p>
      <dl className="disques__detail">
        <div>
          <dt>{haltere ? 'Haltère' : 'Barre'}</dt>
          <dd>{texteKg(barreKg)}</dd>
        </div>
        {resultat.disques.length > 0 && (
          <div>
            <dt>Disques</dt>
            <dd>{texteKg(d.totalDisquesKg)}</dd>
          </div>
        )}
        <div className="disques__total">
          <dt>Total</dt>
          <dd>{texteKg(d.totalKg)}</dd>
        </div>
      </dl>
    </div>
  )
}
