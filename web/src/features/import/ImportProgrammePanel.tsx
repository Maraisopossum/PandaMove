import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import type { ResultatImportProgramme } from '../calendar/seancesCardio/importerProgramme2027'
import { useImportProgramme, type DepsImportProgramme } from '../calendar/seancesCardio/useImportProgramme'
import { formaterDate } from '../endurance/presentation'

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

function messageResultat({ creees, dejaPresentes }: ResultatImportProgramme): string {
  const presentes = dejaPresentes > 0 ? pluriel(dejaPresentes, 'déjà présente', 'déjà présentes') : null
  if (creees === 0) return `Aucune séance ajoutée${presentes ? ` : ${presentes}` : ''}.`
  return `${pluriel(creees, 'séance ajoutée', 'séances ajoutées')}${presentes ? `, ${presentes}` : ''}.`
}

// Onglet « Programme 2027 » : ajoute à l'agenda les séances de cardio du programme (course et vélo). La logique est
// dans useImportProgramme et importerProgramme2027 ; ce composant affiche l'état.
export default function ImportProgrammePanel(props: DepsImportProgramme) {
  const { statut, resultat, erreur, importer, nbSeances, nbJalons, debut, fin, peutImporter, raisonBlocage } = useImportProgramme(props)
  const zoneResultat = useRef<HTMLDivElement>(null)
  const enCours = statut === 'importing'

  // Le focus suit le résultat (erreur ou succès) pour que les lecteurs d'écran l'annoncent
  useEffect(() => {
    if (statut === 'done' || statut === 'error') zoneResultat.current?.focus()
  }, [statut])

  return (
    <>
      <p className="import__intro">
        Ajoutez à l'agenda les {nbSeances} séances de cardio du programme 2027 (course et vélo), du {formaterDate(debut)} au {formaterDate(fin)}, dont {nbJalons} jalons.
      </p>

      <div className="import__carte">
        <p className="import-ia__aide">
          Réimporter ne crée aucun doublon et ne modifie pas ce qui existe déjà : une séance déplacée, validée ou supprimée reste telle quelle.
          Ces séances ne comptent pas dans les statistiques.
        </p>
        <button
          type="button"
          className="bouton bouton--import"
          onClick={() => void importer()}
          disabled={!peutImporter}
          aria-describedby={raisonBlocage ? 'import-programme-raison' : undefined}
        >
          {enCours ? 'Import en cours…' : statut === 'done' ? 'Importer à nouveau' : 'Importer le programme 2027'}
        </button>
        {raisonBlocage && (
          <p id="import-programme-raison" className="import-ia__aide">
            {raisonBlocage}
          </p>
        )}

        <div ref={zoneResultat} tabIndex={-1} className="import__resultat">
          {erreur && (
            <p role="alert" className="import__erreur">
              {erreur}
            </p>
          )}
          {resultat && (
            <section aria-labelledby="import-programme-succes">
              <h2 id="import-programme-succes">Import terminé</h2>
              <p role="status">{messageResultat(resultat)}</p>
              <Link to="/calendar" className="bouton bouton--import import-ia__lien">
                Voir l'agenda
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
