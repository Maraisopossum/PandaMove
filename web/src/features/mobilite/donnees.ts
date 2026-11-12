// Catalogue de la mobilité : zones du corps, exercices et séances types par sport. Données statiques, versionnées avec le
// code : rien n'est lu ni écrit en base. Les consignes sont volontairement courtes (elles s'affichent pendant l'exercice).

export type ZoneCorps =
  | 'cou' | 'epaules' | 'poitrine' | 'haut_dos' | 'bas_dos' | 'hanches' | 'fessiers' | 'adducteurs' | 'quadriceps' | 'ischios' | 'mollets' | 'chevilles'

// Ordre du haut vers le bas du corps : sert à l'affichage des zones et au tri des exercices.
export const ZONES: { id: ZoneCorps; libelle: string }[] = [
  { id: 'cou', libelle: 'Cou' },
  { id: 'epaules', libelle: 'Épaules' },
  { id: 'poitrine', libelle: 'Poitrine' },
  { id: 'haut_dos', libelle: 'Haut du dos' },
  { id: 'bas_dos', libelle: 'Bas du dos' },
  { id: 'hanches', libelle: 'Hanches' },
  { id: 'fessiers', libelle: 'Fessiers' },
  { id: 'adducteurs', libelle: 'Adducteurs' },
  { id: 'quadriceps', libelle: 'Cuisses (avant)' },
  { id: 'ischios', libelle: 'Ischio-jambiers' },
  { id: 'mollets', libelle: 'Mollets' },
  { id: 'chevilles', libelle: 'Chevilles' },
]

export const TOUTES_ZONES: ZoneCorps[] = ZONES.map((z) => z.id)
export const libelleZone = (id: ZoneCorps) => ZONES.find((z) => z.id === id)?.libelle ?? id
export const rangZone = (id: ZoneCorps) => TOUTES_ZONES.indexOf(id)

export type TypeExercice = 'mobilite' | 'etirement' | 'activation'
export type Posture = 'debout' | 'assis' | 'sol'

export const LIBELLE_TYPE: Record<TypeExercice, string> = { mobilite: 'Mobilité', etirement: 'Étirement', activation: 'Activation' }
export const LIBELLE_POSTURE: Record<Posture, string> = { debout: 'Debout', assis: 'Assis', sol: 'Au sol' }

export interface Exercice {
  id: string
  nom: string
  /** Zones travaillées, la principale en premier. */
  zones: ZoneCorps[]
  type: TypeExercice
  /** Se fait des deux côtés : la durée est donnée par côté. */
  cote: boolean
  /** Durée conseillée en secondes (par côté si `cote`). */
  dureeS: number
  posture: Posture
  consigne: string
}

const e = (id: string, nom: string, zones: ZoneCorps[], type: TypeExercice, cote: boolean, dureeS: number, posture: Posture, consigne: string): Exercice => ({
  id, nom, zones, type, cote, dureeS, posture, consigne,
})

export const EXERCICES: Exercice[] = [
  // Cou
  e('nuque-rotations', 'Rotations de nuque', ['cou'], 'mobilite', false, 30, 'assis', 'Tournez lentement la tête d’un côté puis de l’autre, menton à l’horizontale. Épaules basses.'),
  e('nuque-inclinaison', 'Inclinaison latérale du cou', ['cou', 'epaules'], 'etirement', true, 25, 'assis', 'Oreille vers l’épaule, l’autre épaule reste basse. Respirez calmement.'),
  e('nuque-menton', 'Menton rentré', ['cou', 'haut_dos'], 'activation', false, 30, 'assis', 'Rentrez le menton comme pour faire un double menton, nuque longue. Relâchez, répétez doucement.'),
  // Épaules
  e('epaules-cercles', 'Cercles d’épaules', ['epaules'], 'mobilite', false, 30, 'debout', 'Faites de grands cercles avec les épaules, vers l’arrière puis vers l’avant.'),
  e('bras-cercles', 'Grands cercles de bras', ['epaules', 'haut_dos'], 'mobilite', false, 30, 'debout', 'Bras tendus, dessinez de grands cercles réguliers. Changez de sens à mi-temps.'),
  e('epaule-travers', 'Étirement du bras en travers', ['epaules'], 'etirement', true, 30, 'debout', 'Ramenez un bras tendu en travers de la poitrine, l’autre main le maintient au-dessus du coude.'),
  e('triceps', 'Étirement du triceps', ['epaules', 'haut_dos'], 'etirement', true, 30, 'debout', 'Coude vers le plafond, main dans le dos. L’autre main pousse doucement le coude.'),
  e('baton-passage', 'Passage de bâton', ['epaules', 'poitrine'], 'mobilite', false, 40, 'debout', 'Avec un élastique ou une serviette tenue large, passez les bras de l’avant vers l’arrière, coudes tendus.'),
  e('rotation-externe', 'Rotation externe au mur', ['epaules'], 'activation', true, 30, 'debout', 'Coude à 90°, dos de la main contre le mur : faites glisser en haut et en bas sans décoller le coude.'),
  // Poitrine
  e('porte-poitrine', 'Ouverture de poitrine à la porte', ['poitrine', 'epaules'], 'etirement', false, 40, 'debout', 'Avant-bras contre l’encadrement, avancez un pied jusqu’à sentir l’étirement devant l’épaule.'),
  e('mains-dos', 'Mains jointes dans le dos', ['poitrine', 'epaules'], 'etirement', false, 30, 'debout', 'Mains jointes derrière le dos, bras tendus, poitrine ouverte. Soulevez doucement les mains.'),
  e('ouverture-sol', 'Ouverture thoracique au sol', ['poitrine', 'haut_dos'], 'mobilite', true, 30, 'sol', 'Allongé sur le côté, genoux fléchis : ouvrez le bras du dessus vers l’arrière en suivant la main du regard.'),
  // Haut du dos
  e('rotation-thoracique', 'Rotation thoracique à quatre pattes', ['haut_dos'], 'mobilite', true, 30, 'sol', 'Une main derrière la tête, coude vers le sol puis vers le plafond. Les hanches restent fixes.'),
  e('chat-vache', 'Chat-vache', ['haut_dos', 'bas_dos'], 'mobilite', false, 40, 'sol', 'À quatre pattes, creusez puis arrondissez le dos en suivant votre respiration.'),
  e('enfant', 'Posture de l’enfant', ['haut_dos', 'bas_dos', 'epaules'], 'etirement', false, 45, 'sol', 'Assis sur les talons, bras tendus devant vous, front vers le sol. Respirez dans le dos.'),
  e('aiguille', 'Enfilade d’aiguille', ['haut_dos', 'epaules'], 'mobilite', true, 30, 'sol', 'À quatre pattes, glissez un bras sous le corps, épaule et tempe vers le sol, puis revenez.'),
  e('dorsaux-chaise', 'Étirement des dorsaux sur une chaise', ['haut_dos', 'epaules'], 'etirement', false, 40, 'debout', 'Mains sur un dossier, reculez les hanches, dos plat, tête entre les bras.'),
  e('inclinaison-tronc', 'Inclinaison latérale du tronc', ['haut_dos', 'bas_dos'], 'etirement', true, 30, 'debout', 'Un bras au-dessus de la tête, penchez-vous sur le côté sans tourner le buste.'),
  // Bas du dos
  e('genoux-poitrine', 'Genoux contre la poitrine', ['bas_dos', 'fessiers'], 'etirement', false, 40, 'sol', 'Allongé, ramenez les genoux vers la poitrine, bras autour des jambes. Bassin posé.'),
  e('torsion-allonge', 'Torsion allongée', ['bas_dos', 'fessiers'], 'etirement', true, 40, 'sol', 'Genoux ensemble qui tombent d’un côté, épaules posées, regard à l’opposé.'),
  e('pont', 'Pont fessier', ['fessiers', 'bas_dos'], 'activation', false, 30, 'sol', 'Pieds à plat, montez le bassin en serrant les fessiers, sans creuser le bas du dos.'),
  e('bird-dog', 'Bird-dog', ['bas_dos', 'fessiers'], 'activation', true, 30, 'sol', 'À quatre pattes, étendez bras et jambe opposés, dos stable. Revenez en contrôle.'),
  e('bascule-bassin', 'Bascule du bassin', ['bas_dos'], 'mobilite', false, 30, 'sol', 'Allongé genoux fléchis, aplatissez le bas du dos puis relâchez, lentement.'),
  // Hanches
  e('hanche-cercles', 'Cercles de hanche', ['hanches'], 'mobilite', true, 30, 'debout', 'Appui sur un mur, levez le genou et dessinez de grands cercles avec la hanche.'),
  e('fente-rotation', 'Fente avec rotation', ['hanches', 'ischios', 'haut_dos'], 'mobilite', true, 40, 'debout', 'Grande fente, mains au sol, tournez le buste vers le genou avant et ouvrez le bras.'),
  e('flechisseur', 'Étirement du fléchisseur de hanche', ['hanches', 'quadriceps'], 'etirement', true, 45, 'sol', 'Genou arrière au sol, bassin rentré, avancez doucement le bassin. Buste droit.'),
  e('pigeon', 'Posture du pigeon', ['hanches', 'fessiers'], 'etirement', true, 50, 'sol', 'Jambe avant pliée devant vous, jambe arrière étendue, penchez le buste vers l’avant.'),
  e('hanche-90', '90/90 des hanches', ['hanches', 'fessiers'], 'mobilite', true, 40, 'sol', 'Assis, les deux genoux à 90° du même côté : redressez le dos, puis penchez-vous vers l’avant.'),
  e('grenouille', 'Posture de la grenouille', ['adducteurs', 'hanches'], 'etirement', false, 45, 'sol', 'À quatre pattes, genoux écartés, pieds en dedans, reculez doucement le bassin.'),
  e('squat-profond', 'Squat profond tenu', ['hanches', 'chevilles'], 'mobilite', false, 45, 'debout', 'Descendez le plus bas possible, talons au sol, coudes poussant les genoux vers l’extérieur.'),
  e('fente-laterale', 'Fente latérale', ['adducteurs', 'hanches'], 'mobilite', true, 30, 'debout', 'Grand pas de côté, fléchissez une jambe, l’autre reste tendue, pied à plat.'),
  // Fessiers
  e('figure-4', 'Étirement du piriforme (figure 4)', ['fessiers', 'hanches'], 'etirement', true, 40, 'sol', 'Allongé, cheville sur le genou opposé, tirez la cuisse vers la poitrine.'),
  e('clam', 'Coquillage', ['fessiers'], 'activation', true, 30, 'sol', 'Allongé sur le côté, genoux pliés : ouvrez le genou du dessus sans bouger le bassin.'),
  e('fire-hydrant', 'Chien qui lève la patte', ['fessiers', 'hanches'], 'activation', true, 30, 'sol', 'À quatre pattes, levez un genou sur le côté en gardant le dos stable.'),
  // Adducteurs
  e('papillon', 'Papillon', ['adducteurs', 'hanches'], 'etirement', false, 45, 'sol', 'Assis, plantes de pieds jointes, genoux vers le sol. Dos long, buste légèrement penché.'),
  e('ecart-assis', 'Grand écart assis', ['adducteurs', 'ischios'], 'etirement', false, 45, 'sol', 'Jambes écartées, penchez le buste vers l’avant en gardant le dos long.'),
  // Cuisses (avant)
  e('quadri-debout', 'Étirement du quadriceps debout', ['quadriceps'], 'etirement', true, 35, 'debout', 'Talon vers la fesse, genoux proches, bassin rentré. Tenez-vous à un appui.'),
  e('fente-dynamique', 'Fente avant dynamique', ['quadriceps', 'hanches'], 'mobilite', false, 40, 'debout', 'Enchaînez de grandes fentes avant, en alternant, buste droit et mouvement fluide.'),
  e('couch', 'Étirement du quadriceps contre le mur', ['quadriceps', 'hanches'], 'etirement', true, 45, 'sol', 'Genou arrière au sol contre un mur, pied appuyé au mur, redressez le buste.'),
  // Ischio-jambiers
  e('ischios-debout', 'Étirement des ischios, pied surélevé', ['ischios'], 'etirement', true, 35, 'debout', 'Talon sur une marche, jambe tendue, penchez le buste dos plat vers le pied.'),
  e('ischios-allonge', 'Ischios allongé avec serviette', ['ischios'], 'etirement', true, 40, 'sol', 'Allongé, une serviette sous le pied, tirez la jambe tendue vers vous.'),
  e('leg-swings', 'Balancés de jambe', ['ischios', 'hanches'], 'mobilite', true, 30, 'debout', 'Appui sur un mur, balancez la jambe tendue d’avant en arrière, amplitude progressive.'),
  e('flexion-avant', 'Flexion avant, dos relâché', ['ischios', 'bas_dos'], 'etirement', false, 40, 'debout', 'Genoux légèrement fléchis, laissez pendre le haut du corps, nuque détendue.'),
  e('good-morning', 'Good morning léger', ['ischios', 'bas_dos'], 'activation', false, 30, 'debout', 'Mains derrière la tête, penchez le buste en reculant les hanches, dos plat, puis remontez.'),
  // Mollets
  e('mollet-mur', 'Étirement du mollet au mur', ['mollets'], 'etirement', true, 35, 'debout', 'Jambe arrière tendue, talon au sol, poussez le mur avec les mains.'),
  e('soleaire', 'Étirement du soléaire', ['mollets', 'chevilles'], 'etirement', true, 35, 'debout', 'Même position, genou arrière fléchi, talon toujours au sol.'),
  e('chien-pedalage', 'Chien tête en bas, pédalage', ['mollets', 'ischios'], 'mobilite', false, 40, 'sol', 'Hanches hautes, pliez un genou puis l’autre pour étirer les mollets en alternance.'),
  e('pointes', 'Montées sur pointes', ['mollets', 'chevilles'], 'activation', false, 30, 'debout', 'Montez sur la pointe des pieds, tenez une seconde, redescendez lentement.'),
  // Chevilles
  e('cheville-cercles', 'Cercles de cheville', ['chevilles'], 'mobilite', true, 25, 'assis', 'Jambe tendue, dessinez de grands cercles avec le pied, dans les deux sens.'),
  e('cheville-mur', 'Mobilité de cheville au mur', ['chevilles', 'mollets'], 'mobilite', true, 30, 'debout', 'Pied face au mur, poussez le genou vers le mur sans décoller le talon.'),
  e('alphabet', 'Alphabet avec le pied', ['chevilles'], 'mobilite', true, 25, 'assis', 'Dessinez les lettres de l’alphabet dans l’air avec le gros orteil.'),
]

export type MomentSeance = 'avant' | 'apres' | 'libre'
export const MOMENTS: { id: MomentSeance; libelle: string; aide: string }[] = [
  { id: 'avant', libelle: 'Avant le sport', aide: 'Mobilité et activation, étirements courts.' },
  { id: 'apres', libelle: 'Après le sport', aide: 'Étirements tenus pour relâcher.' },
  { id: 'libre', libelle: 'Libre', aide: 'Un mélange de tout.' },
]

export type SportId = 'course' | 'velo' | 'renforcement' | 'bureau'

export interface SeanceType {
  id: SportId
  libelle: string
  texte: string
  zones: ZoneCorps[]
  moment: MomentSeance
  /** Pastille du menu (public/icons/menu/<icone>.webp). */
  icone: string
}

// Séances types : zones habituellement sollicitées par chaque pratique. Elles pré-remplissent le choix, qui reste modifiable.
export const SEANCES_TYPES: SeanceType[] = [
  { id: 'course', libelle: 'Course à pied', texte: 'Hanches, cuisses, ischios, mollets et chevilles.', zones: ['hanches', 'quadriceps', 'ischios', 'mollets', 'chevilles', 'fessiers'], moment: 'apres', icone: 'course' },
  { id: 'velo', libelle: 'Vélo', texte: 'Fléchisseurs de hanche, bas du dos, cuisses, cou et épaules.', zones: ['hanches', 'bas_dos', 'quadriceps', 'ischios', 'cou', 'epaules', 'poitrine'], moment: 'apres', icone: 'velo' },
  { id: 'renforcement', libelle: 'Renforcement', texte: 'Épaules, dos, hanches et chevilles pour bien bouger sous la charge.', zones: ['epaules', 'haut_dos', 'hanches', 'chevilles', 'poitrine'], moment: 'avant', icone: 'halteres' },
  { id: 'bureau', libelle: 'Journée au bureau', texte: 'Cou, épaules, dos et hanches raidis par la position assise.', zones: ['cou', 'epaules', 'haut_dos', 'bas_dos', 'hanches'], moment: 'libre', icone: 'accueil' },
]

export const DUREES_MIN = [5, 10, 15, 20, 30] as const
