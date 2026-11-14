import { useMemo, useState } from 'react'
import type { Sortie } from '../../core/db/repos/sorties'
import { tempsParZone, type MesureZones } from './analyseSerie'
import { parametresEffectifs } from './calculCharge'
import { duree } from '../home/bilanSemaine'
import { formaterDuree } from './presentation'
import { analyserSortie, comparerSortie, DISTANCES, EFFORTS, verdict, type Comparaison } from './recordsSorties'
import { lireSerie } from './statsSorties'
import { lireReglagesCharge } from './useChargeEntrainement'
import { useRecordsSorties } from './useRecordsSorties'

const FORMAT_1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

function valeurComparee(c: Comparaison, v: number, sport: Sortie['sport']): string {
  if (c.id === 'distance') return `${FORMAT_1.format(v / 1000)} km`
  if (c.id === 'denivele') return `${Math.round(v)} m`
  return sport === 'course' ? `${formaterDuree(v)} /km` : `${FORMAT_1.format(v)} km/h`
}

// Part de la couleur du sport de plus en plus forte de Z1 à Z5
const INTENSITE_ZONES = [30, 48, 66, 84, 100]

// Analyse d'une sortie sous le détail : temps par zone (puissance du vélo, fréquence cardiaque), position parmi les sorties des 30
// jours précédents et meilleurs efforts ou tronçons de la sortie, avec ceux qui sont des records. `toutes` : toutes les sorties
// (la FTP et la FC max estimées viennent de l'ensemble). Chaque bloc se masque sans donnée exploitable. Calculs dans analyseSerie.ts
// et recordsSorties.ts.
export function AnalyseSortieBloc({ sortie: s, toutes }: { sortie: Sortie; toutes: Sortie[] }) {
  const serie = useMemo(() => lireSerie(s), [s])
  const reglages = useMemo(() => lireReglagesCharge(), [])
  const params = useMemo(() => parametresEffectifs(toutes, reglages), [toutes, reglages])
  const zonesPuissance = useMemo(() => (s.sport === 'velo' ? tempsParZone(serie, 'w', params.ftpW) : null), [s.sport, serie, params.ftpW])
  const zonesCoeur = useMemo(() => tempsParZone(serie, 'fc', params.fcMax), [serie, params.fcMax])
  const [choix, setChoix] = useState<MesureZones | null>(null)
  const mesure: MesureZones | null = choix === 'fc' && zonesCoeur ? 'fc' : choix === 'w' && zonesPuissance ? 'w' : zonesPuissance ? 'w' : zonesCoeur ? 'fc' : null
  const zones = mesure === 'w' ? zonesPuissance : mesure === 'fc' ? zonesCoeur : null

  const comparaison = useMemo(() => comparerSortie(s, toutes), [s, toutes])
  const analyse = useMemo(() => analyserSortie(s), [s])
  const { records } = useRecordsSorties(toutes, s.sport)
  const reference = mesure === 'w' ? params.ftpW : params.fcMax
  const estimee = mesure === 'w' ? reglages.ftpW === undefined : reglages.fcMax === undefined
  const meilleurs =
    s.sport === 'course'
      ? DISTANCES.flatMap((d) => {
          const t = analyse.temps[d.id]
          const record = records.distances.find((x) => x.definition.id === d.id)?.record
          return t === undefined ? [] : [{ id: d.id, libelle: d.libelle, valeur: formaterDuree(t), record: record?.sortieId === s.id && toutes.filter((x) => x.sport === s.sport).length > 1 }]
        })
      : EFFORTS.flatMap((e) => {
          const w = analyse.efforts[e.id]
          const record = records.efforts.find((x) => x.definition.id === e.id)?.record
          return w === undefined ? [] : [{ id: e.id, libelle: e.libelle, valeur: `${w} W`, record: record?.sortieId === s.id && toutes.filter((x) => x.sport === s.sport).length > 1 }]
        })

  return (
    <>
      {zones && mesure && (
        <section className="sorties__analyse" aria-labelledby="analyse-zones">
          <div className="sorties__semaine-tete">
            <h2 id="analyse-zones">Temps par zone</h2>
            {zonesPuissance && zonesCoeur && (
              <div role="group" aria-label="Mesure des zones" className="segmente">
                <button type="button" className="bouton" aria-pressed={mesure === 'w'} onClick={() => setChoix('w')}>
                  Puissance
                </button>
                <button type="button" className="bouton" aria-pressed={mesure === 'fc'} onClick={() => setChoix('fc')}>
                  Cœur
                </button>
              </div>
            )}
          </div>
          <ul className="sorties__zones">
            {zones.map((z, i) => (
              <li key={z.nom}>
                <span className="sorties__zone-nom">{z.nom}</span>
                <span className="sorties__zone-corps">
                  <span className="sorties__zone-piste" aria-hidden="true">
                    <span className="sorties__zone-barre" style={{ width: `${Math.round(z.part * 100)}%`, background: `color-mix(in srgb, var(--couleur-sport) ${INTENSITE_ZONES[i]}%, var(--surface))` }} />
                  </span>
                  <span className="sorties__zone-plage">{z.plage}</span>
                </span>
                <span className="sorties__zone-temps">
                  <strong>{duree(z.dureeS)}</strong>
                  <span>{Math.round(z.part * 100)} %</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="aide">
            Zones calculées sur {mesure === 'w' ? `votre FTP de ${reference} W` : `votre FC max de ${reference} bpm`}
            {estimee ? ' (estimée d’après vos sorties)' : ''}. Réglez-la dans Statistiques, vue Forme.
          </p>
        </section>
      )}

      {comparaison && (
        <section className="sorties__analyse" aria-labelledby="analyse-comparaison">
          <div className="sorties__semaine-tete">
            <h2 id="analyse-comparaison">Par rapport à vos sorties</h2>
            <span className="aide">30 derniers jours</span>
          </div>
          <ul className="sorties__comparaisons">
            {comparaison.comparaisons.map((c) => (
              <li key={c.id}>
                <span className="sorties__comparaison-ligne">
                  <span>{c.nom}</span>
                  <strong>{valeurComparee(c, c.sortie, s.sport)}</strong>
                </span>
                <span className="sorties__echelle" aria-hidden="true">
                  <span className="sorties__echelle-moyenne" style={{ left: `${c.positionMoyenne}%` }} />
                  <span className="sorties__echelle-sortie" style={{ left: `${c.positionSortie}%` }} />
                </span>
                <span className="aide">
                  {verdict(c)} · moyenne {valeurComparee(c, c.moyenne, s.sport)}
                  {c.id === 'distance' && comparaison.rangDistance !== null && comparaison.rangDistance <= 3
                    ? ` · ${comparaison.rangDistance === 1 ? 'la plus longue' : `${comparaison.rangDistance}e plus longue`} sur ${comparaison.nombre} sorties`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {meilleurs.length > 0 && (
        <section className="sorties__analyse" aria-labelledby="analyse-meilleurs">
          <h2 id="analyse-meilleurs">{s.sport === 'course' ? 'Meilleurs tronçons' : 'Meilleurs efforts'}</h2>
          <table className="stats__tableau">
            <thead>
              <tr>
                <th scope="col">{s.sport === 'course' ? 'Distance' : 'Durée'}</th>
                <th scope="col">{s.sport === 'course' ? 'Temps' : 'Puissance'}</th>
                <th scope="col">Record perso</th>
              </tr>
            </thead>
            <tbody>
              {meilleurs.map((m) => (
                <tr key={m.id}>
                  <td>{m.libelle}</td>
                  <td>
                    <strong>{m.valeur}</strong>
                  </td>
                  <td>{m.record ? <span className="sorties__rt-badge sorties__rt-badge--nouveau">Record</span> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
