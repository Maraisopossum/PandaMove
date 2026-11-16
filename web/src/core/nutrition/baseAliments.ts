// Base d'aliments courants fournie avec l'application (valeurs moyennes pour 100 g, d'après les tables usuelles type Ciqual, arrondies).
// Elle sert à saisir vite hors ligne ; pour un produit précis, scanner le code-barres (Open Food Facts) ou créer un aliment personnel.
// Les valeurs sont celles de l'aliment tel que mangé (cuit pour les féculents, les viandes et les légumineuses).

export type CategorieAliment = 'feculents' | 'proteines' | 'laitiers' | 'fruits' | 'legumes' | 'matieres-grasses' | 'boissons' | 'plaisirs'

export interface AlimentBase {
  /** Identifiant stable (jamais réutilisé) : sert de référence à `aliment_id` quand l'aliment est copié dans « Mes aliments ». */
  id: string
  nom: string
  categorie: CategorieAliment
  /** Pour 100 g (100 ml pour les boissons). */
  kcal: number
  proteines: number
  glucides: number
  lipides: number
  fibres: number | null
  /** Portion habituelle en grammes, et son libellé (« 1 tranche »). */
  portionG: number
  portionLabel: string
}

export const LIBELLE_CATEGORIE: Record<CategorieAliment, string> = {
  feculents: 'Féculents et céréales',
  proteines: 'Viandes, poissons, œufs, végétal',
  laitiers: 'Produits laitiers',
  fruits: 'Fruits et fruits secs',
  legumes: 'Légumes',
  'matieres-grasses': 'Matières grasses',
  boissons: 'Boissons',
  plaisirs: 'Plaisirs et produits sucrés',
}

type Ligne = [id: string, nom: string, kcal: number, p: number, g: number, l: number, fibres: number | null, portionG: number, portionLabel: string]

const lignes = (categorie: CategorieAliment, items: Ligne[]): AlimentBase[] =>
  items.map(([id, nom, kcal, proteines, glucides, lipides, fibres, portionG, portionLabel]) => ({
    id: `base-${id}`, nom, categorie, kcal, proteines, glucides, lipides, fibres, portionG, portionLabel,
  }))

export const BASE_ALIMENTS: readonly AlimentBase[] = [
  ...lignes('feculents', [
    ['riz-blanc', 'Riz blanc cuit', 130, 2.7, 28, 0.3, 0.4, 150, '1 assiette'],
    ['riz-complet', 'Riz complet cuit', 123, 2.7, 25.6, 1, 1.8, 150, '1 assiette'],
    ['pates', 'Pâtes cuites', 131, 5, 25, 1.1, 1.8, 180, '1 assiette'],
    ['pates-completes', 'Pâtes complètes cuites', 124, 5.3, 23, 1.2, 4, 180, '1 assiette'],
    ['pomme-de-terre', 'Pomme de terre cuite', 80, 2, 17, 0.1, 1.8, 200, '2 pommes de terre'],
    ['patate-douce', 'Patate douce cuite', 90, 1.6, 20.7, 0.1, 3.3, 200, '1 patate douce'],
    ['semoule', 'Semoule cuite', 120, 4, 24, 0.5, 1.5, 150, '1 assiette'],
    ['quinoa', 'Quinoa cuit', 120, 4.4, 21.3, 1.9, 2.8, 150, '1 assiette'],
    ['lentilles', 'Lentilles cuites', 116, 9, 20, 0.4, 7.9, 150, '1 assiette'],
    ['pois-chiches', 'Pois chiches cuits', 139, 8, 22, 2.6, 7, 120, '1/2 boîte'],
    ['haricots-rouges', 'Haricots rouges cuits', 127, 8.7, 22.8, 0.5, 6.4, 120, '1/2 boîte'],
    ['pain-blanc', 'Baguette', 270, 8.5, 55, 1.2, 2.5, 60, '1/4 de baguette'],
    ['pain-complet', 'Pain complet', 250, 9, 45, 3, 7, 40, '1 tranche'],
    ['flocons-avoine', 'Flocons d’avoine', 372, 13, 60, 7, 10, 40, '4 c. à soupe'],
    ['muesli', 'Muesli', 370, 9, 66, 6, 8, 50, '1 bol'],
    ['biscottes', 'Biscottes', 400, 11, 72, 6, 4, 20, '2 biscottes'],
  ]),
  ...lignes('proteines', [
    ['poulet', 'Blanc de poulet cuit', 165, 31, 0, 3.6, 0, 120, '1 filet'],
    ['dinde', 'Escalope de dinde cuite', 155, 30, 0, 3, 0, 120, '1 escalope'],
    ['boeuf-5', 'Steak haché 5 % cuit', 160, 26, 0, 6, 0, 125, '1 steak'],
    ['boeuf-15', 'Steak haché 15 % cuit', 250, 26, 0, 16, 0, 125, '1 steak'],
    ['boeuf', 'Bœuf (rumsteck) cuit', 200, 28, 0, 9, 0, 120, '1 pièce'],
    ['porc', 'Filet mignon de porc cuit', 165, 29, 0, 5, 0, 120, '1 pièce'],
    ['jambon-blanc', 'Jambon blanc', 110, 18, 0.5, 4, 0, 45, '1 tranche'],
    ['saumon', 'Saumon cuit', 206, 22, 0, 13, 0, 120, '1 pavé'],
    ['thon', 'Thon au naturel (conserve)', 110, 25, 0, 1, 0, 110, '1 boîte égouttée'],
    ['cabillaud', 'Cabillaud cuit', 105, 23, 0, 1, 0, 130, '1 filet'],
    ['crevettes', 'Crevettes cuites', 100, 21, 0.2, 1.5, 0, 100, '1 portion'],
    ['oeuf', 'Œuf entier', 143, 12.6, 0.7, 9.9, 0, 60, '1 œuf'],
    ['tofu', 'Tofu nature', 120, 13, 2, 7, 1, 100, '1/3 de bloc'],
    ['whey', 'Protéine en poudre (whey)', 380, 78, 6, 5, 0, 30, '1 dose'],
  ]),
  ...lignes('laitiers', [
    ['lait', 'Lait demi-écrémé', 46, 3.3, 4.8, 1.6, 0, 250, '1 verre'],
    ['lait-soja', 'Lait de soja', 41, 3.3, 2.5, 1.8, 0.5, 250, '1 verre'],
    ['yaourt', 'Yaourt nature', 55, 4.2, 5, 2.5, 0, 125, '1 pot'],
    ['yaourt-grec', 'Yaourt grec', 130, 5.5, 4, 10, 0, 125, '1 pot'],
    ['skyr', 'Skyr nature', 63, 11, 4, 0.2, 0, 150, '1 pot'],
    ['fromage-blanc', 'Fromage blanc 0 %', 46, 8, 4, 0.2, 0, 100, '1 pot'],
    ['emmental', 'Emmental', 380, 28, 0, 29, 0, 30, '1 portion'],
    ['mozzarella', 'Mozzarella', 250, 18, 1, 19, 0, 60, '1/2 boule'],
    ['camembert', 'Camembert', 270, 20, 0.5, 22, 0, 30, '1 part'],
    ['creme', 'Crème fraîche 30 %', 290, 2.2, 2.5, 30, 0, 20, '1 c. à soupe'],
  ]),
  ...lignes('fruits', [
    ['banane', 'Banane', 90, 1, 20, 0.2, 2, 120, '1 banane'],
    ['pomme', 'Pomme', 52, 0.3, 11.4, 0.2, 2.4, 150, '1 pomme'],
    ['orange', 'Orange', 47, 0.9, 9.4, 0.1, 2.2, 130, '1 orange'],
    ['poire', 'Poire', 55, 0.4, 12.5, 0.1, 3, 150, '1 poire'],
    ['kiwi', 'Kiwi', 55, 1.1, 11.6, 0.5, 2.7, 75, '1 kiwi'],
    ['fraises', 'Fraises', 33, 0.7, 6, 0.4, 2, 150, '1 barquette'],
    ['myrtilles', 'Myrtilles', 57, 0.7, 12, 0.3, 2.4, 100, '1 poignée'],
    ['raisin', 'Raisin', 70, 0.6, 16, 0.2, 1, 100, '1 grappe'],
    ['avocat', 'Avocat', 160, 2, 2, 15, 6, 100, '1/2 avocat'],
    ['dattes', 'Dattes', 280, 2, 65, 0.4, 7, 25, '3 dattes'],
    ['amandes', 'Amandes', 600, 21, 7, 52, 12, 20, '1 poignée'],
    ['noix', 'Noix', 650, 15, 7, 64, 7, 20, '5 noix'],
    ['cacahuetes', 'Cacahuètes', 590, 25, 8, 50, 8, 20, '1 poignée'],
    ['beurre-cacahuete', 'Beurre de cacahuète', 600, 25, 12, 50, 6, 15, '1 c. à soupe'],
  ]),
  ...lignes('legumes', [
    ['brocoli', 'Brocoli cuit', 35, 3, 3.5, 0.4, 3, 150, '1 portion'],
    ['carottes', 'Carottes', 35, 0.7, 7, 0.2, 3, 100, '1 carotte'],
    ['tomate', 'Tomate', 18, 0.9, 3, 0.2, 1.2, 120, '1 tomate'],
    ['salade', 'Salade verte', 15, 1.2, 1.5, 0.2, 1.5, 50, '1 poignée'],
    ['courgette', 'Courgette cuite', 17, 1.1, 2.3, 0.3, 1.2, 150, '1 portion'],
    ['haricots-verts', 'Haricots verts cuits', 30, 1.8, 4.5, 0.2, 3.3, 150, '1 portion'],
    ['epinards', 'Épinards cuits', 25, 2.7, 1.5, 0.5, 2.5, 150, '1 portion'],
    ['champignons', 'Champignons', 22, 3, 0.5, 0.3, 1.5, 100, '1 portion'],
    ['poivron', 'Poivron', 26, 1, 4.6, 0.3, 1.7, 120, '1 poivron'],
    ['concombre', 'Concombre', 12, 0.6, 1.8, 0.1, 0.5, 100, '1/2 concombre'],
    ['petits-pois', 'Petits pois', 80, 5, 11, 0.5, 5, 100, '1 portion'],
  ]),
  ...lignes('matieres-grasses', [
    ['huile-olive', 'Huile d’olive', 900, 0, 0, 100, 0, 10, '1 c. à soupe'],
    ['beurre', 'Beurre', 745, 0.7, 0.6, 82, 0, 10, '1 noix'],
    ['mayonnaise', 'Mayonnaise', 700, 1, 2, 77, 0, 15, '1 c. à soupe'],
  ]),
  ...lignes('boissons', [
    ['cafe', 'Café sans sucre', 2, 0.1, 0, 0, 0, 120, '1 tasse'],
    ['jus-orange', 'Jus d’orange', 45, 0.7, 10, 0.2, 0.2, 200, '1 verre'],
    ['soda', 'Soda cola', 42, 0, 10.6, 0, 0, 330, '1 canette'],
    ['biere', 'Bière', 43, 0.4, 3.5, 0, 0, 250, '1 demi'],
    ['vin', 'Vin rouge', 70, 0.1, 0.2, 0, 0, 125, '1 verre'],
  ]),
  ...lignes('plaisirs', [
    ['chocolat-noir', 'Chocolat noir 70 %', 560, 8, 35, 40, 11, 20, '2 carrés'],
    ['chocolat-lait', 'Chocolat au lait', 540, 7, 57, 31, 2, 20, '2 carrés'],
    ['croissant', 'Croissant', 410, 8, 45, 22, 2, 60, '1 croissant'],
    ['pain-chocolat', 'Pain au chocolat', 420, 7, 45, 23, 2, 70, '1 pièce'],
    ['barre-cereales', 'Barre de céréales', 400, 5, 70, 12, 4, 25, '1 barre'],
    ['chips', 'Chips', 530, 6, 50, 33, 4, 30, '1 petit sachet'],
    ['frites', 'Frites', 300, 3.5, 40, 15, 3, 150, '1 portion'],
    ['pizza', 'Pizza margherita', 250, 11, 31, 9, 2, 300, '1 pizza'],
    ['glace', 'Glace vanille', 200, 3.5, 24, 10, 0, 60, '2 boules'],
    ['miel', 'Miel', 320, 0.3, 80, 0, 0, 20, '1 c. à soupe'],
    ['confiture', 'Confiture', 250, 0.4, 60, 0.1, 1, 20, '1 c. à soupe'],
    ['sucre', 'Sucre', 400, 0, 100, 0, 0, 5, '1 morceau'],
    ['compote', 'Compote de pommes', 70, 0.4, 16, 0.2, 1.5, 100, '1 pot'],
    ['houmous', 'Houmous', 230, 6, 14, 17, 5, 30, '2 c. à soupe'],
  ]),
]

/** Minuscules sans accents : « Œuf » et « oeuf » se retrouvent. */
export const normaliserTexte = (s: string): string =>
  s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Aliments de la base dont le nom contient tous les mots recherchés, les noms qui commencent par le texte d'abord. */
export function chercherDansBase(texte: string, limite = 30): AlimentBase[] {
  const mots = normaliserTexte(texte).split(' ').filter(Boolean)
  if (mots.length === 0) return []
  const trouves = BASE_ALIMENTS.filter((a) => {
    const nom = normaliserTexte(a.nom)
    return mots.every((m) => nom.includes(m))
  })
  const debut = normaliserTexte(texte)
  return [...trouves].sort((a, b) => Number(normaliserTexte(b.nom).startsWith(debut)) - Number(normaliserTexte(a.nom).startsWith(debut))).slice(0, limite)
}
