import { useMemo, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { formaterDate } from '../endurance/presentation'
import { ajouterPesee, bilanPoids, definirObjectifPoids, lireSuiviPoids, POIDS_MAX_KG, POIDS_MIN_KG, retirerPesee } from './poids'

const MAINTENANT = () => new Date()
const FORMAT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nombre = (texte: string) => Number(texte.trim().replace(',', '.'))

// Suivi du poids du profil : dernière pesée, écart sur 30 jours, courbe des 8 dernières semaines avec la ligne d'objectif, ajout et
// retrait d'une pesée. Données de santé propres à l'appareil (poids.ts). Aucune conclusion de santé n'est tirée des chiffres.
export function PoidsSection({ maintenant = MAINTENANT }: { maintenant?: () => Date }) {
  const [suivi, setSuivi] = useState(lireSuiviPoids)
  const [saisie, setSaisie] = useState<{ kg: string; date: string } | null>(null)
  const [objectif, setObjectif] = useState<string | null>(null)
  const [now] = useState(maintenant)
  const aujourdhui = dateIsoLocale(now)
  const bilan = useMemo(() => bilanPoids(suivi, aujourdhui), [suivi, aujourdhui])

  const kgSaisi = saisie ? nombre(saisie.kg) : Number.NaN
  const saisieValide = saisie !== null && Number.isFinite(kgSaisi) && kgSaisi >= POIDS_MIN_KG && kgSaisi <= POIDS_MAX_KG && /^\d{4}-\d{2}-\d{2}$/.test(saisie.date) && saisie.date <= aujourdhui
  const objectifKg = objectif === null ? null : nombre(objectif)
  const objectifValide = objectif !== null && objectif.trim() !== '' && Number.isFinite(objectifKg) && (objectifKg as number) >= POIDS_MIN_KG && (objectifKg as number) <= POIDS_MAX_KG

  // Courbe : de la valeur la plus basse à la plus haute des pesées récentes et de l'objectif, avec de l'air autour
  const valeurs = [...bilan.recentes.map((p) => p.kg), ...(suivi.objectifKg !== null ? [suivi.objectifKg] : [])]
  const [min, max] = [Math.min(...valeurs), Math.max(...valeurs)]
  const marge = Math.max(0.5, (max - min) * 0.15)
  const y = (kg: number) => 74 - ((kg - (min - marge)) / (max + marge - (min - marge))) * 68
  const debutFenetre = Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10)) - 8 * 7 * 86_400_000
  const x = (iso: string) => 8 + ((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - debutFenetre) / (8 * 7 * 86_400_000)) * 314
  const points = bilan.recentes.map((p) => `${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`)

  return (
    <section className="profil__carte" aria-labelledby="profil-poids">
      <div className="profil__carte-tete">
        <h2 id="profil-poids">Poids</h2>
        <button type="button" className="profil__lien-texte-bouton" onClick={() => setObjectif(suivi.objectifKg === null ? '' : String(suivi.objectifKg).replace('.', ','))}>
          {suivi.objectifKg === null ? 'Définir un objectif' : `Objectif ${FORMAT.format(suivi.objectifKg)} kg`}
        </button>
      </div>

      {objectif !== null && (
        <form
          className="profil__objectifs-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (objectif.trim() === '') {
              setSuivi(definirObjectifPoids(suivi, null) ?? suivi)
              setObjectif(null)
            } else if (objectifValide) {
              setSuivi(definirObjectifPoids(suivi, objectifKg) ?? suivi)
              setObjectif(null)
            }
          }}
        >
          <div className="formulaire__champ">
            <label htmlFor="poids-objectif">Objectif de poids (kg)</label>
            <input id="poids-objectif" inputMode="decimal" value={objectif} autoFocus onChange={(e) => setObjectif(e.target.value)} />
            <p className="aide">Vide : pas d’objectif.</p>
          </div>
          {objectif.trim() !== '' && !objectifValide && (
            <p role="alert" className="formulaire__erreur">
              Entre {POIDS_MIN_KG} et {POIDS_MAX_KG} kg.
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="button" className="bouton" onClick={() => setObjectif(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={objectif.trim() !== '' && !objectifValide}>
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {bilan.derniere ? (
        <>
          <div className="profil__poids-haut">
            <p className="profil__poids-valeur">
              <strong>{FORMAT.format(bilan.derniere.kg)} kg</strong>
              <span className="aide">pesée du {formaterDate(bilan.derniere.date)}</span>
            </p>
            {bilan.ecart30j !== null && (
              <p className="profil__poids-ecart">
                {bilan.ecart30j > 0 ? '↑ +' : bilan.ecart30j < 0 ? '↓ −' : ''}
                {FORMAT.format(Math.abs(bilan.ecart30j))} kg en 30 jours
              </p>
            )}
          </div>
          {bilan.recentes.length > 0 && (
            <svg
              viewBox="0 0 330 80"
              className="profil__poids-courbe"
              role="img"
              aria-label={`Poids sur 8 semaines : de ${FORMAT.format(bilan.recentes[0].kg)} kg à ${FORMAT.format(bilan.recentes[bilan.recentes.length - 1].kg)} kg${suivi.objectifKg !== null ? `, objectif ${FORMAT.format(suivi.objectifKg)} kg` : ''}`}
            >
              {suivi.objectifKg !== null && <line x1="4" x2="326" y1={y(suivi.objectifKg)} y2={y(suivi.objectifKg)} className="profil__poids-objectif" />}
              {points.length > 1 && <polyline points={points.join(' ')} className="profil__poids-trace" />}
              {points.length > 0 && <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r="5" className="profil__poids-point" />}
            </svg>
          )}
        </>
      ) : (
        <p className="aide">Aucune pesée pour l’instant. Ajoutez la première pour suivre votre poids.</p>
      )}

      {saisie ? (
        <form
          className="profil__objectifs-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!saisieValide) return
            setSuivi(ajouterPesee(suivi, saisie.date, kgSaisi) ?? suivi)
            setSaisie(null)
          }}
        >
          <div className="formulaire__champ">
            <label htmlFor="poids-kg">Poids (kg)</label>
            <input id="poids-kg" inputMode="decimal" value={saisie.kg} autoFocus onChange={(e) => setSaisie({ ...saisie, kg: e.target.value })} />
          </div>
          <div className="formulaire__champ">
            <label htmlFor="poids-date">Jour de la pesée</label>
            <input id="poids-date" type="date" max={aujourdhui} value={saisie.date} onChange={(e) => setSaisie({ ...saisie, date: e.target.value })} />
          </div>
          {saisie.kg.trim() !== '' && !(Number.isFinite(kgSaisi) && kgSaisi >= POIDS_MIN_KG && kgSaisi <= POIDS_MAX_KG) && (
            <p role="alert" className="formulaire__erreur">
              Entre {POIDS_MIN_KG} et {POIDS_MAX_KG} kg.
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="button" className="bouton" onClick={() => setSaisie(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={!saisieValide}>
              Enregistrer la pesée
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="bouton" onClick={() => setSaisie({ kg: bilan.derniere ? String(bilan.derniere.kg).replace('.', ',') : '', date: aujourdhui })}>
          + Ajouter une pesée
        </button>
      )}

      {suivi.pesees.length > 0 && (
        <details className="profil__pesees">
          <summary>Mes pesées ({suivi.pesees.length})</summary>
          <ul>
            {[...suivi.pesees].reverse().slice(0, 30).map((p) => (
              <li key={p.date}>
                <span>
                  {formaterDate(p.date)} · {FORMAT.format(p.kg)} kg
                </span>
                <button type="button" className="bouton bouton--alerte" aria-label={`Supprimer la pesée du ${formaterDate(p.date)}`} onClick={() => setSuivi(retirerPesee(suivi, p.date))}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="aide">Le poids reste sur cet appareil : il n’est ni synchronisé ni compris dans l’export. Aucune conclusion de santé n’en est tirée.</p>
    </section>
  )
}
