# 🔔 Notifications — un espace unique pour le compte connecté

> **Sujet** : le centre de notifications du **compte** (visiteur connecté ou membre), pas les alertes d'exploitation.
> Décision user (14/11/2026, verbatim) : « il faut un espace notif réel finalement, qui envoie aussi les
> changelog, les news et tout ce qui peut être nécessaire en notif user profil visiteur connecté,
> (notif rush etc? idk) ».
> Écrit le 14/11/2026. **Aucun code livré** : ce fichier est le cadrage.

## 0. Ce qui existe (mesuré dans le code)

| Élément | Réalité |
|---|---|
| Modèle `Notification` | `guildId String?` (nullable en base), `type`, `category`, `read`, `link`, `imageUrl` |
| Garde applicative | `createNotification` **refuse** une notification sans guilde (verrou `notification-guild-isolation`) ; la cloche filtre `where.guildId` |
| Types | `NotificationType` : 26 valeurs, **aucune** pour changelog / news / rush |
| Surfaces | cloche du dashboard (par guilde), `/espace-visiteur/general` (« Mes signalements »), **aucune page de notifications** |
| Changelog | page par guilde `/dashboard/<guildId>/changelog` + moteur God ; publication existante |
| Rush live | toasts + PiP (temps réel), **aucune trace persistée** |

**Conséquence mesurée** : un visiteur sans guilde ne reçoit **rien** quand le God répond à son
signalement ; il doit rouvrir « Mes signalements » pour découvrir la réponse.

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
- **N2** — type `CHANGELOG_PUBLISHED` (migration additive d'enum) + émission à la publication ;
  `NEWS_PUBLISHED` attend une vraie source éditoriale.
- **N2-bis (option)** — opt-out du compte : interrupteur dans `/espace-visiteur/reglages` + migration
  d'une préférence plateforme, seulement si le besoin est confirmé.
- **N3** — page `/espace-visiteur/notifications` + pastille + lecture/marquage bornés au `userId`.
- **N4** — émission « réponse à mon signalement » (aujourd'hui `notifyMemberFeedbackAction` ne
  notifie que si une guilde est identifiable).

## 4. Invariants

- Aucun `guildId` fourni par le client ; le scope est résolu côté serveur.
- Le verrou `notification-guild-isolation` reste vert : le scope plateforme est une **branche
  explicite testée**, pas un contournement.
- Lecture bornée (`take` ≤ 50) et marquage limité au propriétaire (`userId`).
- Pas de snowflake Discord dans les logs.
