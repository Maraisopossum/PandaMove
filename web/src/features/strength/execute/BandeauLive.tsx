import { texteBandeau, type Bandeau } from './bandeauProgression'

interface Props {
  nomExercice: string
  bandeau: Bandeau
}

// Bandeau de progression live (maquette « séance en direct ») : l'objectif pour progresser et l'avancement des séries
// qui l'atteignent. Présentation seule (texte et comptes viennent de bandeauProgression).
export function BandeauLive({ nomExercice, bandeau }: Props) {
  const total = Math.max(1, bandeau.totalSeries)
  return (
    <section className="bandeau-progression" aria-label={`Progression de ${nomExercice}`}>
      <p className="bandeau-progression__titre">
        <span aria-hidden="true">↗ </span>
        {nomExercice} · en progression
      </p>
      <p className="bandeau-progression__objectif">{texteBandeau(bandeau)}</p>
      <div className="bandeau-progression__compte">
        <span>
          <span aria-hidden="true">🔓 </span>
          {bandeau.seriesReussies}/{bandeau.totalSeries}
          <span className="visuellement-cache"> séries réussies</span>
        </span>
        <progress max={total} value={Math.min(total, bandeau.seriesReussies)} aria-label="Séries qui atteignent la cible" />
      </div>
    </section>
  )
}
