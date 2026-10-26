// Lecture tolérante d'un horodatage synchronisé.
// Les colonnes timestamptz arrivent de Postgres / PowerSync sous la forme « 2026-10-24 16:00:00.123456+00 »
// (espace, microsecondes, décalage court), alors que le client écrit « 2026-10-24T16:00:00.000Z ».
// Date.parse du premier format renvoie NaN sous Safari / iOS : on décompose donc nous-mêmes, sans
// dépendre de Date.parse pour ces formats.

const MOTIF =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i

// Décalage « +02 », « +0200 », « +02:00 » ou « Z » -> minutes (absent = UTC : horodatage serveur).
function decalageMinutes(tz: string | undefined): number {
  if (!tz || tz.toUpperCase() === 'Z') return 0
  const signe = tz[0] === '-' ? -1 : 1
  const chiffres = tz.slice(1).replace(':', '')
  return signe * (Number(chiffres.slice(0, 2)) * 60 + Number(chiffres.slice(2, 4) || '0'))
}

/** Epoch ms d'un horodatage (ISO client ou format Postgres), ou null si absent / illisible. */
export function parseTimestamp(valeur: string | null | undefined): number | null {
  if (valeur === null || valeur === undefined) return null
  const texte = valeur.trim()
  if (texte === '') return null
  const m = MOTIF.exec(texte)
  if (!m) {
    // Autres formats (ex. date seule « 2026-10-24 ») : on laisse le navigateur essayer
    const ms = Date.parse(texte)
    return Number.isFinite(ms) ? ms : null
  }
  const [, a, mo, j, h, mi, s, frac, tz] = m
  const annee = Number(a)
  const mois = Number(mo)
  const jour = Number(j)
  const heure = Number(h)
  const minute = Number(mi)
  const seconde = Number(s ?? '0')
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || heure > 23 || minute > 59 || seconde > 59) return null
  const millis = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0
  const ms = Date.UTC(annee, mois - 1, jour, heure, minute, seconde, millis) - decalageMinutes(tz) * 60_000
  return Number.isFinite(ms) ? ms : null
}

/** Ordre chronologique de deux horodatages de formats possiblement différents ; illisible = le plus ancien. */
export function comparerHorodatages(a: string | null | undefined, b: string | null | undefined): number {
  const ma = parseTimestamp(a)
  const mb = parseTimestamp(b)
  if (ma === null && mb === null) return 0
  if (ma === null) return -1
  if (mb === null) return 1
  return ma - mb
}
