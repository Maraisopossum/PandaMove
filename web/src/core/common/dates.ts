// Vrai si `texte` est une vraie date du calendrier au format yyyy-MM-dd (2026-02-30 est refusé).
// Module neutre : le calendrier et le renforcement l'utilisent sans dépendre l'un de l'autre.
export function dateIsoValide(texte: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  if (!m) return false
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  // Date.UTC « déborde » (30 février -> 2 mars) : on vérifie que la date relue est identique.
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
}
