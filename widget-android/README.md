# Widget Android de nutrition PandaMove

Application Android **compagnon** de la WebApp PandaMove : un widget d'écran d'accueil qui affiche l'énergie restante, les macros et l'eau du jour, avec un bouton « + 250 ml ».
Projet Gradle **indépendant** (il ne touche ni `app/` ni les modules Kotlin de la racine, abandonnés). Spec : `docs/superpowers/specs/2026-11-15-widget-android-nutrition.md`.

## Ce que fait le widget
- **Trois tailles** (Glance, `SizeMode.Responsive`) : 2×2 (anneau d'énergie), 4×1 (énergie, barre, boutons Photo et + 250 ml), 4×2 (anneau, protéines, glucides, lipides, eau, boutons Photo, + 250 ml, Aliment). Clair et sombre ; couleurs dynamiques dès Android 12, vert PandaMove sinon.
- **États** : à jour ; objectif dépassé (ambre, « kcal en trop ») ; données de plus de 2 h ou d'un autre jour (anneau vide, âge affiché) ; non relié ; jeton révoqué (le cache est effacé, toucher ouvre la liaison) ; sans objectif (total consommé, barres sans plafond) ; chargement.
- **Boutons** : Photo → `/nutrition/photo`, Aliment → `/nutrition/ajouter`, toucher le reste → `/nutrition` (liens ouverts dans PandaMove installé, sinon Chrome). **+ 250 ml écrit directement** via la fonction `widget-nutrition` (clé d'appel conservée tant que le serveur n'a pas confirmé : un nouvel appui après une coupure réseau ne compte l'eau qu'une fois).
- **Actualisation** : WorkManager toutes les 30 min avec réseau, à l'ajout du widget, à chaque mise à jour système, et 2 minutes après un appui sur « + 250 ml ». Hors ligne, le dernier résumé reste affiché.
- **Vie privée** : le jeton (`pmw_…`) vit dans des SharedPreferences chiffrées (Android Keystore) ; seuls des totaux sont lus ou gardés, jamais un nom d'aliment ; adresse du serveur en https obligatoire.

## Relier le widget
1. PandaMove (PWA) > **Profil > Widget Android > Relier un widget** : copier l'adresse du serveur et le jeton (affiché une seule fois). Cocher « Ajouter de l'eau depuis le widget » pour le bouton + 250 ml.
2. Installer l'APK, **ajouter le widget** « Nutrition PandaMove » sur l'écran d'accueil : l'écran de configuration s'ouvre. Coller l'adresse du serveur, le jeton et l'adresse de PandaMove (https://…, pour les boutons), puis **Relier** (le jeton est vérifié par une vraie lecture).
3. Pour changer de jeton ou délier : ouvrir l'application « Widget PandaMove » depuis son icône.

## Commandes
Installation sur un téléphone, pas à pas : voir `INSTALLATION.md`.

Prérequis : JDK 17+ (celui d'Android Studio convient : `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`) et le SDK Android 35 (`ANDROID_HOME`).
```bash
./gradlew :app:testDebugUnitTest   # tests JUnit : états, formats français, client (200/401/429/réseau/contrat), clé d'appel
./gradlew :app:assembleDebug       # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:assembleRelease     # APK signé si keystore.properties existe, sinon « unsigned »
```

## APK signé (installation à la main)
Créer une clé personnelle **hors dépôt** (comme `app/keystore/` à la racine : jamais commitée) :
```bash
keytool -genkeypair -v -keystore pandamove-widget.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pandamove-widget
```
Puis `widget-android/keystore.properties` (ignoré par git) :
```properties
storeFile=pandamove-widget.jks
storePassword=...
keyAlias=pandamove-widget
keyPassword=...
```
`./gradlew :app:assembleRelease` produit `app/build/outputs/apk/release/app-release.apk`, à copier sur le téléphone (autoriser l'installation depuis cette source). Garder la même clé pour les mises à jour.

## Limites connues
- Android limite les mises à jour des widgets : l'affichage peut avoir jusqu'à 30 min de retard (d'où l'âge affiché après 2 h).
- Les liens des boutons ouvrent la PWA installée (WebAPK) si elle déclare cette portée ; sinon Chrome. À valider sur le téléphone cible.
- Pas de code QR pour la liaison (le Profil de la PWA n'en affiche pas) : copier-coller.
- Pas de 4×3 avec la liste des quatre repas (le contrat v1 contient déjà `repas`).
