import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { construireNav, indexParDefaut, libelleTypeBloc, positionDefilement } from './navExercices'
import { apresSerie, exerciceValide } from './navigationSeries'
import type { BlocVue, ExerciceVue } from './vue'

// Id de l'exercice affiché : le choix de l'utilisateur s'il existe encore, sinon le premier non terminé.
function idActifDe(choix: string | null, exercices: ExerciceVue[]): string | null {
  if (choix !== null && exercices.some((e) => e.id === choix)) return choix
  return exercices[indexParDefaut(exercices)]?.id ?? null
}

// Défile la barre vers le badge de `idActif` : début du groupe encadré calé à gauche (moins 16 px), sinon
// badge centré. `reduit` (prefers-reduced-motion) : saut immédiat, sans animation. Sans effet si le
// navigateur ne sait pas défiler (jsdom) ou si le badge est introuvable.
export function defilerVersBadge(piste: HTMLElement, idActif: string, reduit: boolean): void {
  const badge = Array.from(piste.querySelectorAll<HTMLElement>('[data-nav-id]')).find((b) => b.dataset.navId === idActif)
  if (!badge || typeof piste.scrollTo !== 'function') return
  const rPiste = piste.getBoundingClientRect()
  // Coordonnée d'un élément dans le contenu défilant
  const gaucheDans = (el: HTMLElement) => el.getBoundingClientRect().left - rPiste.left + piste.scrollLeft
  const groupe = badge.closest<HTMLElement>('[data-groupe-encadre="true"]')
  piste.scrollTo({
    left: positionDefilement({
      largeurVue: rPiste.width,
      gauche: gaucheDans(badge),
      largeur: badge.getBoundingClientRect().width,
      groupeGauche: groupe ? gaucheDans(groupe) : null,
    }),
    behavior: reduit ? 'auto' : 'smooth',
  })
}

const preferenceMouvementReduit = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Barre d'exercices : exercice actif (état local), groupes à afficher, défilement automatique.
// Après chaque série validée l'actif change comme sur Android (voir navigationSeries) ; l'utilisateur peut
// toujours choisir à la main dans la barre.
export function useNavExercices(blocs: BlocVue[], exercices: ExerciceVue[]) {
  const [choix, setChoix] = useState<string | null>(null)
  const [precedents, setPrecedents] = useState(exercices)
  if (precedents !== exercices) {
    // Ajustement pendant le rendu (relecture de la base) : comparaison avant/après de l'exercice actif
    setPrecedents(exercices)
    // Série validée : navigation comme Android (superset / circuit : exercice suivant du tour ; exercice
    // complet : suivant). Sinon, premier chargement : le défaut devient un choix figé.
    const valide = exerciceValide(precedents, exercices)
    const suivant = valide === null ? null : apresSerie(exercices, valide).activerId
    if (suivant !== null) setChoix(suivant)
    else if (choix === null && exercices.length > 0) setChoix(idActifDe(null, exercices))
  }

  const idActif = idActifDe(choix, exercices)
  const blocActif = blocs.find((b) => b.exercices.some((e) => e.id === idActif)) ?? null
  const groupes = useMemo(() => construireNav(blocs, idActif), [blocs, idActif])
  const piste: RefObject<HTMLUListElement | null> = useRef(null)

  useEffect(() => {
    if (idActif !== null && piste.current) defilerVersBadge(piste.current, idActif, preferenceMouvementReduit())
  }, [idActif])

  return {
    idActif,
    exerciceActif: exercices.find((e) => e.id === idActif) ?? null,
    blocActif,
    libelleTypeBloc: libelleTypeBloc(blocActif?.type ?? null),
    groupes,
    piste,
    choisir: setChoix,
  }
}
