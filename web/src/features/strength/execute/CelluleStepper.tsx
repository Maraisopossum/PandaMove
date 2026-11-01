import { useChampNombre } from '../useChampNombre'

interface Props {
  /** Nom accessible du champ de saisie, ex. « Série 2, répétitions » */
  libelle: string
  /** Complément des noms des boutons, ex. « les répétitions, série 2 » → « Diminuer les répétitions, série 2 » */
  cible: string
  valeur: number | null
  facultatif: boolean
  /** Valeur issue du prévu et non d'une saisie : affichée grisée */
  grisee: boolean
  /** Série validée ou écran en lecture seule : plus de saisie ni de pas */
  figee: boolean
  suffixe?: string
  /** Texte des boutons (« − » / « + », ou « −5 » / « +5 » pour le repos) */
  glyphes?: { moins: string; plus: string }
  min: number
  /** Valeur après un appui sur − (-1) ou + (1) */
  suivante: (valeur: number | null, sens: -1 | 1) => number
  onCommit: (v: number | null) => void
}

// Cellule du tableau de séries : [−] valeur [+] (maquette Stitch « Steppers + / − »). La valeur reste un champ
// éditable au clavier (virgule décimale) ; les boutons de 24 px de large occupent toute la hauteur de la cellule.
export function CelluleStepper({
  libelle, cible, valeur, facultatif, grisee, figee, suffixe = '', glyphes = { moins: '−', plus: '+' }, min, suivante, onCommit,
}: Props) {
  const { texte, changer } = useChampNombre(valeur, facultatif, onCommit)
  // « −5 » / « +5 » : texte plus petit pour tenir dans 24 px
  const classePas = glyphes.moins.length > 1 ? 'tableau-series__pas tableau-series__pas--texte' : 'tableau-series__pas'
  const courant = valeur !== null && Number.isFinite(valeur) ? valeur : null
  const classes = ['tableau-series__cellule', grisee && !figee ? 'tableau-series__cellule--grisee' : '', figee ? 'tableau-series__cellule--figee' : '']
  return (
    <span className={classes.filter(Boolean).join(' ')}>
      <button
        type="button"
        className={classePas}
        aria-label={`Diminuer ${cible}`}
        disabled={figee || (courant !== null && courant <= min)}
        onClick={() => onCommit(suivante(valeur, -1))}
      >
        <span aria-hidden="true">{glyphes.moins}</span>
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={libelle}
        value={texte}
        readOnly={figee}
        onChange={(e) => changer(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
      {suffixe && texte !== '' && (
        <span aria-hidden="true" className="tableau-series__suffixe">
          {suffixe}
        </span>
      )}
      <button
        type="button"
        className={classePas}
        aria-label={`Augmenter ${cible}`}
        disabled={figee}
        onClick={() => onCommit(suivante(valeur, 1))}
      >
        <span aria-hidden="true">{glyphes.plus}</span>
      </button>
    </span>
  )
}
