# Installer le widget Nutrition PandaMove sur un téléphone Android

Ce guide est fait pour quelqu'un qui n'a jamais installé une application hors du Play Store. Compter 5 minutes.
Il marche sur tout téléphone Android 8 ou plus récent.

**Vous avez besoin de :** le fichier `PandaMove-Widget.apk`, et PandaMove déjà utilisé sur le téléphone (ou sur un ordinateur) avec votre compte.

---

## Partie 1 : installer l'application

1. **Mettez le fichier `PandaMove-Widget.apk` sur le téléphone.**
   Envoyez-le-vous par WhatsApp, Telegram, e-mail ou Google Drive, puis téléchargez-le. Le fichier se retrouve dans « Téléchargements ».
2. **Ouvrez-le** (touchez-le dans « Téléchargements », ou directement dans WhatsApp).
3. Android affiche **« Pour votre sécurité, l'installation d'applications inconnues n'est pas autorisée »** (le texte varie selon la marque) :
   - touchez **Paramètres**, puis activez **« Autoriser depuis cette source »** (l'application dans laquelle vous avez ouvert le fichier : Fichiers, Chrome, WhatsApp…) ;
   - revenez en arrière (flèche ←).
4. Touchez **Installer**. Si Google Play Protect demande de l'analyser, choisissez **« Installer quand même »** (l'application n'est pas dans le Play Store, c'est normal).
5. Touchez **Ouvrir**, ou laissez-la fermée : la partie 3 suffit.

> Le message « application dangereuse » de Play Protect apparaît parce que l'application n'est pas publiée sur le Play Store, pas parce qu'elle est dangereuse. Elle ne demande qu'un accès à internet.

---

## Partie 2 : créer le jeton dans PandaMove

Le jeton est un mot de passe spécial qui ne sert qu'à lire vos totaux du jour (jamais un nom d'aliment) et, si vous le permettez, à ajouter de l'eau. Chaque téléphone a son propre jeton.

1. Ouvrez **PandaMove** (l'application installée ou le site), connectez-vous.
2. Menu ☰ → **Profil**, descendez jusqu'à **« Widget Android »**.
3. Touchez **Relier un widget**.
4. Donnez un nom (par exemple « Mon téléphone »).
5. Cochez **« Ajouter de l'eau depuis le widget »** si vous voulez le bouton **+ 250 ml**.
6. Touchez **Créer le jeton**.
7. Deux textes s'affichent : **l'adresse du serveur** et **le jeton**. **Le jeton ne sera plus jamais affiché**, ne fermez pas l'écran tout de suite.
   - Touchez **Copier l'adresse**, puis passez à la partie 3 et collez-la. Revenez ici.
   - Touchez **Copier le jeton**, retournez à la partie 3 et collez-le.

Astuce : sur un seul téléphone, le plus simple est d'envoyer l'adresse et le jeton à vous-même dans une note ou un message, puis de les copier depuis là.

---

## Partie 3 : ajouter le widget et le relier

1. **Appui long sur un espace vide** de l'écran d'accueil → **Widgets**.
2. Cherchez **« Nutrition PandaMove »** (ou « Widget PandaMove »), appui long dessus, glissez-le sur l'écran d'accueil.
3. Un écran **« Widget Nutrition PandaMove »** s'ouvre :
   - **Adresse du serveur** : touchez **Coller l'adresse** (ou collez à la main). Elle commence par `https://` et finit par `widget-nutrition`.
   - **Jeton** : touchez **Coller le jeton**. Il commence par `pmw_`.
   - **Panda du widget** : choisissez « Panda fille » ou « Panda garçon » (modifiable plus tard depuis l'icône de l'application).
   - **Adresse de PandaMove** : l'adresse du site PandaMove que vous ouvrez dans le navigateur (par exemple `https://…`). Elle sert aux boutons Photo, Aliment et au journal.
4. Touchez **Relier**. Le widget vérifie le jeton avec une vraie lecture :
   - tout va bien : l'écran se ferme et le widget affiche vos chiffres ;
   - un message en rouge s'affiche : voir « Si ça ne marche pas » ci-dessous.

C'est fini. Pour agrandir ou réduire le widget : appui long dessus, puis tirez sur les poignées (2×2 anneau, 4×1 barre, 4×2 détail).

---

## À quoi servent les boutons
- **Toucher le widget** : ouvre le journal du jour dans PandaMove.
- **Photo** : ouvre l'analyse d'une photo de repas.
- **Aliment** : ouvre l'ajout d'un aliment (taille 4×2).
- **↻** : actualise les chiffres tout de suite (au plus une fois toutes les 20 secondes).
- **+ 250 ml** : ajoute un verre d'eau tout de suite, sans ouvrir PandaMove. Si le téléphone n'a pas de réseau, un nouvel appui ne compte l'eau qu'une fois.

**Ce que vous ajoutez dans PandaMove n'apparaît pas tout de suite** : touchez le bouton **↻** du widget pour l'actualiser (il affiche l'heure de la dernière mise à jour). Sinon il se met à jour tout seul toutes les 15 à 30 minutes environ. Au-delà de 2 heures sans mise à jour (pas de réseau), il se grise et indique son âge.

---

## Si ça ne marche pas
| Ce que vous voyez | Que faire |
| --- | --- |
| « L'adresse du serveur doit commencer par https:// » | Recopiez l'adresse depuis PandaMove (Profil > Widget Android), elle commence par `https://`. |
| « Jeton inconnu » | Le jeton est mal copié. Créez-en un nouveau dans PandaMove (Profil > Relier un widget), il est refusé s'il manque un caractère. |
| « Ce jeton a été révoqué » | Le jeton a été supprimé dans le Profil. Créez-en un nouveau. |
| « Pas de réseau, ou serveur injoignable » | Vérifiez internet puis réessayez. |
| Toucher « + 250 ml » dit « pas le droit d'ajouter de l'eau » | Dans PandaMove > Profil > Widget Android, cochez « Peut ajouter de l'eau » pour ce widget. |
| Le widget affiche « Relier le widget » | Touchez-le pour rouvrir la configuration. |
| Les boutons ouvrent la configuration | L'adresse de PandaMove n'est pas renseignée : touchez le widget (ou l'icône de l'application) et complétez-la. |
| Le widget ne se met plus à jour | Réglages Android > Applications > Widget PandaMove > Batterie > **Sans restriction** (certaines marques coupent les applications en arrière-plan). |

## Changer de jeton, délier, désinstaller
- **Changer de jeton ou délier** : ouvrez l'application **« Widget PandaMove »** (son icône ronde verte) → collez un nouveau jeton, ou touchez **Délier**.
- **Couper l'accès à distance** : PandaMove > Profil > Widget Android > **Révoquer** (le widget cesse de fonctionner immédiatement).
- **Désinstaller** : appui long sur l'icône « Widget PandaMove » > Désinstaller.

## Mettre à jour plus tard
Installez simplement le nouveau fichier `.apk` par-dessus : le jeton et les réglages sont conservés. Cela ne marche que si le nouveau fichier est signé avec la **même clé** (voir `README.md`).

## Pour le donner à d'autres personnes
- Donnez-leur le **même fichier** `PandaMove-Widget.apk` et ce guide.
- **Chaque personne** doit avoir son compte PandaMove et créer **son propre jeton** (partie 2). Ne partagez jamais votre jeton.
- Le widget ne lit que les données du compte auquel le jeton appartient.
