import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import { ImportScreen } from './EcransChargesALaDemande'
import { PageErreur } from './PageErreur'
import { PageIntrouvable } from './PageIntrouvable'
import { PagePlaceholder } from './PagePlaceholder'

// L'import dynamique est gardé par `import.meta.env.DEV` : Vite le remplace par `false` en production,
// donc le chunk de l'écran de debug n'est jamais émis dans le build.
const chargerDebug = import.meta.env.DEV ? () => import('../features/debug/DebugWriteScreen') : null
const DebugWriteScreen = chargerDebug ? lazy(chargerDebug) : null

const placeholder = (titre: string) => <PagePlaceholder titre={titre} />

// Table de routes : `coque` est le layout commun (drawer, barre du haut, <Outlet />).
// `dev` est paramétrable pour tester l'absence de la route de debug hors développement.
export function construireRoutes(coque: ReactNode, dev: boolean = import.meta.env.DEV): RouteObject[] {
  const enfants: RouteObject[] = [
    { index: true, element: placeholder('Accueil') },
    { path: 'strength', element: placeholder('Renforcement') },
    { path: 'strength/new', element: placeholder('Nouvelle séance') },
    { path: 'strength/:id/edit', element: placeholder('Modifier la séance') },
    { path: 'strength/instance/:id', element: placeholder('Séance') },
    { path: 'strength/instance/:id/report', element: placeholder('Bilan de séance') },
    { path: 'calendar', element: placeholder('Calendrier') },
    { path: 'stats', element: placeholder('Statistiques') },
    { path: 'profile', element: placeholder('Profil') },
    {
      path: 'import',
      element: (
        <Suspense fallback={<p>Chargement…</p>}>
          <ImportScreen />
        </Suspense>
      ),
    },
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
