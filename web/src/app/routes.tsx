import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import {
  CalendarScreen, CatalogScreen, EquipmentScreen, ExecuteScreen, HomeScreen, ImportScreen, ListeInstancesScreen, MethodeFormScreen, ProfileScreen,
  ReportScreen, RespirationScreen, SeanceDetailScreen, SeanceEditScreen, SeanceListScreen, SessionRespirationScreen, SortieDetailScreen, SortieFormScreen,
  SortiesScreen, StatsScreen, OutilsScreen, MobiliteScreen, ApercuMobiliteScreen, SeanceMobiliteScreen, DonneesScreen, RappelsScreen, ProgressionScreen,
} from './EcransChargesALaDemande'
import { PageErreur } from './PageErreur'
import { PageIntrouvable } from './PageIntrouvable'

// L'import dynamique est gardé par `import.meta.env.DEV` : Vite le remplace par `false` en production,
// donc le chunk de l'écran de debug n'est jamais émis dans le build.
const chargerDebug = import.meta.env.DEV ? () => import('../features/debug/DebugWriteScreen') : null
const DebugWriteScreen = chargerDebug ? lazy(chargerDebug) : null

// Écrans chargés à la demande : un seul fallback commun
const chargement = (ecran: ReactNode) => <Suspense fallback={<p>Chargement…</p>}>{ecran}</Suspense>

// Table de routes : `coque` est le layout commun (drawer, barre du haut, <Outlet />).
// `dev` est paramétrable pour tester l'absence de la route de debug hors développement.
export function construireRoutes(coque: ReactNode, dev: boolean = import.meta.env.DEV): RouteObject[] {
  const enfants: RouteObject[] = [
    { index: true, element: chargement(<HomeScreen />) },
    { path: 'strength', element: chargement(<SeanceListScreen />) },
    // `key` distincte : passer d'un sous-menu à l'autre remonte l'écran (aucun état d'une liste dans l'autre)
    { path: 'strength/planned', element: chargement(<ListeInstancesScreen key="programmees" type="programmees" />) },
    { path: 'strength/done', element: chargement(<ListeInstancesScreen key="terminees" type="terminees" />) },
    { path: 'strength/new', element: chargement(<SeanceEditScreen />) },
    // Détail d'un modèle ; les chemins statiques (new, planned, done, catalog, instance/…) l'emportent sur :id
    { path: 'strength/:id', element: chargement(<SeanceDetailScreen />) },
    { path: 'strength/:id/edit', element: chargement(<SeanceEditScreen />) },
    // Monté et gardé en vie par ExecutionEnFond (coque) : la séance continue quand on navigue ailleurs
    { path: 'strength/instance/:id', element: null },
    { path: 'strength/instance/:id/edit', element: chargement(<SeanceEditScreen instance />) },
    { path: 'strength/instance/:id/correct', element: chargement(<ExecuteScreen correction />) },
    { path: 'strength/instance/:id/report', element: chargement(<ReportScreen />) },
    // Sorties d'endurance : chemins statiques (new) avant :id
    { path: 'running', element: chargement(<SortiesScreen sport="course" />) },
    { path: 'running/new', element: chargement(<SortieFormScreen sport="course" />) },
    { path: 'running/:id', element: chargement(<SortieDetailScreen sport="course" />) },
    { path: 'running/:id/edit', element: chargement(<SortieFormScreen sport="course" />) },
    { path: 'cycling', element: chargement(<SortiesScreen sport="velo" />) },
    { path: 'cycling/new', element: chargement(<SortieFormScreen sport="velo" />) },
    { path: 'cycling/:id', element: chargement(<SortieDetailScreen sport="velo" />) },
    { path: 'cycling/:id/edit', element: chargement(<SortieFormScreen sport="velo" />) },
    { path: 'calendar', element: chargement(<CalendarScreen />) },
    { path: 'stats', element: chargement(<StatsScreen />) },
    { path: 'breathing', element: chargement(<RespirationScreen />) },
    // Chemins statiques (new, session/…) avant :id/edit
    { path: 'breathing/new', element: chargement(<MethodeFormScreen />) },
    { path: 'breathing/:id/edit', element: chargement(<MethodeFormScreen />) },
    { path: 'breathing/session/:id/:cycles', element: chargement(<SessionRespirationScreen />) },
    { path: 'strength/catalog', element: chargement(<CatalogScreen />) },
    { path: 'profile', element: chargement(<ProfileScreen />) },
    { path: 'profile/equipment', element: chargement(<EquipmentScreen />) },
    { path: 'import', element: chargement(<ImportScreen />) },
    { path: 'mobility', element: chargement(<MobiliteScreen />) },
    { path: 'mobility/apercu', element: chargement(<ApercuMobiliteScreen />) },
    { path: 'mobility/seance', element: chargement(<SeanceMobiliteScreen />) },
    { path: 'outils', element: chargement(<OutilsScreen />) },
    { path: 'outils/donnees', element: chargement(<DonneesScreen />) },
    { path: 'outils/rappels', element: chargement(<RappelsScreen />) },
    { path: 'outils/progression', element: chargement(<ProgressionScreen />) },
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
