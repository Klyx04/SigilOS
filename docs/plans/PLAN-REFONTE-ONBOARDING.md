# Plan de refonte — Onboarding & acquisition (prospect → guilde active)

> Statut : **PROPOSITION** — en attente de validation produit (décision §2).
> Origine : audit funnel 06/09/2026 (parcours prospect `jeanmich58`, bot installé puis bloqué « aucun serveur éligible »).
> Périmètre : landing → OAuth → portail → invite bot → success → déploiement → console owner + panel God.
> Hors périmètre : refonte visuelle globale, pricing/premium, modules eux-mêmes.

## 0. État d'implémentation — one-shot 06/09/2026 (branche `feat/refonte-onboarding`, NON commité)

| Item | État |
|---|---|
| Bitmask corrigé (`326686043268`, 11 droits) + tests | ✅ fait (`discord-permissions.ts`, `discord-permissions.test.ts`, `onboarding-funnel.test.ts`, runbook J-day) |
| Kill-switch `PlatformConfig.autoOnboardingEnabled` + migration + toggle panel God + gates portail/modale/`onboardGuild` | ✅ fait |
| Modèle A : join = actif + notif God info + embed réécrit (URL paramétrée) | ✅ fait (`services/discord-bot/index.ts`) — ⚠️ `dist/index.js` commité : **rebuild le bot au déploiement** |
| Success page à états réels (polling `getGuildDeployState`, anti-énumération) | ✅ fait |
| Portail unifié (colonne « En attente », `awaiting`, fin du fantôme) | ✅ fait (`dashboard/page.tsx`, `user-actions.ts`) |
| Landing CTA bot-first + scope slash `bot applications.commands` | ✅ fait (hero, `guild-setup-card`) |
| God guildes : dédup Dégeler, zone danger, trigger visible | ✅ fait (`guild-table.tsx`) |
| P0 succession au départ + normalisation ownerId | ✅ fait (bot `GuildMemberRemove`) |
| P1 widget Gouvernance + console `/admin` (filtre modules + gate unifiée doc) | ✅ fait (widget affiché, gate `updateGuildModules` resserrée `isDiscordAdmin` — breaking documenté) |
| P2 cron orphelin + claim + bannière + auto-résolution au transfert | ✅ fait (migration `GuildRecoveryClaim` incluse) |
| God override modules (`disabledByGod` + résolution + UI God + badge + matrice filtrée) | ✅ fait |
| God claims UI (notifs : Transférer/Rejeter) + tri SLA file d'attente + badge ⏳ 24h | ✅ fait (`god-notification-panel.tsx`, `guild-table.tsx`) |
| Portail pilotage « mes serveurs » (badges verrous/claim + deep-links, `getPilotSignals`) | ✅ fait (`dashboard/page.tsx`) |
| Modale bloquante 2 étapes (serveur whitelisté + rôle non-@everyone, action atomique `completeMandatoryOnboarding`, succès = prompt étapes optionnelles) rendue par le layout sur toutes les pages (God exempté) | ✅ fait (`onboarding-blocker-modal.tsx`, 7 tests) |
| 2e modale persistante (`OnboardingNextStepsModal`, 1 fois/navigateur via localStorage) quand onboarding complet mais modules non configurés + fix race reload/navigation | ✅ fait |
| Pseudo-banner masqué si module profil OFF (CTA menait à un mur) + toggle `commandes` manquant créé (contexte + page + sidebar + matrice + migration, défaut true existants / false nouvelles) | ✅ fait |
| Refonte settings : IA 3 groupes (Guilde / Notifications & Canaux / Par Module), nav + panneau suivent les modules (repli + lien Modules), `DiscordChannelPicker` partagé (Radix, types 0/5 + forums galerie, repli saisie), 14 inputs migrés, « SAUVEGARDER TOUT » → « Enregistrer », ancres tour/docs inchangées | ✅ fait |
| Garde dirty uniforme : snapshot + `UnsavedChangesGuard` + pastille sur les 11 sections settings (corrige aussi 2 bugs closure périmée sur les boutons Désactiver services/prêts) | ✅ fait |
| Page Pilotage dédiée natifs (`/admin/pilotage`, onglets isolés `?tab=` : État+Gouvernance / Modules / Accès / Commandes) ; `/admin` = vue Staff pure (cartes filtrées, sans onglets owner) ; sidebar « Staff » + « Pilotage » | ✅ fait |
| Commandes slash = onglet Pilotage (`?tab=commandes`), gate page + écriture resserrées natif (`isDiscordAdmin`), sidebar alignée | ✅ fait |
| Console : entrée sidebar renommée « Console » (pas « Staff » — staff = plateforme), filtre modules sidebar + cartes | ✅ fait |
| Descriptions RBAC `system:god`/`system:rbac` corrigées au réel + `bypassModules = isGod` seul (désactivé = invisible y compris admin ; God plateforme seule exception, testée) | ✅ fait |
| Console : sous-nav partagée `AdminConsoleNav` (Vue d'ensemble / Mise en route / Modules / Accès & Rôles, Pilotage natifs vs Accès natifs+délégués) sur 4 pages | ✅ fait |
| P2 : tests claim/resolve (aînesse, drapeau requis, anti-doublon, God-only) | ✅ fait |
| Vérifs | tsc 0 · eslint 0 erreur · **554/554** (60 fichiers) · build Turbopack compilé OK ; static-gen non terminée (machine trop lente — à relancer au merge) |
| Vérifs | tsc 0 · eslint 0 erreur · **541/541** (19 nouveaux) · build Turbopack compilé OK ; phases TS/static-gen non terminées en 20 min (machine trop lente, build stoppé — à relancer au merge) |
| Reste migration BDD | `prisma/migrations/20261015000000_add_onboarding_governance/` à appliquer (`migrate deploy`) |

---

## 1. Diagnostic (vérifié dans le code)

### 1.1 Cause racine : le modèle contredit l'UX

| Couche | Comportement réel | Fichier |
|---|---|---|
| Bot rejoint un serveur | `allowedGuild` créée avec `isActive: false` (« Manual activation required ») + notif God `GUILD_CREATE_UNWHITELISTED` | `services/discord-bot/index.ts:136-203` |
| Portail (`getGuildsSeparated`) | `isAllowedForDeployment()` exclut toute guilde explicitement désactivée → **ni active, ni pending** | `src/server/actions/user-actions.ts:1400-1408` |
| Portail `/dashboard` | active + pending vides → écran cul-de-sac `NoGuildMessage` (« aucun serveur éligible ») | `src/app/dashboard/page.tsx:52-53`, `src/components/no-guild-message.tsx` |
| Modale « Deux façons de commencer » | Promet « déploie ta guilde en 30 secondes », bouton « Déployer mon serveur en 1 clic » qui ne fait qu'un login OAuth | `src/components/landing/AccessRequestModal.tsx:46-52` |
| Embed de bienvenue | Dit « trouvez la carte de votre serveur et cliquez Déployer » → carte inexistante après le gel | `services/discord-bot/index.ts:253-285` |
| Page `BOT AUTORISÉ` | Compte à rebours → « RETOUR AU QG » → le QG est vide. Promesse non tenue, aucun état « en attente staff » | `src/app/onboarding/success/page.tsx` |

**Effet pervers documenté : avant d'inviter le bot, la guilde EST visible en pending (« Inviter le Bot ») ; l'inviter la fait DISPARAÎTRE du portail.** Aucun refresh/reconnect ne répare (état serveur, pas client). Le prospect part.

### 1.2 Anomalie grave : bits de permissions du bot erronés

`src/lib/discord-permissions.ts` étiquette trois bits de travers (référence : `discord-api-types`, `PermissionFlagsBits`) :

| Bit | Étiquette code | Réalité Discord | Utilisé par le bot ? |
|---|---|---|---|
| `2**39` | CREATE_PUBLIC_THREADS | **Utiliser les Activités** | Non trouvé |
| `2**40` | CREATE_PRIVATE_THREADS | **Modérer les membres (= timeout)** | Non trouvé |
| `2**42` | MANAGE_THREADS | **Soundboard** | Non trouvé |

Et manquent les vrais `MANAGE_THREADS (2**34)`, `CREATE_PRIVATE_THREADS (2**36)`, `SEND_VOICE_MESSAGES (2**46)` que les commentaires prétendent inclure. Conséquences : écran OAuth effrayant pour rien (« Modérer les membres » en tête de liste) + gestion des threads possiblement inopérante en silencieux. À auditer aussi : `MOVE_MEMBERS (2**24)`, `VIEW_AUDIT_LOG (128)`, `BAN_MEMBERS (4)` — aucune utilisation trouvée (stats vocales via gateway, `auditLog` = table interne, tombstones à confirmer) ; `MANAGE_ROLES (2**28)` — à garder **ssi** le bot assigne réellement des rôles (gate règlement), la lecture seule n'exigeant aucun droit.

Bitmask déployé avant refonte : `6356836904068` (14 droits). Corrigé : **`326686043268`** (11 droits — retrait Activités 39 / Modération-timeout 40 / Soundboard 42 / Move 24, ajout vrai ManageThreads 34).

### 1.3 Panel God guildes — constats

- Dégeler existe en **doublon** (bouton rapide + menu ⋮ : `guild-table.tsx:807` vs `:838`).
- Actions destructrices noyées dans le même menu ⋮, même couleur rouge, sans sort des données explicite. Correspondance réelle : **Hard Delete** = suppression BDD définitive (double confirm `DELETE`) · **Bannir** = `platformBan` (bloque, données gardées) · **Expulser le Bot** = `leaveGuild` (données gardées) · **Révoquer Permission** = retire la whitelist · **Mettre en pause** = soft-delete 30 j.
- Actions en `opacity-0 group-hover:opacity-100` → **invisibles au tactile**.
- Aucun kill-switch global de l'auto-onboarding.

---

## 2. Décision produit requise (bloque tout le reste)

Deux modèles possibles. **Recommandation : A.**

### Modèle A — Ouvert (recommandé)
Bot rejoint = guilde active immédiatement (ou après déploiement 1-clic sans validation humaine). Le staff modère **a posteriori** (ban, gel, quotas) + notifs God conservées. Aligne le code sur les promesses UX existantes (« 30 secondes », « invité = fonctionnel »). Anti-abus : rate-limit onboarding déjà en place (`onboardGuild`, 3/10 min), `platformBan`, capacité membres, tombstones à la suppression Discord.

### Modèle B — Fermé assumé
On garde l'approbation God, mais on la rend **explicite partout** : pending « en attente de validation staff (délai moyen affiché) », success page et embed réécrits en ce sens, SLA God, CTA landing qui ne promettent plus 30 secondes. Conversion plus faible, charge staff permanente.

> ⚠️ Tant que ce choix n'est pas tranché, ne pas toucher aux CTA : un CTA bot-first sous modèle fermé fabrique des clients frustrés à la chaîne.

---

## 3. Funnel cible (modèle A)

```
Landing (CTA primaire « Ajouter à Discord » → OAuth bot, secondaire « Connexion »)
  → Portail UNIQUE à états (jamais d'écran cul-de-sac) :
      a) guildes actives → accès direct (inchangé, + smart redirect si 1 seule)
      b) serveurs déployables (admin/owner, bot absent) → « Inviter le Bot »
      c) bot présent, non déployé → « Déployer » (1-clic, idempotent)
      d) vide total → carte onboarding (déployer / ticket aide), PAS « Accès Restreint »
  → OAuth bot (bitmask corrigé §5.1)
  → Page succès = ÉTAT RÉEL (polling) : « déployé ✓ » ou « déploiement en cours… »
  → Guilde active → mise en route (getting-started existant) → console owner
```

Règles : **zéro écran sans issue** (chaque état a un CTA qui fait avancer), **zéro promesse non tenue** (pas de « 30 secondes » si validation humaine), **langue FR partout** (plus aucun debug EN).

---

## 4. Spéc par vague

### Vague 0 — Confiance (1–2 j, sans toucher au modèle)
1. **Bitmask** (`src/lib/discord-permissions.ts`) : ✅ FAIT — constantes renommées aux vrais noms, retrait 39/40/42/24, ajout vrai `MANAGE_THREADS (2**34)` ; nouveau mask `326686043268` + tests maj. Note rollout : guildes existantes inchangées jusqu'à ré-invitation — le communiquer.
2. **Embed de bienvenue** (`services/discord-bot/index.ts:253`) : réécrire selon §3 (étapes réelles), URL paramétrée par environnement (plus de `beta.sigilos.fr` en dur).
3. **Page succès** (`src/app/onboarding/success/page.tsx`) : remplacer le compte à rebours aveugle par un polling d'état (`verifyGuildAccessibility` + config) : « Bot détecté ✓ → Déploiement… → Actif ✓ / En attente ». Bouton retour contextuel.
4. **Portail** (`src/app/dashboard/page.tsx` + `no-guild-message.tsx`) : fusionner en une page à états (§3 a–d) ; supprimer le cul-de-sac ; garder le plafond anti-tempête (`MAX_PORTAL_AUTO_RELOAD`) et le cas `needsReconnect` (déjà bons).
5. **Modale** (`AccessRequestModal.tsx`) : renommer « Déployer mon serveur en 1 clic » (ne fait qu'un login) → « Continuer avec Discord », ou brancher le vrai flux bot-first si modèle A.

### Vague 1 — God & sécurité opérationnelle (1 j)
1. Dédupliquer Dégeler (garder UN seul point d'entrée, menu ⋮).
2. Section « Zone danger » dans le menu : libellés avec sort des données (`Supprimer définitivement (BDD)` / `Bannir (bloque, garde les données)` / `Expulser le bot (garde les données)` / `Révoquer la whitelist`), confirmations inchangées.
3. Actions visibles hors hover (au minimum le trigger ⋮ toujours visible).
4. **Kill-switch auto-onboarding** : champ `autoOnboardingEnabled` (default `true`) sur le singleton `PlatformConfig` + migration + toggle God + gate dans `isAllowedForDeployment` (**nouvelles guildes uniquement**, existantes intouchées) + masquage du bloc « En autonomie » quand OFF. Même pattern que `roadmapEnabled`/`donationsEnabled` (`getPlatformConfig`).
5. SLA visuelle : âge des guildes en attente dans l'onglet + tri par ancienneté (file d'approbation si modèle B, file de surveillance si modèle A).

### Vague 2 — Acquisition & console owner (2–3 j)
1. Landing : primaire « Ajouter à Discord » (OAuth bot direct, `guild_id` facultatif) / secondaire « Connexion » ; ne jamais promettre un délai inférieur au pire cas réel.
2. Console owner `/dashboard/[guildId]/admin` restructurée : **État du déploiement** (bot présent ? config ? rôles mappés ?) → **Accès & rôles** (matrice existante) → **Modules** (page existante) → **Zone danger** (quitter/supprimer sa guilde). Principalement de la réorganisation + un sélecteur multi-serveurs pour les owners.
3. Page `auth/error` : distinguer « pas de guilde » (CTA déployer) de « pas admin » (expliquer le prérequis), sans jargon.

### Non-objectifs assumés
- Pas de changement du scope OAuth login (`identify` + `guilds` déjà minimaux et nécessaires).
- Pas de `KICK_MEMBERS` (déjà absent ✓), jamais `ADMINISTRATOR=8` (déjà retiré, PR #520 ✓).
- Pas de fenêtre PiP/overlay dans ce chantier.

---

## 5. Sécurité (non-négociable, existant à préserver)

- Fail-closed partout : `isAllowedForDeployment` reste deny-by-default (ban, whitelist désactivée) ; toute nouvelle gate suit le même sens.
- `getUserContext(guildId)` + `verifyGuildAccessibility` restent les seules sources de vérité d'accès ; le portail n'accorde rien, il **affiche** (le déploiement effectif passe par `onboardGuild` + `requireGuildAdmin`, idempotente + rate-limitée).
- Pas de secret côté client : `clientId` public OK, jamais de token ; erreurs Discord loggées serveur, messages FR génériques côté UI (cf. fix permissions du 06/09 : aucun `DISCORD_BOT_TOKEN`/`.env`/erreur brute à l'écran).
- Validation Zod des entrées, bornes, guild isolation par `guildId` — inchangés.
- Abuse (modèle A) : rate-limit créations déjà en place ; ajouter si besoin un plafond de guildes/jour/IP + alerte God au-delà d'un seuil (même canal que `GUILD_CREATE_UNWHITELISTED`).

---

## 6. Rollout & migration

1. Vague 0 déployable sans migration (que du code + textes). Guilde existantes : permissions bot inchangées (re-invitation volontaire pour le nouveau bitmask — le dire dans un changelog/annonce).
2. Kill-switch : migration `PlatformConfig.autoOnboardingEnabled` default `true` → comportement inchangé au déploiement ; OFF = les nouvelles guildes retombent en file God, l'UX bascule en mode « accompagné ».
3. Si modèle A : script one-shot de dégel des guildes « Bot Seul » en attente (liste via onglet God) + message aux owners concernés.
4. Si modèle B : SLA God écrite (ex. < 24 h) + rappel notif au-delà du délai.

---

## 7. Acceptation & métriques

- Parcours prospect filmé de bout en bout : landing → guilde active **sans intervention staff** (modèle A) en < 5 min, zéro écran sans CTA.
- OAuth bot : écran ≤ 10 lignes, sans « Modérer/Activités/Soundboard ».
- Funnel mesurable : `landing → oauth → bot_install → deploy → actif` (compteurs par étape, TelemetryTracker existant) ; objectif : abandon post-install < 20 %.
- Tests : unitaires `discord-permissions` (nouveau mask), `onboarding-gating` (états portail), e2e manuel du parcours gelé (modèle B) ; `tsc 0`, `npm run test:run`, `npm run build` avant merge (règle repo).
- God : action « supprimer définitivement » trouvable en < 10 s par un staff n'ayant jamais ouvert l'onglet (test utilisateur).

---

## 8. Réponses directes aux questions du doc

- *Tous ces droits sont-ils nécessaires ?* **Non** : Activités, Modération (timeout), Soundboard = bits erronés à retirer ; Move/Audit-logs/Ban = à confirmer puis retirer si inutilisés ; Roles = à garder ssi assignation réelle.
- *Quel bouton supprime définitivement ?* **Hard Delete** (menu ⋮, taper `DELETE`). Le bouton rouge « Supprimée » = état soft-delete.
- *Pourquoi la page intermédiaire ?* `NoGuildMessage` quand le portail est vide + prudence rate-limit/scope. À fusionner, pas à contourner.
- *Le kill-switch est-il faisable ?* **Oui**, pattern existant, ~1/2 journée.
- *Panel owner manquant ?* Les briques existent (`/admin`, modules, matrice) ; manque la **forme** console (état → accès → modules → danger) + sélecteur multi-serveurs. Vague 2.

---

## 9. Console owner + gouvernance + super-gestion God (ajout 06/09 PM)

Contexte : modèle Eliacord (sidebar MODULES avec toggles + GESTION : Général, Journal, Utilisateurs). Audit : le filtrage RBAC carte→page des 14 cartes `/admin` est déjà sain (aucune impasse) ; les pages d'écriture portent leurs propres gates ; en revanche les pages admin ignorent l'état des modules, et `updateGuildModules` accepte `isAdmin` (incl. dieux délégués) alors que la page exige le natif `isDiscordAdmin`.

### 9.1 P3 précisé : absorption, pas liens
La console owner **embarque** les composants existants (pas des liens vers les pages) :
- Section Modules = `ModulesClient` intégré, toggles par module avec état + badge « verrouillé par le staff » quand God-lock actif (§9.4).
- Section Accès = `PermissionsManager` intégré, **filtré d'affichage** : les permissions d'un module désactivé (guilde OU God) sont masquées (mappings **conservés** en BDD → réactivation sans perte), avec compteur « N permissions masquées ».
- Les pages `/admin/modules` et `/admin/permissions` restent en deep-links (tours `data-tour`, docs `docSlug` inchangés) pour compat.
- Filtre module global : toute carte/section admin lit `isModuleEnabled` ; si OFF → masquée + renvoi « activer dans Modules ». Règle d'écriture unifiée : page ET action exigent `requireGuildAdmin` (natif owner/0x8, `guards.ts`) — resserrement vs `isAdmin` actuel, à signaler au changelog (breaking pour dieux délégués).

### 9.2 P0 — Succession au départ + réconciliation (1/2 j)
- `GuildMemberRemove` (`services/discord-bot/index.ts:439`) : après archivage, si le partant = `ownerId` (via `account`) OU = `owner_id` Discord live → `handleGuildOwnerSuccession` (existe : priorité owner Discord actif → membre le plus ancien + alertes).
- Réconciliation : si `owner_id` Discord live a un profil actif et que l'`ownerId` stocké est archivé/absent → mise à jour (même logique priorité 1, il manque le déclencheur).
- Hygiène : `ownerId` mélange snowflakes (onboarding) et UUID internes (transferts) → normaliser vers UUID + migration. Sans ça, les comparaisons restent défensives et fragiles.

### 9.3 P1 — Widget Gouvernance (1 j)
Owner SigilOS vs owner Discord (alerte divergence), admins natifs live, délégués god/rbac, transfert existant (`transferGuildOwnershipAction`, double confirmation) + « désigner un second » (renvoi matrice). Rend la continuité **explicite** au lieu d'accidentelle.

### 9.4 P2 — Filet orphelin (1 j)
Détection « zéro admin natif + zéro délégué » en **cron quotidien** (trop cher au chargement) → notif God + bannière « demander une récupération » au membre actif le plus ancien (claim → God approuve via `transferGuildOwnership` existant). **Jamais d'auto-élévation** (fail-closed).

### 9.5 Rework panel God guildes (avec la vague 1)
Dédupliquer Dégeler (1 seul point d'entrée), « Zone danger » avec sort des données en clair (Supprimer BDD / Bannir / Expulser / Révoquer), actions visibles hors hover (tactile), kill-switch auto-onboarding §4, file d'attente triée par ancienneté + SLA.

### 9.6 Super-gestion God des modules par guilde (1 j)
Besoin : God active/coupe un module **pour une guilde donnée** → invisible du panel admin de la guilde + RBAC associée masquée. État actuel : aucun verrou (modèle `GuildModules` = booléens simples, `prisma/schema.prisma:505`).
- Schéma : `GuildModules.disabledByGod String[] @default([])` (noms de `ModuleKey`) + migration. Pas de suppression : mappings et toggles guilde **conservés**.
- Résolution dans `getGuildModules` (`module-actions.ts`) : God-disabled ⇒ `false` quel que soit le toggle guilde. Invalider `moduleCache` + `flushGuildUserContextCache` (pattern existant).
  > ⚠️ **Correction du 25/09/2026 (audit croisé du 24/09)** : cette ligne affirmait que « le `applyModule` existant (`user-actions.ts`) propage **déjà** le `false` à tous les `canView*/canManage*` ». **C'était faux** : `getUserContext` lit `guildConfig.modules` via son propre `select` (`GUILD_CONFIG_CACHE_SELECT`), qui ne contenait ni `disabledByGod` ni la résolution `getGuildModules`. Résultat mesuré : sidebar masquée (elle lit `getGuildModules`) mais `canView*/canManage*` toujours `true` ⇒ **admin Discord qui atteint la page en URL directe**, et commandes du bot qui répondent encore. Corrigé par la règle pure partagée `src/lib/module-lock.ts` (`applyGodLocks`), lue par `getGuildModules`, `getUserContext` **et** `internalCheckPermission` (option `{ module }`), plus la suppression de l'exemption `isAdmin` sur les pages. Vérifs : `tests/unit/module-lock.test.ts`, `tests/unit/user-context.test.ts`.
- UI God (page détail `/god/guilds/[id]`, section Modules) : grille des modules avec état effectif (toggle guilde × lock God) + lock/unlock + audit + notif salon staff si configuré.
  > ⚠️ **Correction du 25/09/2026** : l'audit demandé ici (`createAuditLog`, `isGodLog: true`) est **impossible** — `createAuditLog` force `isGodLog: false` et n'accepte pas ce champ (le wrapper God s'appelle `createGodAuditLog`). L'implémentation avait donc écrit un log **de guilde** pour une action plateforme. Corrigé (`createGodAuditLog`, action `GOD_MODULE_LOCK`, sans `guildId`), avec Zod borné, rate-limit 10/min et garde d'état `WHERE disabledByGod equals`.
- UI guilde : badge « Verrouillé par le staff » sur la carte module (toggle désactivé, pas supprimé — l'admin voit ce qu'on lui coupe et pourquoi) ; permissions masquées de la matrice avec compteur.
- Garde-fous : `admin: true` (panneau de config) non verrouillable (sinon l'admin ne voit même plus pourquoi tout est vide) ; au moins un canal d'appel (ticket/“contacter le staff”) toujours affiché ; God ne peut pas se lock lui-même (bypass `isSuperAdmin` inchangé).

« désactivé = invisible ». Preuves : `tests/unit/module-lock.test.ts` (12) + 3 cas de verrou
dans `tests/unit/user-context.test.ts` + suite complète verte.