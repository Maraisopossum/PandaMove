import { getDb } from './client'
import type { Db } from './Db'

/**
 * Lie une fonction de dépôt à la base de l'application : `lier(creerAliment)` donne `(saisie) => creerAliment(getDb(), saisie)`.
 * Sert aux hooks d'accès des écrans (`useAccesNutrition`…) : un composant n'appelle jamais `getDb()` lui-même (architectureEcrans.test.ts).
 * La base est résolue à l'appel, pas à la création (les tests la remplacent par une base en mémoire).
 */
export const lier =
  <A extends unknown[], R>(depot: (db: Db, ...args: A) => R) =>
  (...args: A): R =>
    depot(getDb(), ...args)
