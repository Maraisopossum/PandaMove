import { usePushRappels } from './usePushRappels'
import { useReglagesRappels } from './useRappels'

// Rappels de séance : interrupteur général, rappel la veille et le jour même, heures au choix. Logique dans useReglagesRappels.
export default function RappelsScreen() {
  const r = useReglagesRappels()
  const push = usePushRappels()
  const { reglages } = r
  return (
    <div className="outils">
      <h1 className="titre-ecran">Rappels</h1>
      <label className="outils__interrupteur">
        <input
          type="checkbox"
          checked={reglages.actif}
          onChange={(e) => {
            void r.basculer(e.target.checked)
            // Rappels coupés : l'abonnement push de cet appareil est retiré aussi
            if (!e.target.checked && push.actif) void push.desactiver()
          }}
        />
        <span>Rappeler mes séances programmées</span>
      </label>
      {r.message && <p role="alert">{r.message}</p>}

      {push.disponible && (
        <>
          <label className="outils__interrupteur">
            <input
              type="checkbox"
              checked={push.actif}
              disabled={!reglages.actif || push.enCours}
              onChange={(e) => void (e.target.checked ? push.activer() : push.desactiver())}
            />
            <span>Aussi quand l'application est fermée</span>
          </label>
          {push.message && <p role="alert">{push.message}</p>}
        </>
      )}

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
        {push.disponible
          ? "Avec « Aussi quand l'application est fermée », les rappels sont envoyés par le serveur de PandaMove, aux heures ci-dessus (heure de cet appareil) : ils arrivent même si l'application est fermée. Cet appareil est alors enregistré auprès du service de notifications de votre navigateur. Sans cette option, les rappels sont des notifications de l'appareil qui partent tant que PandaMove est ouvert, y compris en arrière-plan : un rappel dû est envoyé à la prochaine ouverture."
          : "Les rappels sont des notifications de l'appareil, sans compte tiers. Ils partent tant que PandaMove est ouvert, y compris en arrière-plan sur le téléphone. Une application web ne peut pas réveiller l'appareil quand elle est fermée : un rappel dû est alors envoyé à la prochaine ouverture."}
      </p>
    </div>
  )
}
