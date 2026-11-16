export type ModuleId = 'home' | 'strength' | 'running' | 'cycling' | 'calendar' | 'plans' | 'hyrox' | 'nutrition' | 'stats' | 'breathing' | 'mobility' | 'tools' | 'profile' | 'import'

export interface ModuleInfo {
  path: string
  label: string
  color: string
  /** Pastille illustrée du menu (public/icons/menu/<icone>.webp, style des pandas) */
  icone: string
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
  },
  // Vert (course) et bleu (vélo) : texte blanc >= 4,5:1 (contraste.test.ts)
  running: { path: '/running', label: 'Course', color: '#2E7D32', icone: 'course' },
  cycling: { path: '/cycling', label: 'Vélo', color: '#0277BD', icone: 'velo' },
  // Teal : texte blanc 6,5:1 (contraste.test.ts)
  breathing: { path: '/breathing', label: 'Respiration', color: '#00695C', icone: 'souffle' },
  // Rose framboise : texte blanc >= 4,5:1 (contraste.test.ts)
  mobility: { path: '/mobility', label: 'Mobilité', color: '#AD1457', icone: 'mobilite' },
  calendar: { path: '/calendar', label: 'Calendrier', color: '#D24700', icone: 'calendrier' },
  // Plans d'endurance (frise, phases, jalons) : vert foncé, texte blanc >= 4,5:1 (contraste.test.ts)
  plans: { path: '/plans', label: 'Plans', color: '#1B5E20', icone: 'plans' },
  // Hyrox : gris anthracite de la maquette, texte blanc >= 4,5:1 (contraste.test.ts)
  hyrox: { path: '/hyrox', label: 'Hyrox', color: '#26262B', icone: 'halteres' },
  // Nutrition : vert émeraude foncé (le #059669 du design ne donne que 3,8:1 avec du texte blanc ; #059669 reste l'accent non textuel)
  nutrition: { path: '/nutrition', label: 'Nutrition', color: '#047857', icone: 'nutrition' },
  stats: { path: '/stats', label: 'Statistiques', color: '#BF360C', icone: 'stats' },
  // Menu à part des modules sportifs : sauvegarde et rappels. Gris-bleu : texte blanc >= 4,5:1 (contraste.test.ts)
  tools: {
    path: '/outils',
    label: 'Outils',
    color: '#455A64',
    icone: 'materiel',
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

// L'administration n'a pas d'entrée dans le menu (on y va depuis le profil, pour les administrateurs) mais sa barre du haut doit le dire :
// sans cela, /admin affichait « Accueil » sur le violet de l'accueil. Gris ardoise : texte blanc >= 4,5:1 (contraste.test.ts).
export const MODULE_ADMIN: ModuleInfo = { path: '/admin', label: 'Administration', color: '#37474F', icone: 'cle' }

/** Informations de la barre du haut pour une adresse : module du menu, ou administration, sinon accueil. */
export function infoModule(pathname: string): ModuleInfo {
  if (pathname === MODULE_ADMIN.path || pathname.startsWith(`${MODULE_ADMIN.path}/`)) return MODULE_ADMIN
  return MODULES[moduleActif(pathname)]
}

// Adresse de la pastille d'un module (fichier de public/icons/menu).
export const urlIcone = (icone: string) => `/icons/menu/${icone}.webp`
