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

// Détail technique d'une erreur (nom, message, pile) destiné à être transmis au support.
// Aucune donnée personnelle : origines et paramètres d'URL retirés de la pile, adresses e-mail masquées.
export function detailsErreur(erreur: unknown): string {
  const brut =
    erreur instanceof Error
      ? `${erreur.name}: ${erreur.message}${erreur.stack ? `\n${pileSansEntete(erreur)}` : ''}`
      : `Valeur levée : ${String(erreur)}`
  return brut
    .replace(/https?:\/\/[^/\s)]+/g, '')
    .replace(/\?[^\s:)]*(?=:\d+:\d+|\)|\s|$)/g, '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[e-mail]')
}

// La pile V8 recommence par « Nom: message » : on la retire pour ne pas la dupliquer.
function pileSansEntete(erreur: Error): string {
  const lignes = (erreur.stack ?? '').split('\n')
  const entete = `${erreur.name}: ${erreur.message}`
  return (lignes[0] === entete ? lignes.slice(1) : lignes).join('\n')
}
