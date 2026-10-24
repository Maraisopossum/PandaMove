export const MESSAGE_CONFIGURATION =
  'Configuration manquante : renseignez VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et VITE_POWERSYNC_URL dans web/.env.local'

// Message affichable pour une erreur de rendu. L'erreur de variable d'environnement est levée par
// core/db/client.ts avec le préfixe « Configuration manquante ».
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof Error && erreur.message.startsWith('Configuration manquante')) {
    return MESSAGE_CONFIGURATION
  }
  return 'Une erreur est survenue. Rechargez la page ; si le problème persiste, contactez le support.'
}
