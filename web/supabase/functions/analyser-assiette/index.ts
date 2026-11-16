// Fonction Supabase `analyser-assiette` (Deno) : estime le contenu nutritionnel d'une photo de repas avec un modèle de vision, AU CHOIX de l'utilisateur
// parmi les fournisseurs dont la clé est configurée (Anthropic, Google Gemini, OpenAI : voir fournisseurs.ts).
// La photo est envoyée au fournisseur choisi pour cette seule analyse : elle n'est ni conservée ni journalisée. Les clés ne sortent jamais d'ici.
// Plafond par compte et par jour (table analyses_assiette, migration 0020) pour borner le coût, tous fournisseurs confondus. Règles dans analyse.ts.
//
// Requêtes (POST JSON) : { action: 'fournisseurs' } rend la liste des fournisseurs configurés ; sinon une analyse { image, mediaType, indication?, fournisseur? }.
//
// Secrets (à définir par `supabase secrets set`), au moins UNE clé : sans clé la fonction répond 503 et l'application propose la saisie manuelle.
//   ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY      clés des fournisseurs proposés.
//   ANALYSE_MODELE_ANTHROPIC / _GEMINI / _OPENAI           facultatifs : modèle de vision de chaque fournisseur (ANALYSE_MODELE reste lu pour Anthropic).
//   ANALYSE_FOURNISSEUR_DEFAUT                             facultatif : anthropic, gemini ou openai (défaut : le premier configuré).
//   ANALYSES_PAR_JOUR                                      facultatif : plafond par compte et par jour (défaut 30).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { ErreurAnalyse, executer, lireDemande, PLAFOND_PAR_JOUR_DEFAUT, type DemandeAnalyse, type PortsAnalyse } from './analyse.ts'
import { choisirFournisseur, construireRequete, extraireSortie, fournisseursConfigures, lireFournisseur, listePublique, type FournisseurConfigure } from './fournisseurs.ts'

const env = (nom: string): string => {
  const v = Deno.env.get(nom)
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return v
}

const entetes = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: entetes })

async function appelerModele(fournisseur: FournisseurConfigure, demande: DemandeAnalyse): Promise<unknown> {
  const requete = construireRequete(fournisseur, demande)
  const r = await fetch(requete.url, { method: 'POST', headers: requete.headers, body: requete.body, signal: AbortSignal.timeout(45_000) })
  if (!r.ok) {
    console.error('analyser-assiette : API', fournisseur.id, r.status, (await r.text()).slice(0, 300))
    throw new ErreurAnalyse(502, `Le service d’analyse (${fournisseur.libelle}) est indisponible pour le moment.`)
  }
  return extraireSortie(fournisseur.id, await r.json().catch(() => null))
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetes })
  if (requete.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée.' })

  try {
    const configures = fournisseursConfigures((nom) => Deno.env.get(nom))
    const defaut = Deno.env.get('ANALYSE_FOURNISSEUR_DEFAUT')
    const base = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const jeton = (requete.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: appelant, error: erreurJeton } = await base.auth.getUser(jeton)
    if (erreurJeton || !appelant.user) return reponse(401, { erreur: 'Connexion requise.' })
    const userId = appelant.user.id

    const corps = await requete.json().catch(() => null)
    if (typeof corps === 'object' && corps !== null && (corps as Record<string, unknown>).action === 'fournisseurs') return reponse(200, listePublique(configures, defaut))
    const fournisseur = choisirFournisseur(lireFournisseur(corps), configures, defaut)
    const demande = lireDemande(corps)

    const ports: PortsAnalyse = {
      plafondParJour: Number(Deno.env.get('ANALYSES_PAR_JOUR')) || PLAFOND_PAR_JOUR_DEFAUT,
      async analysesRecentes() {
        const depuis = new Date(Date.now() - 86_400_000).toISOString()
        const { count, error } = await base.from('analyses_assiette').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', depuis)
        if (error) throw new Error(error.message)
        return count ?? 0
      },
      async noterAnalyse() {
        const { error } = await base.from('analyses_assiette').insert({ user_id: userId })
        if (error) throw new Error(error.message)
      },
      appelerModele: (d) => appelerModele(fournisseur, d),
    }

    return reponse(200, await executer(demande, ports))
  } catch (e) {
    if (e instanceof ErreurAnalyse) return reponse(e.statut, { erreur: e.message })
    console.error('analyser-assiette', e)
    return reponse(500, { erreur: 'Erreur du serveur.' })
  }
})
