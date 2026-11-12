import type { Sortie } from '../../core/db/repos/sorties'
import { courbeSerie, lireSerie } from './statsSorties'

const COURBES = [
  { champ: 'fc', libelle: 'Fréquence cardiaque', unite: 'bpm' },
  { champ: 'w', libelle: 'Puissance', unite: 'W' },
  { champ: 'a', libelle: 'Altitude', unite: 'm' },
] as const

// Courbes de la sortie importée (FC, puissance, altitude). Rien si la sortie est saisie à la main. Le tracé est dans le bandeau.
export function TraceSortie({ sortie }: { sortie: Pick<Sortie, 'serie'> }) {
  const serie = lireSerie(sortie)
  const courbes = COURBES.flatMap((c) => {
    const courbe = courbeSerie(serie, c.champ, 320, 70)
    return courbe ? [{ ...c, courbe }] : []
  })
  if (courbes.length === 0) return null
  return (
    <section className="sorties__trace" aria-label="Courbes">
      {courbes.map(({ champ, libelle, unite, courbe }) => (
        <figure key={champ} className="sorties__courbe">
          <figcaption>
            {libelle}{' '}
            <span className="outils__chiffre-detail">
              {courbe.min} à {courbe.max} {unite}
            </span>
          </figcaption>
          <svg viewBox="0 0 320 70" role="img" aria-label={`${libelle} de ${courbe.min} à ${courbe.max} ${unite}`}>
            <polyline points={courbe.points} fill="none" className="sorties__courbe-ligne" />
          </svg>
        </figure>
      ))}
    </section>
  )
}
