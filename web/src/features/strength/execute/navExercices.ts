import { LIBELLES_BLOC, type TypeBloc } from '../draft'
import { nombreLignes } from './lignesSeries'
import type { BlocVue, ExerciceVue } from './vue'

// Barre horizontale d'exercices de l'écran d'exécution (parité Android : HorizontalExerciseNav).
// Fonctions pures : regroupement par bloc, libellés courts, exercice actif, cible de défilement.

// Teintes par type de bloc. `clair` : thème clair (fond du badge actif sous texte blanc, texte et bordure
// sur surface claire) ; `sombre` : thème sombre (texte et bordure sur surface sombre, fond du badge actif
// sous texte sombre). Les teintes Android (ex. échauffement #FF8F00, blanc dessus = 2,3:1) sont assombries
// en thème clair pour atteindre 4,5:1 (WCAG AA) ; vérifié par les tests avec app/contraste.ts.
export const COULEURS_BLOC = {
  ECHAUFFEMENT: { clair: '#9A5700', sombre: '#FFB74D' },
  ACTIVATION: { clair: '#5E35B1', sombre: '#B39DDB' },
  SUPERSET: { clair: '#BA4100', sombre: '#FF8A50' },
  CIRCUIT: { clair: '#007580', sombre: '#4DD0E1' },
  RECUPERATION: { clair: '#2A7430', sombre: '#81C784' },
  // Couleur primaire du module (violet)
  AUTRE: { clair: '#5B3D9E', sombre: '#B8A1F0' },
} as const

export interface CouleursBloc {
  clair: string
  sombre: string
}

export function couleursBloc(type: string | null): CouleursBloc {
  return type !== null && type !== 'AUTRE' && type in COULEURS_BLOC
    ? COULEURS_BLOC[type as keyof typeof COULEURS_BLOC]
    : COULEURS_BLOC.AUTRE
}

// Encadré : superset / circuit de plus d'un exercice, ou bloc d'échauffement / activation / récupération.
export function estGroupeEncadre(type: string | null, nbExercices: number): boolean {
  if (type === 'SUPERSET' || type === 'CIRCUIT') return nbExercices > 1
  return type === 'ECHAUFFEMENT' || type === 'ACTIVATION' || type === 'RECUPERATION'
}

// Libellé de la pastille : « 🔄 » si bilatéral, sinon premier mot du premier groupe musculaire (4 lettres
// max, majuscules), à défaut les 3 premières lettres du nom.
export function libelleCourt(e: Pick<ExerciceVue, 'isBilateral' | 'muscles' | 'nom'>): string {
  if (e.isBilateral) return '🔄'
  const mot = (e.muscles[0] ?? '').split(/[\s_-]+/).find((m) => m !== '')
  return (mot ?? e.nom.trim().slice(0, 3)).slice(0, 4).toUpperCase()
}

// Libellé du type de bloc (« Superset »…) ; null hors bloc ou pour un type inconnu.
export function libelleTypeBloc(type: string | null): string | null {
  return type !== null && type in LIBELLES_BLOC ? LIBELLES_BLOC[type as TypeBloc] : null
}

// Exercice terminé : au moins une série, et toutes les séries prévues saisies.
export function exerciceTermine(e: Pick<ExerciceVue, 'series' | 'nombreSeriesPrevues' | 'isBilateral'>): boolean {
  return nombreFaites(e) > 0 && nombreFaites(e) >= nombreLignes(e)
}

// Séries validées (les lignes laissées non validées ne comptent pas)
const nombreFaites = (e: Pick<ExerciceVue, 'series'>) => e.series.filter((s) => s.terminee).length

// Exercice actif au chargement : premier non terminé, à défaut le premier.
export function indexParDefaut(exercices: ExerciceVue[]): number {
  const i = exercices.findIndex((e) => !exerciceTermine(e))
  return i >= 0 ? i : 0
}

export interface BadgeNav {
  id: string
  nom: string
  libelle: string
  actif: boolean
  termine: boolean
  // « terminé » ou « 1 série sur 3 faite »
  etat: string
  // Nom accessible complet : exercice, bloc, état
  nomAccessible: string
}

export interface GroupeNav {
  cle: string
  encadre: boolean
  couleurs: CouleursBloc
  badges: BadgeNav[]
}

function etatExercice(e: ExerciceVue): string {
  if (exerciceTermine(e)) return 'terminé'
  const n = nombreFaites(e)
  const prevues = nombreLignes(e)
  return `${n} série${n > 1 ? 's' : ''} sur ${prevues} faite${n > 1 ? 's' : ''}`
}

// Un groupe par bloc ou par suite d'exercices libres (ordre unifié de construireVue).
export function construireNav(blocs: BlocVue[], idActif: string | null): GroupeNav[] {
  return blocs.map((b) => ({
    cle: b.cle,
    encadre: estGroupeEncadre(b.type, b.exercices.length),
    couleurs: couleursBloc(b.type),
    badges: b.exercices.map((e) => {
      const etat = etatExercice(e)
      return {
        id: e.id,
        nom: e.nom,
        libelle: libelleCourt(e),
        actif: e.id === idActif,
        termine: exerciceTermine(e),
        etat,
        nomAccessible: `${e.nom}, ${b.nom}, ${etat}`,
      }
    }),
  }))
}

export const MARGE_GROUPE_PX = 16

// Position de défilement (scrollLeft) cible, coordonnées relatives au contenu défilant. Groupe encadré :
// son début au bord gauche moins 16 px ; sinon badge centré dans la barre.
export function positionDefilement(p: { largeurVue: number; gauche: number; largeur: number; groupeGauche: number | null }): number {
  const cible = p.groupeGauche !== null ? p.groupeGauche - MARGE_GROUPE_PX : p.gauche + p.largeur / 2 - p.largeurVue / 2
  return Math.max(0, Math.round(cible))
}
