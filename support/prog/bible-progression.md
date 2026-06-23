<!-- Page 1 -->

Bible de la progression — Musculation & Running
BIBLE DE LA PROGRESSION
Musculation & Running
Spécification fonctionnelle & algorithmique
Document de référence destiné à l'implémentation (Claude Code)
Surcharge progressive · Systèmes de progression · Montée en charge qualitative · Progression sur
intervalles
Version 1.0
Page 1


---

<!-- Page 2 -->

Bible de la progression — Musculation & Running
Sommaire
Sommaire ............................................................................................................................................... 2
0. Principes directeurs & vocabulaire .................................................................................................... 4
0.1 Les deux couches de données à séparer .................................................................................... 4
0.2 Vocabulaire................................................................................................................................... 4
0.3 Périmètre : la logique ne s'applique PAS partout ........................................................................ 4
1. Les systèmes de progression ............................................................................................................ 6
1.1 Vue d'ensemble ............................................................................................................................ 6
1.2 Progression linéaire ...................................................................................................................... 6
1.3 Double progression (recommandée par défaut) .......................................................................... 6
1.4 Progression par volume ............................................................................................................... 7
1.5 Progression par densité ............................................................................................................... 7
1.6 Autorégulation par RPE / RIR ...................................................................................................... 7
1.7 Progression temporelle (isométrie) .............................................................................................. 7
2. Logique de validation à la clôture ...................................................................................................... 8
2.1 Flux général .................................................................................................................................. 8
2.2 Définition du SUCCÈS (critère strict) ........................................................................................... 8
2.3 Arbre de décision (par exercice) .................................................................................................. 8
2.4 En cas d'échec : ne JAMAIS copier le réalisé ............................................................................. 9
2.5 Le compteur d'échecs consécutifs ............................................................................................... 9
2.6 La boîte de validation à la clôture ................................................................................................ 9
3. Application concrète : ta séance « Bas du corps » ......................................................................... 10
4. Générer une montée en charge qualitative ..................................................................................... 11
4.1 L'incrément dépend du type d'exercice ...................................................................................... 11
4.2 Incrément absolu vs relatif ......................................................................................................... 11
4.3 Le matériel disponible contraint l'incrément ............................................................................... 11
4.4 L'incrément dépend du niveau (ancienneté) .............................................................................. 11
4.5 Garde-fous qualité ...................................................................................................................... 12
5. Running : logique de progression .................................................................................................... 13
5.1 Les variables d'une séance d'intervalles .................................................................................... 13
5.2 Les leviers de progression (un seul à la fois) ............................................................................ 13
5.3 Arbre de décision intervalles ...................................................................................................... 13
5.4 Détecter une séance « tenue » : la dérive d'allure .................................................................... 14
5.5 Exemple de cycle (volume puis intensité) .................................................................................. 14
5.6 Garde-fous running .................................................................................................................... 14
6. Modèle de données & spécification technique ................................................................................ 15
6.1 Champs à ajouter par exercice (dans la séance type) .............................................................. 15
Page 2


---

<!-- Page 3 -->

Bible de la progression — Musculation & Running
6.2 Champs d'état (objectif courant, hors séance type) .................................................................. 15
6.3 Pseudo-fonctions à implémenter ............................................................................................... 15
6.4 Règle de propagation (rappel critique) ....................................................................................... 15
6.5 Checklist d'implémentation......................................................................................................... 16
Page 3


---

<!-- Page 4 -->

Bible de la progression — Musculation & Running
0. Principes directeurs & vocabulaire
But du module : automatiser la décision de progression d'une séance à l'autre, tout en gardant la
validation humaine à la clôture. Le système propose, l'utilisateur valide.
0.1 Les deux couches de données à séparer
C'est la décision d'architecture la plus importante. Ne jamais mélanger ces deux notions :
• La séance type (structure) : définit les exercices, l'ordre, les blocs (échauffement, activation,
supersets, récupération), le nombre de séries, les temps de repos. Elle est stable et ne
change pas à chaque séance.
• Les objectifs courants par exercice (cible) : charge et reps visées. Ils évoluent
indépendamment, exercice par exercice, en fonction des résultats.
RÈGLE FONDAMENTALE
Une séance planifiée ne stocke PAS une copie figée des cibles. Elle LIT l'objectif courant de chaque
exercice au moment où elle devient active. Ainsi, valider une progression met à jour automatiquement
toutes les instances futures non réalisées, sans édition manuelle.
Exception : les séances déjà clôturées (rapports passés) ne sont JAMAIS retouchées. Un
rapport est un instantané figé de ce qui a réellement été fait ce jour-là.
0.2 Vocabulaire
Terme Définition
Cible Objectif visé pour un exercice : séries × reps @ charge (ex : 3×8 @ 60 kg)
Réalisé Ce qui a effectivement été loggé série par série pendant la séance
Validation Comparaison réalisé vs cible à la clôture → succès / échec par exercice
Plage de reps Intervalle [min ; max] de répétitions par exercice (ex : 8–12)
Incrément Pas d'augmentation de charge (ex : +2,5 kg). Dépend de l'exercice
Deload Réduction volontaire de charge/volume après échecs répétés
Progression activée Flag booléen par exercice : la logique ne s'applique que si TRUE
0.3 Périmètre : la logique ne s'applique PAS partout
La surcharge progressive est une OPTION activable par exercice, jamais globale. Les blocs
suivants ne doivent jamais déclencher de progression automatique :
• Échauffement (ex : Tibial raises, Clam shell, Bird dog) — charge au poids du corps, objectif
d'activation, pas de performance.
• Activation (ex : Wall sit iso, Calf raise iso) — travail isométrique de préparation.
• Récupération / mobilité / gainage de fin (ex : Dead Hang, Dead Bug) — sauf décision
explicite de l'utilisateur de les traiter en progression.
Page 4


---

<!-- Page 5 -->

Bible de la progression — Musculation & Running
Concrètement : chaque exercice porte un flag progression_activée (bool). Par défaut FALSE pour
tout ce qui est échauffement/activation/récup, TRUE uniquement pour les exercices de travail que
l'utilisateur choisit.
Page 5


---

<!-- Page 6 -->

Bible de la progression — Musculation & Running
1. Les systèmes de progression
La « surcharge progressive » n'est pas une méthode unique : c'est un principe (augmenter
graduellement la contrainte) qui se décline en plusieurs systèmes. Le module doit pouvoir en
supporter plusieurs, sélectionnables par exercice.
1.1 Vue d'ensemble
Système Variable augmentée Idéal pour Complexité
Charge fixe à chaque
Progression linéaire Débutant, exos composés Faible
succès
Intermédiaire, isolation &
Double progression Reps puis charge Moyenne
composés
Hypertrophie, plateau de
Progression par volume Séries / reps totales Moyenne
charge
Progression par densité Réduction du repos Conditionnement, finisher Moyenne
RPE / RIR autorégulé Charge selon effort perçu Avancé Élevée
Progression temporelle Durée (iso, gainage) Isométrie, planches Faible
1.2 Progression linéaire
On garde reps et séries fixes ; à chaque séance réussie, on augmente la charge d'un incrément.
• Déclencheur : toutes les séries atteignent les reps cibles.
• Action : charge += incrément (la prochaine séance).
• Limite : s'épuise vite (le corps ne peut pas progresser linéairement indéfiniment) → bascule
en deload ou changement de système au plateau.
Exemple : Squat 3×5 @ 60 kg réussi → 3×5 @ 62,5 kg → 3×5 @ 65 kg…
1.3 Double progression (recommandée par défaut)
On définit une plage de reps. On augmente d'abord les reps jusqu'au haut de la plage, PUIS on
augmente la charge en retombant au bas de la plage.
• Déclencheur charge : le HAUT de la plage est validé sur toutes les séries.
• Action : charge += incrément ET reps cible = bas de plage.
• Entre deux : reps cible += 1 à chaque succès intermédiaire.
Exemple (plage 8–12) : 3×8 @ 20 → 3×9 → 3×10 → 3×11 → 3×12 @ 20 (haut atteint) → 3×8 @
22,5 → …
POURQUOI C'EST LA MEILLEURE MÉTHODE PAR DÉFAUT
Quand on augmente la charge, on accepte de perdre des reps temporairement plutôt que de forcer le
même volume sur un poids plus lourd (risque d'échec ou de dégradation technique). La plage de reps
absorbe le saut de charge en douceur.
Page 6


---

<!-- Page 7 -->

Bible de la progression — Musculation & Running
1.4 Progression par volume
Quand la charge stagne, on progresse en ajoutant du volume : une série supplémentaire, ou plus de
reps totales, à charge constante.
• Déclencheur : cible de volume hebdo atteinte plusieurs séances.
• Action : ajouter une série (3×10 → 4×10) ou augmenter les reps cibles globales.
• Garde-fou : plafonner le volume (MRV — volume maximum récupérable) pour éviter le
surentraînement.
1.5 Progression par densité
Même travail (séries × reps × charge) dans moins de temps : on réduit le temps de repos.
• Action : repos -5 à -10 s à chaque palier réussi, jusqu'à un plancher (ex : 45 s).
• Usage : supersets, finishers, conditionnement métabolique.
1.6 Autorégulation par RPE / RIR
La charge n'est plus fixée à l'avance mais ajustée selon l'effort perçu. RPE = Rate of Perceived
Exertion (6–10). RIR = Reps In Reserve (reps restantes avant l'échec).
RPE RIR Signification
10 0 Échec, aucune rep en réserve
9 1 Une rep en réserve
8 2 Deux reps en réserve (zone hypertrophie courante)
7 3 Trois reps en réserve (travail technique / volume)
Logique : si le RPE loggé est inférieur à la cible (séance trop facile), proposer une charge
supérieure ; s'il est supérieur, maintenir ou réduire. Nécessite que l'utilisateur logue le RPE — d'où
la colonne RPE déjà présente dans ton rapport de séance.
1.7 Progression temporelle (isométrie)
Pour les exercices tenus (gainage, wall sit, dead hang) : la variable est la durée, pas la charge.
• Action : durée cible += 5 s par succès, jusqu'à un plafond, puis ajouter une série ou une
charge externe.
Note : ces exercices sont souvent en échauffement/activation/récup → progression désactivée par
défaut. À n'activer que si l'utilisateur en fait un vrai objectif.
Page 7


---

<!-- Page 8 -->

Bible de la progression — Musculation & Running
2. Logique de validation à la clôture
C'est le cœur du module. À la clôture d'une séance, pour CHAQUE exercice ayant
progression_activée = TRUE, on compare le réalisé à la cible et on décide.
2.1 Flux général
1. AVANT la séance : chaque exercice affiche sa cible courante (séries × reps @ charge), lue
depuis l'objectif courant de l'exercice.
2. PENDANT : l'utilisateur logue chaque série réellement effectuée (reps + charge + RPE
optionnel).
3. À LA CLÔTURE : le module évalue chaque exercice → SUCCÈS / ÉCHEC / PARTIEL.
4. Si SUCCÈS qualifiant → boîte de validation proposant la progression (Oui / Non / Ajuster).
5. La décision validée met à jour l'objectif courant → propagé aux instances futures non
réalisées.
2.2 Définition du SUCCÈS (critère strict)
CRITÈRE DE SUCCÈS
Toutes les séries de travail atteignent au moins les reps cibles, à la charge cible. Un seul échec
de série = pas de progression de charge cette fois-ci.
Cas dépassement : si toutes les séries dépassent déjà le haut de plage, on progresse quand
même (et on peut sauter directement au palier de charge).
2.3 Arbre de décision (par exercice)
POUR chaque exercice où progression_activée == TRUE :
reussies = nb de séries atteignant reps_cible @ charge_cible
total = nb de séries de travail prévues
SI reussies == total :
SI reps_cible >= reps_max (haut de plage) :
→ PROPOSER : charge += increment ; reps_cible = reps_min
SINON :
→ PROPOSER : reps_cible += 1 (même charge)
compteur_echec = 0
SINON SI reussies >= total - 1 ET ecart_reps faible :
→ MAINTENIR la cible (retenter à l'identique)
compteur_echec += 1
SINON (échec marqué) :
compteur_echec += 1
SI ecart_reps_relatif >= 30% DÈS LE 1er échec :
→ FLAGUER : charge probablement mal calibrée
(proposer réduction immédiate, ne pas attendre 3 séances)
Page 8


---

<!-- Page 9 -->

Bible de la progression — Musculation & Running
SINON :
→ MAINTENIR la cible
SI compteur_echec >= seuil_deload (def. 3) :
→ DELOAD : charge -= 10% (arrondi à l'incrément),
reps_cible = reps_min, compteur_echec = 0
2.4 En cas d'échec : ne JAMAIS copier le réalisé
ERREUR À NE PAS COMMETTRE
Ne pas remplacer la cible par les séries/charges réellement réalisées lors d'un échec. Une
mauvaise séance (fatigue, mauvaise nuit, stress) deviendrait la nouvelle référence permanente,
et on perdrait l'objectif réel à atteindre.
À la place : on garde la cible inchangée et on retente. Ce n'est qu'après plusieurs échecs
consécutifs qu'on applique une réduction calculée (deload : −10 %), jamais le chiffre brut de la
pire performance.
2.5 Le compteur d'échecs consécutifs
• 1er échec : cible inchangée, on retente.
• 2e échec consécutif : cible inchangée, on retente (dernière chance).
• 3e échec consécutif : deload automatique proposé (−10 % charge, retour bas de plage).
• Remise à zéro : tout succès qualifiant remet le compteur à 0.
• Cas écart énorme dès le 1er échec (≥ 30 %) : flaguer immédiatement sans attendre 3
séances — c'est une charge mal calée, pas de la fatigue.
2.6 La boîte de validation à la clôture
À la clôture, n'afficher la boîte que pour les exercices en SUCCÈS qualifiant. Pour les échecs :
message neutre (« même cible la prochaine fois »), pas de pop-up bloquante.
┌─────────────────────────────────────────────┐
│ Squat gobelet — réussi 3×11 @ 20 kg │
│ Cible atteinte (haut de plage). │
│ │
│ Proposer : 3×8 @ 22,5 kg la prochaine fois ? │
│ │
│ [ Oui ] [ Non, garder ] [ Ajuster… ] │
└─────────────────────────────────────────────┘
• Oui : applique la progression → objectif courant mis à jour.
• Non, garder : cible inchangée (l'utilisateur sait quelque chose que l'algo ignore : douleur,
fatigue…).
• Ajuster : saisie manuelle libre de la nouvelle cible (garde toujours la main).
Page 9


---

<!-- Page 10 -->

Bible de la progression — Musculation & Running
3. Application concrète : ta séance « Bas du corps »
Démonstration de l'arbre de décision sur le rapport réel du samedi 20 juin 2026. Seuls les exercices
de travail sont concernés ; échauffement et activation sont ignorés.
Exercice Cible Réalisé Décision
Squat gobelet 3×10 @ 20 3×11 @ 20 Succès → 22,5 kg (reps→8)
Échec → garder ; si répété, variante
Nordic curl 3×5 PDC 3×3 PDC
assistée
Hip thrust machine 3×12 3×10 Échec léger → retenter même charge
Échec marqué (−40%) → réduire à
Tibial raises (superset) 3×20 @ 10 3×12 @ 10
7,5 kg
Fente haltères 3×10 @ 9 3×12 @ 10 Succès → +charge
Gainage latéral 3×25 s 3×25 s Atteint pile → +5 s (30 s)
Mollets assis machine 3×15 @ 50 3×12 @ 50 Échec → retenter 50 kg
Dead Hang 3×35 s 40/40/28 s Mixte (3e série chute) → garder 35 s
Récup/core → reps avant charge :
Dead Bug 3×8 3×10
3×12
ANOMALIE DE DONNÉES À GÉRER
« Abduction de hanche debout » (et l'abduction contre mur) figurent dans la séance type mais
sont absentes du rapport réalisé. Le module doit détecter ce cas : exercice planifié non loggé →
ne rien décider, et signaler (oubli pendant la séance, ou bug d'enregistrement à investiguer).
Page 10


---

<!-- Page 11 -->

Bible de la progression — Musculation & Running
4. Générer une montée en charge qualitative
Augmenter la charge ne suffit pas : il faut le faire de façon adaptée à l'exercice, au matériel
disponible et au niveau de l'utilisateur. Voici comment calculer un incrément intelligent plutôt qu'un
+2,5 kg systématique.
4.1 L'incrément dépend du type d'exercice
Type d'exercice Exemples Incrément conseillé
Composé bas du corps Squat, soulevé de terre, hip thrust +5 kg (ou +2,5 % à 5 %)
Développé couché, rowing, tractions
Composé haut du corps +2,5 kg (ou +1 % à 2,5 %)
lestées
Isolation Curl, élévations, extensions +1 à +2,5 kg (ou +reps d'abord)
Selon le pas de la machine (souvent
Machine à plaques Mollets assis, hip thrust machine
5 kg)
+reps, puis lest, puis variante plus
Poids du corps (PDC) Nordic curl, pompes, tractions
dure
4.2 Incrément absolu vs relatif
Un +2,5 kg sur un curl à 10 kg = +25 % (énorme). Le même +2,5 kg sur un squat à 100 kg = +2,5 %
(raisonnable). D'où la règle :
FORMULE D'INCRÉMENT QUALITATIF
increment = max( pas_minimum_matériel , arrondi( charge_actuelle × pourcentage_cible )
)
où pourcentage_cible ≈ 2,5 % (composé) à 5 % (gros composé bas du corps), et
pas_minimum_matériel = plus petit disque/cran disponible. On ne descend jamais sous le pas
matériel, et on arrondit toujours à un palier réalisable.
4.3 Le matériel disponible contraint l'incrément
Le module doit connaître le matériel pour ne pas proposer une charge non réalisable (ex : +1,25 kg
impossible si les plus petits disques font 2,5 kg, ou machine par crans de 5 kg).
• Haltères : pas = écart entre deux haltères de la série (souvent 2 kg ou 2,5 kg).
• Barre + disques : pas = 2 × plus petit disque (ex : 2 × 1,25 = 2,5 kg).
• Micro-charges : si disponibles (0,5 / 1,25 kg), permettre une progression plus fine sur le haut
du corps.
• Machines : pas = écart entre deux crans (souvent 5 kg, parfois non linéaire).
Implémentation : une fonction arrondir_a_charge_realisable(charge_brute, materiel) qui prend
la charge théorique et renvoie la charge la plus proche réellement chargeable. C'est elle qui
transforme « 21,05 kg » en « 22,5 kg » selon ton matériel.
4.4 L'incrément dépend du niveau (ancienneté)
Page 11


---

<!-- Page 12 -->

Bible de la progression — Musculation & Running
Niveau Vitesse de progression Réglage
Incréments standards, progression linéaire
Débutant Rapide (presque chaque séance)
OK
Intermédiaire Modérée (hebdo) Double progression, plages de reps
Avancé Lente (mensuelle) RPE/RIR, micro-charges, périodisation
Conséquence module : un champ niveau (ou ancienneté) module le pourcentage_cible et la
fréquence d'augmentation. Un avancé sur un développé reçoit +1,25 kg ; un débutant sur un squat
reçoit +5 kg.
4.5 Garde-fous qualité
• Plafond de saut : ne jamais proposer une hausse > 10 % en une fois, même si l'utilisateur a
explosé sa cible (risque technique).
• Cohérence technique : si le RPE loggé est déjà très haut (9–10) malgré le succès, ne pas
augmenter — la marge n'existe pas.
• Distinction composé/isolation : toujours préférer la progression en reps sur l'isolation avant
de toucher la charge.
• Asymétrie G/D : pour les exercices unilatéraux (3×G+D), valider le côté faible — ne pas
progresser tant que le côté faible n'a pas atteint la cible.
Page 12


---

<!-- Page 13 -->

Bible de la progression — Musculation & Running
5. Running : logique de progression
Le running suit le même principe (proposer / valider / propager) mais les variables sont différentes :
allure, distance, durée, récupération, nombre de répétitions. La surcharge progressive devient «
progression de la charge d'entraînement ».
5.1 Les variables d'une séance d'intervalles
Une séance d'intervalles (fractionné) se décrit par :
Variable Description Exemple
Répétitions Nombre de fractions 8 × …
Distance / durée
Longueur de chaque fraction 400 m ou 1 min
d'effort
Allure cible Vitesse visée sur l'effort 4:00 /km
Récupération Repos entre fractions (durée/distance) 1:30 ou 200 m
Type de récup Active (footing) ou passive (marche/arrêt) trot
Séries Groupes de répétitions 2 × (4 × 400 m)
5.2 Les leviers de progression (un seul à la fois)
RÈGLE D'OR DU RUNNING
Ne faire progresser qu'UN seul levier à la fois, et de façon graduelle. Augmenter
simultanément le volume ET l'intensité est la première cause de blessure et de surentraînement.
Ordre de priorité recommandé d'une séance à l'autre :
6. Augmenter le VOLUME d'abord (plus de répétitions, ou fractions plus longues) à allure
constante.
7. Puis réduire la RÉCUPÉRATION (récup plus courte = densité accrue).
8. Puis augmenter l'INTENSITÉ (allure cible plus rapide), en réduisant éventuellement le volume.
5.3 Arbre de décision intervalles
ENTRÉE : séance réalisée (allures réelles par fraction, récup tenue, RPE)
valide = (toutes les fractions tenues dans la fourchette d'allure cible)
ET (récupérations respectées)
ET (RPE <= RPE_cible OU dérive d'allure faible)
SI valide :
SELON levier_actif :
'volume' → +1 répétition (ou +durée fraction)
jusqu'à volume_max de la séance type
'densite' → récup -10 à -15 s (jusqu'à plancher)
'intensite'→ allure_cible -2 à -5 s/km
(et éventuellement -1 rép pour compenser)
Page 13


---

<!-- Page 14 -->

Bible de la progression — Musculation & Running
compteur_echec = 0
SINON (fractions non tenues / dérive forte / RPE trop haut) :
compteur_echec += 1
→ MAINTENIR la séance à l'identique (retenter)
SI compteur_echec >= 2 :
→ RECUL : -1 rép ou allure_cible +2 à 3 s/km (semaine plus light)
5.4 Détecter une séance « tenue » : la dérive d'allure
Critère clé propre au running : la régularité entre la première et la dernière fraction. Si les dernières
fractions sont nettement plus lentes que les premières, la séance était trop dure même si l'allure
moyenne semble correcte.
• Dérive faible (< 2-3 %) : séance maîtrisée → progression possible.
• Dérive forte (> 5 %) : séance subie → maintenir, ne pas progresser.
• Effondrement final (ex : Dead Hang running = dernière fraction qui s'écroule) → c'est le
signal de ne pas augmenter, comme pour l'iso en muscu.
5.5 Exemple de cycle (volume puis intensité)
Séance Contenu Décision si tenue
S1 6 × 400 m @ 4:00, récup 1:30 Volume → 7 × 400 m
S2 7 × 400 m @ 4:00, récup 1:30 Volume → 8 × 400 m
S3 8 × 400 m @ 4:00, récup 1:30 Volume max atteint → densité
S4 8 × 400 m @ 4:00, récup 1:15 Densité → récup 1:00
S5 8 × 400 m @ 4:00, récup 1:00 Plancher récup → intensité
Intensité +volume réduit →
S6 6 × 400 m @ 3:55, récup 1:30
recommencer le cycle
5.6 Garde-fous running
• Règle des ~10 % : ne pas augmenter le volume hebdomadaire total de plus de ~10 % d'une
semaine à l'autre.
• Semaine de décharge : toutes les 3–4 semaines, réduire volume/intensité (récupération
programmée), indépendamment des succès.
• Allures plancher : borner l'allure cible par une estimation réaliste (ex : VMA / records) pour
ne pas proposer l'impossible.
• Météo / terrain : comme le RPE en muscu, prévoir un marqueur « conditions » pour ne pas
pénaliser une séance ratée à cause de la chaleur ou du dénivelé. Idéalement, ne pas faire
progresser sur une séance flaguée « conditions difficiles ».
• Intégration cycle pompier : la charge doit tenir compte du rythme 24 h / 72 h — ne pas
programmer de progression d'intensité au sortir d'une garde.
Page 14


---

<!-- Page 15 -->

Bible de la progression — Musculation & Running
6. Modèle de données & spécification technique
Section directement exploitable par Claude Code pour l'implémentation.
6.1 Champs à ajouter par exercice (dans la séance type)
Champ Type Rôle / valeur par défaut
FALSE par défaut ; TRUE seulement sur exos de travail
progression_activee bool
choisis
systeme_progression enum lineaire | double | volume | densite | rpe | temps
reps_min int Bas de la plage de reps (double progression)
reps_max int Haut de la plage de reps
increment_pct float % d'augmentation cible (ex : 0.025 à 0.05)
increment_min float Pas matériel minimum réalisable (kg)
type_exercice enum compose_bas | compose_haut | isolation | machine | pdc
unilateral bool TRUE si G/D séparés (valider le côté faible)
seuil_deload int Nb d'échecs consécutifs avant deload (def. 3)
6.2 Champs d'état (objectif courant, hors séance type)
Champ Type Rôle
charge_cible float Charge visée actuelle
reps_cible int Reps visées actuelles (entre reps_min et reps_max)
compteur_echec int Échecs consécutifs ; remis à 0 à tout succès
derniere_maj date Traçabilité de la dernière progression
6.3 Pseudo-fonctions à implémenter
evaluer_exercice(cible, realise) -> statut // SUCCES|ECHEC|PARTIEL
proposer_progression(exo, statut) -> proposition // applique l'arbre §2.3
arrondir_a_charge_realisable(charge, materiel) -> kg // §4.3
appliquer_validation(exo, choix_utilisateur) // Oui|Non|Ajuster
propager_aux_instances_futures(exo) // §0.1 : MAJ instances non réalisées
detecter_exo_non_logge(seance_type, rapport) // §3 anomalie
// running
calc_derive_allure(fractions) -> pct // §5.4
proposer_progression_intervalles(seance, levier) // §5.3
6.4 Règle de propagation (rappel critique)
PROPAGATION
Page 15


---

<!-- Page 16 -->

Bible de la progression — Musculation & Running
Au moment de planifier une séance future (copie de la séance type), NE PAS y figer les
charges/reps. La séance future référence l'exercice et lit son objectif courant à l'exécution.
Si l'implémentation actuelle copie les valeurs à la planification : ajouter
propager_aux_instances_futures() qui réécrit la cible sur toutes les instances non encore
réalisées après chaque validation.
Jamais toucher aux séances déjà clôturées (rapports = instantanés figés).
6.5 Checklist d'implémentation
1. Ajouter le flag progression_activee (défaut FALSE) sur tous les exercices.
2. Ajouter les champs de configuration (système, plage de reps, incréments, type).
3. Séparer clairement séance type (structure) et objectif courant (cibles).
4. Implémenter evaluer_exercice() avec le critère de succès strict (§2.2).
5. Implémenter l'arbre de décision (§2.3) avec compteur d'échecs et deload.
6. Implémenter arrondir_a_charge_realisable() selon le matériel.
7. Boîte de validation à la clôture, uniquement sur succès (Oui/Non/Ajuster).
8. En cas d'échec : maintenir la cible, NE JAMAIS copier le réalisé.
9. Propagation aux instances futures non réalisées ; rapports passés intouchables.
10. Détection des exercices planifiés non loggés (anomalie).
11. Variante running : leviers volume/densité/intensité, un seul à la fois, dérive d'allure.
12. Marqueurs contextuels (RPE, conditions, cycle de garde) pour ne pas pénaliser une séance
subie.
Fin du document — Bible de la progression v1.0
Page 16


---
