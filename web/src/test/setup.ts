import { configure } from '@testing-library/dom'

// findBy* / waitFor attendent 1 s par défaut : trop court sur une machine chargée (CI), d'où des échecs aléatoires.
configure({ asyncUtilTimeout: 6000 })
