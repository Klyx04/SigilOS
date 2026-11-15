# 🔔 Notifications — un espace unique pour le compte connecté

> **Sujet** : le centre de notifications du **compte** (visiteur connecté ou membre), pas les alertes d'exploitation.
> Décision user (14/11/2026, verbatim) : « il faut un espace notif réel finalement, qui envoie aussi les
> changelog, les news et tout ce qui peut être nécessaire en notif user profil visiteur connecté,
> (notif rush etc? idk) ».
> Écrit le 14/11/2026. **Cadrage** ; N1 → N4 livrés le 15/11/2026 (voir §3).

## 0. Ce qui existe (mesuré dans le code)

| Élément | Réalité |
|---|---|
| Modèle `Notification` | `guildId String?` (nullable en base), `type`, `category`, `read`, `link`, `imageUrl` |
| Garde applicative | `createNotification` **refuse** une notification sans guilde (verrou `notification-guild-isolation`) ; la cloche filtre `where.guildId` |
| Types | `NotificationType` : 26 valeurs, **aucune** pour changelog / news / rush |
| Surfaces | cloche du dashboard (par guilde), `/espace-visiteur/general` (« Mes signalements »), **page compte `/espace-visiteur/notifications`** (N3) |
| Changelog | page par guilde `/dashboard/<guildId>/changelog` + moteur God ; publication existante |
| Rush live | toasts + PiP (temps réel), **aucune trace persistée** |

**Conséquence mesurée (avant N4)** : un visiteur sans guilde ne recevait **rien** quand le God
répondait à son signalement ; il devait rouvrir « Mes signalements ». **Corrigé** : la réponse crée
une notification de compte quand aucune guilde n'est identifiable (N4).

## 1. Périmètre v1

Un **espace de notifications du compte**, disponible sur le profil visiteur connecté :

- page `/espace-visiteur/notifications` + pastille dans l'en-tête du profil ;
- events v1 : ① réponse à mon signalement, ② changelog publié, ③ news publiée ;
- marquage lu/non-lu, lien vers la cible, pagination serveur bornée.

Hors v1 : Rush live (les toasts existent déjà), e-mail, push navigateur, préférences par canal.

## 2. Décisions (15/11/2026)

1. **News** : aucune source éditoriale distincte en base ⇒ v1 = **changelog global uniquement**
   (`ChangelogEntry`, `isInternal = false`). Pas de `NEWS_PUBLISHED` tant qu'une vraie source n'existe pas.
2. **Audience** : **tout le monde** — membres de guilde et visiteurs avec espace — avec **une seule
   notification par personne** (scope compte). Le coût d'un `createMany` par publication est à mesurer
   avant N2.
3. **Opt-out** : aucun en v1. Un interrupteur dans `/espace-visiteur/reglages` est possible, mais il
   demande une migration (préférence plateforme) ⇒ lot **N2-bis** séparé, pas dans N1.
4. **Rétention** : la purge quotidienne existante s'applique déjà (lues > 30 j, non lues > 90 j).
   Aucun nouveau code en v1. Passer tout à 30 j reste possible, mais efface une notification jamais vue.
5. **Lien du changelog** : il n'existe pas de page publique de changelog (`/dashboard/<guildId>/changelog`
   et `/god/changelog` seulement). Une notification de compte ne peut donc pas pointer vers une page de
   guilde pour un visiteur sans guilde ⇒ surface de destination à trancher avant N3.

## 3. Lots

- **N1 — livré le 15/11/2026** : scope « plateforme » explicite (`userId` + `guildId: null`) dans
  `src/server/account-notifications.ts` (écriture bornée, lecture ≤ 50, total/non-lues) et
  `src/server/actions/account-notification-actions.ts` (marquage lu/tout lu, session + rate limit).
  Le verrou `notification-guild-isolation` reste intact ; `guild-actions-rbac` a imposé de sortir le
  littéral `guildId` de l'action (fonction de scope partagée). Test `account-notifications-scope` (14).
- **N2 — livré le 15/11/2026** : type `CHANGELOG_PUBLISHED` (migration additive
  `20270205000000_add_changelog_notification_type`) ; fan-out `src/server/changelog-notifications.ts`
  (une notification par `User`, lots de 500, `after()` après la réponse God, entrées internes exclues,
  lien vers la page compte). `NEWS_PUBLISHED` attend une vraie source éditoriale.
- **N2-bis — livré le 15/11/2026** : `User.accountNotificationsEnabled` (migration additive
  `20270206000000_add_account_notifications_opt_out`, défaut `true`), interrupteur dans Réglages,
  action `setAccountNotificationsEnabled` (session + rate limit), fan-out changelog filtré et
  `createAccountNotification` qui refuse d'écrire si le compte a coupé.
- **N3 — livré le 15/11/2026** : page `/espace-visiteur/notifications` (page + loading + error), liste
  bornée, marquage lu / tout lu, 8ᵉ onglet + pastille de non-lues dans la nav visiteur. Garde
  `requirePublicSession` : aucun `UserProfile` requis.
- **N3-bis — livré le 15/11/2026** : « Mes signalements » déplacé de Général vers l'onglet Notifications ;
  une réponse God crée **toujours** une notification de compte (même pour un membre avec guilde), la
  cloche de guilde n'est plus utilisée pour ce message.
- **N4 — livré le 15/11/2026** : `notifyMemberFeedbackAction` crée une notification de **compte** quand
  aucune guilde n'est identifiable ; un membre avec guilde garde la cloche de guilde (pas de doublon).
  Lien vers `/espace-visiteur/general` (« Mes signalements »).

## 4. Invariants

- Aucun `guildId` fourni par le client ; le scope est résolu côté serveur.
- Le verrou `notification-guild-isolation` reste vert : le scope plateforme est une **branche
  explicite testée**, pas un contournement.
- Lecture bornée (`take` ≤ 50) et marquage limité au propriétaire (`userId`).
- Opt-out : `User.accountNotificationsEnabled` est lu à l'écriture et dans le fan-out ; une préférence
  illisible annule l'envoi, elle ne l'autorise pas.
- Pas de snowflake Discord dans les logs.
