import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import {
  CalendarScreen, CatalogScreen, EquipmentScreen, ExecuteScreen, ImportScreen, ProfileScreen, ReportScreen, SeanceEditScreen, SeanceListScreen,
} from './EcransChargesALaDemande'
import { PageErreur } from './PageErreur'
import { PageIntrouvable } from './PageIntrouvable'
import { PagePlaceholder } from './PagePlaceholder'

// L'import dynamique est gardé par `import.meta.env.DEV` : Vite le remplace par `false` en production,
// donc le chunk de l'écran de debug n'est jamais émis dans le build.
const chargerDebug = import.meta.env.DEV ? () => import('../features/debug/DebugWriteScreen') : null
const DebugWriteScreen = chargerDebug ? lazy(chargerDebug) : null

const placeholder = (titre: string) => <PagePlaceholder titre={titre} />

// Écrans chargés à la demande : un seul fallback commun
const chargement = (ecran: ReactNode) => <Suspense fallback={<p>Chargement…</p>}>{ecran}</Suspense>

// Table de routes : `coque` est le layout commun (drawer, barre du haut, <Outlet />).
// `dev` est paramétrable pour tester l'absence de la route de debug hors développement.
export function construireRoutes(coque: ReactNode, dev: boolean = import.meta.env.DEV): RouteObject[] {
  const enfants: RouteObject[] = [
    { index: true, element: placeholder('Accueil') },
    { path: 'strength', element: chargement(<SeanceListScreen />) },
    { path: 'strength/new', element: chargement(<SeanceEditScreen />) },
    { path: 'strength/:id/edit', element: chargement(<SeanceEditScreen />) },
    { path: 'strength/instance/:id', element: chargement(<ExecuteScreen />) },
    { path: 'strength/instance/:id/report', element: chargement(<ReportScreen />) },
    { path: 'calendar', element: chargement(<CalendarScreen />) },
    { path: 'stats', element: placeholder('Statistiques') },
    { path: 'strength/catalog', element: chargement(<CatalogScreen />) },
    { path: 'profile', element: chargement(<ProfileScreen />) },
    { path: 'profile/equipment', element: chargement(<EquipmentScreen />) },
    { path: 'import', element: chargement(<ImportScreen />) },
  ]
  if (dev && DebugWriteScreen) {
    enfants.push({
      path: 'debug/write',
      element: (
        <Suspense fallback={<p>Chargement…</p>}>
          <DebugWriteScreen />
        </Suspense>
      ),
    })
  }
  enfants.push({ path: '*', element: <PageIntrouvable /> })
  return [{ element: coque, errorElement: <PageErreur />, children: enfants }]
}
