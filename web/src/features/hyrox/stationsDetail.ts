import type { CleStation } from './stations'

// Contenu pédagogique du détail d'une station : points clés et erreurs fréquentes. Texte de référence, jamais en base.

export interface DetailStation {
  pointsCles: string[]
  erreurs: string[]
}

export const DETAIL_STATION: Record<CleStation, DetailStation> = {
  skierg: {
    pointsCles: ['Bras tendus au départ, tirez avec le dos et les hanches, pas seulement avec les bras.', 'Cadence régulière, expiration à chaque tirage.', 'Gardez de l’énergie pour la suite : la station ne se gagne pas, elle se gère.'],
    erreurs: ['Partir trop fort et finir en perdant du temps.', 'Tirer uniquement avec les bras.', 'Rester statique : la charge vient de tout le corps.'],
  },
  sled_push: {
    pointsCles: ['Buste incliné, bras tendus, appuis sur l’avant du pied.', 'Pas courts et continus, sans temps d’arrêt.', 'Regard devant, respiration régulière.'],
    erreurs: ['S’arrêter en cours de route : repartir coûte plus cher.', 'Se redresser et perdre la poussée des jambes.', 'Pas trop longs qui cassent l’élan.'],
  },
  sled_pull: {
    pointsCles: ['Assis ou reculant, tirez avec les jambes et le dos.', 'Mains rapides sur la corde, sans pause.', 'Gardez la corde tendue pour que le traîneau ne revienne pas.'],
    erreurs: ['Tirer uniquement avec les bras et les épuiser.', 'Laisser la corde mollir.', 'Aller trop vite sur la première moitié.'],
  },
  burpees: {
    pointsCles: ['Rythme constant plutôt que de grands sauts.', 'Poitrine au sol, rebond rapide, saut vers l’avant en gardant les pieds près des mains.', 'Planifiez de petites respirations plutôt que des arrêts.'],
    erreurs: ['Sauter très loin au début puis s’effondrer.', 'Perdre du temps à se relever lentement.', 'Oublier que la distance est comptée au pied.'],
  },
  rowing: {
    pointsCles: ['Poussez fort avec les jambes, puis le dos, puis les bras.', 'Cadence modérée (autour de 24 à 28 coups par minute).', 'Profitez-en pour faire redescendre la fréquence cardiaque.'],
    erreurs: ['Tirer d’abord avec les bras.', 'Cadence trop haute et trop peu de puissance par coup.', 'Se relâcher complètement alors que la course reprend après.'],
  },
  farmers: {
    pointsCles: ['Épaules basses, buste droit, prise ferme.', 'Pas rapides plutôt que longs.', 'Posez les charges seulement si vos mains lâchent.'],
    erreurs: ['Poser trop souvent les charges.', 'Se pencher en avant.', 'Marcher lentement par peur de lâcher.'],
  },
  lunges: {
    pointsCles: ['Sac haut sur les épaules, buste droit.', 'Fentes longues et régulières, genou arrière près du sol.', 'Respirez à chaque fente.'],
    erreurs: ['Fentes trop courtes qui multiplient les pas.', 'Laisser le sac glisser.', 'S’arrêter à mi-parcours sans l’avoir décidé.'],
  },
  wall_balls: {
    pointsCles: ['Découpez en séries décidées à l’avance (par exemple 25 × 4).', 'Squat profond, poussée des jambes dans le lancer.', 'Rattrapez la balle déjà en position de squat.'],
    erreurs: ['Casser les séries au hasard.', 'Lancer avec les bras seulement.', 'Ne pas atteindre la cible et devoir refaire la répétition.'],
  },
}
