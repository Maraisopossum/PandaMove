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

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'a', 'à', 'en', 'et', 'sur', 'avec'])

// Libellé de la pastille : initiales de l'exercice (2 lettres max, majuscules) en ignorant les petits mots
// (« Développé couché haltères » → DC) ; un seul mot : ses deux premières lettres.
export function libelleCourt(e: Pick<ExerciceVue, 'nom'>): string {
  const mots = e.nom.split(/[\s'’_-]+/).filter((m) => m !== '')
  const utiles = mots.filter((m) => !MOTS_VIDES.has(m.toLowerCase()))
  const retenus = utiles.length > 0 ? utiles : mots
  const lettres = (m: string) => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '')
  const initiales = retenus.length >= 2 ? lettres(retenus[0]).slice(0, 1) + lettres(retenus[1]).slice(0, 1) : lettres(retenus[0] ?? '').slice(0, 2)
  return initiales.toUpperCase()
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
  // Statut court affiché sous le nom (maquette) : l'exercice affiché est « En cours »
  statut: 'En cours' | 'Terminé' | 'À venir'
}

export interface GroupeNav {
  cle: string
  // Rang du bloc dans la séance (à partir de 1) et son nom : étiquette « BLOC 1 » du groupe encadré
  rang: number
  nom: string
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
  return blocs.map((b, i) => ({
    cle: b.cle,
    rang: i + 1,
    nom: b.nom,
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
        statut: e.id === idActif ? 'En cours' : exerciceTermine(e) ? 'Terminé' : 'À venir',
      }
    }),
  }))
}

// « 2 sur 5 » : rang de l'exercice actif parmi tous les exercices de la barre (0 si aucun n'est actif).
export function progressionNav(groupes: GroupeNav[]): { rang: number; total: number } {
  const badges = groupes.flatMap((g) => g.badges)
  return { rang: badges.findIndex((b) => b.actif) + 1, total: badges.length }
}


// Position de défilement (scrollLeft) cible, coordonnées relatives au contenu défilant : l'exercice actif est
// toujours centré dans la barre (même dans un bloc encadré ; `groupeGauche` n'est plus utilisé).
export function positionDefilement(p: { largeurVue: number; gauche: number; largeur: number; groupeGauche: number | null }): number {
  const cible = p.gauche + p.largeur / 2 - p.largeurVue / 2
  return Math.max(0, Math.round(cible))
}
