# 🎫 Tickets God — un seul endroit, une UI refondue

> **Sujet distinct** de `PLAN-REFONTE-TICKETS-V2.md` : ce dernier décrit le module **de
> guilde** (motifs, tunnel, CSAT). Ici il s'agit du **module d'exploitation** — ce que le
> mainteneur voit et traite lui-même.
> Écrit le 08/11/2026 ; **G1-G3 livrés le 14/11/2026** (fusion des signalements dans
> `SupportTicket`, onglet « Signalements », refonte UI et **retours visiteurs connectés**).
> Reste **G4** (`ticket-bot`).

## 0. Demande (verbatim, 08/11/2026)

> « il faut permettre côté god de voir aussi les retours des visiteurs connectés » ·
> « et tout doit tomber dans `…/mng-FL5nO4Yl6s4w?tab=tickets` > attention UI UX déprécié
> à refondre entièrement » · « il y a également un module ticket obsolète lié je crois
> qui reçoit les tickets du discord sigilos : à revoir » · « j'aimerai gérer mon module
> ticket god un peu à l'image de ce qu'on propose côté module ticket de guilde mais
> adapté à moi le dev ».

## 1. Mesures (dans le code, 08/11/2026)

| Élément | Réalité mesurée |
|---|---|
| `mng-FL5nO4Yl6s4w` | **Ce n'est pas une route en dur** : c'est `GOD_ROUTE` (`src/lib/god-route.ts`), réécrite vers `/god/*` par `src/proxy.ts` l.150. Le secret vit dans `.env`, jamais dans le dépôt. |
| `?tab=tickets` | **Existe déjà** : `src/app/god/page.tsx` l.75 (`TAB_TO_BRICK`), et sert de cible de redirection aux sous-gods (l.85, l.99). |
| Retours (bugs / features) | `/god/bugs` — tracker `SupportTicket` (`origin` FEEDBACK/INTERNAL), composant partagé `feedback-tracker.tsx`. |
| Tickets Discord | `/god/ticket-bot` — `page.tsx` de **1,3 Ko** : module réduit, dit « obsolète ». |
| Destination d'un retour | `submitQuestFeedbackAction` → `SupportTicket` (`origin: FEEDBACK`) + `notifyGod(USER_FEEDBACK)` + embed Discord (`PlatformConfig.questFeedbackChannelId`, repli `godNotifyChannelId`). |
| Overlay du guide public | `isGuest={true}` **en dur** (`PublicRushGuideClient`) : un membre connecté y lit le même overlay, il envoie donc sous le même chemin. |

**Conséquence mesurée** : un retour de **visiteur connecté** arrive bien en base, mais
`guildId` vaut `null` et **rien ne le distingue** d'un retour de membre dans `/god/bugs`.
C'est le point ① de la demande.

## 2. Périmètre proposé (4 lots)

### G1 — Les retours des visiteurs sont identifiables
**Livré le 14/11/2026** : `SupportTicket` (`origin: FEEDBACK`, `guildId` = guilde
d'accueil du compte ou `null`), `submitVisitorFeedbackAction` (aucune appartenance
exigée), bouton global du header public (profil visiteur, élevage, guides…),
historique « Mes signalements » dans l'espace visiteur et panneau Rush en mode
visiteur. Un visiteur sans guilde reste anonyme dans le tracker membre ; le God
voit la référence et peut répondre (la réponse est journalisée dans `transcript`).

### G2 — Un seul endroit : `?tab=tickets`
- L'onglet agrège **trois** sources : `SupportTicket` (`origin` FEEDBACK/INTERNAL), tickets
  Discord (`ticket-bot`), retours visiteurs.
- `/god/bugs` et `/god/ticket-bot` deviennent des **vues** de cet onglet, ou redirigent.
- **Une seule règle de lecture**, plusieurs vues — aucune liste dupliquée.

### G3 — Refonte UI/UX de l'onglet
- La DA est celle du reste du God (tokens), **pas** une refonte du dashboard entier.
- Liste dense + détail latéral, filtres (source, type, état, guilde), recherche.
- Règles UI du dépôt : rayons ≤ 12 px, aucune couleur en dur, états vides honnêtes.

### G4 — Le module ticket God, paramétrable bout en bout
**Décision user (14/11/2026)** : « module ticket côté god parametrable bout en bout, pas codé en dur ».
Les admins de guilde **ne répondent pas** aux signalements : un admin de guilde est un membre comme un autre, seul le God répond.

**Mesures (14/11/2026, code + base locale)** :
- `/god/ticket-bot` = 2 fichiers, **supervision de flotte** seulement (`toggleGodTicketBotModuleAction`, `setTicketPlatformLimitsAction`) : il ne configure rien du flux support.
- Le flux support (`createSupportTicket`) reçoit `channelId`/`discordGuildId` de l'interaction Discord ; les catégories, libellés et couleurs sont des **constantes de code** (`TICKET_CATEGORY_LABELS`, `TICKET_STATUS_COLORS`).
- `PlatformConfig` porte déjà `ticketSupportGuildId` et `ticketAutoRoleId` — aucun ID à coder.
- Le moteur complet existe côté guilde (`TicketGuildConfig`, catégories, panneaux, parcours, formulaires, équipes, transcripts, CSAT) mais exige un `GuildConfig` interne.
- Base locale : **7** `GuildConfig`, **3** `TicketGuildConfig`, **10** `SupportTicket`, **0** `TicketRecord` ; le serveur SigilOS n'est **pas** un `GuildConfig` et `ticketSupportGuildId` y est NULL.

**Architecture à trancher (bloquante avant toute migration)** :
1. **Réutiliser le moteur** : donner au serveur SigilOS un `GuildConfig` + `TicketGuildConfig`, puis une UI God des mêmes réglages. Avantage : zéro duplication. À mesurer : effets de bord d'une guilde plateforme (listes, quotas, synchro, RBAC).
2. **Configuration dédiée au support** : garder `SupportTicket` et ajouter une configuration God propre (catégories, salon, rôles, fermeture, CSAT). Avantage : pas de pollution multi-tenant. Coût : duplication partielle.

**Lots** :
- **G4-0** — mesurer la route 1 (effets d'un `GuildConfig` plateforme) ; aucun code.
- **G4-1** — configuration persistée (catégories, salon, rôles, fermeture, CSAT) ; migration additive si route 2.
- **G4-2** — console God (réglages + aperçu) branchée sur la configuration.
- **G4-3** — runtime Discord (panneau, création, fermeture) lisant la configuration : plus aucune constante de catégorie/libellé.
- **G4-4** — nettoyage de ce qui n'a plus d'écrivain.

## 3. Décisions à trancher (bloquantes pour G1 et G4)

1. **Origine** : tranché le 13/11/2026 — colonne `SupportTicket.origin`
   (`TicketOrigin`: SUPPORT/FEEDBACK/INTERNAL), migration additive livrée le 14/11.
2. **`ticket-bot`** : tranché le 14/11/2026 — **module God paramétrable bout en bout**, aucun ID en dur.
   Reste à mesurer l'architecture : moteur de guilde partagé (route 1) ou configuration
   dédiée (route 2) — **G4-0**.
3. **Ancien tracker `/god/bugs`** : redirection vers `?tab=tickets&view=bugs`, ou
   conservation en vue secondaire ?

## 4. Hors périmètre

- Le module **de guilde** (`PLAN-REFONTE-TICKETS-V2.md`) : inchangé.
- La modale de retour de l'overlay (F11) : elle vit dans `PLAN-ESPACE-VISITEUR.md`.
