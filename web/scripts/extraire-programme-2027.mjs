// Extrait les séances de cardio du programme 2027 du fichier HTML et écrit un JSON versionné :
//   node scripts/extraire-programme-2027.mjs [chemin du HTML]
// Sans argument, lit support/Programme_endurance_PandaMove_2027_Zwift_KICKR.html (racine du dépôt) et écrit
// src/features/calendar/seancesCardio/programme2027.json. À lancer à la main, une seule fois : l'application importe ensuite
// ce JSON (bouton « Importer le programme 2027 » de l'écran Import).
//
// Le fichier contient un littéral `const weeks=[{n, start, end, label, events}]` suivi de `const strengthA`. Chaque événement
// est un tableau [date, type, titre, "durée · zone", consigne, optionnelle?]. Le script ne lit que ce littéral (JSON.parse,
// jamais eval) et ÉCHOUE SANS RIEN ÉCRIRE sur tout format inattendu.
//
// Règles de conversion :
//   - run donne « course », bike donne « velo » ;
//   - `detail` reprend le texte « durée · zone » tel quel, sans le couper ;
//   - `jalon` est déduit du titre, sans tenir compte de la casse ni des accents : Ravensberg, Pi Marathon, et Lille-Hardelot
//     pour une sortie vélo ;
//   - `optionnelle` est vraie si le 6e élément est vrai ou si la consigne contient « facultatif » ou « optionnel » ;
//   - `cle` = w{semaine}|e{rang}, le rang étant la position dans la semaine du fichier BRUT (avant tout retrait) : elle sert à
//     calculer l'identifiant de chaque séance à l'import et n'est jamais recalculée ;
//   - le 10 km du Ravensberg figure deux fois (24 et 31 janvier) : celui de la semaine 12 est retiré, après le calcul des clés.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const racineWeb = join(dirname(fileURLToPath(import.meta.url)), '..')
export const FICHIER_SOURCE_PAR_DEFAUT = join(racineWeb, '..', 'support', 'Programme_endurance_PandaMove_2027_Zwift_KICKR.html')
export const FICHIER_SORTIE = join(racineWeb, 'src', 'features', 'calendar', 'seancesCardio', 'programme2027.json')

const MARQUEUR_DEBUT = 'const weeks='
const SEMAINE_DU_DOUBLON = 12

// Le littéral `weeks`, entre « const weeks= » et « ; » suivi d'un saut de ligne (\n ou \r\n) et de « const strengthA ».
export function extraireLitteral(html) {
  const debut = html.indexOf(MARQUEUR_DEBUT)
  if (debut < 0) throw new Error(`« ${MARQUEUR_DEBUT} » est introuvable dans le fichier.`)
  const apres = html.slice(debut + MARQUEUR_DEBUT.length)
  const fin = /;\r?\n\s*const strengthA\b/.exec(apres)
  if (!fin) throw new Error('Le repère de fin du littéral est introuvable : « ; » suivi d’un saut de ligne puis de « const strengthA ».')
  try {
    return JSON.parse(apres.slice(0, fin.index))
  } catch (e) {
    throw new Error(`Le littéral weeks n'est pas du JSON valide : ${e.message}`)
  }
}

// Vraie date du calendrier au format yyyy-MM-dd (2026-02-30 est refusé).
function dateValide(texte) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  if (!m) return false
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
}

// Refuse tout format inattendu, avec la position de l'erreur.
export function validerSemaines(semaines) {
  if (!Array.isArray(semaines)) throw new Error('Le programme doit être une liste de semaines.')
  semaines.forEach((s, i) => {
    const ou = `Semaine #${i + 1}`
    if (typeof s !== 'object' || s === null || !Number.isInteger(s.n)) throw new Error(`${ou} : le numéro de semaine est absent ou invalide.`)
    if (!dateValide(s.start) || !dateValide(s.end)) throw new Error(`${ou} (n° ${s.n}) : dates de début et de fin invalides.`)
    if (!Array.isArray(s.events)) throw new Error(`${ou} (n° ${s.n}) : la liste des événements est absente.`)
    s.events.forEach((e, rang) => {
      const position = `Semaine ${s.n}, événement ${rang}`
      if (!Array.isArray(e)) throw new Error(`${position} : ce n'est pas un tableau.`)
      if (e.length !== 5 && e.length !== 6) throw new Error(`${position} : 5 ou 6 éléments attendus, ${e.length} trouvés.`)
      const [date, type, titre, detail, consigne, optionnelle] = e
      if (typeof date !== 'string' || !dateValide(date)) throw new Error(`${position} : date invalide (${JSON.stringify(date)}).`)
      if (date < s.start || date > s.end) throw new Error(`${position} : la date ${date} est hors de la semaine (${s.start} au ${s.end}).`)
      if (type !== 'run' && type !== 'bike') throw new Error(`${position} : type inconnu (${JSON.stringify(type)}), « run » ou « bike » attendu.`)
      if (typeof titre !== 'string' || titre.trim() === '') throw new Error(`${position} : titre vide.`)
      if (typeof detail !== 'string') throw new Error(`${position} : le détail (« durée · zone ») doit être du texte.`)
      if (typeof consigne !== 'string') throw new Error(`${position} : la consigne doit être du texte.`)
      if (optionnelle !== undefined && typeof optionnelle !== 'boolean') throw new Error(`${position} : « optionnelle » doit être un booléen.`)
    })
  })
}

// Minuscules sans accents, pour reconnaître un jalon quelle que soit la casse ou l'écriture.
const nu = (texte) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function jalonDe(genre, titre) {
  const t = nu(titre)
  if (t.includes('ravensberg')) return 'Ravensberg'
  if (t.includes('pi marathon')) return 'Pi Marathon'
  // Lille-Hardelot est une sortie vélo : une séance de course à pied de ce nom n'est pas le jalon
  if (genre === 'velo' && /lille[- ]?hardelot/.test(t)) return 'Lille-Hardelot'
  return null
}

// Toutes les entrées du fichier, converties, avec leur clé (le doublon du Ravensberg n'est pas encore retiré).
export function convertirSemaines(semaines) {
  validerSemaines(semaines)
  return semaines.flatMap((s) =>
    s.events.map((e, rang) => {
      const [date, type, titre, detail, consigne, optionnelle] = e
      const genre = type === 'run' ? 'course' : 'velo'
      return {
        cle: `w${s.n}|e${rang}`,
        genre,
        date,
        titre: titre.trim(),
        consigne: consigne.trim() === '' ? null : consigne.trim(),
        detail: detail.trim() === '' ? null : detail.trim(),
        optionnelle: optionnelle === true || /facultatif|optionnel/i.test(consigne),
        jalon: jalonDe(genre, titre),
      }
    }),
  )
}

// Retire le 10 km du Ravensberg de la semaine 12 (doublon de celui de la semaine 13) ; il doit y en avoir exactement un.
export function retirerDoublonRavensberg(entrees) {
  const estDoublon = (e) => e.jalon === 'Ravensberg' && e.cle.startsWith(`w${SEMAINE_DU_DOUBLON}|`)
  const trouves = entrees.filter(estDoublon).length
  if (trouves !== 1) {
    throw new Error(`Le doublon du Ravensberg de la semaine ${SEMAINE_DU_DOUBLON} devait exister une seule fois, ${trouves} trouvé(s) : le fichier a changé.`)
  }
  return entrees.filter((e) => !estDoublon(e))
}

export function extraireProgramme(html) {
  return retirerDoublonRavensberg(convertirSemaines(extraireLitteral(html)))
}

// Lancement en ligne de commande (pas à l'import depuis les tests)
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = process.argv[2] ? resolve(process.argv[2]) : FICHIER_SOURCE_PAR_DEFAUT
  const entrees = extraireProgramme(readFileSync(source, 'utf8'))
  writeFileSync(FICHIER_SORTIE, `${JSON.stringify(entrees, null, 2)}\n`, 'utf8')
  const jalons = entrees.filter((e) => e.jalon).length
  const optionnelles = entrees.filter((e) => e.optionnelle).length
  console.log(`${entrees.length} séances (${jalons} jalons, ${optionnelles} optionnelles) écrites dans ${FICHIER_SORTIE}`)
}
