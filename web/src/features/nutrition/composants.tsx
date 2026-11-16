import type { Apport, Valeurs100 } from '../../core/nutrition/calculs'
import { apportPourQuantite } from '../../core/nutrition/calculs'
import { ajusterQuantite, decimal, entier, PAS_QUANTITE, QUANTITE_MAX } from './outils'

// Anneau d'énergie du jour : consommé, objectif, reste. L'anneau passe en ambre au-delà de l'objectif (information, pas reproche).
export function AnneauKcal({ consomme, objectif }: { consomme: number; objectif: number | null }) {
  const rayon = 52
  const circonference = 2 * Math.PI * rayon
  const part = objectif ? Math.min(1, consomme / objectif) : 0
  const reste = objectif ? objectif - consomme : null
  const depasse = reste !== null && reste < 0
  const libelle = objectif
    ? `${entier(consomme)} kilocalories consommées sur ${entier(objectif)}, ${depasse ? `${entier(-reste!)} de plus que l’objectif` : `il en reste ${entier(reste!)}`}`
    : `${entier(consomme)} kilocalories consommées, aucun objectif défini`
  return (
    <div className="nutri__anneau" role="img" aria-label={libelle}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="nutri__anneau-fond" cx="60" cy="60" r={rayon} />
        <circle className={`nutri__anneau-arc${depasse ? ' nutri__anneau-arc--depasse' : ''}`} cx="60" cy="60" r={rayon} strokeDasharray={`${part * circonference} ${circonference}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="nutri__anneau-texte" aria-hidden="true">
        <strong>{objectif ? entier(depasse ? -reste! : reste!) : entier(consomme)}</strong>
        <span>{objectif ? (depasse ? 'kcal en trop' : 'kcal restantes') : 'kcal'}</span>
      </div>
    </div>
  )
}

export function BarreMacro({ libelle, valeur, objectif, classe }: { libelle: string; valeur: number; objectif: number | null; classe: 'proteines' | 'glucides' | 'lipides' }) {
  const part = objectif ? Math.min(100, Math.round((valeur / objectif) * 100)) : 0
  return (
    <div className="nutri__macro">
      <div className="nutri__macro-tete">
        <span>{libelle}</span>
        <strong>{decimal(valeur)} g{objectif ? <span className="nutri__macro-objectif"> / {entier(objectif)} g</span> : null}</strong>
      </div>
      <div className="nutri__barre" role="progressbar" aria-label={libelle} aria-valuemin={0} aria-valuemax={objectif ?? undefined} aria-valuenow={Math.round(valeur)} aria-valuetext={objectif ? `${decimal(valeur)} g sur ${entier(objectif)} g` : `${decimal(valeur)} g`}>
        <span className={`nutri__barre-rempli nutri__barre-rempli--${classe}`} style={{ width: `${part}%` }} />
      </div>
    </div>
  )
}

/**
 * Choix de la quantité d'un aliment : boutons de pas (-50 à +50 g), saisie, portion habituelle, et apports recalculés en direct.
 * Sert à l'ajout d'un aliment et à la correction d'une ligne du journal.
 */
export function PanneauQuantite({
  valeurs, quantiteG, onChange, portionG, portionLabel,
}: { valeurs: Valeurs100; quantiteG: number; onChange: (g: number) => void; portionG?: number | null; portionLabel?: string | null }) {
  const apport: Apport = apportPourQuantite(valeurs, quantiteG)
  return (
    <div className="nutri__quantite">
      <div className="nutri__stepper" role="group" aria-label="Quantité en grammes">
        {PAS_QUANTITE.filter((p) => p < 0).map((p) => (
          <button key={p} type="button" className="bouton nutri__pas" aria-label={`Retirer ${-p} grammes`} disabled={quantiteG <= 0} onClick={() => onChange(ajusterQuantite(quantiteG, p))}>{p}</button>
        ))}
        <label className="nutri__saisie">
          <span className="nutri__saisie-libelle">Quantité (g)</span>
          <input type="number" inputMode="decimal" min={0} max={QUANTITE_MAX} step="any" value={Number.isFinite(quantiteG) ? quantiteG : ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Math.min(QUANTITE_MAX, Math.max(0, Number(e.target.value))))} />
        </label>
        {PAS_QUANTITE.filter((p) => p > 0).map((p) => (
          <button key={p} type="button" className="bouton nutri__pas" aria-label={`Ajouter ${p} grammes`} disabled={quantiteG >= QUANTITE_MAX} onClick={() => onChange(ajusterQuantite(quantiteG, p))}>+{p}</button>
        ))}
      </div>
      {portionG ? (
        <button type="button" className="nutri__portion" aria-pressed={Math.abs(quantiteG - portionG) < 0.05} onClick={() => onChange(portionG)}>
          1 portion : {portionLabel ? `${portionLabel}, ` : ''}{decimal(portionG)} g
        </button>
      ) : null}
      <dl className="nutri__apports" aria-live="polite">
        <div><dt>Énergie</dt><dd>{entier(apport.kcal)} kcal</dd></div>
        <div><dt>Protéines</dt><dd>{decimal(apport.proteines)} g</dd></div>
        <div><dt>Glucides</dt><dd>{decimal(apport.glucides)} g</dd></div>
        <div><dt>Lipides</dt><dd>{decimal(apport.lipides)} g</dd></div>
      </dl>
    </div>
  )
}
