import { useNavigate } from 'react-router'
import { urlIcone } from '../../app/modules'
import { libelleZone, type ZoneCorps } from '../mobilite/donnees'
import { preparerSeance } from '../mobilite/routines'
import { CHOIX_PAR_DEFAUT } from '../mobilite/stockage'

const MINUTES = 8

// Échauffement conseillé d'une séance type : 8 minutes de mobilité et d'activation sur les zones des muscles de la séance. Le bouton
// prépare la séance dans le module Mobilité (comme « Générer ») et ouvre son aperçu. Rien sans zone.
export function EchauffementConseille({ zones }: { zones: ZoneCorps[] }) {
  const navigate = useNavigate()
  if (zones.length === 0) return null
  const lancer = () => {
    preparerSeance({ ...CHOIX_PAR_DEFAUT, minutes: MINUTES, zones, moment: 'avant', types: ['mobilite', 'activation'], sport: null })
    navigate('/mobility/apercu')
  }
  return (
    <section className="renfo-echauffement" aria-labelledby="renfo-echauffement-titre">
      <img src={urlIcone('mobilite')} alt="" width={52} height={52} decoding="async" />
      <div>
        <h2 id="renfo-echauffement-titre">Échauffement conseillé</h2>
        <p>
          {MINUTES} min de mobilité et d’activation : {zones.map((z) => libelleZone(z).toLowerCase()).join(', ')}.
        </p>
        <button type="button" className="bouton" onClick={lancer}>
          Lancer dans Mobilité
        </button>
      </div>
    </section>
  )
}
