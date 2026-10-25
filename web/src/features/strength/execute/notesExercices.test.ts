// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { lireNotes, modifierNote, serialiserNotes } from './notesExercices'
import { useNotesExercices } from './useNotesExercices'

beforeEach(() => window.localStorage.clear())

describe('notes par exercice (exerciceNotesLocal Android)', () => {
  it('lecture défensive : texte absent, illisible ou mal formé => aucune note', () => {
    expect(lireNotes(null)).toEqual({})
    expect(lireNotes('pas du json')).toEqual({})
    expect(lireNotes('[1,2]')).toEqual({})
    expect(lireNotes('{"a":"ok","b":3}')).toEqual({ a: 'ok' })
  })

  it('modifierNote : texte vide supprime la note, jamais de mutation', () => {
    const avant = { a: 'x' }
    expect(modifierNote(avant, 'b', 'ça pince')).toEqual({ a: 'x', b: 'ça pince' })
    expect(avant).toEqual({ a: 'x' })
    expect(modifierNote({ a: 'x' }, 'a', '')).toEqual({})
  })

  it('serialiser puis lire restitue les notes', () => {
    expect(lireNotes(serialiserNotes({ a: 'x', b: 'y' }))).toEqual({ a: 'x', b: 'y' })
  })
})

describe('useNotesExercices', () => {
  it('garde la note par exercice et la restitue après rechargement', () => {
    const r = renderHook(() => useNotesExercices('inst'))
    expect(r.result.current.note('e1')).toBe('')
    act(() => r.result.current.changer('e1', 'Épaule gauche douloureuse'))
    expect(r.result.current.note('e1')).toBe('Épaule gauche douloureuse')
    r.unmount()
    const r2 = renderHook(() => useNotesExercices('inst'))
    expect(r2.result.current.note('e1')).toBe('Épaule gauche douloureuse')
    expect(renderHook(() => useNotesExercices('autre')).result.current.note('e1')).toBe('')
  })
})
