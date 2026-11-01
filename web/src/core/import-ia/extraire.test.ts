import { describe, expect, it } from 'vitest'
import { extraireJson } from './extraire'

const OBJ = { format: 'pandamove-seances-ia', version: 1, seances: [{ nom: 'A « test »', blocs: [] }] }

describe('extraireJson', () => {
  it('JSON pur, avec BOM et espaces', () => {
    const r = extraireJson('﻿  ' + JSON.stringify(OBJ) + '\n')
    expect(r).toEqual({ ok: true, valeur: OBJ, notes: [] })
  })

  it('premier bloc ```json d\'une réponse bavarde', () => {
    const texte = `Voici ta séance !\n\n\`\`\`json\n${JSON.stringify(OBJ, null, 2)}\n\`\`\`\n\nBon courage ! {pas du json}`
    const r = extraireJson(texte)
    expect(r.ok && r.valeur).toEqual(OBJ)
    expect(r.ok && r.notes).toEqual(['Bloc JSON extrait du texte collé.'])
  })

  it('bloc ``` sans langage, ou objet nu dans du texte', () => {
    expect(extraireJson('```\n{"a": 1}\n```')).toMatchObject({ ok: true, valeur: { a: 1 } })
    expect(extraireJson('Réponse : {"a": {"b": "}"}} fin')).toMatchObject({ ok: true, valeur: { a: { b: '}' } } })
  })

  it('préfère le bloc au format PandaMove quand il y en a plusieurs', () => {
    const texte = '```json\n{"autre": true}\n```\n```json\n' + JSON.stringify(OBJ) + '\n```'
    expect(extraireJson(texte)).toMatchObject({ ok: true, valeur: OBJ })
  })

  it('tolère guillemets typographiques et virgules finales, et le signale', () => {
    const texte = '{ “format”: “pandamove-seances-ia”, “version”: 1, “seances”: [ { “nom”: “A”, },], }'
    const r = extraireJson(texte)
    expect(r.ok && r.valeur).toEqual({ format: 'pandamove-seances-ia', version: 1, seances: [{ nom: 'A' }] })
    expect(r.ok && r.notes).toEqual(['Guillemets typographiques remplacés par des guillemets droits.', 'Virgules finales supprimées.'])
  })

  it('ne touche pas une virgule suivie d\'une accolade DANS un texte', () => {
    const r = extraireJson('{"consigne": "garde le dos droit,}", "x": [1,2,],}')
    expect(r).toMatchObject({ ok: true, valeur: { consigne: 'garde le dos droit,}', x: [1, 2] } })
  })

  it('JSON tronqué : message clair avec la ligne', () => {
    const r = extraireJson('{\n  "a": 1,\n  "b": [1, 2\n')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erreur).toMatch(/^JSON invalide ou tronqué/)
  })

  it('texte sans JSON, ou vide', () => {
    expect(extraireJson('Désolé, je ne peux pas.')).toEqual({ ok: false, erreur: "Aucun JSON trouvé dans le texte. Collez uniquement la réponse JSON de l'IA." })
    expect(extraireJson('   ')).toEqual({ ok: false, erreur: 'Le fichier est vide.' })
  })

  it('un tableau ou un scalaire n\'est pas un fichier valide', () => {
    expect(extraireJson('[1,2]')).toMatchObject({ ok: true, valeur: [1, 2] })
    expect(extraireJson('42')).toMatchObject({ ok: false })
  })

  it('commentaires // non pris en charge : erreur claire', () => {
    const r = extraireJson('{\n// commentaire\n"a": 1}')
    expect(r.ok).toBe(false)
  })
})
