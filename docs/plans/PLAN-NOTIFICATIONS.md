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

## 2. Décisions à trancher

1. **News** : quelle source ? (changelog uniquement, ou un flux éditorial distinct)
2. **Opt-out** : par type, global, ou aucun en v1 ?
3. **Rétention** : purge des notifications lues (90 j ?) ou conservation.

## 3. Lots

- **N1** — scope « plateforme » explicite : `Notification.guildId = null` autorisé par un chemin
  dédié, **sans affaiblir** le verrou d'isolation (nouveau test couvrant les deux scopes).
- **N2** — types `CHANGELOG_PUBLISHED` / `NEWS_PUBLISHED` (migration additive d'enum) + émission
  à la publication.
- **N3** — page `/espace-visiteur/notifications` + pastille + lecture/marquage bornés au `userId`.
- **N4** — émission « réponse à mon signalement » (aujourd'hui `notifyMemberFeedbackAction` ne
  notifie que si une guilde est identifiable).

## 4. Invariants

- Aucun `guildId` fourni par le client ; le scope est résolu côté serveur.
- Le verrou `notification-guild-isolation` reste vert : le scope plateforme est une **branche
  explicite testée**, pas un contournement.
- Lecture bornée (`take` ≤ 50) et marquage limité au propriétaire (`userId`).
- Pas de snowflake Discord dans les logs.
