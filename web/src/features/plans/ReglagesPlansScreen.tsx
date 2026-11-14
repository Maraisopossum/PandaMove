import { definitionMesure, LIBELLE_MESURE, type MesureReussite, type ReglagesPlans } from './reglagesPlans'
import { usePlans } from './usePlans'

const MESURES: MesureReussite[] = ['seances', 'duree', 'les-deux']

function Nombre({ id, libelle, valeur, min, max, unite, onChange }: { id: string; libelle: string; valeur: number; min: number; max: number; unite: string; onChange: (v: number) => void }) {
  return (
    <label className="formulaire__champ" htmlFor={id}>
      {libelle} ({unite})
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={valeur} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  )
}

function Interrupteur({ libelle, aide, cle, r, changer }: { libelle: string; aide: string; cle: keyof ReglagesPlans; r: ReglagesPlans; changer: (s: Partial<ReglagesPlans>) => void }) {
  return (
    <label className="outils__interrupteur plans__interrupteur">
      <input type="checkbox" checked={r[cle] as boolean} onChange={(e) => changer({ [cle]: e.target.checked })} />
      <span>
        {libelle}
        <span className="plans__phase-detail">{aide}</span>
      </span>
    </label>
  )
}

// Réglages des plans d'endurance : mesure de réussite (taux de réalisation configurable), seuils, déduction des phases, plusieurs plans.
// Préférences d'appareil, non synchronisées.
export default function ReglagesPlansScreen() {
  const { reglages: r, changer, retablir } = usePlans()
  return (
    <div className="plans">
      <h1 className="titre-ecran">Réglages des plans</h1>

      <section className="plans__carte" aria-labelledby="rp-mesure">
        <h2 id="rp-mesure" className="plans__titre">Mesure de réussite</h2>
        <p className="aide">Ce qui compte comme une séance réussie. Cette mesure alimente le taux de réalisation de l’écran Plans.</p>
        <div role="group" aria-label="Mesure de réussite" className="outils__periodes">
          {MESURES.map((m) => (
            <button key={m} type="button" className="outils__periode" aria-pressed={r.mesure === m} onClick={() => changer({ mesure: m })}>
              {LIBELLE_MESURE[m]}
            </button>
          ))}
        </div>
        <p className="aide">Avec « {LIBELLE_MESURE[r.mesure]} » : {definitionMesure(r.mesure)}.</p>
        <Nombre id="rp-duree" libelle="Durée minimale pour compter une séance" valeur={r.dureeMinPct} min={10} max={100} unite="% du prévu" onChange={(v) => changer({ dureeMinPct: v })} />
        <Nombre id="rp-autre" libelle="Séance « faite autrement » : part comptée" valeur={r.autrementPct} min={0} max={100} unite="%" onChange={(v) => changer({ autrementPct: v })} />
        <p className="aide">Les séances facultatives ne comptent jamais comme manquées. Le seuil de durée et la part des séances « faites autrement » s’appliquent quand les sorties sont rattachées aux séances prévues (prochaine étape).</p>
      </section>

      <section className="plans__carte" aria-labelledby="rp-seuils">
        <h2 id="rp-seuils" className="plans__titre">Seuils d’alerte</h2>
        <Nombre id="rp-bon" libelle="Bon à partir de" valeur={r.seuilBonPct} min={1} max={100} unite="%" onChange={(v) => changer({ seuilBonPct: v, seuilSurveillerPct: Math.min(r.seuilSurveillerPct, v) })} />
        <Nombre id="rp-surv" libelle="À surveiller sous" valeur={r.seuilSurveillerPct} min={1} max={r.seuilBonPct} unite="%" onChange={(v) => changer({ seuilSurveillerPct: Math.min(v, r.seuilBonPct) })} />
        <Interrupteur libelle="Prévenir si trois semaines sont sous le seuil" aide="Une proposition d’allègement apparaîtra dans « Ajuster le plan »." cle="prevenirTroisSemaines" r={r} changer={changer} />
      </section>

      <section className="plans__carte" aria-labelledby="rp-phases">
        <h2 id="rp-phases" className="plans__titre">Phases</h2>
        <Interrupteur libelle="Déduire les phases automatiquement" aide="D’après les volumes et les jalons ; recalculées quand le plan change." cle="phasesAuto" r={r} changer={changer} />
        <Nombre id="rp-aff" libelle="Réduction qui fait un affûtage" valeur={r.reductionAffutagePct} min={10} max={80} unite="%" onChange={(v) => changer({ reductionAffutagePct: v })} />
        <Nombre id="rp-alg" libelle="Semaine allégée sous" valeur={r.allegeePct} min={30} max={95} unite="% de la moyenne des trois précédentes" onChange={(v) => changer({ allegeePct: v })} />
      </section>

      <section className="plans__carte" aria-labelledby="rp-plans">
        <h2 id="rp-plans" className="plans__titre">Plusieurs plans</h2>
        <Interrupteur libelle="Additionner la charge de tous les plans" aide="La charge de la semaine compte les séances de chaque plan actif." cle="additionnerCharge" r={r} changer={changer} />
        <Interrupteur libelle="Alerter si deux jalons sont à moins de 10 jours" aide="Message avant l’enregistrement d’un objectif." cle="alerteJalons" r={r} changer={changer} />
        <Interrupteur libelle="Proposer le rattachement des sorties" aide="Une proposition par sortie ; jamais appliquée sans confirmation." cle="proposerRattachement" r={r} changer={changer} />
      </section>

      <button type="button" className="bouton bouton--secondaire" onClick={retablir}>
        Rétablir les réglages par défaut
      </button>
      <p className="aide">Ces réglages sont propres à cet appareil, comme les rappels : ils ne sont pas synchronisés.</p>
    </div>
  )
}
