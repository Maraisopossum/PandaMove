import type { VueCarte } from './mercatorCarte'

// Tuiles de fond d'une vue : à placer dans un <svg> de même repère que la vue, sous les tracés. Une tuile qui ne se charge
// pas (hors ligne) laisse simplement voir le fond uni du <svg>.
export function FondCarte({ vue }: { vue: Pick<VueCarte, 'tuiles'> }) {
  return (
    <g aria-hidden="true" className="fond-carte">
      {vue.tuiles.map((t) => (
        <image key={t.url} href={t.url} x={t.x} y={t.y} width={t.cote} height={t.cote} preserveAspectRatio="none" />
      ))}
    </g>
  )
}

// Mention obligatoire des données OpenStreetMap, à afficher sur chaque carte.
export function MentionOsm() {
  return (
    <a className="fond-carte__mention" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
      © contributeurs OpenStreetMap
    </a>
  )
}
