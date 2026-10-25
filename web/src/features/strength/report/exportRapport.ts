import type { LigneSerie } from './bilan'

// Export du rapport (équivalent web du partage Android) : texte copiable et fichier HTML autonome.
// Fonctions pures ; le téléchargement et le presse-papiers vivent dans useExportRapport.

export interface ExerciceExport {
  nom: string
  cible: string
  lignes: LigneSerie[]
}

export interface GroupeExport {
  /** Titre du bloc (« Superset A · Inter : 20 s »), null pour des exercices libres */
  titre: string | null
  exercices: ExerciceExport[]
}

export interface RapportExport {
  nom: string
  dateLongue: string
  notesSeance: string
  notesInstance: string
  duree: string
  tonnage: string
  series: string
  groupes: GroupeExport[]
}

function detailLigne(l: LigneSerie): string {
  if (!l.realisee) return `${l.libelle} : non validée`
  const rpe = l.rpe === '—' ? '' : `, RPE ${l.rpe}`
  const reps = /^\d+$/.test(l.reps) ? `${l.reps} reps` : l.reps
  return `${l.libelle} : ${reps} à ${l.charge}${rpe}`
}

/** Résumé en texte brut (presse-papiers, partage). */
export function texteResume(r: RapportExport): string {
  const lignes = [
    r.dateLongue ? `${r.nom} — ${r.dateLongue}` : r.nom,
    `Durée ${r.duree} · Tonnage ${r.tonnage} · Séries ${r.series}`,
  ]
  if (r.notesSeance.trim()) lignes.push(r.notesSeance.trim())
  for (const g of r.groupes) {
    lignes.push('')
    if (g.titre) lignes.push(g.titre)
    for (const e of g.exercices) {
      lignes.push(`${e.nom} (${e.cible})`)
      for (const l of e.lignes) lignes.push(`  ${detailLigne(l)}`)
    }
  }
  if (r.notesInstance.trim()) lignes.push('', `Note : ${r.notesInstance.trim()}`)
  return lignes.join('\n')
}

const echapper = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const STYLE = `body{font-family:system-ui,sans-serif;max-width:40rem;margin:1rem auto;padding:0 1rem;color:#1c1b1f}
h1{margin-bottom:.25rem}.date{color:#5b4a8a;font-weight:600;margin:0 0 1rem}
.kpis{display:flex;gap:.5rem;margin:1rem 0}.kpi{flex:1;padding:.5rem;border:1px solid #d0c8e0;border-radius:10px;text-align:center}
.kpi b{display:block;font-size:1.25rem}table{width:100%;border-collapse:collapse;margin:.25rem 0 1rem}
th,td{padding:.35rem .5rem;border-bottom:1px solid #e3deee;text-align:left}th{font-size:.8rem;text-transform:uppercase;color:#4a4458}
.barree{text-decoration:line-through;color:#4a4458}.bloc{font-weight:800;color:#8a3b00;margin-top:1rem}`

function tableau(e: ExerciceExport): string {
  if (e.lignes.length === 0) return '<p>Aucune série enregistrée.</p>'
  const lignes = e.lignes
    .map((l) => {
      const classe = l.realisee ? '' : ' class="barree"'
      const statut = l.realisee ? '' : ' (non validée)'
      return `<tr${classe}><th scope="row">${echapper(l.libelle)}${statut}</th><td>${echapper(l.reps)}</td><td>${echapper(l.charge)}</td><td>${echapper(l.rpe)}</td></tr>`
    })
    .join('')
  return `<table><caption>${echapper(e.nom)}</caption><thead><tr><th scope="col">Série</th><th scope="col">Reps</th><th scope="col">Charge</th><th scope="col">RPE</th></tr></thead><tbody>${lignes}</tbody></table>`
}

/** Fichier HTML autonome (styles intégrés, aucun script), lisible hors de l'application. */
export function genererHtml(r: RapportExport): string {
  const corps = r.groupes
    .map(
      (g) =>
        `${g.titre ? `<p class="bloc">${echapper(g.titre)}</p>` : ''}${g.exercices
          .map((e) => `<h3>${echapper(e.nom)} <small>${echapper(e.cible)}</small></h3>${tableau(e)}`)
          .join('')}`,
    )
    .join('')
  const notes = r.notesInstance.trim() ? `<h2>Note de séance</h2><p>${echapper(r.notesInstance.trim())}</p>` : ''
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(r.nom)} — rapport de séance</title><style>${STYLE}</style></head>
<body><h1>${echapper(r.nom)}</h1>
<p class="date">${echapper(r.dateLongue)}${r.notesSeance.trim() ? ` · ${echapper(r.notesSeance.trim())}` : ''}</p>
<div class="kpis"><div class="kpi"><b>${echapper(r.duree)}</b>Durée</div><div class="kpi"><b>${echapper(r.tonnage)}</b>Tonnage</div><div class="kpi"><b>${echapper(r.series)}</b>Séries</div></div>
${corps}${notes}
<p><small>Rapport généré par PandaMove</small></p></body></html>`
}

/** Nom de fichier sûr : « rapport-haut-du-corps-2026-10-24.html ». */
export function nomFichierRapport(nomSeance: string, date: string): string {
  const slug = nomSeance
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `rapport-${slug || 'seance'}-${date}.html`
}
