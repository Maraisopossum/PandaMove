# Fonction `admin-comptes` : actions d'administration technique

Inviter, suspendre, rétablir, envoyer un lien de réinitialisation du mot de passe, déconnecter (couper les sessions), supprimer un compte. Appelée par l'écran **Administration > Comptes**
avec le jeton de l'administrateur connecté. **Aucun accès au contenu d'un compte** : seules des métadonnées sont touchées ; la suppression vide les
tables du compte puis supprime l'utilisateur.

Rien de ceci n'est déployé automatiquement. Tant que la fonction n'est pas déployée, l'écran affiche « La fonction d'administration n'est pas déployée ».

## Sécurité

- La plateforme vérifie la signature du jeton (`verify_jwt`, activé par défaut : ne pas le désactiver pour cette fonction).
- La fonction exige en plus `app_metadata.role = 'admin'` (même rôle que les fonctions SQL de la migration 0016).
- La clé de service (`SUPABASE_SERVICE_ROLE_KEY`, fournie par la plateforme) reste côté serveur.
- Garde-fous : aucune suspension ni suppression de son propre compte ni d'un autre administrateur ; la suppression exige de retaper l'adresse e-mail.
- Chaque action est inscrite au journal d'audit (`journal_admin`, insertion seulement) ; pour une suppression, le journal est écrit **avant**.
- Les règles sont dans `comptes.ts` (testées sous Vitest, `src/core/admin/fonctionAdminComptes.test.ts`) ; `index.ts` ne fait que brancher Supabase.

## Installation

Prérequis : les migrations `0016_administration.sql` et `0017_sante_synchro.sql` appliquées (la 0017 pour « Déconnecter »), ton compte avec `{"role": "admin"}`, la CLI Supabase connectée au projet.

```bash
supabase functions deploy admin-comptes
```

Facultatif : l'adresse de l'application, pour les liens des e-mails d'invitation et de réinitialisation (sinon, l'adresse du projet Supabase est utilisée) :

```bash
supabase secrets set SITE_URL="https://<adresse de PandaMove>"
```

Dans le tableau de bord Supabase, **Authentication > URL Configuration** : ajouter cette adresse aux « Redirect URLs ».

## Inscription sur invitation seulement

Pour que seules les personnes invitées puissent créer un compte : **Authentication > Sign In / Providers > désactiver « Allow new users to sign up »**.
L'invitation passe alors uniquement par l'écran « Comptes ». Réglage du tableau de bord : rien ne le change automatiquement.

## Suspendre

La suspension interdit la connexion (`ban_duration` d'environ 100 ans) : le compte ne peut plus ouvrir de session ni rafraîchir son jeton. Une session déjà
ouverte cesse au plus tard à l'expiration de son jeton (une heure). « Rétablir » lève l'interdiction.

## Suppression

Définitive : les lignes de toutes les tables du compte (`TABLES_UTILISATEUR`, vérifiée contre le schéma local par un test) puis l'utilisateur. La personne doit avoir
exporté ses données avant (Profil > Exporter mes données) : l'administrateur ne peut pas les lui exporter, il ne les lit jamais.
