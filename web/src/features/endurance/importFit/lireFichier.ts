import { ErreurImportFit, type ActiviteFit } from './convertirFit'

// Lecture d'un fichier choisi par l'utilisateur : `.fit` directement, ou `.zip` (export Garmin Connect : une seule
// activité FIT dans l'archive). Le décodeur FIT est chargé à la demande pour ne pas alourdir le chargement de l'application.

const TAILLE_MAX = 20 * 1024 * 1024

const u16 = (v: DataView, o: number) => v.getUint16(o, true)
const u32 = (v: DataView, o: number) => v.getUint32(o, true)

// Extrait le premier fichier .fit d'une archive zip (méthodes « stockée » et « deflate », lecture par le répertoire central).
export async function extraireFitDuZip(octets: Uint8Array): Promise<Uint8Array> {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  let fin = -1
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65_557); i--) {
    if (u32(v, i) === 0x06054b50) {
      fin = i
      break
    }
  }
  if (fin < 0) throw new ErreurImportFit('Archive zip illisible.')
  let o = u32(v, fin + 16)
  const entrees = u16(v, fin + 10)
  for (let n = 0; n < entrees && u32(v, o) === 0x02014b50; n++) {
    const methode = u16(v, o + 10)
    const tailleCompressee = u32(v, o + 20)
    const longueurNom = u16(v, o + 28)
    const extra = u16(v, o + 30)
    const commentaire = u16(v, o + 32)
    const decalage = u32(v, o + 42)
    const nom = new TextDecoder().decode(octets.subarray(o + 46, o + 46 + longueurNom))
    o += 46 + longueurNom + extra + commentaire
    if (!nom.toLowerCase().endsWith('.fit')) continue
    const debutDonnees = decalage + 30 + u16(v, decalage + 26) + u16(v, decalage + 28)
    const donnees = octets.subarray(debutDonnees, debutDonnees + tailleCompressee)
    if (methode === 0) return donnees
    if (methode !== 8) throw new ErreurImportFit("Compression de l'archive non prise en charge.")
    const flux = new Response(donnees as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(flux).arrayBuffer())
  }
  throw new ErreurImportFit('Aucun fichier .fit dans cette archive.')
}

// Décode des octets FIT en activité (séparé de la lecture du fichier pour pouvoir être testé sans File).
export async function decoderFit(octets: Uint8Array): Promise<ActiviteFit> {
  const { default: FitParser } = await import('fit-file-parser')
  const parseur = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true, mode: 'both' })
  const copie = octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer
  return new Promise<ActiviteFit>((resolve, reject) => {
    parseur.parse(copie, (erreur: unknown, donnees: unknown) => {
      if (erreur) reject(new ErreurImportFit('Fichier FIT illisible ou endommagé.'))
      else resolve(donnees as ActiviteFit)
    })
  })
}

export async function lireFichierActivite(fichier: File): Promise<ActiviteFit> {
  if (fichier.size > TAILLE_MAX) throw new ErreurImportFit('Fichier trop volumineux (20 Mo au plus).')
  const nom = fichier.name.toLowerCase()
  if (!nom.endsWith('.fit') && !nom.endsWith('.zip')) throw new ErreurImportFit('Format non pris en charge : choisissez un fichier .fit ou .zip.')
  let octets: Uint8Array = new Uint8Array(await fichier.arrayBuffer())
  if (nom.endsWith('.zip')) octets = await extraireFitDuZip(octets)
  return decoderFit(octets)
}
