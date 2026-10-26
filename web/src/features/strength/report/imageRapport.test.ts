import { describe, expect, it, vi } from 'vitest'
import type { RapportExport } from './exportRapport'
import { genererPng, nomFichierImage, planImage, LARGEUR_IMAGE } from './imageRapport'

const rapport: RapportExport = {
  nom: 'Haut du corps',
  dateLongue: 'Samedi 24 octobre 2026',
  notesSeance: '',
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
          note: 'Épaule sensible',
          lignes: [
            { numero: '1', libelle: 'Série 1', reps: '8', charge: '50 kg', rpe: '8', realisee: true },
            { numero: '2', libelle: 'Série 2', reps: '—', charge: 'PDC', rpe: '—', realisee: false },
          ],
        },
      ],
    },
  ],
}

// 10 px par caractère : mesure déterministe
const mesure = (texte: string) => texte.length * 10

describe('planImage', () => {
  const plan = planImage(rapport, mesure)

  it('largeur fixe, hauteur qui s’adapte au contenu', () => {
    expect(plan.largeur).toBe(LARGEUR_IMAGE)
    const dernier = plan.textes[plan.textes.length - 1]
    expect(plan.hauteur).toBeGreaterThan(dernier.y)
    const plusLong = planImage({ ...rapport, groupes: [...rapport.groupes, ...rapport.groupes, ...rapport.groupes] }, mesure)
    expect(plusLong.hauteur).toBeGreaterThan(plan.hauteur)
  })

  it('texte dans l’ordre : titre, date, chiffres clés, bloc, exercice, séries, note', () => {
    const textes = plan.textes.map((t) => t.texte)
    const ordre = ['Haut du corps', 'Samedi 24 octobre 2026', 'Durée 45:30', 'Superset A · Inter : 20 s', 'Développé couché', 'Série 1 : 8 reps à 50 kg, RPE 8', 'Série 2 : non validée', 'Bonne forme']
    let position = -1
    for (const attendu of ordre) {
      const i = textes.findIndex((t, k) => k > position && t.includes(attendu))
      expect(i, attendu).toBeGreaterThan(position)
      position = i
    }
  })

  it('porte la note de l’exercice et la cible', () => {
    const textes = plan.textes.map((t) => t.texte).join('\n')
    expect(textes).toContain('3 × 8 reps à 50 kg')
    expect(textes).toContain('Note : Épaule sensible')
  })

  it('les lignes y sont strictement croissantes et dans l’image', () => {
    for (let i = 1; i < plan.textes.length; i++) expect(plan.textes[i].y).toBeGreaterThanOrEqual(plan.textes[i - 1].y)
    for (const t of plan.textes) expect(t.x).toBeGreaterThanOrEqual(0)
  })

  it('coupe les lignes trop longues à la largeur disponible (aucune ligne ne déborde)', () => {
    const long = planImage({ ...rapport, notesInstance: 'mot '.repeat(80) }, mesure)
    for (const t of long.textes) expect(t.x + mesure(t.texte)).toBeLessThanOrEqual(LARGEUR_IMAGE)
    expect(long.textes.filter((t) => t.texte.startsWith('mot')).length).toBeGreaterThan(1)
  })

  it('un mot plus long que la ligne est coupé sans boucle infinie', () => {
    const p = planImage({ ...rapport, notesInstance: 'x'.repeat(500) }, mesure)
    for (const t of p.textes) expect(t.x + mesure(t.texte)).toBeLessThanOrEqual(LARGEUR_IMAGE)
  })

  it('sans note ni exercice : titre et chiffres clés seulement', () => {
    const p = planImage({ ...rapport, notesInstance: '', groupes: [] }, mesure)
    expect(p.textes.map((t) => t.texte)).toEqual(['Haut du corps', 'Samedi 24 octobre 2026', 'Durée 45:30 · Tonnage 1,1 t · Séries 4 / 5', 'Rapport généré par PandaMove'])
  })
})

describe('nomFichierImage', () => {
  it('rapport-<slug>-<date>.png', () => {
    expect(nomFichierImage('Haut du corps', '2026-10-24')).toBe('rapport-haut-du-corps-2026-10-24.png')
  })
})

describe('genererPng', () => {
  function fauxCanvas(contexteNul = false, blobNul = false) {
    const fillText = vi.fn()
    const ctx = {
      fillText, fillRect: vi.fn(), measureText: (t: string) => ({ width: t.length * 10 }), font: '', fillStyle: '', textBaseline: '',
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => (contexteNul ? null : ctx),
      toBlob: (cb: (b: Blob | null) => void) => cb(blobNul ? null : new Blob(['png'], { type: 'image/png' })),
    }
    return { canvas: canvas as unknown as HTMLCanvasElement, fillText, ctx }
  }

  it('dessine le plan sur un canvas aux dimensions du plan et renvoie un PNG', async () => {
    const { canvas, fillText } = fauxCanvas()
    const blob = await genererPng(rapport, () => canvas)
    expect(blob.type).toBe('image/png')
    expect(canvas.width).toBe(LARGEUR_IMAGE)
    expect(canvas.height).toBeGreaterThan(200)
    expect(fillText.mock.calls.map((c) => c[0])).toContain('Haut du corps')
  })

  it('canvas indisponible : erreur explicite', async () => {
    await expect(genererPng(rapport, () => fauxCanvas(true).canvas)).rejects.toThrow(/canvas/i)
  })

  it('PNG non produit : erreur explicite', async () => {
    await expect(genererPng(rapport, () => fauxCanvas(false, true).canvas)).rejects.toThrow(/PNG/)
  })
})
