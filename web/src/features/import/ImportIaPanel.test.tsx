// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installerCatalogueDeBase } from '../../core/catalogue/installerCatalogue'
import type { Db } from '../../core/db/Db'
import { listSeanceTemplates } from '../../core/db/repos/seances'
import { EXEMPLE, genererModeleIA, NOMS_FICHIERS_MODELE } from '../../core/import-ia/modele'
import { createTestDb } from '../../test/sqliteDb'

const USER = '11111111-1111-4111-8111-111111111111'
let db: Db
vi.mock('../../core/db/client', () => ({ getDb: () => db }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: USER } } }) }))
const telechargerTexte = vi.fn(() => true)
const copierTexte = vi.fn(() => Promise.resolve(true))
vi.mock('./telecharger', () => ({
  telechargerTexte: (...a: unknown[]) => (telechargerTexte as (...x: unknown[]) => boolean)(...a),
  copierTexte: (...a: unknown[]) => (copierTexte as (...x: unknown[]) => Promise<boolean>)(...a),
}))

vi.mock('../calendar/seancesCardio/useSourceSynchro', () => ({
  useSourceSynchro: () => ({
    etat: 'online',
    attendrePremiereSynchro: () => Promise.resolve(),
    compterFileEnvoi: () => Promise.resolve(0),
  }),
}))

import ImportIaPanel from './ImportIaPanel'
import ImportScreen from './ImportScreen'

beforeEach(async () => {
  db = createTestDb()
  await installerCatalogueDeBase(db, USER)
  telechargerTexte.mockClear()
  copierTexte.mockClear()
})
afterEach(cleanup)

const rendre = (userId: string | null = USER) => render(<MemoryRouter><ImportIaPanel userId={userId ?? undefined} /></MemoryRouter>)
const coller = (texte: string) => {
  fireEvent.change(screen.getByLabelText("Ou collez la réponse de l'IA"), { target: { value: texte } })
  fireEvent.click(screen.getByRole('button', { name: 'Analyser le texte' }))
}
const EXEMPLE_TEXTE = JSON.stringify(EXEMPLE)
const fichier = (texte: string) => new File([texte], 'seances.json', { type: 'application/json' })

describe('ImportIaPanel : fichier modèle', () => {
  it('propose les quatre actions', () => {
    rendre()
    for (const nom of ["Télécharger la consigne pour l'IA (.md)", 'Copier la consigne', "Télécharger l'exemple (.json)", 'Télécharger le schéma (.json)']) {
      expect(screen.getByRole('button', { name: nom })).toBeTruthy()
    }
  })

  it('télécharge la consigne, l\'exemple et le schéma sous leurs noms, et annonce le résultat', async () => {
    rendre()
    fireEvent.click(screen.getByRole('button', { name: "Télécharger la consigne pour l'IA (.md)" }))
    await waitFor(() => expect(telechargerTexte).toHaveBeenCalledTimes(1))
    const [nom, contenu, type] = telechargerTexte.mock.calls[0] as unknown as [string, string, string]
    expect(nom).toBe(NOMS_FICHIERS_MODELE.consigne)
    expect(type).toBe('text/markdown')
    expect(contenu).toBe(genererModeleIA().consigne)
    expect((await screen.findAllByRole('status')).some((n) => n.textContent === 'Consigne téléchargée.')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: "Télécharger l'exemple (.json)" }))
    await waitFor(() => expect(telechargerTexte).toHaveBeenCalledTimes(2))
    expect((telechargerTexte.mock.calls[1] as unknown as string[])[0]).toBe(NOMS_FICHIERS_MODELE.exemple)
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le schéma (.json)' }))
    await waitFor(() => expect(telechargerTexte).toHaveBeenCalledTimes(3))
    expect((telechargerTexte.mock.calls[2] as unknown as string[])[0]).toBe(NOMS_FICHIERS_MODELE.schema)
  })

  it('copie la consigne et annonce le résultat ; échec de copie expliqué', async () => {
    rendre()
    fireEvent.click(screen.getByRole('button', { name: 'Copier la consigne' }))
    expect(await screen.findByText(/Consigne copiée/)).toBeTruthy()
    expect((copierTexte.mock.calls[0] as unknown as string[])[0]).toContain('## Ma demande')
    copierTexte.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Copier la consigne' }))
    expect(await screen.findByText(/Copie impossible/)).toBeTruthy()
  })

  it('la consigne inclut les exercices personnalisés de la base', async () => {
    await db.execute(
      `INSERT INTO exercises (id, user_id, updated_at, name, category, muscle_groups, description, is_favorite, is_custom, exercise_type, equipment, muscle_primary, is_bodyweight)
       VALUES ('x1', ?, 'n', 'Mon tirage maison', 'BACK', '["DOS"]', '', 0, 1, '', '[]', 'DOS', 0)`,
      [USER],
    )
    rendre()
    fireEvent.click(screen.getByRole('button', { name: "Télécharger la consigne pour l'IA (.md)" }))
    await waitFor(() => expect(telechargerTexte).toHaveBeenCalled())
    expect((telechargerTexte.mock.calls[0] as unknown as string[])[1]).toContain('- Mon tirage maison')
  })
})

describe('ImportIaPanel : aperçu et import', () => {
  it('texte collé -> aperçu complet -> import -> résultat avec lien', async () => {
    rendre()
    coller(`Voici ta séance :\n\`\`\`json\n${JSON.stringify(EXEMPLE, null, 2)}\n\`\`\``)
    const apercu = await screen.findByRole('region', { name: 'Aperçu avant import' })
    expect(within(apercu).getByText('2 séances à importer, 1 exercice à créer.')).toBeTruthy()
    expect(within(apercu).getByRole('heading', { name: 'Haut du corps – force' })).toBeTruthy()
    expect(within(apercu).getByRole('heading', { name: 'Jambes et gainage' })).toBeTruthy()
    expect(within(apercu).getAllByText(/\d+ blocs · \d+ exercices · \d+ séries · ≈ \d+ min/)).toHaveLength(2)
    expect(within(apercu).getByText('Étirement des pectoraux au mur', { exact: false })).toBeTruthy()
    expect(screen.getByText('Bloc JSON extrait du texte collé.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Importer 2 séances' }))
    const statut = await screen.findByText('2 séances importées, 1 exercice créé.')
    expect(statut.getAttribute('role')).toBe('status')
    expect(screen.getByRole('link', { name: 'Voir mes séances types' }).getAttribute('href')).toBe('/strength')
    expect(screen.queryByRole('button', { name: /^Importer \d/ })).toBeNull()
    await waitFor(() => expect(document.activeElement?.className).toBe('import__resultat'))
    expect((await listSeanceTemplates(db)).map((s) => s.nom).sort()).toEqual(['Haut du corps – force', 'Jambes et gainage'])
  })

  it('fichier .json choisi -> aperçu ; un second import du même fichier : déjà présentes, bouton désactivé', async () => {
    rendre()
    const choisir = (f: File) => fireEvent.change(screen.getByLabelText(/Fichier JSON de l'IA/), { target: { files: [f] } })
    choisir(fichier(EXEMPLE_TEXTE))
    fireEvent.click(await screen.findByRole('button', { name: 'Importer 2 séances' }))
    await screen.findByText('2 séances importées, 1 exercice créé.')

    fireEvent.click(screen.getByRole('button', { name: 'Importer un autre fichier' }))
    choisir(fichier(EXEMPLE_TEXTE))
    expect(await screen.findByText('0 séance à importer, 2 déjà présentes (ignorées), aucun exercice à créer.')).toBeTruthy()
    expect(screen.getAllByText('Déjà présente : ignorée')).toHaveLength(2)
    const bouton = screen.getByRole('button', { name: 'Aucune séance à importer' }) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    expect((await listSeanceTemplates(db)).length).toBe(2)
  })

  it('même nom, contenu différent : badge « Renommée » et avertissement', async () => {
    rendre()
    coller(EXEMPLE_TEXTE)
    fireEvent.click(await screen.findByRole('button', { name: 'Importer 2 séances' }))
    await screen.findByText(/séances importées/)
    fireEvent.click(screen.getByRole('button', { name: 'Importer un autre fichier' }))
    const modifie = { ...EXEMPLE, seances: [{ ...EXEMPLE.seances[0], notes: 'Variante' }] }
    coller(JSON.stringify(modifie))
    expect(await screen.findByText('Renommée (nom déjà pris)')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Haut du corps – force (2)' })).toBeTruthy()
    expect(screen.getByText(/sera enregistrée sous « Haut du corps – force \(2\) »/)).toBeTruthy()
  })

  it('exercice inconnu proche d\'un nom du catalogue : suggestion sans substitution', async () => {
    rendre()
    coller(JSON.stringify({ format: 'pandamove-seances-ia', version: 1, seances: [{ nom: 'S', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Developpe couche barr', series: 3 }] }] }] }))
    expect(await screen.findByText(/vouliez-vous dire « Développé couché barre »/)).toBeTruthy()
    expect(screen.getByText('À créer (1) :', { exact: false })).toBeTruthy()
  })

  it('champs inconnus : avertissement visible, import possible', async () => {
    rendre()
    coller(JSON.stringify({ ...EXEMPLE, auteur: 'IA' }))
    expect(await screen.findByText('Fichier : champ inconnu « auteur » ignoré')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Importer 2 séances' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('ImportIaPanel : erreurs bloquantes', () => {
  const sansBouton = () => expect(screen.queryByRole('button', { name: /^Importer \d|Aucune séance/ })).toBeNull()

  it('JSON cassé : alerte claire, focus sur la zone, aucun bouton d\'import', async () => {
    rendre()
    coller('{"format": "pandamove-seances-ia", "seances": [')
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toMatch(/JSON invalide ou tronqué/)
    await waitFor(() => expect(document.activeElement?.className).toBe('import__resultat'))
    sansBouton()
    expect(await listSeanceTemplates(db)).toEqual([])
  })

  it('erreurs de schéma : toutes listées avec leur chemin', async () => {
    rendre()
    coller(JSON.stringify({ format: 'pandamove-seances-ia', version: 1, seances: [
      { nom: 'A', blocs: [{ type: 'PYRAMIDE', exercices: [{ exercice: 'Pompes', series: 3 }] }] },
      { nom: 'B', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Pompes', series: 0 }] }, { type: 'SUPERSET', exercices: [] }] },
    ] }))
    const alerte = await screen.findByRole('alert')
    expect(within(alerte).getByText('Le fichier contient 3 erreurs : rien n\'a été importé.')).toBeTruthy()
    expect(within(alerte).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      "seances[0].blocs[0].type : doit valoir l'une de ces valeurs : LIBRE, ECHAUFFEMENT, ACTIVATION, SUPERSET, CIRCUIT, RECUPERATION",
      'seances[1].blocs[0].exercices[0].series : doit être un entier entre 1 et 20',
      'seances[1].blocs[1].exercices : doit contenir au moins 1 élément',
    ])
    sansBouton()
    expect(screen.queryByRole('region', { name: 'Aperçu avant import' })).toBeNull()
  })

  it('modifier le texte après une analyse invalide l\'aperçu', async () => {
    rendre()
    coller(EXEMPLE_TEXTE)
    await screen.findByRole('button', { name: 'Importer 2 séances' })
    fireEvent.change(screen.getByLabelText("Ou collez la réponse de l'IA"), { target: { value: EXEMPLE_TEXTE + ' ' } })
    expect(screen.queryByRole('button', { name: 'Importer 2 séances' })).toBeNull()
  })

  it('fichier trop volumineux', async () => {
    rendre()
    const gros = new File(['x'], 'gros.json')
    Object.defineProperty(gros, 'size', { value: 3 * 1024 * 1024 })
    fireEvent.change(screen.getByLabelText(/Fichier JSON de l'IA/), { target: { files: [gros] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/Fichier trop volumineux \(maximum 2 Mo\)/)
  })

  it('utilisateur non connecté', async () => {
    rendre(null)
    coller(EXEMPLE_TEXTE)
    expect((await screen.findByRole('alert')).textContent).toMatch(/connecté/)
  })
})

describe('ImportScreen : onglets', () => {
  const ecran = () => render(<MemoryRouter><ImportScreen /></MemoryRouter>)

  it('l\'import Android reste l\'onglet par défaut ; l\'onglet IA est accessible', () => {
    ecran()
    const onglets = screen.getAllByRole('tab')
    expect(onglets.map((o) => o.textContent)).toEqual(['Export Android', 'Séances créées par une IA', 'Programme 2027'])
    expect(onglets[0].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByLabelText(/Fichier d'export/)).toBeTruthy()
    fireEvent.click(onglets[1])
    expect(onglets[1].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'Copier la consigne' })).toBeTruthy()
    expect(screen.queryByLabelText(/Fichier d'export/)).toBeNull()
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(onglets[1].id)
  })

  it("flèches du clavier : changent d'onglet, bouclent et déplacent le focus", () => {
    ecran()
    const [android, ia, prog] = screen.getAllByRole('tab')
    android.focus()
    fireEvent.keyDown(android, { key: 'ArrowRight' })
    expect(ia.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(ia)
    fireEvent.keyDown(ia, { key: 'ArrowRight' })
    expect(prog.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(prog, { key: 'ArrowRight' })
    expect(android.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(android, { key: 'End' })
    expect(prog.getAttribute('aria-selected')).toBe('true')
    expect(prog.tabIndex).toBe(0)
    expect(android.tabIndex).toBe(-1)
    fireEvent.keyDown(prog, { key: 'Home' })
    expect(android.getAttribute('aria-selected')).toBe('true')
  })

  it("l'onglet Programme 2027 affiche son panneau", () => {
    ecran()
    fireEvent.click(screen.getAllByRole('tab')[2])
    expect(screen.getByRole('button', { name: 'Importer le programme 2027' })).toBeTruthy()
    expect(screen.queryByLabelText(/Fichier d'export/)).toBeNull()
  })
})
