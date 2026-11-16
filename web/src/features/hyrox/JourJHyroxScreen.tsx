import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ciblesCourseComplete, ecrireRepartition, formaterChrono, lireTempsHyrox, NOM_COURSE_COURT, SEGMENTS_COMPLETS } from './simulation'
import { chargeStation, STATION_PAR_CLE } from './stations'
import { useEcrituresHyrox } from './useAccesHyrox'
import { useHyrox } from './useHyrox'

const CLE_LISTE = 'pandamove.hyrox.checklist'
const LISTE = [
  'Dossard et pièce d’identité retirés',
  'Tenue et chaussures prêtes, déjà portées',
  'Repas pris trois heures avant le départ',
  'Boisson et gel d’appoint préparés',
  'Montre chargée, plan de course relu',
  'Échauffement prévu (course, mobilité, quelques répétitions de stations)',
  'Après la course : repas, hydratation et sommeil, pas d’entraînement le lendemain',
]

function lireCoches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_LISTE) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const nomSegment = (rang: number) => {
  const s = SEGMENTS_COMPLETS[rang - 1]
  return s.type === 'course' ? NOM_COURSE_COURT : STATION_PAR_CLE[s.station!].nom
}

// Jour J : liste de préparation (gardée sur l'appareil), plan de course (partage et impression), résultat officiel saisi à la main
// segment par segment. La date de course est facultative : l'écran sert aussi de répétition générale.
export default function JourJHyroxScreen() {
  const navigate = useNavigate()
  const h = useHyrox()
  const ecriture = useEcrituresHyrox()
  const [coches, setCoches] = useState(lireCoches)
  const [saisies, setSaisies] = useState<string[]>(() => Array.from({ length: 16 }, () => ''))
  const [erreur, setErreur] = useState('')
  const objectif = h.objectif
  const cibles = objectif?.objectifS ? ciblesCourseComplete(objectif.objectifS, h.repartition.partCoursesPct) : null
  const categorie = objectif?.categorie ?? 'open'
  const genre = objectif?.genre ?? 'homme'

  const basculer = (item: string) => {
    const suite = coches.includes(item) ? coches.filter((x) => x !== item) : [...coches, item]
    setCoches(suite)
    try {
      localStorage.setItem(CLE_LISTE, JSON.stringify(suite))
    } catch {
      // stockage indisponible : la liste vaut pour la session
    }
  }

  const textePlan = () =>
    SEGMENTS_COMPLETS.map((s, i) => `${i + 1}. ${nomSegment(s.rang)}${s.station ? ` (${chargeStation(s.station, categorie, genre) ?? STATION_PAR_CLE[s.station].effort})` : ''} : ${cibles ? formaterChrono(cibles[i]) : '—'}`).join('\n')

  async function partager() {
    const texte = `Plan de course Hyrox${objectif?.nom ? ` · ${objectif.nom}` : ''}\n${textePlan()}`
    try {
      if (navigator.share) await navigator.share({ title: 'Plan de course Hyrox', text: texte })
      else await navigator.clipboard.writeText(texte)
    } catch {
      // partage annulé ou indisponible : sans conséquence
    }
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    const temps = saisies.map((s) => (s.trim() === '' ? null : lireTempsHyrox(s)))
    if (saisies.some((s, i) => s.trim() !== '' && temps[i] === null)) {
      setErreur('Les temps doivent ressembler à 4:35 ou 1:02:10.')
      return
    }
    if (temps.every((t) => t === null)) {
      setErreur('Saisissez au moins un temps.')
      return
    }
    try {
      const id = await ecriture.enregistrerCourseOfficielle({
        courseId: objectif?.id ?? null, categorie, genre, debutAt: objectif?.date ? new Date(`${objectif.date}T12:00:00`).toISOString() : undefined,
        segments: SEGMENTS_COMPLETS.map((s, i) => ({
          rang: s.rang, type: s.type, station: s.station, cibleS: cibles ? cibles[i] : null, chargeLabel: s.station ? chargeStation(s.station, categorie, genre) : null, reelS: temps[i],
        })),
      })
      if (objectif && temps.every((t) => t !== null)) {
        const total = temps.reduce((t, x) => t + (x ?? 0), 0)
        await ecriture.modifierObjectif(objectif.id, {
          nom: objectif.nom, lieu: objectif.lieu, date: objectif.date, categorie: objectif.categorie, genre: objectif.genre, objectifS: objectif.objectifS,
          resultatS: total, repartitionJson: objectif.repartitionJson ?? ecrireRepartition(h.repartition),
        })
      }
      navigate(`/hyrox/bilan/${id}`, { replace: true })
    } catch {
      setErreur('L’enregistrement a échoué.')
    }
  }

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Jour J</h1>
      <p className="aide">Aucune date n’est nécessaire : cet écran sert aussi de répétition générale.</p>

      <section className="plans__carte" aria-labelledby="jj-liste">
        <h2 id="jj-liste" className="plans__titre">Liste de préparation <span className="plans__sous">{coches.filter((c) => LISTE.includes(c)).length} sur {LISTE.length}</span></h2>
        <ul className="hyrox__liste">
          {LISTE.map((item) => (
            <li key={item}>
              <label className="hyrox__case"><input type="checkbox" checked={coches.includes(item)} onChange={() => basculer(item)} /> <span>{item}</span></label>
            </li>
          ))}
        </ul>
      </section>

      <section className="plans__carte hyrox__plan" aria-labelledby="jj-plan">
        <h2 id="jj-plan" className="plans__titre">Plan de course</h2>
        {!cibles && <p className="aide">Sans temps visé, les cibles restent vides : définissez-le dans l’objectif.</p>}
        <ol className="plans__phases">
          {SEGMENTS_COMPLETS.map((s, i) => (
            <li key={s.rang}>
              <span className="plans__phase-texte">
                <strong>{i + 1}. {nomSegment(s.rang)}</strong>
                <span className="plans__phase-detail">{s.station ? `${chargeStation(s.station, categorie, genre) ?? STATION_PAR_CLE[s.station].effort} · ` : ''}{cibles ? formaterChrono(cibles[i]) : '—'}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="hyrox__liens">
          <button type="button" className="bouton" onClick={() => void partager()}>Partager</button>
          <button type="button" className="bouton" onClick={() => window.print()}>Imprimer</button>
        </div>
      </section>

      <section className="plans__carte" aria-labelledby="jj-res">
        <h2 id="jj-res" className="plans__titre">Résultat officiel</h2>
        <p className="aide">Recopiez les temps par segment depuis le résultat du chronométreur. Vous pouvez en laisser en blanc. Le résultat est enregistré comme une simulation complète, donc vos records et votre estimation en profitent.</p>
        <form className="plans__formulaire" onSubmit={(e) => void enregistrer(e)}>
          {SEGMENTS_COMPLETS.map((s, i) => (
            <label key={s.rang} className="formulaire__champ">
              {i + 1}. {nomSegment(s.rang)}
              <input value={saisies[i]} onChange={(e) => setSaisies(saisies.map((x, k) => (k === i ? e.target.value : x)))} placeholder="4:35" inputMode="numeric" />
            </label>
          ))}
          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" className="bouton bouton--principal">Enregistrer le résultat</button>
        </form>
      </section>
    </div>
  )
}
