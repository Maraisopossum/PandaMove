import { describe, expect, it } from 'vitest'
import { genererHtml, nomFichierRapport, texteResume, type RapportExport } from './exportRapport'

const rapport: RapportExport = {
  nom: 'Haut <du> corps',
  dateLongue: 'Samedi 24 octobre 2026',
  notesSeance: 'Pecs & dos',
  notesInstance: 'Bonne forme',
  duree: '45:30',
  tonnage: '1,1 t',
  series: '4 / 5',
  groupes: [
    {
      titre: 'Superset A · Inter : 20 s',
      exercices: [
        {
          nom: 'Développé couché',
          cible: '3 × 8 reps à 50 kg',
          lignes: [
            { numero: '1', libelle: 'Série 1', reps: '8', charge: '50 kg', rpe: '8', realisee: true },
            { numero: '2', libelle: 'Série 2', reps: '—', charge: 'PDC', rpe: '—', realisee: false },
          ],
        },
      ],
    },
    { titre: null, exercices: [{ nom: 'Gainage', cible: '2 × 45 s', lignes: [] }] },
  ],
}

describe('texteResume', () => {
  it('résumé copiable : en-tête, chiffres clés, séries par exercice, note', () => {
    const t = texteResume(rapport)
    expect(t).toContain('Haut <du> corps — Samedi 24 octobre 2026')
    expect(t).toContain('Durée 45:30 · Tonnage 1,1 t · Séries 4 / 5')
    expect(t).toContain('Superset A · Inter : 20 s')
    expect(t).toContain('Développé couché (3 × 8 reps à 50 kg)')
    expect(t).toContain('Série 1 : 8 reps à 50 kg, RPE 8')
    expect(t).toContain('Série 2 : non validée')
    expect(t).toContain('Gainage (2 × 45 s)')
    expect(t).toContain('Note : Bonne forme')
  })
})

describe('genererHtml', () => {
  it('document autonome en français, texte échappé, tableaux avec en-têtes', () => {
    const h = genererHtml(rapport)
    expect(h.startsWith('<!doctype html>')).toBe(true)
    expect(h).toContain('<html lang="fr">')
    expect(h).toContain('Haut &lt;du&gt; corps')
    expect(h).not.toContain('<du>')
    expect(h).toContain('Pecs &amp; dos')
    expect(h).toContain('<th scope="col">Reps</th>')
    expect(h).toContain('<th scope="col">Charge</th>')
    expect(h).toContain('non validée')
    expect(h).toContain('Bonne forme')
    expect(h).not.toMatch(/<script/i)
  })
})

describe('nomFichierRapport', () => {
  it('nom de fichier sûr, daté', () => {
    expect(nomFichierRapport('Haut du corps / A', '2026-10-24')).toBe('rapport-haut-du-corps-a-2026-10-24.html')
    expect(nomFichierRapport('', '2026-10-24')).toBe('rapport-seance-2026-10-24.html')
  })
})

describe('note par exercice', () => {
  const avecNote: RapportExport = {
    ...rapport,
    groupes: [{ titre: null, exercices: [{ nom: 'Curl <b>', cible: '3 × 10', note: 'Épaule & coude sensibles', lignes: [] }] }],
  }
  it('le résumé texte porte la note sous l’exercice', () => {
    expect(texteResume(avecNote)).toContain('Curl <b> (3 × 10)\n  Note : Épaule & coude sensibles')
  })
  it('le HTML la porte, échappée', () => {
    const h = genererHtml(avecNote)
    expect(h).toContain('Note : Épaule &amp; coude sensibles')
    expect(h).not.toContain('Curl <b>')
  })
  it('sans note, rien n’est ajouté', () => {
    expect(texteResume(rapport)).not.toContain('Note : \n')
    expect(genererHtml(rapport)).not.toContain('class="note-ex"')
  })
})
