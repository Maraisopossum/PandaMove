export type ModuleId = 'home' | 'strength' | 'calendar' | 'stats' | 'profile' | 'import'

export interface ModuleInfo {
  path: string
  label: string
  color: string
}

// Couleurs de DESIGN.md (PandaPurple, PandaOrange, PandaOrangeDark...). Les modules « génériques »
// (accueil, profil) prennent un gris sombre neutre. Texte blanc sur toutes ces couleurs.
export const MODULES: Record<ModuleId, ModuleInfo> = {
  home: { path: '/', label: 'Accueil', color: '#1E1E22' },
  strength: { path: '/strength', label: 'Renforcement', color: '#7C5CBF' },
  calendar: { path: '/calendar', label: 'Calendrier', color: '#E65100' },
  stats: { path: '/stats', label: 'Statistiques', color: '#BF360C' },
  profile: { path: '/profile', label: 'Profil', color: '#5A5E4C' },
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
