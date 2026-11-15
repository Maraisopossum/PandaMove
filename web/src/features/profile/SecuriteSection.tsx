import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { desinscrire, inscrireTotp, listerFacteurs, verifierCode, type FacteurTotp, type InscriptionTotp } from '../../core/auth/mfa'
import { getSupabase } from '../../core/db/client'
import type { ClientSupabase } from '../../core/db/clientSupabase'

// Section « Double authentification » du profil : inscrire une application d'authentification (QR code, code à 6 chiffres), ou la retirer.
// Facultative pour tous ; exigée seulement pour accéder à l'administration. La logique d'accès est dans core/auth/mfa.ts.
export function SecuriteSection({ client }: { client?: ClientSupabase } = {}) {
  const supabase = () => client ?? getSupabase()
  const [facteurs, setFacteurs] = useState<FacteurTotp[] | null>(null)
  const [inscription, setInscription] = useState<InscriptionTotp | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [confirmeRetrait, setConfirmeRetrait] = useState(false)

  const [version, setVersion] = useState(0)
  const [illisible, setIllisible] = useState(false)
  const lire = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let annule = false
    Promise.resolve()
      .then(() => listerFacteurs(client ?? getSupabase()))
      .then((f) => {
        if (annule) return
        setFacteurs(f)
        setIllisible(false)
      })
      .catch(() => {
        if (annule) return
        setFacteurs(null)
        setIllisible(true)
      })
    return () => {
      annule = true
    }
  }, [client, version])

  const actif = facteurs?.find((f) => f.verifie) ?? null

  async function commencer() {
    setErreur('')
    setMessage('')
    setOccupe(true)
    try {
      // Un facteur commencé puis abandonné empêcherait une nouvelle inscription : on le retire d'abord
      for (const f of facteurs ?? []) if (!f.verifie) await desinscrire(supabase(), f.id)
      setInscription(await inscrireTotp(supabase(), `PandaMove ${new Date().toISOString().slice(0, 16)}`))
      setCode('')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Inscription impossible.')
    } finally {
      setOccupe(false)
    }
  }

  async function confirmer(ev: FormEvent) {
    ev.preventDefault()
    if (!inscription) return
    setErreur('')
    setOccupe(true)
    try {
      await verifierCode(supabase(), inscription.facteurId, code)
      setInscription(null)
      setCode('')
      setMessage('Double authentification activée : un code vous sera demandé à chaque connexion.')
      lire()
    } catch {
      setErreur('Code incorrect ou expiré. Réessayez avec le code affiché maintenant dans votre application.')
    } finally {
      setOccupe(false)
    }
  }

  async function retirer() {
    if (!actif) return
    setErreur('')
    setOccupe(true)
    try {
      await desinscrire(supabase(), actif.id)
      setConfirmeRetrait(false)
      setMessage('Double authentification désactivée.')
      lire()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Désactivation impossible.')
    } finally {
      setOccupe(false)
    }
  }

  return (
    <section aria-labelledby="profil-mfa" className="profil__sauvegarde">
      <h2 id="profil-mfa">Double authentification</h2>
      <p>
        Ajoute un code à 6 chiffres, généré par une application d’authentification (Google Authenticator, Aegis, Microsoft Authenticator…), à votre mot de passe.
        Facultative, mais obligatoire pour accéder à l’administration.
      </p>
      {illisible && <p className="aide">L’état de la double authentification est indisponible pour le moment (connexion requise).</p>}
      {message && <p role="status" className="profil__retour">{message}</p>}
      {erreur && <p role="alert">{erreur}</p>}

      {facteurs !== null && !actif && !inscription && (
        <button type="button" className="bouton bouton--principal" disabled={occupe} onClick={() => void commencer()}>Activer la double authentification</button>
      )}

      {inscription && (
        <form onSubmit={(e) => void confirmer(e)} className="profil__mdp">
          <p>1. Scannez ce code avec votre application d’authentification.</p>
          <img src={inscription.qrCode} alt="QR code à scanner avec l’application d’authentification" width={200} height={200} />
          <p>Impossible de scanner ? Saisissez cette clé à la main : <code>{inscription.secret}</code></p>
          <label className="profil__champ">
            <span>2. Code à 6 chiffres affiché</span>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <button type="submit" className="bouton bouton--principal" disabled={occupe || code.length !== 6}>Valider</button>
          <button type="button" className="bouton" disabled={occupe} onClick={() => { setInscription(null); lire() }}>Annuler</button>
        </form>
      )}

      {actif && (
        <>
          <p role="status">Activée : un code vous est demandé à chaque connexion.</p>
          {!confirmeRetrait ? (
            <button type="button" className="bouton" disabled={occupe} onClick={() => setConfirmeRetrait(true)}>Désactiver…</button>
          ) : (
            <>
              <p>Désactiver la double authentification ? L’administration ne sera plus accessible tant que vous ne l’aurez pas réactivée.</p>
              <button type="button" className="bouton bouton--alerte" disabled={occupe} onClick={() => void retirer()}>Désactiver définitivement</button>
              <button type="button" className="bouton" onClick={() => setConfirmeRetrait(false)}>Annuler</button>
            </>
          )}
        </>
      )}
    </section>
  )
}
