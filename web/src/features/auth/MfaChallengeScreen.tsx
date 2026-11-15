import { useState, type FormEvent } from 'react'
import { verifierCode } from '../../core/auth/mfa'
import { getSupabase } from '../../core/db/client'
import type { FacteurTotp } from '../../core/auth/mfa'

// Deuxième étape de la connexion : code à 6 chiffres de l'application d'authentification. Affiché à la place de l'application tant que la
// session n'a pas passé ce contrôle ; « Se déconnecter » permet de renoncer.
export function MfaChallengeScreen({ facteur, deconnecter }: { facteur: FacteurTotp; deconnecter: () => void }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function valider(ev: FormEvent) {
    ev.preventDefault()
    setErreur('')
    setEnCours(true)
    try {
      await verifierCode(getSupabase(), facteur.id, code)
      // La session passe au niveau aal2 : l'écran disparaît de lui-même
    } catch {
      setErreur('Code incorrect ou expiré. Réessayez avec le code affiché maintenant.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="connexion">
      <header className="connexion__tete">
        <h1 className="titre-ecran">Vérification en deux étapes</h1>
        <p className="connexion__sous-titre">Saisissez le code à 6 chiffres de votre application d’authentification.</p>
      </header>
      <form onSubmit={(e) => void valider(e)}>
        <label>
          Code à 6 chiffres
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus />
        </label>
        <button type="submit" disabled={enCours || code.length !== 6}>Valider</button>
        {erreur && <p role="alert">{erreur}</p>}
        <button type="button" className="connexion__lien" onClick={deconnecter}>Se déconnecter</button>
      </form>
    </main>
  )
}
