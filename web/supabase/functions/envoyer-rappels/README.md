# Fonction `envoyer-rappels` : rappels de séance par notification push

Envoie les rappels de séance (la veille et le jour même, aux heures réglées dans Outils → Rappels) **même quand PandaMove est fermé**. Sans elle, un rappel ne part que si l'application est ouverte.

Rien de ceci n'est déployé automatiquement : chaque étape est manuelle, dans cet ordre. Tant que la variable de build `VITE_VAPID_PUBLIC_KEY` n'existe pas, l'option « Aussi quand l'application est fermée » n'apparaît pas dans l'application : on peut donc tout installer côté serveur avant de l'activer.

## Fonctionnement

1. Dans Outils → Rappels, l'option « Aussi quand l'application est fermée » abonne l'appareil au service de notifications de son navigateur, puis enregistre l'abonnement dans la table `push_abonnements` (avec le fuseau horaire de l'appareil).
2. Une tâche planifiée appelle cette fonction toutes les 5 minutes. Pour chaque abonnement, elle lit les réglages du compte (`user_settings.rappels_json`) et ses séances non terminées (renforcement planifié ou en cours, cardio non validé), calcule l'heure locale de l'appareil et envoie les rappels dus.
3. Un rappel part au plus une fois par appareil (mémoire dans `rappels_push_envoyes`) et seulement dans les 3 heures qui suivent son heure.
4. Un abonnement que le service de notifications déclare expiré (désinstallation, données du navigateur effacées) est supprimé automatiquement.

Quand le push est actif sur un appareil, le planificateur local de l'application s'y met en retrait (pas de doublon).

## Installation

Prérequis : la CLI Supabase (`supabase`), connectée au projet (`supabase login`, `supabase link --project-ref <ref>`).

### 1. Migration

Exécuter `web/supabase/migrations/0013_rappels_push.sql` dans l'éditeur SQL du tableau de bord. Elle crée `push_abonnements` et `rappels_push_envoyes`. Ces tables ne sont pas synchronisées : rien à changer dans PowerSync.

### 2. Clés VAPID

Une paire de clés identifie votre serveur auprès des services de notifications. À générer une fois :

```bash
npx web-push generate-vapid-keys
```

La clé **publique** va dans l'application (étape 5), la clé **privée** reste secrète, côté Supabase seulement. Ne jamais les écrire dans un fichier versionné.

### 3. Secrets de la fonction

```bash
supabase secrets set VAPID_PUBLIC_KEY="<clé publique>" VAPID_PRIVATE_KEY="<clé privée>" VAPID_SUBJECT="mailto:<votre adresse>" CRON_SECRET="<une longue chaîne aléatoire>"
```

- `VAPID_SUBJECT` : un contact, `mailto:` ou `https:`. Les services de notifications l'utilisent pour vous joindre en cas d'abus ; il n'est jamais affiché dans l'application.
- `CRON_SECRET` : secret partagé avec la tâche planifiée (étape 4), par exemple le résultat de `openssl rand -hex 32`.
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par la plateforme.

### 4. Déploiement et tâche planifiée

```bash
supabase functions deploy envoyer-rappels --no-verify-jwt
```

(`--no-verify-jwt` : l'appel vient d'une tâche planifiée, pas d'un utilisateur ; la fonction vérifie elle-même `CRON_SECRET`.)

Puis, dans l'éditeur SQL du tableau de bord (extensions `pg_cron` et `pg_net` activées : Database → Extensions), en remplaçant `<ref>` et `<CRON_SECRET>` :

```sql
select cron.schedule(
  'rappels-push',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/envoyer-rappels',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
       body := '{}'::jsonb
     ) $$
);
```

Ce SQL contient le secret : ne pas le coller dans un fichier du dépôt. Pour arrêter l'envoi : `select cron.unschedule('rappels-push');`.

### 5. Application

Ajouter la clé **publique** comme variable de build Cloudflare (Settings → Build → Variables and secrets) : `VITE_VAPID_PUBLIC_KEY`, puis relancer un déploiement. L'option apparaît alors dans Outils → Rappels ; elle demande l'autorisation de notifier la première fois.

## Vérification

1. Dans Outils → Rappels, activer les rappels puis « Aussi quand l'application est fermée » : la table `push_abonnements` reçoit une ligne.
2. Planifier une séance pour demain, régler l'heure du rappel de la veille quelques minutes plus tard, fermer l'application. Dans les 5 minutes qui suivent l'heure, la notification arrive.
3. Journal de la fonction : tableau de bord → Edge Functions → `envoyer-rappels` → Logs. La réponse est un bilan JSON `{ abonnements, envoyes, expires, erreurs }`.

Test à la main, sans attendre la tâche planifiée :

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/envoyer-rappels" -H "x-cron-secret: <CRON_SECRET>"
```

## Limites

- **iPhone / iPad** : les notifications push web exigent iOS 16.4 ou plus et l'application **installée sur l'écran d'accueil** (« Ajouter à l'écran d'accueil »). Dans Safari seul, l'option n'apparaît pas.
- Le délai d'arrivée dépend du service de notifications du navigateur (en général quelques secondes) et de la fréquence de la tâche (5 minutes).
- Les heures sont celles de l'appareil au moment de l'abonnement ; le fuseau est remis à jour à chaque ouverture de l'écran Rappels.
- Un appareil qui change de compte sans se désabonner garde son abonnement sous l'ancien compte : se désabonner avant de se déconnecter.
- La logique est dans `rappels.ts` (testée sous Vitest, avec un test de parité contre les rappels du client). `index.ts` ne fait que brancher Supabase et `web-push`, il n'a pas de test automatique : le premier envoi réel est la vérification.
