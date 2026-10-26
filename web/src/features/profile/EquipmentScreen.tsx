import { useId } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import type { DisquesConfig, HalteresConfig, PlageConfig } from '../../core/progression/types'
import {
  apercuCharges, BARRE_DEFAUT, brouillonDisques, brouillonHalteres, brouillonPlage, CABLE_DEFAUT, categoriesAvecPas,
  KETTLEBELL_DEFAUT, lireDisques, lireHalteres, lirePas, lirePlage, LIBELLES_CATEGORIES,
  type DisquesBrouillon, type HalteresBrouillon, type PlageBrouillon,
} from './equipementForm'
import { useBrouillon, type StatutEnregistrement } from './useBrouillon'
import { useEquipment } from './useEquipment'

const MESSAGES_STATUT: Record<StatutEnregistrement, string> = {
  idle: '',
  enCours: 'Enregistrement…',
  enregistre: 'Enregistré.',
  erreur: "L'enregistrement a échoué.",
}

const SANS_APERCU = (): string[] => []

function Apercu({ charges, titre }: { charges: string[]; titre: string }) {
  return (
    <div className="materiel__apercu" role="group" aria-label={titre}>
      <p>
        <strong>{titre}</strong> ({charges.length})
      </p>
      <p>{charges.length > 0 ? `${charges.join(' · ')} kg` : 'Aucune charge composable.'}</p>
    </div>
  )
}

function Statut({ statut }: { statut: StatutEnregistrement }) {
  return (
    <p role="status" className="materiel__statut">
      {MESSAGES_STATUT[statut]}
    </p>
  )
}

interface ChampNombreProps {
  label: string
  valeur: string
  onChange: (v: string) => void
  mode?: 'decimal' | 'numeric'
}

function ChampNombre({ label, valeur, onChange, mode = 'decimal' }: ChampNombreProps) {
  const id = useId()
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode={mode} value={valeur} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Disques (barre + disques), réutilisé par la barre et les haltères chargeables ─

interface ChampsDisquesProps {
  libelleBarre: string
  valeur: DisquesBrouillon
  onChange: (v: DisquesBrouillon) => void
}

function ChampsDisques({ libelleBarre, valeur, onChange }: ChampsDisquesProps) {
  const majLigne = (i: number, champ: 'poids' | 'quantite', texte: string) =>
    onChange({ ...valeur, lignes: valeur.lignes.map((l, j) => (j === i ? { ...l, [champ]: texte } : l)) })
  return (
    <>
      <ChampNombre label={libelleBarre} valeur={valeur.barre} onChange={(barre) => onChange({ ...valeur, barre })} />
      <fieldset className="formulaire__groupe">
        <legend>Disques possédés (quantité totale : une paire = 2)</legend>
        {valeur.lignes.map((l, i) => (
          <div key={i} className="formulaire__ligne">
            <ChampNombre label={`Poids du disque ${i + 1} (kg)`} valeur={l.poids} onChange={(t) => majLigne(i, 'poids', t)} />
            <ChampNombre label={`Quantité du disque ${i + 1}`} valeur={l.quantite} mode="numeric" onChange={(t) => majLigne(i, 'quantite', t)} />
            <button
              type="button"
              className="bouton"
              onClick={() => onChange({ ...valeur, lignes: valeur.lignes.filter((_, j) => j !== i) })}
            >
              Retirer le disque {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="bouton"
          onClick={() => onChange({ ...valeur, lignes: [...valeur.lignes, { poids: '', quantite: '' }] })}
        >
          Ajouter un disque
        </button>
      </fieldset>
    </>
  )
}

// ── Sections ────────────────────────────────────────────────────────────────────

function SectionBarre({ valeur, sauver }: { valeur: DisquesConfig | null; sauver: (c: DisquesConfig) => Promise<void> }) {
  const f = useBrouillon<DisquesBrouillon, DisquesConfig>(brouillonDisques(valeur, BARRE_DEFAUT), lireDisques, apercuCharges, sauver)
  return (
    <section aria-labelledby="mat-barre" className="materiel__section">
      <h2 id="mat-barre">Barre</h2>
      {!valeur && <p>Non renseignée : valeurs proposées par défaut, à adapter puis enregistrer.</p>}
      <ChampsDisques libelleBarre="Poids de la barre (kg)" valeur={f.brouillon} onChange={f.setBrouillon} />
      <Apercu titre="Charges atteignables" charges={f.charges} />
      <button type="button" className="bouton" disabled={!f.valide || f.statut === 'enCours'} onClick={() => void f.enregistrer()}>
        Enregistrer la barre
      </button>
      <Statut statut={f.statut} />
    </section>
  )
}

function SectionHalteres({ valeur, sauver }: { valeur: HalteresConfig; sauver: (c: HalteresConfig) => Promise<void> }) {
  const f = useBrouillon<HalteresBrouillon, HalteresConfig>(brouillonHalteres(valeur), lireHalteres, apercuCharges, sauver)
  const b = f.brouillon
  return (
    <section aria-labelledby="mat-halteres" className="materiel__section">
      <h2 id="mat-halteres">Haltères</h2>
      <div className="formulaire__champ">
        <label htmlFor="halteres-fixes">Poids fixes (kg, séparés par des espaces)</label>
        <input id="halteres-fixes" type="text" value={b.fixes} onChange={(e) => f.setBrouillon({ ...b, fixes: e.target.value })} />
      </div>
      <label className="formulaire__case">
        <input type="checkbox" checked={b.chargeable} onChange={(e) => f.setBrouillon({ ...b, chargeable: e.target.checked })} />
        J'ai aussi des haltères chargeables
      </label>
      {b.chargeable && (
        <ChampsDisques libelleBarre="Poids de la poignée (kg)" valeur={b.disques} onChange={(disques) => f.setBrouillon({ ...b, disques })} />
      )}
      <Apercu titre="Charges atteignables" charges={f.charges} />
      <button type="button" className="bouton" disabled={!f.valide || f.statut === 'enCours'} onClick={() => void f.enregistrer()}>
        Enregistrer les haltères
      </button>
      <Statut statut={f.statut} />
    </section>
  )
}

interface SectionPlageProps {
  id: string
  titre: string
  valeur: PlageConfig | null
  defaut: PlageConfig
  sauver: (c: PlageConfig) => Promise<void>
}

function SectionPlage({ id, titre, valeur, defaut, sauver }: SectionPlageProps) {
  const f = useBrouillon<PlageBrouillon, PlageConfig>(brouillonPlage(valeur, defaut), lirePlage, apercuCharges, sauver)
  const b = f.brouillon
  return (
    <section aria-labelledby={id} className="materiel__section">
      <h2 id={id}>{titre}</h2>
      {!valeur && <p>Non renseigné : valeurs proposées par défaut, à adapter puis enregistrer.</p>}
      <ChampNombre label="Charge minimale (kg)" valeur={b.min} onChange={(min) => f.setBrouillon({ ...b, min })} />
      <ChampNombre label="Charge maximale (kg)" valeur={b.max} onChange={(max) => f.setBrouillon({ ...b, max })} />
      <ChampNombre label="Pas (kg)" valeur={b.pas} onChange={(pas) => f.setBrouillon({ ...b, pas })} />
      <Apercu titre="Charges atteignables" charges={f.charges} />
      <button type="button" className="bouton" disabled={!f.valide || f.statut === 'enCours'} onClick={() => void f.enregistrer()}>
        Enregistrer ({titre})
      </button>
      <Statut statut={f.statut} />
    </section>
  )
}

interface LignePasProps {
  categorie: string
  valeur: number | undefined
  sauver: (categorie: string, kg: number) => Promise<void>
}

function LignePas({ categorie, valeur, sauver }: LignePasProps) {
  const f = useBrouillon<string, number>(
    valeur === undefined ? '' : String(valeur).replace('.', ','),
    lirePas,
    SANS_APERCU,
    (kg) => sauver(categorie, kg),
  )
  const id = `pas-${categorie}`
  return (
    <div className="formulaire__ligne">
      <div className="formulaire__champ">
        <label htmlFor={id}>Pas — {LIBELLES_CATEGORIES[categorie]} (kg)</label>
        <input id={id} type="text" inputMode="decimal" value={f.brouillon} onChange={(e) => f.setBrouillon(e.target.value)} />
      </div>
      <button type="button" className="bouton" disabled={!f.valide || f.statut === 'enCours'} onClick={() => void f.enregistrer()}>
        Enregistrer le pas ({LIBELLES_CATEGORIES[categorie]})
      </button>
      <Statut statut={f.statut} />
    </div>
  )
}

// Écran « Mon matériel » : toute la logique vit dans useEquipment / useBrouillon.
export default function EquipmentScreen() {
  const { session } = useAuth()
  const m = useEquipment({ userId: session?.user.id })

  if (!m.charge) return <p>Chargement…</p>

  const avecPas = categoriesAvecPas(m.categories, m.pasParCategorie)
  return (
    <>
      <h1>Mon matériel</h1>
      <p>Déclarez votre matériel : la progression de charge proposera des valeurs réellement composables.</p>

      <fieldset className="formulaire__groupe materiel__section">
        <legend>Catégories possédées</legend>
        {Object.entries(LIBELLES_CATEGORIES).map(([id, libelle]) => (
          <label key={id} className="formulaire__case">
            <input
              type="checkbox"
              checked={m.categories.includes(id)}
              onChange={(e) => void m.basculerCategorie(id, e.target.checked)}
            />
            {libelle}
          </label>
        ))}
      </fieldset>
      {m.erreur && <p role="alert">{m.erreur}</p>}

      {avecPas.length > 0 && (
        <section aria-labelledby="mat-pas" className="materiel__section">
          <h2 id="mat-pas">Pas par catégorie</h2>
          {avecPas.map((c) => (
            <LignePas key={c} categorie={c} valeur={m.pasParCategorie[c]} sauver={m.setPas} />
          ))}
        </section>
      )}

      <SectionHalteres valeur={m.inventaire.halteres} sauver={m.setHalteres} />
      <SectionBarre valeur={m.inventaire.barre} sauver={m.setBarre} />
      <SectionPlage id="mat-kettlebell" titre="Kettlebell" valeur={m.inventaire.kettlebell} defaut={KETTLEBELL_DEFAUT} sauver={m.setKettlebell} />
      <SectionPlage id="mat-cable" titre="Câble / Poulie" valeur={m.inventaire.cable} defaut={CABLE_DEFAUT} sauver={m.setCable} />
    </>
  )
}
