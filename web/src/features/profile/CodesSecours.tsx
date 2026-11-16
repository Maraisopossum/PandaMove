import { useEffect, useState } from 'react'
import { compterCodesRestants, genererCodesSecours, texteDesCodes } from '../../core/auth/codesSecours'
import type { ClientSupabase } from '../../core/db/clientSupabase'

// Codes de secours de la double authentification (sous-section de « Double authentification », visible quand elle est activée).
// 8 codes à usage unique, affichés une seule fois ; en générer de nouveaux invalide les précédents.
export function CodesSecours({ supabase }: { supabase: () => ClientSupabase }) {
  const [restants, setRestants] = useState<number | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [confirme, setConfirme] = useState(false)

  useEffect(() => {
    let annule = false
    Promise.resolve()
      .then(() => compterCodesRestants(supabase()))
      .then((n) => {
        if (!annule) setRestants(n)
      })
      .catch(() => undefined)
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes])

  async function generer() {
    setErreur('')
    setMessage('')
    setOccupe(true)
    try {
      setCodes(await genererCodesSecours(supabase()))
      setConfirme(false)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Génération impossible.')
    } finally {
      setOccupe(false)
    }
  }

  async function copier() {
    if (!codes) return
    try {
      await navigator.clipboard.writeText(texteDesCodes(codes))
      setMessage('Codes copiés.')
    } catch {
      setMessage('Copie impossible : recopiez-les à la main ou téléchargez-les.')
    }
  }

  function telecharger() {
    if (!codes) return
    const url = URL.createObjectURL(new Blob([texteDesCodes(codes)], { type: 'text/plain;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = 'pandamove-codes-de-secours.txt'
    lien.click()
    URL.revokeObjectURL(url)
  }

  const aDesCodes = (restants ?? 0) > 0

  return (
    <div className="profil__secours">
      <h3>Codes de secours</h3>
      <p>
        Si vous perdez votre téléphone, un code de secours retire la double authentification de votre compte (une seule fois par code). Gardez-les
        hors de votre téléphone : gestionnaire de mots de passe ou papier.
      </p>
      {restants !== null && !codes && (
        <p role="status">{aDesCodes ? `${restants} code${restants > 1 ? 's' : ''} de secours encore valable${restants > 1 ? 's' : ''}.` : 'Aucun code de secours : générez-en avant d’en avoir besoin.'}</p>
      )}
      {erreur && <p role="alert">{erreur}</p>}
      {message && <p role="status" className="profil__retour">{message}</p>}

      {codes && (
        <>
          <p><strong>Notez ces codes maintenant : ils ne seront plus affichés.</strong></p>
          <ul className="profil__codes" aria-label="Codes de secours">
            {codes.map((c) => <li key={c}><code>{c}</code></li>)}
          </ul>
          <button type="button" className="bouton" onClick={() => void copier()}>Copier</button>
          <button type="button" className="bouton" onClick={telecharger}>Télécharger</button>
          <button type="button" className="bouton" onClick={() => { setCodes(null); setMessage('') }}>J’ai noté mes codes</button>
        </>
      )}

      {!codes && !confirme && (
        <button type="button" className="bouton" disabled={occupe} onClick={() => (aDesCodes ? setConfirme(true) : void generer())}>
          {aDesCodes ? 'Générer de nouveaux codes…' : 'Générer mes codes de secours'}
        </button>
      )}
      {!codes && confirme && (
        <>
          <p>De nouveaux codes remplacent les anciens, qui ne fonctionneront plus.</p>
          <button type="button" className="bouton bouton--principal" disabled={occupe} onClick={() => void generer()}>Remplacer mes codes</button>
          <button type="button" className="bouton" onClick={() => setConfirme(false)}>Annuler</button>
        </>
      )}
    </div>
  )
}
