import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MODULES, urlIcone, type ModuleId } from '../../app/modules'
import { deplacer, usePreferencesModules } from '../../app/ordreModules'

// Organiser les modules : l'ordre vaut pour le menu de navigation ET pour les accès rapides de l'Accueil ; chaque module peut en plus être
// affiché ou masqué sur l'Accueil. Boutons « monter / descendre » (utilisables au clavier, au lecteur d'écran et au doigt, sans glisser).
// Réglage de cet appareil. Toute la logique est dans app/ordreModules.ts.
export default function OrganiserModulesScreen() {
  const { preferences, modifier, reinitialiser } = usePreferencesModules()
  const [annonce, setAnnonce] = useState('')
  const aFocaliser = useRef<string | null>(null)

  // Après un déplacement, le bouton déplacé retrouve le focus (le navigateur le perd quand le nœud change de place)
  useEffect(() => {
    if (aFocaliser.current) document.getElementById(aFocaliser.current)?.focus()
    aFocaliser.current = null
  })

  function bouger(id: ModuleId, sens: -1 | 1) {
    const ordre = deplacer(preferences.ordre, id, sens)
    modifier({ ...preferences, ordre })
    aFocaliser.current = `mod-${id}-${sens === -1 ? 'haut' : 'bas'}`
    setAnnonce(`${MODULES[id].label} : position ${ordre.indexOf(id) + 2} sur ${ordre.length + 1}`)
  }

  function basculerTuile(id: ModuleId) {
    const affiche = preferences.tuiles.includes(id)
    modifier({ ...preferences, tuiles: affiche ? preferences.tuiles.filter((x) => x !== id) : [...preferences.tuiles, id] })
    setAnnonce(`${MODULES[id].label} ${affiche ? 'retiré de' : 'ajouté à'} l’accueil`)
  }

  return (
    <div className="profil">
      <h1 className="titre-ecran">Organiser les modules</h1>
      <p className="aide">
        L’ordre choisi vaut pour le menu et pour les accès rapides de l’Accueil. Cochez les modules à garder en accès rapide sur l’Accueil. Ce réglage reste sur cet
        appareil.
      </p>

      <ol className="modules-ordre" aria-label="Modules, dans l’ordre du menu">
        <li className="modules-ordre__ligne modules-ordre__ligne--fixe">
          <img className="modules-ordre__puce" src={urlIcone(MODULES.home.icone)} alt="" width={32} height={32} decoding="async" />
          <span className="modules-ordre__nom">{MODULES.home.label}</span>
          <span className="aide modules-ordre__fixe">Toujours en premier</span>
        </li>
        {preferences.ordre.map((id, i) => (
          <li key={id} className="modules-ordre__ligne" style={{ '--couleur-module': MODULES[id].color } as CSSProperties}>
            <img className="modules-ordre__puce" src={urlIcone(MODULES[id].icone)} alt="" width={32} height={32} decoding="async" />
            <span className="modules-ordre__nom">{MODULES[id].label}</span>
            <label className="modules-ordre__accueil">
              <input type="checkbox" checked={preferences.tuiles.includes(id)} onChange={() => basculerTuile(id)} aria-label={`Afficher ${MODULES[id].label} sur l’accueil`} />
              <span>Accueil</span>
            </label>
            <button type="button" id={`mod-${id}-haut`} className="bouton modules-ordre__bouton" aria-label={`Monter ${MODULES[id].label}`} disabled={i === 0} onClick={() => bouger(id, -1)}>
              <span aria-hidden="true">↑</span>
            </button>
            <button type="button" id={`mod-${id}-bas`} className="bouton modules-ordre__bouton" aria-label={`Descendre ${MODULES[id].label}`} disabled={i === preferences.ordre.length - 1} onClick={() => bouger(id, 1)}>
              <span aria-hidden="true">↓</span>
            </button>
          </li>
        ))}
      </ol>

      <p role="status" className="visuellement-cache">
        {annonce}
      </p>
      <button type="button" className="bouton" onClick={() => { reinitialiser(); setAnnonce('Ordre et accès rapides rétablis') }}>
        Rétablir l’ordre par défaut
      </button>
    </div>
  )
}
