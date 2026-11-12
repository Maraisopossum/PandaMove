import { useReglagesRappels } from './useRappels'

// Rappels de séance : interrupteur général, rappel la veille et le jour même, heures au choix. Logique dans useReglagesRappels.
export default function RappelsScreen() {
  const r = useReglagesRappels()
  const { reglages } = r
  return (
    <div className="outils">
      <h1 className="titre-ecran">Rappels</h1>
      <label className="outils__interrupteur">
        <input type="checkbox" checked={reglages.actif} onChange={(e) => void r.basculer(e.target.checked)} />
        <span>Rappeler mes séances programmées</span>
      </label>
      {r.message && <p role="alert">{r.message}</p>}

      <fieldset className="outils__rappel" disabled={!reglages.actif}>
        <legend>La veille</legend>
        <label className="outils__interrupteur">
          <input type="checkbox" checked={reglages.veille} onChange={(e) => r.modifier('veille', e.target.checked)} />
          <span>Prévenir la veille</span>
        </label>
        <label className="formulaire__champ">
          Heure du rappel de la veille
          <input type="time" value={reglages.veilleHeure} disabled={!reglages.veille} onChange={(e) => r.regler('veilleHeure', e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="outils__rappel" disabled={!reglages.actif}>
        <legend>Le jour même</legend>
        <label className="outils__interrupteur">
          <input type="checkbox" checked={reglages.jour} onChange={(e) => r.modifier('jour', e.target.checked)} />
          <span>Prévenir le jour de la séance</span>
        </label>
        <label className="formulaire__champ">
          Heure du rappel du jour
          <input type="time" value={reglages.jourHeure} disabled={!reglages.jour} onChange={(e) => r.regler('jourHeure', e.target.value)} />
        </label>
      </fieldset>

      <p className="aide">
        Les rappels sont des notifications de l'appareil, sans compte tiers. Ils partent tant que PandaMove est ouvert, y compris en arrière-plan sur
        le téléphone. Une application web ne peut pas réveiller l'appareil quand elle est fermée : un rappel dû est alors envoyé à la prochaine ouverture.
      </p>
    </div>
  )
}
