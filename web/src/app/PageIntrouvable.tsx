import { Link } from 'react-router'

export function PageIntrouvable() {
  return (
    <>
      <h1>Page introuvable</h1>
      <p>
        Cette page n’existe pas. <Link to="/">Retour à l’accueil</Link>
      </p>
    </>
  )
}
