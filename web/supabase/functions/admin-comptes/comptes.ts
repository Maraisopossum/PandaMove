// Logique de la fonction `admin-comptes` (actions d'administration technique) : validation, garde-fous et enchaînement des actions.
// Aucune dépendance à Deno ni à Supabase : les accès passent par des « ports » injectés (index.ts les branche sur la clé de service),
// ce qui permet de tester toutes les règles sous Vitest (src/core/admin/fonctionAdminComptes.test.ts).

export type ActionAdmin = 'inviter' | 'suspendre' | 'retablir' | 'reinitialiser' | 'supprimer'
export const ACTIONS: readonly ActionAdmin[] = ['inviter', 'suspendre', 'retablir', 'reinitialiser', 'supprimer']

export interface DemandeAdmin {
  action: ActionAdmin
  email?: string
  userId?: string
  /** Suppression : l'adresse e-mail du compte, retapée pour confirmer. */
  confirmation?: string
}

/**
 * Tables qui portent des lignes d'un utilisateur (colonne `user_id`) : toutes sont vidées avant la suppression du compte (aucune clé
 * étrangère vers auth.users). Un test vérifie que chaque table du schéma local y figure : une nouvelle table doit être ajoutée ici.
 */
export const TABLES_UTILISATEUR = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance', 'series_realisees', 'objectifs_progression', 'user_settings',
  'seances_course', 'seances_velo', 'methodes_respiration', 'seances_respiration', 'sorties', 'seances_mobilite', 'objectifs_plan',
  'hyrox_courses', 'hyrox_simulations', 'hyrox_segments', 'push_abonnements', 'rappels_push_envoyes', 'profils',
] as const

export interface CompteCible {
  id: string
  email: string | null
  /** Porte le rôle administrateur. */
  admin: boolean
}

export interface PortsAdmin {
  /** Compte qui fait la demande (déjà reconnu comme administrateur). */
  adminId: string
  trouverCompte(id: string): Promise<CompteCible | null>
  inviter(email: string): Promise<void>
  /** Interdit (ou autorise de nouveau) la connexion du compte. */
  bannir(id: string, banni: boolean): Promise<void>
  marquerStatut(id: string, statut: 'actif' | 'suspendu'): Promise<void>
  envoyerReinitialisation(email: string): Promise<void>
  viderTables(id: string): Promise<void>
  supprimerUtilisateur(id: string): Promise<void>
  journaliser(action: string, cibleId: string | null, detail: string | null): Promise<void>
}

export class ErreurAdmin extends Error {
  readonly statut: number
  constructor(statut: number, message: string) {
    super(message)
    this.name = 'ErreurAdmin'
    this.statut = statut
  }
}

const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Demande lue dans un corps JSON non fiable ; lève une ErreurAdmin 400 si elle est invalide. */
export function lireDemande(brut: unknown): DemandeAdmin {
  if (typeof brut !== 'object' || brut === null) throw new ErreurAdmin(400, 'Demande invalide.')
  const o = brut as Record<string, unknown>
  const action = ACTIONS.find((a) => a === o.action)
  if (!action) throw new ErreurAdmin(400, 'Action inconnue.')
  const email = typeof o.email === 'string' ? o.email.trim() : undefined
  const userId = typeof o.userId === 'string' ? o.userId.trim() : undefined
  const confirmation = typeof o.confirmation === 'string' ? o.confirmation.trim() : undefined
  if (action === 'inviter') {
    if (!email || !RE_EMAIL.test(email)) throw new ErreurAdmin(400, 'Adresse e-mail invalide.')
  } else if (!userId || !RE_UUID.test(userId)) {
    throw new ErreurAdmin(400, 'Identifiant de compte invalide.')
  }
  return { action, email, userId, confirmation }
}

/** Exécute une action. Garde-fous : jamais sur son propre compte ni sur un autre administrateur pour suspendre ou supprimer. */
export async function executer(demande: DemandeAdmin, p: PortsAdmin): Promise<{ message: string }> {
  if (demande.action === 'inviter') {
    await p.inviter(demande.email!)
    await p.journaliser('invitation', null, demande.email!)
    return { message: `Invitation envoyée à ${demande.email}.` }
  }

  const cible = await p.trouverCompte(demande.userId!)
  if (!cible) throw new ErreurAdmin(404, 'Compte introuvable.')
  const destructif = demande.action === 'suspendre' || demande.action === 'supprimer'
  if (destructif && cible.id === p.adminId) throw new ErreurAdmin(403, 'Vous ne pouvez pas faire cela sur votre propre compte.')
  if (destructif && cible.admin) throw new ErreurAdmin(403, 'Ce compte est administrateur : retirez d’abord son rôle dans Supabase.')

  switch (demande.action) {
    case 'suspendre':
      await p.bannir(cible.id, true)
      await p.marquerStatut(cible.id, 'suspendu')
      await p.journaliser('suspension', cible.id, cible.email)
      return { message: 'Compte suspendu : il ne peut plus se connecter.' }
    case 'retablir':
      await p.bannir(cible.id, false)
      await p.marquerStatut(cible.id, 'actif')
      await p.journaliser('retablissement', cible.id, cible.email)
      return { message: 'Compte rétabli.' }
    case 'reinitialiser':
      if (!cible.email) throw new ErreurAdmin(400, 'Ce compte n’a pas d’adresse e-mail.')
      await p.envoyerReinitialisation(cible.email)
      await p.journaliser('reinitialisation_mot_de_passe', cible.id, cible.email)
      return { message: `Lien de réinitialisation envoyé à ${cible.email}.` }
    case 'supprimer': {
      if (!cible.email || (demande.confirmation ?? '').toLowerCase() !== cible.email.toLowerCase()) {
        throw new ErreurAdmin(400, 'Confirmation incorrecte : retapez l’adresse e-mail du compte.')
      }
      // Le journal d'abord : la trace existe même si la suppression échoue en cours de route
      await p.journaliser('suppression', cible.id, cible.email)
      await p.viderTables(cible.id)
      await p.supprimerUtilisateur(cible.id)
      return { message: 'Compte supprimé avec toutes ses données.' }
    }
  }
}
