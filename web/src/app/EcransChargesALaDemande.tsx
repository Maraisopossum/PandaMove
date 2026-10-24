import { lazy } from 'react'

// Écrans chargés à la demande (chunks séparés). Fichier dédié : routes.tsx n'exporte ainsi
// que des fonctions, ce que demande la règle react-refresh.
export const CalendarScreen = lazy(() => import('../features/calendar/CalendarScreen'))
export const ImportScreen = lazy(() => import('../features/import/ImportScreen'))
export const ProfileScreen = lazy(() => import('../features/profile/ProfileScreen'))
export const EquipmentScreen = lazy(() => import('../features/profile/EquipmentScreen'))
export const CatalogScreen = lazy(() => import('../features/strength/catalog/CatalogScreen'))
export const SeanceListScreen = lazy(() => import('../features/strength/SeanceListScreen'))
export const SeanceEditScreen = lazy(() => import('../features/strength/SeanceEditScreen'))
export const ExecuteScreen = lazy(() => import('../features/strength/execute/ExecuteScreen'))
export const ReportScreen = lazy(() => import('../features/strength/report/ReportScreen'))
