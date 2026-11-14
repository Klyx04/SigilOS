# 🎫 Tickets God — un seul endroit, une UI refondue

> **Sujet distinct** de `PLAN-REFONTE-TICKETS-V2.md` : ce dernier décrit le module **de
> guilde** (motifs, tunnel, CSAT). Ici il s'agit du **module d'exploitation** — ce que le
> mainteneur voit et traite lui-même.
> Écrit le 08/11/2026 ; **G1-G3 livrés le 14/11/2026** (fusion des signalements dans
> `SupportTicket`, onglet « Signalements » et refonte UI). Reste **G4** (`ticket-bot`).

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
- Discriminer l'**origine** d'un retour : membre de guilde · visiteur connecté · anonyme.
- Filtre dédié + compteur dans le tracker.
- **Décision attendue** : colonne explicite (migration) **ou** dérivation
  (`guildId === null` + présence d'un `PublicProfile`) — zéro migration.

### G2 — Un seul endroit : `?tab=tickets`
- L'onglet agrège **trois** sources : `SupportTicket` (`origin` FEEDBACK/INTERNAL), tickets
  Discord (`ticket-bot`), retours visiteurs.
- `/god/bugs` et `/god/ticket-bot` deviennent des **vues** de cet onglet, ou redirigent.
- **Une seule règle de lecture**, plusieurs vues — aucune liste dupliquée.

### G3 — Refonte UI/UX de l'onglet
- La DA est celle du reste du God (tokens), **pas** une refonte du dashboard entier.
- Liste dense + détail latéral, filtres (source, type, état, guilde), recherche.
- Règles UI du dépôt : rayons ≤ 12 px, aucune couleur en dur, états vides honnêtes.

### G4 — Le module `ticket-bot` revu
- À l'image du module de guilde (motif → salon → équipe → fermeture → CSAT) mais
  **adapté à l'exploitation** : un seul serveur (celui de SigilOS), pas de multi-tenant.
- Supprimer ce qui n'a plus d'écrivain, garder la réception des tickets Discord.

## 3. Décisions à trancher (bloquantes pour G1 et G4)

1. **Origine** : tranché le 13/11/2026 — colonne `SupportTicket.origin`
   (`TicketOrigin`: SUPPORT/FEEDBACK/INTERNAL), migration additive livrée le 14/11.
2. **`ticket-bot`** : on le garde comme **récepteur Discord**, ou on le remplace par un
   motif du module de guilde appliqué au serveur SigilOS ?
3. **Ancien tracker `/god/bugs`** : redirection vers `?tab=tickets&view=bugs`, ou
   conservation en vue secondaire ?

## 4. Hors périmètre

- Le module **de guilde** (`PLAN-REFONTE-TICKETS-V2.md`) : inchangé.
- La modale de retour de l'overlay (F11) : elle vit dans `PLAN-ESPACE-VISITEUR.md`.
