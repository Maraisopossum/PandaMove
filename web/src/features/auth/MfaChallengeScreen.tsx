import { useState, type FormEvent } from 'react'
import { utiliserCodeSecours } from '../../core/auth/codesSecours'
import { verifierCode } from '../../core/auth/mfa'
import { getSupabase } from '../../core/db/client'
import type { FacteurTotp } from '../../core/auth/mfa'

// Deuxième étape de la connexion : code à 6 chiffres de l'application d'authentification. Affiché à la place de l'application tant que la
// session n'a pas passé ce contrôle ; « Se déconnecter » permet de renoncer.
export function MfaChallengeScreen({ facteur, deconnecter }: { facteur: FacteurTotp; deconnecter: () => void }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [secours, setSecours] = useState(false)
  const [codeSecours, setCodeSecours] = useState('')

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

  async function validerSecours(ev: FormEvent) {
    ev.preventDefault()
    setErreur('')
    setEnCours(true)
    try {
      await utiliserCodeSecours(getSupabase(), codeSecours)
      // La session est rafraîchie sans facteur : la barrière laisse entrer
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Code de secours refusé.')
    } finally {
      setEnCours(false)
    }
  }

  if (secours) {
    return (
      <main className="connexion">
        <header className="connexion__tete">
          <h1 className="titre-ecran">Code de secours</h1>
          <p className="connexion__sous-titre">
            Saisissez l’un de vos codes de secours. Il retire la double authentification de ce compte : vous pourrez la réactiver dans votre profil.
          </p>
        </header>
        <form onSubmit={(e) => void validerSecours(e)}>
          <label>
            Code de secours
            <input value={codeSecours} onChange={(e) => setCodeSecours(e.target.value.toUpperCase().slice(0, 11))} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCDE-FGH23" required autoFocus />
          </label>
          <button type="submit" disabled={enCours || codeSecours.replace(/[^A-Za-z0-9]/g, '').length !== 10}>Utiliser ce code</button>
          {erreur && <p role="alert">{erreur}</p>}
          <button type="button" className="connexion__lien" onClick={() => { setSecours(false); setErreur('') }}>Revenir au code à 6 chiffres</button>
        </form>
      </main>
    )
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
        <button type="button" className="connexion__lien" onClick={() => { setSecours(true); setErreur('') }}>Téléphone perdu ? Utiliser un code de secours</button>
        <button type="button" className="connexion__lien" onClick={deconnecter}>Se déconnecter</button>
      </form>
    </main>
  )
}
