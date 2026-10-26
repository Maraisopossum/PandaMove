import { useRejetEnvoi } from './rejetsEnvoi'

// Présentation pure : role="alert" car la modification rejetée est perdue côté serveur ;
// le message ne bloque rien et se masque d'un appui (bouton .bouton : cible de 44 px).
export function AlerteRejetEnvoiVue({ message, onMasquer }: { message: string | null; onMasquer: () => void }) {
  if (!message) return null
  return (
    <section role="alert" className="bandeau">
      <p>{message}</p>
      <button type="button" className="bouton" aria-label="Masquer l'alerte d'envoi" onClick={onMasquer}>
        Masquer
      </button>
    </section>
  )
}

// Alerte branchée sur le dernier rejet définitif du connecteur.
export function AlerteRejetEnvoi() {
  const { message, masquer } = useRejetEnvoi()
  return <AlerteRejetEnvoiVue message={message} onMasquer={masquer} />
}
