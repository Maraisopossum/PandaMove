import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PANDA_MANIFEST } from './manifest.generated'
import { pandaImage, type PandaImageName } from './pandaImage'

const racineWeb = join(__dirname, '..', '..', '..')
const publicDir = join(racineWeb, 'public')
const NOMS = Object.keys(PANDA_MANIFEST) as PandaImageName[]

describe('pandaImage', () => {
  it('le manifeste couvre les noms logiques attendus', () => {
    for (const nom of ['joy', 'victory', 'tired', 'injury', 'motivation', 'musculation', 'splash', 'heatmap_face', 'heatmap_dos']) {
      expect(NOMS).toContain(nom)
    }
    for (let i = 1; i <= 5; i++) expect(NOMS).toContain(`onboarding_0${i}`)
    expect(NOMS.some((n) => n.startsWith('pose_'))).toBe(true)
    expect(NOMS.some((n) => n.startsWith('bg_'))).toBe(true)
  })

  it('chaque nom, pour chaque variante et taille, renvoie un .webp existant dans public/panda/', () => {
    for (const nom of NOMS) {
      for (const variante of ['male', 'female'] as const) {
        for (const taille of ['sm', 'lg'] as const) {
          const img = pandaImage(nom, variante, taille)
          expect(img.src).toMatch(/^\/panda\/[a-z0-9-]+\.webp$/)
          expect(existsSync(join(publicDir, img.src)), img.src).toBe(true)
          expect(img.width).toBeGreaterThan(0)
          expect(img.height).toBeGreaterThan(0)
          // srcSet : chaque fichier listé existe aussi
          for (const morceau of img.srcSet.split(', ')) {
            const [chemin, descripteur] = morceau.split(' ')
            expect(descripteur).toMatch(/^\d+w$/)
            expect(existsSync(join(publicDir, chemin)), chemin).toBe(true)
          }
        }
      }
    }
  })

  it('srcSet propose les deux tailles, la petite étant plus étroite', () => {
    const sm = pandaImage('joy', 'male', 'sm')
    const lg = pandaImage('joy', 'male', 'lg')
    expect(sm.width).toBeLessThan(lg.width)
    expect(sm.srcSet).toBe(`${sm.src} ${sm.width}w, ${lg.src} ${lg.width}w`)
    expect(lg.srcSet).toBe(sm.srcSet)
  })

  it('taille par défaut : lg', () => {
    expect(pandaImage('victory', 'female')).toEqual(pandaImage('victory', 'female', 'lg'))
  })

  it('les variantes homme et femme donnent des images différentes', () => {
    expect(pandaImage('joy', 'male').src).not.toBe(pandaImage('joy', 'female').src)
  })

  it('variante absente : repli sur l’image commune, sinon sur l’autre variante', () => {
    // Image commune (sans variante) : même fichier pour les deux
    expect(pandaImage('splash', 'male').src).toBe(pandaImage('splash', 'female').src)
    // Pose dessinée seulement en version femme : la version homme se replie dessus
    expect(PANDA_MANIFEST.pose_squat.variantes).not.toHaveProperty('male')
    expect(pandaImage('pose_squat', 'male')).toEqual(pandaImage('pose_squat', 'female'))
  })

  it('les fonds de heatmap gardent leurs noms historiques, en taille unique 600 × 900', () => {
    const face = pandaImage('heatmap_face', 'male')
    expect(face.src).toBe('/panda/heatmap-male-face.webp')
    expect(pandaImage('heatmap_dos', 'female', 'sm').src).toBe('/panda/heatmap-female-dos.webp')
    expect([face.width, face.height]).toEqual([600, 900])
    expect(face.srcSet).toBe('/panda/heatmap-male-face.webp 600w')
  })

  it('expose un texte alternatif français', () => {
    expect(pandaImage('victory', 'male').alt).toMatch(/panda/i)
  })

  it('un nom inconnu échoue à la compilation (et à l’exécution)', () => {
    // @ts-expect-error nom absent du manifeste
    expect(() => pandaImage('licorne', 'male')).toThrow()
  })

  it('le manifeste commité correspond aux fichiers de public/panda (script --check)', () => {
    expect(() =>
      execFileSync(process.execPath, [join(racineWeb, 'scripts', 'build-images.mjs'), '--check'], { stdio: 'pipe' }),
    ).not.toThrow()
  })
})
