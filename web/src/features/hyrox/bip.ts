// Bip court à chaque changement de segment, synthétisé avec Web Audio (aucun fichier). Ne lève jamais d'exception : sans API audio,
// ou si le navigateur refuse de démarrer le son, la simulation continue en silence. Réglage gardé par appareil.

const CLE_SON = 'pandamove.hyrox.son'

export function lireSonHyrox(): boolean {
  try {
    return localStorage.getItem(CLE_SON) !== '0'
  } catch {
    return true
  }
}

export function ecrireSonHyrox(actif: boolean): void {
  try {
    localStorage.setItem(CLE_SON, actif ? '1' : '0')
  } catch {
    // stockage indisponible : le réglage vaut pour la session
  }
}

let contexte: AudioContext | null = null

export function bip(frequence = 880, dureeMs = 140): void {
  try {
    const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Classe) return
    contexte ??= new Classe()
    void contexte.resume().catch(() => {})
    const oscillateur = contexte.createOscillator()
    const gain = contexte.createGain()
    oscillateur.frequency.value = frequence
    gain.gain.value = 0.15
    oscillateur.connect(gain)
    gain.connect(contexte.destination)
    oscillateur.start()
    oscillateur.stop(contexte.currentTime + dureeMs / 1000)
  } catch {
    // pas de son possible : sans conséquence
  }
}
