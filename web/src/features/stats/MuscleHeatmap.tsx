import { HEATMAP_VIEWBOX, type VueHeatmap } from './heatmapZones'
import { libelleSeries, type GroupeVue } from './presentation'

const NOM_VUE: Record<VueHeatmap, string> = { face: 'de face', dos: 'de dos' }

interface Props {
  image: string
  vue: VueHeatmap
  /** Groupes ayant une zone sur cette vue */
  zones: GroupeVue[]
}

// Fond du panda (WebP) et calque SVG d'une zone par groupe, colorée selon son niveau de volume.
// La couleur n'est jamais seule : chaque zone a un <title> et la liste sous la figure donne les valeurs.
export function MuscleHeatmap({ image, vue, zones }: Props) {
  const { largeur, hauteur } = HEATMAP_VIEWBOX
  return (
    <figure className="heatmap" aria-label={`Heatmap musculaire, vue ${NOM_VUE[vue]}`}>
      <div className="heatmap__cadre">
        <img className="heatmap__image" src={image} alt="" width={largeur} height={hauteur} decoding="async" />
        <svg className="heatmap__calque" viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={`Zones musculaires, vue ${NOM_VUE[vue]}`}>
          {zones.map((z) =>
            z.svgPath ? (
              <path
                key={z.groupe}
                d={z.svgPath}
                className={z.couleur ? 'heatmap__zone' : 'heatmap__zone heatmap__zone--vide'}
                fill={z.couleur ?? 'transparent'}
              >
                <title>{`${z.libelle} : ${libelleSeries(z.series)} (${z.libelleNiveau.toLowerCase()})`}</title>
              </path>
            ) : null,
          )}
        </svg>
      </div>
      <figcaption className="heatmap__legende">Séries par muscle principal sur la période, vue {NOM_VUE[vue]}.</figcaption>
    </figure>
  )
}
