// Logique de la fonction `analyser-assiette` : analyse d'une photo de repas par un modèle de vision (Anthropic) et nettoyage de sa réponse.
// Aucune dépendance à Deno ni à Supabase : les accès passent par des « ports » injectés (index.ts les branche), ce qui permet de tester
// toutes les règles sous Vitest (src/core/nutrition/fonctionAnalyserAssiette.test.ts).
//
// Les valeurs rendues sont des ESTIMATIONS : le client les montre modifiables avant d'enregistrer, jamais écrites directement au journal.

export const PLAFOND_PAR_JOUR_DEFAUT = 30
export const TAILLE_IMAGE_MAX = 4_000_000 // caractères base64 (≈ 3 Mo) ; le client réduit la photo à ~300 Ko
export const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const
export const NOM_OUTIL = 'enregistrer_repas'

export class ErreurAnalyse extends Error {
  readonly statut: number
  constructor(statut: number, message: string) {
    super(message)
    this.name = 'ErreurAnalyse'
    this.statut = statut
  }
}

export type Confiance = 'haute' | 'moyenne' | 'faible'

export interface AlimentAnalyse {
  nom: string
  quantiteG: number
  kcal100: number
  proteines100: number
  glucides100: number
  lipides100: number
  fibres100: number | null
  confiance: Confiance
}

export interface ResultatAnalyse {
  estUnRepas: boolean
  aliments: AlimentAnalyse[]
  remarque: string | null
}

export interface DemandeAnalyse {
  image: string
  mediaType: (typeof TYPES_IMAGE)[number]
  indication: string | null
}

export function lireDemande(brut: unknown): DemandeAnalyse {
  if (typeof brut !== 'object' || brut === null) throw new ErreurAnalyse(400, 'Demande invalide.')
  const o = brut as Record<string, unknown>
  const mediaType = TYPES_IMAGE.find((t) => t === o.mediaType)
  if (!mediaType) throw new ErreurAnalyse(400, 'Format d’image non pris en charge (JPEG, PNG ou WebP).')
  if (typeof o.image !== 'string' || o.image.length < 100 || !/^[A-Za-z0-9+/]+=*$/.test(o.image.slice(0, 200))) throw new ErreurAnalyse(400, 'Image invalide.')
  if (o.image.length > TAILLE_IMAGE_MAX) throw new ErreurAnalyse(413, 'Photo trop volumineuse.')
  const indication = typeof o.indication === 'string' && o.indication.trim() ? o.indication.trim().slice(0, 200) : null
  return { image: o.image, mediaType, indication }
}

export const CONSIGNE_SYSTEME = [
  'Tu es un diététicien qui estime le contenu nutritionnel d’un repas à partir d’une photo.',
  'Identifie chaque aliment ou composant distinct visible (féculent, viande ou poisson, légumes, sauce, fromage, boisson, dessert…).',
  'Pour chacun : donne son nom en français, la quantité servie en grammes (ou millilitres pour un liquide) en t’aidant de la taille de l’assiette, des couverts et des repères visibles,',
  'puis les valeurs nutritionnelles moyennes POUR 100 g de l’aliment tel que servi (cuit s’il est cuit) : énergie en kcal, protéines, glucides, lipides, fibres en grammes.',
  'Une assiette vue de dessus cache souvent l’huile, le beurre et les sauces : si tu soupçonnes une matière grasse de cuisson, ajoute-la comme composant distinct avec une petite quantité et une confiance « faible ».',
  'N’invente pas ce qui n’est pas visible. Si la photo n’est pas un repas ou si rien n’est identifiable, mets est_un_repas à false et laisse la liste vide.',
  'La confiance vaut « haute » quand l’aliment et la quantité sont clairs, « moyenne » quand l’un des deux est incertain, « faible » quand tu devines.',
  'Dans « remarque », indique en une ou deux phrases ce qui rend l’estimation incertaine, ou ce que l’utilisateur devrait vérifier. Tu réponds uniquement en appelant l’outil.',
].join(' ')

const nombre = { type: 'number' }
export const SCHEMA_OUTIL = {
  type: 'object',
  properties: {
    est_un_repas: { type: 'boolean', description: 'false si la photo ne montre pas de nourriture identifiable.' },
    aliments: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          quantite_g: { ...nombre, description: 'Quantité servie, en grammes (ml pour un liquide).' },
          kcal_100: { ...nombre, description: 'Énergie pour 100 g, en kcal.' },
          proteines_100: nombre,
          glucides_100: nombre,
          lipides_100: nombre,
          fibres_100: nombre,
          confiance: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
        },
        required: ['nom', 'quantite_g', 'kcal_100', 'proteines_100', 'glucides_100', 'lipides_100', 'confiance'],
      },
    },
    remarque: { type: 'string' },
  },
  required: ['est_un_repas', 'aliments'],
} as const

const borne = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : Number.NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
}

/** Réponse du modèle (entrée de l'outil) : valeurs bornées, au plus 12 aliments, tout ce qui est inexploitable est écarté. */
export function nettoyerAnalyse(brut: unknown): ResultatAnalyse {
  if (typeof brut !== 'object' || brut === null) throw new ErreurAnalyse(502, 'Réponse de l’analyse illisible.')
  const o = brut as Record<string, unknown>
  const aliments: AlimentAnalyse[] = []
  for (const a of Array.isArray(o.aliments) ? o.aliments : []) {
    if (aliments.length >= 12 || typeof a !== 'object' || a === null) continue
    const x = a as Record<string, unknown>
    const nom = typeof x.nom === 'string' ? x.nom.trim().slice(0, 200) : ''
    const quantiteG = borne(x.quantite_g, 1, 5000)
    const kcal100 = borne(x.kcal_100, 0, 1000)
    const proteines100 = borne(x.proteines_100, 0, 100)
    const glucides100 = borne(x.glucides_100, 0, 100)
    const lipides100 = borne(x.lipides_100, 0, 100)
    if (!nom || quantiteG === null || kcal100 === null || proteines100 === null || glucides100 === null || lipides100 === null) continue
    aliments.push({
      nom, quantiteG: Math.round(quantiteG), kcal100: Math.round(kcal100), proteines100: Math.round(proteines100 * 10) / 10, glucides100: Math.round(glucides100 * 10) / 10,
      lipides100: Math.round(lipides100 * 10) / 10, fibres100: ((f) => (f === null ? null : Math.round(f * 10) / 10))(borne(x.fibres_100, 0, 100)),
      confiance: x.confiance === 'haute' || x.confiance === 'faible' ? x.confiance : 'moyenne',
    })
  }
  const remarque = typeof o.remarque === 'string' && o.remarque.trim() ? o.remarque.trim().slice(0, 500) : null
  return { estUnRepas: o.est_un_repas !== false && aliments.length > 0, aliments, remarque }
}

export interface PortsAnalyse {
  /** Nombre d'analyses de l'appelant sur les dernières 24 h. */
  analysesRecentes(): Promise<number>
  /** Note l'analyse (avant l'appel au modèle : un échec compte quand même, pour borner le coût). */
  noterAnalyse(): Promise<void>
  /** Appelle le modèle de vision ; renvoie l'entrée de l'outil `enregistrer_repas`. */
  appelerModele(demande: DemandeAnalyse): Promise<unknown>
  plafondParJour: number
}

export async function executer(demande: DemandeAnalyse, p: PortsAnalyse): Promise<ResultatAnalyse> {
  if ((await p.analysesRecentes()) >= p.plafondParJour) {
    throw new ErreurAnalyse(429, `Limite atteinte : ${p.plafondParJour} analyses de photo par jour. Réessayez demain ou saisissez le repas à la main.`)
  }
  await p.noterAnalyse()
  return nettoyerAnalyse(await p.appelerModele(demande))
}
