import { useEffect, useRef, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { detailSeance, ETIQUETTES_STATUT, libelleBoutonImport, messageResultat, syntheseApercu } from './libellesIA'
import { useImportIA, type DepsImportIA } from './useImportIA'

// Onglet « Séances créées par une IA » : préparer la consigne, déposer la réponse de l'IA, vérifier l'aperçu, importer.
// Toute la logique vit dans useImportIA et core/import-ia.
export default function ImportIaPanel(props: DepsImportIA) {
  const ia = useImportIA(props)
  const zoneResultat = useRef<HTMLDivElement>(null)
  const { statut } = ia

  // Le focus suit le résultat (erreurs ou succès) pour que les lecteurs d'écran l'annoncent
  useEffect(() => {
    if (statut === 'done' || statut === 'error') zoneResultat.current?.focus()
  }, [statut])

  const choisir = (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (fichier) void ia.chargerFichier(fichier)
    e.target.value = '' // permet de re-sélectionner le même fichier après une correction
  }
  const importer = () => {
    // L'échec est déjà exposé par le hook : on évite un rejet non géré
    ia.confirmer().catch(() => {})
  }

  const enCours = statut === 'importing'
  const plan = ia.plan
  const apercuVisible = plan !== null && statut !== 'done' && ia.erreurs.length === 0

  return (
    <>
      <p className="import__intro">
        Faites créer vos séances par une IA (ChatGPT, Claude, Gemini…) : donnez-lui la consigne ci-dessous avec votre demande, puis importez sa réponse.
      </p>

      <div className="import__carte">
        <h2 className="import-ia__titre">1. Préparer la consigne pour l'IA</h2>
        <p className="import-ia__aide">
          Le fichier est généré sur cet appareil, avec la liste des exercices disponibles. Rien n'est envoyé à une IA : c'est vous qui le lui donnez.
        </p>
        <div className="import-ia__actions">
          <button type="button" className="bouton bouton--import" onClick={() => void ia.telecharger('consigne')}>
            Télécharger la consigne pour l'IA (.md)
          </button>
          <button type="button" className="bouton" onClick={() => void ia.copierConsigne()}>
            Copier la consigne
          </button>
          <button type="button" className="bouton" onClick={() => void ia.telecharger('exemple')}>
            Télécharger l'exemple (.json)
          </button>
          <button type="button" className="bouton" onClick={() => void ia.telecharger('schema')}>
            Télécharger le schéma (.json)
          </button>
        </div>
        <p role="status" className="import-ia__info">
          {ia.info}
        </p>
      </div>

      <div className="import__carte import-ia__carte-import">
        <h2 className="import-ia__titre">2. Importer la réponse de l'IA</h2>
        <div className="import__champ">
          <span className="import__icone" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
          </span>
          <label htmlFor="import-ia-fichier">Fichier JSON de l'IA (.json)</label>
          <input
            id="import-ia-fichier"
            type="file"
            accept=".json,.txt,.md,application/json,text/plain,text/markdown"
            onChange={choisir}
            disabled={enCours}
          />
        </div>

        <div className="import-ia__collage">
          <label htmlFor="import-ia-texte">Ou collez la réponse de l'IA</label>
          <textarea
            id="import-ia-texte"
            className="import-ia__zone"
            rows={6}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={'Collez ici le texte, avec ou sans ```json … ```'}
            value={ia.texte}
            disabled={enCours}
            onChange={(e) => ia.setTexte(e.target.value)}
          />
          <button type="button" className="bouton" onClick={() => void ia.analyserTexte()} disabled={enCours || ia.texte.trim() === ''}>
            Analyser le texte
          </button>
        </div>

        <div ref={zoneResultat} tabIndex={-1} className="import__resultat">
          {ia.erreurs.length > 0 && (
            <div role="alert" className="import__erreur">
              <p className="import-ia__erreur-titre">
                {ia.erreurs.length > 1 ? `Le fichier contient ${ia.erreurs.length} erreurs` : 'Le fichier contient une erreur'} : rien n'a été importé.
              </p>
              <ul className="import-ia__liste">
                {ia.erreurs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="import-ia__aide">Corrigez le fichier (ou redemandez-le à l'IA en lui donnant ces messages), puis rechargez-le.</p>
            </div>
          )}
          {ia.echec && (
            <p role="alert" className="import__erreur">
              {ia.echec}
            </p>
          )}
          {ia.resultat && (
            <section aria-labelledby="import-ia-succes">
              <h2 id="import-ia-succes">Import terminé</h2>
              <p role="status" className="import-ia__succes">
                {messageResultat(ia.resultat)}
              </p>
              <div className="import-ia__actions">
                <Link to="/strength" className="bouton bouton--import import-ia__lien">
                  Voir mes séances types
                </Link>
                <button type="button" className="bouton" onClick={ia.reinitialiser}>
                  Importer un autre fichier
                </button>
              </div>
            </section>
          )}
        </div>

        {ia.notes.length > 0 && statut !== 'done' && (
          <ul className="import-ia__notes">
            {ia.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {apercuVisible && (
          <section aria-labelledby="import-ia-apercu">
            <h2 id="import-ia-apercu">Aperçu avant import</h2>
            <p role="status" className="import-ia__synthese">
              {syntheseApercu(plan.seances, plan.exercicesACreer.length)}
            </p>

            {ia.avertissements.length > 0 && (
              <div className="import__avertissement">
                <strong>Champs ignorés : </strong>
                <ul className="import-ia__liste">
                  {ia.avertissements.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="import-ia__seances">
              {plan.seances.map((s) => {
                const etiquette = ETIQUETTES_STATUT[s.statut]
                return (
                  <li key={s.index} className={s.statut === 'nouvelle' ? 'import-ia__seance' : 'import-ia__seance import-ia__seance--ignoree'}>
                    <h3 className="import-ia__seance-nom">{s.nom}</h3>
                    {s.renommee && <p className="import-ia__badge import-ia__badge--attention">Renommée (nom déjà pris)</p>}
                    {etiquette && <p className="import-ia__badge">{etiquette}</p>}
                    <p className="import-ia__detail">{detailSeance(s)}</p>
                    {s.reconnus.length > 0 && (
                      <p className="import-ia__exercices">
                        <strong>Reconnus au catalogue ({s.reconnus.length}) : </strong>
                        {s.reconnus.map((r) => (r.via === 'alias' ? `${r.nomFichier} → ${r.nomCatalogue}` : r.nomCatalogue)).join(', ')}
                      </p>
                    )}
                    {s.aCreer.length > 0 && (
                      <p className="import-ia__exercices import-ia__exercices--creer">
                        <strong>À créer ({s.aCreer.length}) : </strong>
                        {s.aCreer.map((a) => a.nom).join(', ')}
                      </p>
                    )}
                    {s.avertissements.length > 0 && (
                      <ul className="import-ia__liste import-ia__liste--attention">
                        {s.avertissements.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>

            <button type="button" className="bouton bouton--import" onClick={importer} disabled={enCours || !ia.peutImporter}>
              {enCours ? 'Import en cours…' : libelleBoutonImport(ia.nbSeancesNouvelles)}
            </button>
          </section>
        )}
      </div>

      <aside className="import__info" aria-label="À savoir">
        <span className="import__info-icone" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
        </span>
        <p>
          <strong>Sans doublon, sans écrasement</strong>
          Réimporter le même fichier ne crée rien de plus. Une séance du même nom mais différente est ajoutée avec « (2) ». N'ajoutez jamais de données personnelles dans votre demande à l'IA.
        </p>
      </aside>
    </>
  )
}
