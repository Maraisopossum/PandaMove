import { useAuth } from '../../../core/auth/AuthProvider'
import type { MuscleGroup } from '../../../core/db/types'
import { musclesAffiches } from './filtreCatalogue'
import { CATEGORIES_EXERCICE, libelleMuscle, MUSCLE_GROUPS } from './libelles'
import { useCatalog } from './useCatalog'
import { useFormulaireExercice, useSuppressionExercice } from './useFormulaireExercice'

// Catalogue d'exercices : recherche, filtre par muscle, favoris, création / édition / suppression.
// Toute la logique vit dans useCatalog, useFormulaireExercice et useSuppressionExercice.
export default function CatalogScreen() {
  const { session } = useAuth()
  const c = useCatalog({ userId: session?.user.id })
  const form = useFormulaireExercice(c)
  const suppression = useSuppressionExercice(c.supprimer)
  const b = form.brouillon

  return (
    <>
      <h1>Catalogue d'exercices</h1>

      <div className="catalogue__filtres" role="search">
        <div className="formulaire__champ">
          <label htmlFor="cat-recherche">Rechercher</label>
          <input
            id="cat-recherche"
            type="search"
            value={c.filtre.query}
            onChange={(e) => c.setFiltre({ ...c.filtre, query: e.target.value })}
          />
        </div>
        <div className="formulaire__champ">
          <label htmlFor="cat-muscle">Groupe musculaire</label>
          <select
            id="cat-muscle"
            value={c.filtre.muscle ?? ''}
            onChange={(e) => c.setFiltre({ ...c.filtre, muscle: (e.target.value || null) as MuscleGroup | null })}
          >
            <option value="">Tous</option>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {libelleMuscle(m)}
              </option>
            ))}
          </select>
        </div>
        <label className="formulaire__case">
          <input
            type="checkbox"
            checked={c.filtre.favorisSeulement}
            onChange={(e) => c.setFiltre({ ...c.filtre, favorisSeulement: e.target.checked })}
          />
          Favoris seulement
        </label>
        <button type="button" className="bouton" onClick={form.nouveau}>
          Nouvel exercice
        </button>
      </div>

      <section className="catalogue__maintenance" aria-label="Catalogue de base">
        {c.baseInstallee === false && (
          <button type="button" className="bouton" disabled={c.operation.enCours} onClick={() => void c.installerBase()}>
            Ajouter le catalogue de base
          </button>
        )}
        <button type="button" className="bouton" disabled={c.operation.enCours} onClick={() => void c.corrigerGroupes()}>
          Corriger les groupes musculaires
        </button>
        <p role="status" aria-label="Résultat de l'opération" className="catalogue__resultat">
          {c.operation.enCours ? 'Opération en cours…' : (c.operation.message ?? '')}
        </p>
        {c.operation.erreur && <p role="alert" className="import__erreur">{c.operation.erreur}</p>}
      </section>

      {form.ouvert && (
        <form
          className="catalogue__formulaire"
          aria-label={form.enEdition ? "Modifier l'exercice" : 'Nouvel exercice'}
          onSubmit={(e) => {
            e.preventDefault()
            void form.soumettre()
          }}
        >
          <h2>{form.enEdition ? "Modifier l'exercice" : 'Nouvel exercice'}</h2>
          <div className="formulaire__champ">
            <label htmlFor="ex-nom">Nom</label>
            <input id="ex-nom" type="text" value={b.name} onChange={(e) => form.setBrouillon({ ...b, name: e.target.value })} required />
          </div>
          <div className="formulaire__champ">
            <label htmlFor="ex-categorie">Catégorie</label>
            <select id="ex-categorie" value={b.category} onChange={(e) => form.setBrouillon({ ...b, category: e.target.value })}>
              {CATEGORIES_EXERCICE.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.libelle}
                </option>
              ))}
            </select>
          </div>
          <div className="formulaire__champ">
            <label htmlFor="ex-principal">Muscle principal</label>
            <select id="ex-principal" value={b.musclePrimary} onChange={(e) => form.setBrouillon({ ...b, musclePrimary: e.target.value })}>
              <option value="">Aucun</option>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {libelleMuscle(m)}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="formulaire__groupe">
            <legend>Muscles sollicités</legend>
            {MUSCLE_GROUPS.map((m) => (
              <label key={m} className="formulaire__case">
                <input type="checkbox" checked={b.muscleGroups.includes(m)} onChange={(e) => form.basculerMuscle(m, e.target.checked)} />
                {libelleMuscle(m)}
              </label>
            ))}
          </fieldset>
          <div className="formulaire__champ">
            <label htmlFor="ex-type">Type (ex. Pluri, Mono)</label>
            <input id="ex-type" type="text" value={b.exerciseType} onChange={(e) => form.setBrouillon({ ...b, exerciseType: e.target.value })} />
          </div>
          <div className="formulaire__champ">
            <label htmlFor="ex-materiel">Équipement (séparé par des virgules)</label>
            <input id="ex-materiel" type="text" value={b.equipment} onChange={(e) => form.setBrouillon({ ...b, equipment: e.target.value })} />
          </div>
          <div className="formulaire__champ">
            <label htmlFor="ex-description">Description</label>
            <textarea id="ex-description" rows={3} value={b.description} onChange={(e) => form.setBrouillon({ ...b, description: e.target.value })} />
          </div>
          <label className="formulaire__case">
            <input type="checkbox" checked={b.isBodyweight} onChange={(e) => form.setBrouillon({ ...b, isBodyweight: e.target.checked })} />
            Poids de corps
          </label>
          {form.erreur && <p role="alert" className="import__erreur">{form.erreur}</p>}
          <div className="formulaire__ligne">
            <button type="submit" className="bouton">
              Enregistrer
            </button>
            <button type="button" className="bouton" onClick={form.fermer}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {suppression.erreur && <p role="alert" className="import__erreur">{suppression.erreur}</p>}

      {!c.charge ? (
        <p>Chargement…</p>
      ) : c.exercices.length === 0 ? (
        <p>Aucun exercice ne correspond.</p>
      ) : (
        <>
          <p role="status">{c.exercices.length} exercice(s)</p>
          <ul className="catalogue__liste">
            {c.exercices.map((e) => {
              const muscles = musclesAffiches(e)
              return (
              <li key={e.id} className="catalogue__carte">
                <div className="catalogue__texte">
                  <strong>{e.name}</strong>
                  <span className="catalogue__muscles">
                    {muscles.principal === null ? 'Muscle non renseigné' : <>Principal : <b>{muscles.principal}</b></>}
                    {muscles.secondaires.length > 0 && ' · Aussi : ' + muscles.secondaires.join(', ')}
                  </span>
                </div>
                <button
                  type="button"
                  className="bouton"
                  aria-pressed={e.isFavorite}
                  aria-label={`Favori : ${e.name}`}
                  onClick={() => void c.toggleFavori(e.id)}
                >
                  <span aria-hidden="true">{e.isFavorite ? '★' : '☆'}</span>
                </button>
                <button type="button" className="bouton" aria-label={`Modifier ${e.name}`} onClick={() => form.editer(e)}>
                  Modifier
                </button>
                <button type="button" className="bouton" aria-label={`Supprimer ${e.name}`} onClick={() => void suppression.demander(e)}>
                  Supprimer
                </button>
              </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
