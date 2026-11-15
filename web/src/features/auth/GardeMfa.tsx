import { useEffect, useState, type ReactNode } from 'react'
import { deconnecterSupabaseBrut, useAuth } from '../../core/auth/AuthProvider'
import { doitVerifier, listerFacteurs, niveauAssurance, type FacteurTotp } from '../../core/auth/mfa'
import { getSupabase } from '../../core/db/client'
import { MfaChallengeScreen } from './MfaChallengeScreen'

type Etat = { etape: 'lecture' } | { etape: 'libre' } | { etape: 'code'; facteur: FacteurTotp }

/**
 * Barrière de la connexion en deux étapes : un compte qui a inscrit un facteur (code à 6 chiffres) ne voit l'application qu'après l'avoir
 * saisi. Sans facteur, rien ne change. Le niveau est lu dans la session locale (aucun réseau : l'application démarre hors ligne) ; seule
 * l'étape du code a besoin du réseau, comme toute connexion.
 */
export function GardeMfa({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [etat, setEtat] = useState<Etat>({ etape: 'lecture' })
  const jeton = session?.access_token

  useEffect(() => {
    let annule = false
    void (async () => {
      try {
        const supabase = getSupabase()
        if (!doitVerifier(await niveauAssurance(supabase))) {
          if (!annule) setEtat({ etape: 'libre' })
          return
        }
        const facteur = (await listerFacteurs(supabase)).find((f) => f.verifie)
        if (!annule) setEtat(facteur ? { etape: 'code', facteur } : { etape: 'libre' })
      } catch {
        // Lecture impossible (hors ligne) : on laisse entrer. Cette barrière est une commodité : le serveur n'exige le second facteur que pour l'administration
        if (!annule) setEtat({ etape: 'libre' })
      }
    })()
    return () => {
      annule = true
    }
  }, [jeton])

  if (etat.etape === 'lecture') return null
  if (etat.etape === 'code') return <MfaChallengeScreen facteur={etat.facteur} deconnecter={() => void deconnecterSupabaseBrut()} />
  return <>{children}</>
}
