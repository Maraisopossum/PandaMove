export type ModuleId = 'home' | 'strength' | 'running' | 'cycling' | 'calendar' | 'stats' | 'breathing' | 'profile' | 'import'

export interface SousLien {
  path: string
  label: string
}

export interface ModuleInfo {
  path: string
  label: string
  color: string
  /** Sous-menus affichés en permanence sous le module dans le drawer */
  sousLiens?: SousLien[]
}

// Couleurs de la barre du haut selon le design system Stitch « PandaMove System » (web/DESIGN.md §2).
// Texte blanc >= 4,5:1 sur chacune (testé dans contraste.test.ts). Écart assumé : le calendrier utilise
// #D24700 au lieu de #E65100 (3,8:1 seulement avec du texte blanc) ; #E65100 reste la couleur d'accent
// (jeton --couleur-calendrier) pour les éléments non textuels.
export const MODULES: Record<ModuleId, ModuleInfo> = {
  home: { path: '/', label: 'Accueil', color: '#5B3D9E' },
  strength: {
    path: '/strength',
    label: 'Renforcement',
    color: '#5B3D9E',
    sousLiens: [
      { path: '/strength', label: 'Séances types' },
      { path: '/strength/planned', label: 'Séances programmées' },
      { path: '/strength/done', label: 'Séances terminées' },
    ],
  },
  // Vert (course) et bleu (vélo) : texte blanc >= 4,5:1 (contraste.test.ts)
  running: { path: '/running', label: 'Course', color: '#2E7D32' },
  cycling: { path: '/cycling', label: 'Vélo', color: '#0277BD' },
  calendar: { path: '/calendar', label: 'Calendrier', color: '#D24700' },
  stats: { path: '/stats', label: 'Statistiques', color: '#BF360C' },
  // Teal : texte blanc 6,5:1 (contraste.test.ts)
  breathing: { path: '/breathing', label: 'Respiration', color: '#00695C' },
  profile: { path: '/profile', label: 'Profil', color: '#576746' },
  import: { path: '/import', label: 'Import', color: '#1565C0' },
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
