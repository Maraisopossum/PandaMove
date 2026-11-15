// Catalogue des 8 stations Hyrox : données de référence du code, jamais en base. Une course Hyrox alterne 1 km de course et une station,
// huit fois. ATTENTION : les charges ci-dessous sont celles du règlement courant tel que connu à la rédaction ; elles changent parfois
// d'une saison à l'autre. À vérifier avec le règlement de la saison visée avant d'en dépendre (voir README du module).

export type CategorieHyrox = 'open' | 'pro'
export type GenreHyrox = 'homme' | 'femme'
export type CleStation = 'skierg' | 'sled_push' | 'sled_pull' | 'burpees' | 'rowing' | 'farmers' | 'lunges' | 'wall_balls'

export const CATEGORIES_HYROX: readonly CategorieHyrox[] = ['open', 'pro']
export const GENRES_HYROX: readonly GenreHyrox[] = ['homme', 'femme']
export const LIBELLE_CATEGORIE: Record<CategorieHyrox, string> = { open: 'Open', pro: 'Pro' }
export const LIBELLE_GENRE: Record<GenreHyrox, string> = { homme: 'Homme', femme: 'Femme' }

export interface Station {
  cle: CleStation
  nom: string
  /** Effort demandé, hors charge. */
  effort: string
  /** Poids relatif dans la répartition du temps des stations (somme normalisée au calcul). */
  poids: number
  conseil: string
  /** Charge par catégorie et genre ; null quand la station n'a pas de charge (machine à régler, poids du corps). */
  charges: Record<CategorieHyrox, Record<GenreHyrox, string | null>>
}

const sansCharge = { open: { homme: null, femme: null }, pro: { homme: null, femme: null } }

export const STATIONS: readonly Station[] = [
  {
    cle: 'skierg', nom: 'SkiErg', effort: '1 000 m', poids: 1,
    conseil: 'Partez à une allure tenable : les 1 000 m tirent sur les bras que vous devrez encore utiliser au traîneau.',
    charges: sansCharge,
  },
  {
    cle: 'sled_push', nom: 'Sled Push', effort: '50 m', poids: 0.9,
    conseil: 'Corps incliné, bras tendus, pas courts et continus : ne vous arrêtez pas, relancer un traîneau coûte plus cher que de le garder en mouvement.',
    charges: { open: { homme: '152 kg', femme: '102 kg' }, pro: { homme: '202 kg', femme: '152 kg' } },
  },
  {
    cle: 'sled_pull', nom: 'Sled Pull', effort: '50 m', poids: 1.1,
    conseil: 'Reculez en tirant avec les jambes et le dos, mains rapides sur la corde ; ne remontez pas la corde uniquement aux bras.',
    charges: { open: { homme: '103 kg', femme: '78 kg' }, pro: { homme: '153 kg', femme: '103 kg' } },
  },
  {
    cle: 'burpees', nom: 'Burpee Broad Jumps', effort: '80 m', poids: 1.4,
    conseil: 'Gardez un rythme régulier plutôt que de grands sauts : la fatigue vient du nombre de répétitions, pas de la distance de chaque saut.',
    charges: sansCharge,
  },
  {
    cle: 'rowing', nom: 'Rowing', effort: '1 000 m', poids: 1.1,
    conseil: 'Poussez fort avec les jambes, cadence modérée : c’est la station où récupérer le souffle avant les trois dernières.',
    charges: sansCharge,
  },
  {
    cle: 'farmers', nom: 'Farmers Carry', effort: '200 m', poids: 0.8,
    conseil: 'Pas rapides, épaules basses, prise solide : posez la charge seulement si vos mains lâchent.',
    charges: { open: { homme: '2 × 24 kg', femme: '2 × 16 kg' }, pro: { homme: '2 × 32 kg', femme: '2 × 24 kg' } },
  },
  {
    cle: 'lunges', nom: 'Sandbag Lunges', effort: '100 m', poids: 1.2,
    conseil: 'Sac haut sur les épaules, fentes longues et régulières : les jambes sont déjà chargées, respirez à chaque fente.',
    charges: { open: { homme: '20 kg', femme: '10 kg' }, pro: { homme: '30 kg', femme: '20 kg' } },
  },
  {
    cle: 'wall_balls', nom: 'Wall Balls', effort: '100 répétitions', poids: 1.5,
    conseil: 'Découpez en séries (par exemple 25 × 4) avec des pauses courtes décidées à l’avance : s’arrêter au hasard fait perdre plus de temps.',
    charges: { open: { homme: '6 kg', femme: '4 kg' }, pro: { homme: '9 kg', femme: '6 kg' } },
  },
]

export const STATION_PAR_CLE: Record<CleStation, Station> = Object.fromEntries(STATIONS.map((s) => [s.cle, s])) as Record<CleStation, Station>

export const estCleStation = (v: unknown): v is CleStation => typeof v === 'string' && v in STATION_PAR_CLE

export function chargeStation(cle: CleStation, categorie: CategorieHyrox, genre: GenreHyrox): string | null {
  return STATION_PAR_CLE[cle].charges[categorie][genre]
}
