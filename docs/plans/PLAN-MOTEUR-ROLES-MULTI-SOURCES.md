---
description: Moteur de rôles multi-sources — ancienneté + vocal + contribution, garde-fous, un onglet, 1 migration additive (cadré le 18/10/2026, aucun code)
---

# 🎛️ Moteur de rôles multi-sources — plan durable

> **Statut** : **cadré le 18/10/2026** (issu du conducteur `src/temp/FIL-CONDUCTEUR-2026-10-18.md` §4),
> **aucun lot commencé**. 1 lot = 1 branche = 1 PR → `dev`. Aucune écriture avant la décision **D-R1**.

## 1. Besoin

Les rôles automatiques ne connaissent aujourd'hui qu'**un axe** : l'ancienneté (`GuildConfig.seniorityRoles*`,
`src/lib/seniority-roles.ts`, cron `seniority-roles`). Le staff veut **un seul moteur** qui distribue aussi des
rôles sur le **vocal** et la **contribution**, avec des garde-fous (ne pas toucher aux rôles non gérés,
ne pas retirer à tort, ne pas flapper).

## 2. État mesuré (18/10/2026 — dépôt + base)

| Fait | Où | Conséquence |
|---|---|---|
| L'ancienneté fonctionne | `src/lib/seniority-roles.ts` + `seniority-roles-core.ts` + cron `seniority-roles` | **à conserver** : elle devient une **projection** de règles `SENIORITY` (zéro régression) |
| Vocal + messages | `UserProfile.discordVoiceTimeWeekly/Monthly/Total`, `discordMessageCount*` | **profils dashboard uniquement** (le bot ne trouve personne d'autre) |
| Contribution | `UserProfile.contributionPoints` (cumulatif) | **profils uniquement** |
| Activité de **tous** | **`DiscordMemberActivity`** (lot 7, #1020) : `messagesTotal`, `voiceSecondsTotal`, `lastMessageAt`, `lastVoiceAt`, `leftDiscordAt`, purge 365 j | **total** seulement : **aucune fenêtre hebdomadaire/mensuelle** pour un non-inscrit |
| Bot | `services/discord-bot/index.ts` | remet à zéro les fenêtres **des profils** (hebdo/mensuel) ; ne fait pas de reset pour `DiscordMemberActivity` |

⇒ **Le point dur est mesuré** : une règle « vocal hebdo/mensuel » ne peut pas être universelle tant que
`DiscordMemberActivity` n'a pas ses propres fenêtres. C'est l'objet de **D-R1**.

## 3. Décisions

- **D-R0 — stockage** : une seule colonne `GuildConfig.roleAutomationRules` **JSONB** (1 migration additive).
  Les colonnes `seniorityRoles*` **restent** (rétro-compatibilité : le moteur les lit comme une projection).
- **D-R1 — fenêtres vocal (ouverte, bloque le lot R-1)** :
  - **Voie A (recommandée)** : sources = **ancienneté** + **vocal total** (`voiceSecondsTotal`, universel) +
    **contribution** (profils uniquement ; les non-inscrits pèsent 0, ce que la règle **dit**). **Aucun compteur
    nouveau, aucune migration supplémentaire.**
  - **Voie B** : ajouter `voiceSecondsWeekly` / `voiceSecondsMonthly` à `DiscordMemberActivity` (reset bot
    hebdo/mensuel, comme les profils) ⇒ fenêtres universelles mais **1 migration + 1 passe de reset**.
  - Dans les deux voies : **jamais** de règle sur une mesure absente (un non-inscrit n'est pas « 0 vocal »
    silencieusement : l'aperçu dit « non mesuré »).
- **D-R2 — périmètre** : `ignoreRoleIds` (exclusion = **gel**, option de retrait **off**) ·
  `requireRoleIds` (portail, ex. `@Membre`) · **1 rôle = 1 règle** (validation) · **hystérésis** anti-flapping ·
  **jamais** de retrait d'un rôle non managé.
- **D-R3 — UI** : **un onglet**, 5 blocs — Garde-fous · Ancienneté · Vocal · Contribution · État.

## 4. Architecture

1. **Faits du membre** (`src/server/role-facts.ts`) : liste Discord (tous) × `UserProfile` ×
   `DiscordMemberActivity` ⇒ `{ discordId, roles, registered, seniorityDays, voiceTotalMinutes,
   voiceWeeklyMinutes, voiceMonthlyMinutes, contributionPoints }`. Non-inscrit : fenêtres = `null` (pas 0).
2. **Évaluateur unique** (`src/lib/role-automation.ts`, **pur**) : `evaluateRoleAutomation(facts, rules)` ⇒
   `{ add: string[], remove: string[], frozen: string[], skipped: SkipReason[] }`. L'ancienneté est une
   projection `SENIORITY` des paliers existants (mêmes résultats que `computeSeniorityRoleDiff`).
3. **Stockage** : `roleAutomationRules` relecture **fail-safe** (JSON jamais cru), bornes (nombre de règles,
   longueurs, snowflakes), 1 rôle = 1 règle.
4. **Application** : le cron `seniority-roles` devient le runner du moteur (idempotent, `rateLimit`, journal
   `details` par guilde, annonces seulement sur un **ajout** réel).
5. **UI** : onglet « Rôles automatiques » (ex-« Rôles d'ancienneté »), éditeur par règle + aperçu « qui serait
   impacté » (dry-run, zéro écriture).

## 5. Lots

| Lot | Contenu | Migration | Preuve attendue |
|---|---|---|---|
| **R-1** | Faits + évaluateur pur + stockage JSONB (lecture/écriture) + projection ancienneté | **1 additive** (`roleAutomationRules`) | tests purs : garde-fous, hystérésis, 1 rôle = 1 règle, non-inscrit non mesuré, parité ancienneté |
| **R-2** | Runner cron (remplace/appelle le moteur) + annonces + journal | — | idempotence, aucune écriture si gel, bornes, RBAC cron |
| **R-3** | Onglet 5 blocs + éditeur + aperçu | — | verrous de câblage + dry-run sans écriture |
| **R-4** *(seulement si D-R1 = voie B)* | Fenêtres hebdo/mensuelles de `DiscordMemberActivity` + reset bot | **1 additive** | reset, purge 365 j intacte, fenêtres universelles |

## 6. Acceptation

- [ ] Un membre **non inscrit** peut recevoir un rôle d'ancienneté et de **vocal total** ; un rôle de
      contribution ne le cible que si la règle l'autorise (0 assumé et affiché).
- [ ] Un rôle **ignoré** n'est **jamais** retiré (gel) ; un rôle hors périmètre n'est jamais touché.
- [ ] Deux passes consécutives ne produisent **aucun** changement (idempotence) et aucune annonce en double.
- [ ] L'aperçu ne déclenche **aucune** écriture Discord.
- [ ] Les verrous `tests/unit/seniority-roles*` restent verts **sans modification**.

## 7. Vigilance

- **Ne pas dupliquer** l'évaluateur : l'ancienneté passe par lui (sinon deux vérités).
- Un non-inscrit n'a **pas** de fenêtre hebdo/mensuelle : `null` ≠ `0` (jamais un zéro accusateur).
- Le bot est indispensable : sans lui, `DiscordMemberActivity` est vide (ops de #1020).
- Ne jamais retirer un rôle que le moteur n'a pas posé (périmètre fermé).
