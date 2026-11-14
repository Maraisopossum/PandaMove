import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { urlIcone } from '../../../app/modules'
import { ecart, type Ecart } from '../../../core/common/ecart'
import { getDb } from '../../../core/db/client'
import type { DbLecture } from '../../../core/db/Db'
import { duree } from '../../home/bilanSemaine'
import { preparerAudio } from '../../respiration/audio'
import { formaterDate, formaterTonnage, formaterValeur } from '../../stats/presentation'
import { bilanInstance, type BilanInstance } from '../../stats/statsQueries'

const SYMBOLE = { hausse: '↑ ', baisse: '↓ ', stable: '' } as const

function Ligne({ libelle, valeur, e }: { libelle: string; valeur: string; e: Ecart | null }) {
  return (
    <div>
      <dt>{libelle}</dt>
      <dd>{valeur}</dd>
      {e && (
        <dd className={`bilan__ecart--${e.sens}`}>
          {SYMBOLE[e.sens]}
          {e.texte}
          <span className="visuellement-cache"> par rapport à la séance précédente</span>
        </dd>
      )}
    </div>
  )
}

// Compléments du rapport d'une séance terminée : écarts avec la précédente du même modèle, records de la séance (1RM estimé
// supérieur à toutes les séances antérieures) et retour au calme de 5 minutes en Respiration. Lecture seule ; une lecture qui
// échoue masque ces blocs sans gêner le rapport. Calculs dans statsQueries.ts (bilanInstance).
export function BilanPlus({ instanceId, db }: { instanceId: string; db?: DbLecture }) {
  const navigate = useNavigate()
  const [bilan, setBilan] = useState<BilanInstance | null>(null)

  useEffect(() => {
    let annule = false
    bilanInstance(db ?? getDb(), instanceId)
      .then((b) => !annule && setBilan(b))
      .catch((e: unknown) => console.error('Bilan de séance impossible', e))
    return () => {
      annule = true
    }
  }, [instanceId, db])

  const c = bilan?.courante
  const p = bilan?.precedente ?? null
  return (
    <>
      {bilan && c && p && (
        <section className="bilan__plus" aria-labelledby="bilan-precedente">
          <h2 id="bilan-precedente">Par rapport à la dernière fois</h2>
          <dl className="bilan__ecarts">
            <Ligne
              libelle="Tonnage"
              valeur={formaterTonnage(c.tonnageKg)}
              e={p.tonnageKg > 0 ? ecart(c.tonnageKg, p.tonnageKg, (d) => `${Math.round((d / p.tonnageKg) * 100)} %`) : null}
            />
            <Ligne libelle="Séries" valeur={String(c.series)} e={ecart(c.series, p.series, String)} />
            <Ligne libelle="Durée" valeur={c.dureeS > 0 ? duree(c.dureeS) : '—'} e={c.dureeS > 0 && p.dureeS > 0 ? ecart(c.dureeS, p.dureeS, duree) : null} />
          </dl>
          <p className="aide">Séance précédente du même modèle : {formaterDate(p.date)}.</p>
        </section>
      )}

      {bilan && bilan.records.length > 0 && (
        <section className="bilan__plus" aria-labelledby="bilan-records">
          <h2 id="bilan-records">Records de la séance</h2>
          <ul className="bilan__records">
            {bilan.records.map((r) => (
              <li key={r.exerciseId}>
                <span>
                  <span>{r.nom}</span>
                  <span className="aide">
                    {formaterValeur(r.chargeKg, 'kg')} × {r.reps} · ancien record {formaterValeur(r.ancienRmKg, 'kg')}
                  </span>
                </span>
                <span>
                  <strong>{formaterValeur(r.rmKg, 'kg')}</strong>
                  <span className="bilan__ecart--hausse"> +{formaterValeur(Math.round((r.rmKg - r.ancienRmKg) * 10) / 10, 'kg')}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="aide">1RM estimé (formule d’Epley).</p>
        </section>
      )}

      <section className="bilan__retour-calme" aria-labelledby="bilan-calme">
        <img src={urlIcone('souffle')} alt="" width={48} height={48} decoding="async" />
        <div>
          <h2 id="bilan-calme">Retour au calme</h2>
          <p>5 minutes de respiration pour redescendre après l’effort.</p>
          <button
            type="button"
            className="bouton"
            onClick={() => {
              // Geste de l'utilisateur : c'est le moment d'autoriser le son, comme à l'écran Respiration
              preparerAudio()
              void navigate('/breathing/session/coherence_cardiaque/30')
            }}
          >
            Respirer 5 min
          </button>
        </div>
      </section>
    </>
  )
}
