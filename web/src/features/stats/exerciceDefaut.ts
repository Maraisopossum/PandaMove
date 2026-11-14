// Exercice montré en premier dans « Historique d'un exercice » : réglage d'appareil (comme la période), jamais synchronisé.
// Absent : le premier exercice de la liste (ordre alphabétique).

export const CLE_EXERCICE_DEFAUT = 'pandamove.stats.exerciceDefaut'

export function lireExerciceDefaut(): string | null {
  try {
    const v = localStorage.getItem(CLE_EXERCICE_DEFAUT)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

/** `null` retire le réglage. */
export function ecrireExerciceDefaut(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(CLE_EXERCICE_DEFAUT)
    else localStorage.setItem(CLE_EXERCICE_DEFAUT, id)
  } catch {
    // Stockage indisponible (navigation privée, quota) : le choix vaut pour la session seulement
  }
}
