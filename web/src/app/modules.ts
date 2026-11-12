export type ModuleId = 'home' | 'strength' | 'running' | 'cycling' | 'calendar' | 'stats' | 'breathing' | 'tools' | 'profile' | 'import'

export interface SousLien {
  path: string
  label: string
}

export interface ModuleInfo {
  path: string
  label: string
  color: string
  /** Pastille illustrée du menu (public/icons/menu/<icone>.webp, style des pandas) */
  icone: string
  /** Sous-menus affichés en permanence sous le module dans le drawer */
  sousLiens?: SousLien[]
}

// Couleurs de la barre du haut selon le design system Stitch « PandaMove System » (web/DESIGN.md §2).
// Texte blanc >= 4,5:1 sur chacune (testé dans contraste.test.ts). Écart assumé : le calendrier utilise
// #D24700 au lieu de #E65100 (3,8:1 seulement avec du texte blanc) ; #E65100 reste la couleur d'accent
// (jeton --couleur-calendrier) pour les éléments non textuels.
export const MODULES: Record<ModuleId, ModuleInfo> = {
  home: { path: '/', label: 'Accueil', color: '#5B3D9E', icone: 'accueil' },
  strength: {
    path: '/strength',
    label: 'Renforcement',
    color: '#5B3D9E',
    icone: 'halteres',
    sousLiens: [
      { path: '/strength', label: 'Séances types' },
      { path: '/strength/planned', label: 'Séances programmées' },
      { path: '/strength/done', label: 'Séances terminées' },
      { path: '/strength/catalog', label: 'Catalogue d’exercices' },
    ],
  },
  // Vert (course) et bleu (vélo) : texte blanc >= 4,5:1 (contraste.test.ts)
  running: { path: '/running', label: 'Course', color: '#2E7D32', icone: 'course' },
  cycling: { path: '/cycling', label: 'Vélo', color: '#0277BD', icone: 'velo' },
  calendar: { path: '/calendar', label: 'Calendrier', color: '#D24700', icone: 'calendrier' },
  stats: { path: '/stats', label: 'Statistiques', color: '#BF360C', icone: 'stats' },
  // Teal : texte blanc 6,5:1 (contraste.test.ts)
  breathing: { path: '/breathing', label: 'Respiration', color: '#00695C', icone: 'souffle' },
  // Menu à part des modules sportifs : sauvegarde, rappels, progression. Gris-bleu : texte blanc >= 4,5:1 (contraste.test.ts)
  tools: {
    path: '/outils',
    label: 'Outils',
    color: '#455A64',
    icone: 'materiel',
    sousLiens: [
      { path: '/outils/donnees', label: 'Mes données' },
      { path: '/outils/rappels', label: 'Rappels' },
      { path: '/outils/progression', label: 'Progression' },
    ],
  },
  profile: { path: '/profile', label: 'Profil', color: '#576746', icone: 'profil' },
  import: { path: '/import', label: 'Import', color: '#1565C0', icone: 'import' },
}

// Module dont dépend la couleur de la barre du haut : celui dont le chemin préfixe l'URL courante
// (segment entier), sinon l'accueil (y compris pour une page introuvable).
export function moduleActif(pathname: string): ModuleId {
  for (const [id, { path }] of Object.entries(MODULES) as [ModuleId, ModuleInfo][]) {
    if (id === 'home') continue
    if (pathname === path || pathname.startsWith(`${path}/`)) return id
  }
  return 'home'
}

// Adresse de la pastille d'un module (fichier de public/icons/menu).
export const urlIcone = (icone: string) => `/icons/menu/${icone}.webp`
