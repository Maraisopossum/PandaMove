// Couleurs de l'écran du circuit : toujours sombre, comme l'overlay noir d'Android, quel que soit le thème.
// Les mêmes valeurs sont dans app.css (vérifié par un test) ; contrastes AA vérifiés par ratioContraste.
// Alertes d'après Android (blanc > 10 s, orange de 10 à 4 s, rouge à 3 s) avec des teintes plus claires
// que Color.Red pour tenir 4,5:1 sur le fond ; repos : bleu doux d'Android.
export const COULEURS_CIRCUIT = {
  fond: '#14121c',
  texte: '#ffffff',
  secondaire: '#d0cbe0',
  attention: '#ffab91',
  urgent: '#ff8a80',
  repos: '#90caf9',
  boutonFond: '#2d2a3a',
  boutonTexte: '#ffffff',
} as const
