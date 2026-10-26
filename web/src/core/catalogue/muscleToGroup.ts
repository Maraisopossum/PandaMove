import { MUSCLE_GROUPS, type MuscleGroup } from '../db/types'

// Libellés Android (MuscleGroup.label, core/database/.../catalog/MuscleGroup.kt:3-20) : ils sont
// stockés tels quels dans muscle_groups / muscle_primary par les exercices personnalisés Android.
export const LIBELLES_GROUPE: Record<MuscleGroup, string> = {
  PECTORAUX: 'Pectoraux',
  DOS: 'Dos',
  TRAPEZES: 'Trapèzes',
  LOMBAIRES: 'Lombaires',
  EPAULES: 'Épaules',
  BICEPS: 'Biceps',
  TRICEPS: 'Triceps',
  QUADRICEPS: 'Quadriceps',
  ISCHIO: 'Ischio-jambiers',
  FESSIERS: 'Fessiers',
  ADDUCTEURS: 'Adducteurs',
  MOLLETS: 'Mollets',
  ABDOMINAUX: 'Abdominaux',
  OBLIQUES: 'Obliques',
  AVANT_BRAS: 'Avant-bras',
  AUTRE: 'Autre',
}

// Groupe d'un texte de muscle, dans cet ordre :
// 1. code exact (« PECTORAUX », exercices créés sur le web) ;
// 2. libellé Android sans tenir compte de la casse (« Ischio-jambiers », « mollets ») ;
// 3. règles anatomiques de muscleToGroup (MuscleGroup.kt:26-98), dans le même ordre que le Kotlin
//    (noms du catalogue MuscuCatalog.kt : « Grand dorsal », « Deltoïde antérieur »…).
// Texte vide ou non reconnu : AUTRE.
export function muscleToGroup(muscle: string): MuscleGroup {
  const brut = muscle.trim()
  if (brut === '') return 'AUTRE'
  if ((MUSCLE_GROUPS as readonly string[]).includes(brut)) return brut as MuscleGroup
  // ignoreCase Kotlin : comparaison en minuscules des deux côtés
  const m = brut.toLowerCase()
  const parLibelle = MUSCLE_GROUPS.find((g) => LIBELLES_GROUPE[g].toLowerCase() === m)
  if (parLibelle) return parLibelle

  const debut = (...p: string[]) => p.some((x) => m.startsWith(x.toLowerCase()))
  const contient = (...p: string[]) => p.some((x) => m.includes(x.toLowerCase()))
  const egal = (...p: string[]) => p.some((x) => m === x.toLowerCase())

  // Pectoraux, y compris « (chef claviculaire) », « (chef sternal) »
  if (debut('Pectoral', 'Pecto')) return 'PECTORAUX'
  // Triceps avant Biceps
  if (debut('Triceps')) return 'TRICEPS'
  // Trapèzes et rhomboïdes, avant Dos
  if (contient('Trapèze', 'Trapeze', 'Rhomboï', 'Rhomboi')) return 'TRAPEZES'
  // Érecteurs du rachis, avant Dos
  if (contient('rachis', 'Lombaire')) return 'LOMBAIRES'
  // Grand dorsal, infra-épineux, deltoïde postérieur
  if (contient('Grand dorsal', 'Infra-', 'postérieur', 'posterieur')) return 'DOS'
  // Deltoïdes antérieur / médial
  if (debut('Deltoi', 'Deltoï') || egal('Épaules', 'Epaules', 'Deltoïdes')) return 'EPAULES'
  // Biceps brachial (toutes variantes), brachial
  if (debut('Biceps') || egal('Brachial')) return 'BICEPS'
  if (egal('Quadriceps')) return 'QUADRICEPS'
  if (contient('Ischio')) return 'ISCHIO'
  // Adducteurs avant Fessiers
  if (egal('Adducteurs')) return 'ADDUCTEURS'
  if (debut('Fessier')) return 'FESSIERS'
  // Gastrocnémien, soléaire, tibial antérieur
  if (contient('Gastro') || (contient('ol') && contient('aire')) || contient('Tibial')) return 'MOLLETS'
  // Obliques avant Abdominaux
  if (egal('Obliques')) return 'OBLIQUES'
  // Droit abdominal, transverse, iliopsoas
  if (contient('abdomin') || egal('Transverse', 'Iliopsoas')) return 'ABDOMINAUX'
  // Extenseurs / fléchisseurs du carpe, avant-bras (grip), brachioradial
  if (contient('Extenseur', 'chisseur', 'Avant-bras', 'grip') || debut('Brachio')) return 'AVANT_BRAS'
  return 'AUTRE'
}
