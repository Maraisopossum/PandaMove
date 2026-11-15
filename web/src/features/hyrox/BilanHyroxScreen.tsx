import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDb } from '../../core/db/client'
import { definirReference, modifierNotesSimulation, supprimerSimulation } from '../../core/db/repos/hyrox'
import { bilanSimulation, deriveCourse, formaterChrono, formaterEcart, LIBELLE_FORME, NOM_COURSE_COURT } from './simulation'
import { STATION_PAR_CLE } from './stations'
import { useBilanHyrox, versMesure } from './useHyrox'

const nomSegment = (s: { type: 'course' | 'station'; station: string | null }) => (s.type === 'course' ? NOM_COURSE_COURT : STATION_PAR_CLE[s.station as keyof typeof STATION_PAR_CLE]?.nom ?? 'Station')
const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

// Bilan d'une simulation : total et écart, dérive de course, temps et écart de chaque segment, forts et faibles, référence.
export default function BilanHyroxScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const b = useBilanHyrox(id)
  const [notes, setNotes] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  if (b.etat === 'introuvable') return <div className="plans hyrox"><h1 className="titre-ecran">Bilan</h1><p>Simulation introuvable. <Link to="/hyrox">Retour à Hyrox</Link></p></div>
  if (b.etat === 'erreur') return <div className="plans hyrox"><h1 className="titre-ecran">Bilan</h1><p role="alert">Impossible de lire la simulation.</p></div>
  if (!b.simulation) return <div className="plans hyrox"><h1 className="titre-ecran">Bilan</h1></div>

  const sim = b.simulation
  const mesures = b.segments.map(versMesure)
  const bilan = bilanSimulation(mesures)
  const derive = bilan ? deriveCourse(bilan.kilometres) : null
  const notesAffichees = notes ?? sim.notes ?? ''

  async function agir(action: () => Promise<void>, apres?: () => void) {
    setErreur('')
    try {
      await action()
      if (apres) apres()
      else b.recharger()
    } catch {
      setErreur('L’action a échoué.')
    }
  }

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Bilan de simulation</h1>
      <section className="plans__entete" aria-labelledby="hb-titre">
        <p className="plans__sur-titre">{LIBELLE_FORME[sim.forme].split(' · ')[0].toUpperCase()}{sim.statut === 'abandonnee' ? ' · ABANDONNÉE' : ''}{sim.reference ? ' · RÉFÉRENCE' : ''}</p>
        <h2 id="hb-titre" className="plans__grand">{bilan ? formaterChrono(bilan.totalS) : '—'}</h2>
        <p>{jour(sim.debutAt)}</p>
        {bilan && (
          <div className="outils__chiffres">
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Écart à la cible</span><strong>{bilan.ecartS !== null ? formaterEcart(bilan.ecartS) : '—'}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Dérive de course</span><strong>{derive !== null ? formaterEcart(derive) : '—'}</strong><span className="outils__chiffre-detail">dernier km − premier km</span></div>
          </div>
        )}
      </section>

      {!bilan ? (
        <p>Aucun segment n’a été chronométré dans cette simulation.</p>
      ) : (
        <>
          <section className="plans__carte" aria-labelledby="hb-seg">
            <h2 id="hb-seg" className="plans__titre">Segments</h2>
            <ol className="plans__phases">
              {mesures.map((s) => (
                <li key={s.rang}>
                  <span className="plans__phase-texte">
                    <strong>{s.rang}. {nomSegment(s)}</strong>
                    <span className="plans__phase-detail">
                      {s.reelS !== null ? formaterChrono(s.reelS) : 'non chronométré'}
                      {s.reelS !== null && s.cibleS !== null ? ` · ${formaterEcart(s.reelS - s.cibleS)} (cible ${formaterChrono(s.cibleS)})` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {(bilan.faibles.length > 0 || bilan.forts.length > 0) && (
            <section className="plans__carte" aria-labelledby="hb-ff">
              <h2 id="hb-ff" className="plans__titre">Forts et faibles</h2>
              {bilan.forts.length > 0 && <p><strong>Points forts :</strong> {bilan.forts.map(nomSegment).join(', ')}.</p>}
              {bilan.faibles.length > 0 && <p><strong>À travailler :</strong> {bilan.faibles.map(nomSegment).join(', ')}.</p>}
            </section>
          )}
        </>
      )}

      <section className="plans__carte" aria-labelledby="hb-act">
        <h2 id="hb-act" className="plans__titre">Notes et référence</h2>
        <label className="formulaire__champ">
          Notes
          <textarea rows={3} maxLength={2000} value={notesAffichees} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="button" className="bouton" onClick={() => void agir(() => modifierNotesSimulation(getDb(), sim.id, notesAffichees), () => { setNotes(null); b.recharger() })}>Enregistrer les notes</button>
        {sim.forme === 'complete' && sim.statut === 'terminee' && (
          <button type="button" className="bouton" onClick={() => void agir(() => definirReference(getDb(), sim.id, !sim.reference))}>
            {sim.reference ? 'Retirer des références' : 'Définir comme référence'}
          </button>
        )}
        {erreur && <p role="alert">{erreur}</p>}
        <button type="button" className="bouton bouton--alerte" onClick={() => void agir(() => supprimerSimulation(getDb(), sim.id), () => navigate('/hyrox'))}>Supprimer la simulation</button>
      </section>
      <Link className="plans__lien" to="/hyrox">Retour à Hyrox</Link>
    </div>
  )
}
