import { useEffect, useRef, useState } from 'react'

interface DetecteurCodes {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type ConstructeurDetecteur = new (options: { formats: string[] }) => DetecteurCodes

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

export function ScanCodeBarres({ onCode, onFermer }: { onCode: (code: string) => void; onFermer: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let arret = false
    let flux: MediaStream | null = null
    let minuterie = 0
    const Detecteur = (window as unknown as { BarcodeDetector: ConstructeurDetecteur }).BarcodeDetector
    const detecteur = new Detecteur({ formats: FORMATS })

    const boucle = async () => {
      if (arret || !video.current) return
      try {
        const codes = await detecteur.detect(video.current)
        if (codes[0]?.rawValue) {
          onCode(codes[0].rawValue)
          return
        }
      } catch {
        // Image pas encore prête : on réessaie
      }
      minuterie = window.setTimeout(() => void boucle(), 250)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (f) => {
        if (arret) {
          f.getTracks().forEach((p) => p.stop())
          return
        }
        flux = f
        if (video.current) {
          video.current.srcObject = f
          await video.current.play().catch(() => undefined)
        }
        void boucle()
      })
      .catch(() => setErreur('La caméra n’est pas accessible. Autorisez-la dans le navigateur, ou saisissez le numéro du code-barres.'))

    return () => {
      arret = true
      window.clearTimeout(minuterie)
      flux?.getTracks().forEach((p) => p.stop())
    }
  }, [onCode])

  return (
    <div className="nutri__scan" role="dialog" aria-label="Scanner un code-barres">
      {erreur ? <p role="alert">{erreur}</p> : <video ref={video} muted playsInline aria-label="Aperçu de la caméra" />}
      <p className="aide">Placez le code-barres dans le cadre, bien éclairé.</p>
      <button type="button" className="bouton" onClick={onFermer}>Fermer</button>
    </div>
  )
}
