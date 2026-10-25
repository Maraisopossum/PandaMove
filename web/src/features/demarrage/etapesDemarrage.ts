// Carte « Pour commencer » : étapes déduites des données (rien n'est stocké pour dire « fait »). Fonction pure.

export interface DonneesDemarrage {
  /** Séances types du renforcement (vivantes), séances directes comprises */
  seances: number
  /** Séances jouées ou programmées (vivantes) */
  instances: number
  /** Exercices du catalogue de base (non personnalisés, vivants) */
  exercicesBase: number
  /** « Masquer ces conseils » choisi par l'utilisateur */
  masque: boolean
}

export interface EtapeDemarrage {
  id: 'importer' | 'catalogue' | 'seance'
  titre: string
  aide: string
  fait: boolean
  lien: string
  libelleLien: string
}

export interface Demarrage {
  /** La carte s'affiche tant que la première séance n'existe pas et qu'elle n'est pas masquée */
  visible: boolean
  etapes: EtapeDemarrage[]
}

export function etapesDemarrage({ seances, instances, exercicesBase, masque }: DonneesDemarrage): Demarrage {
  const aDesSeances = seances > 0 || instances > 0
  const etapes: EtapeDemarrage[] = [
    {
      id: 'importer',
      titre: 'Récupérer vos données de l’application Android',
      aide: 'Facultatif : retrouvez vos séances, vos exercices et votre matériel à partir d’un fichier d’export.',
      // Un historique déjà présent (séance jouée ou programmée) vient d'un import ou d'un usage : étape sans objet
      fait: instances > 0,
      lien: '/import',
      libelleLien: 'Importer un fichier',
    },
    {
      id: 'catalogue',
      titre: 'Ajouter le catalogue d’exercices de base',
      aide: 'Plus de cent exercices prêts à l’emploi. Sur la page du catalogue, appuyez sur « Ajouter le catalogue de base ».',
      fait: exercicesBase > 0,
      lien: '/strength/catalog',
      libelleLien: 'Aller au catalogue',
    },
    {
      id: 'seance',
      titre: 'Créer ou lancer votre première séance',
      aide: 'Choisissez quelques exercices : vous pourrez ensuite la lancer, la planifier ou la dupliquer.',
      fait: aDesSeances,
      lien: '/strength/new',
      libelleLien: 'Créer une séance',
    },
  ]
  return { visible: !aDesSeances && !masque, etapes }
}
