---
description: Template générique d'« amorce de session » — le prompt à coller pour démarrer n'importe quel chantier SigilOS (contexte, sécurité, méthode, DoD)
---

# 🧭 Amorce de session — **template générique** (SigilOS)

> **À quoi ça sert** : démarrer une session (bug, feature, refonte, docs, ops) avec le bon
> contexte, les **règles de sécurité non négociables**, la méthode de preuve et la
> **Definition of Done** du dépôt — sans rien réinventer et sans en oublier la moitié.
>
> **Comment s'en servir** : l'amorce courte est **`AGENTS.md`** (racine), chargée automatiquement à chaque
> session — ce fichier-ci est le **complément détaillé, à la demande** : (1) remplir le **§1 « Brief »** ;
> (2) le **§10** sert de prompt long si un cadrage exhaustif est nécessaire ; (3) en fin de session cocher
> le **§8** et ouvrir la PR vers `dev`.
>
> **Règles de référence (toujours valables)** : `docs/RULES.md` · `docs/SECURITY.md` ·
> `docs/agents/{git-push,prisma-schema-change,add-cron-task,discord-module,dev-local}.md`.

---

## 1. 📝 Brief de session (à remplir — **1 chantier = 1 branche = 1 PR**)

| Champ | À remplir |
| --- | --- |
| **Type** | 🐞 bug · ✨ feature · 🎨 UI/UX · ♻️ refonte · 📄 docs · 🔧 ops/infra · 🧪 tests |
| **Module / périmètre** | ex. `Marché` (`src/app/dashboard/[guildId]/marche`, `src/lib/market`, `src/server/market`) |
| **Objectif** | **une** phrase claire |
| **Constats / demandes** | 1 ligne par constat + **une capture** (jamais deviner) |
| **DoD (attendu)** | ce qui doit être **vrai** à la fin (comportement, écran, embed, cron, requête…) |
| **Hors périmètre** | à écrire explicitement (anti-dérive) |
| **Entrées fournies** | captures, logs, IDs, sondes existantes, `debug.md` |
| **Risque** | schéma/données ? Discord ? God ? sécurité ? prod ? |
| **Docs concernées** | `ROADMAP` · `activeContext` · `chantier-actif` · §25 du plan · fiche `docs-catalog` |

## 2. 📚 Sources de vérité à lire AVANT de coder (dans cet ordre)

1. `docs/ROADMAP.md` — **le backlog canonique** (bloc courant + entrées du module).
2. `docs/agents/activeContext.md` — en-tête = **dernière PR mergée**, bloc de la session, `NEXT`.
3. La zone volatile `src/temp/` **si elle existe** (mémo de session, `debug.md`, plan maître du module) — créée à la demande par la session qui en a besoin, jamais versionnée ; règle : `docs/agents/zone-volatile.md`.
4. `docs/RULES.md` (§ Security · § fail-closed · § doc obligatoire · § rate limiting) et `docs/SECURITY.md`.
5. Les workflows concernés : `docs/agents/git-push.md` · `docs/agents/prisma-schema-change.md` (si schéma) · `docs/agents/add-cron-task.md` (si cron) · `docs/agents/discord-module.md` (si Discord).
6. **Le code** — puis l'écart entre la doc et la réalité : **vérifier, corriger la doc** (elle peut être en retard d'une ou deux PR).

## 3. 🎯 Méthode imposée (c'est comme ça que le dépôt fonctionne)

1. **Mesurer avant de corriger** : reproduire (URL exacte, compte, **thème**, **taille d'écran**), puis **cause racine mesurée** — sonde `_probe-*.mjs`, requête SQL **en lecture seule**, `curl` d'une route, logs. Écrire la **mesure** dans le rapport (jamais « ça devait être »).
2. **Corriger au bon étage** : règle **pure** (`src/lib/**`) > serveur (`src/server/**`) > composant. **Une seule source de vérité** par règle (§13.4) — pas de correctif dupliqué dans deux écrans.
3. **Tester le comportement**, pas le rendu : test unitaire **+ non-régression** des verrous existants. **Jamais** de test désactivé pour verdir.
4. **Prouver** : capture **avant/après** (UI) ou mesure chiffrée (perf, OG, DB) attachée au rapport.
5. **Pas de scope creep** : une idée hors brief ⇒ notée en « reste » (ou nouveau chantier), **pas codée**.
6. **Arrêt immédiat + question** si : migration de schéma non prévue, changement d'interface **publique** Discord, action **God**, suppression de données, ou une mesure qui **contredit** le brief.

---

## 4. 🔒 Sécurité — checklist **NON NÉGOCIABLE** (à repasser avant chaque commit)

| Règle | Implémentation attendue |
| --- | --- |
| Auth sur **chaque** action | `await auth()` / `getUserContext(guildId)` **en tête** ; retour `Unauthorized` / `Forbidden` |
| **Isolation de guilde** | toute requête DB filtrée par le **`guildId` interne** (`guildConfig.id`) ; **jamais** un snowflake venu du client |
| RBAC | `ctx.isMember` / `ctx.isAdmin` / permission (`canXxx`) vérifié **avant** l'écriture |
| **God** | `await isSuperAdmin()` **fail-closed** sur **chaque** page **et** action + **audit** |
| Validation | **Zod borné** (`max()`, `.slice()`) sur **toute** entrée utilisateur **et** sur les données d'API externes (Discord, DofusDB…) |
| **Fail-closed** | Discord / Redis KO ⇒ **refuser** — jamais accorder par défaut |
| Secrets | `process.env.X` **sans fallback en dur** ; comparaison via `timingSafeEqual` / `timingSafeEqualStr` |
| Logs | `logger` de `@/lib/logger` (**jamais** `console.log` en prod ; les valeurs sensibles sont auto-masquées) |
| Rate limiting | `checkRateLimit(userId, "<action>", { max, windowMs })` sur les mutations ; réponse **429** propre |
| Interdits | `$queryRaw` (hors sonde), `eval`, `dangerouslySetInnerHTML` sans `sanitizeHtml()`, `src/middleware.ts` ⇒ **`src/proxy.ts`** obligatoire (Next 16 : le middleware Edge inline les `process.env` au build), secret dans un composant client (`NEXT_PUBLIC_*` seulement) |
| Anti-SSRF / assets | liste blanche d'URL, bornes de taille, jamais d'asset public non validé |
| Transitions d'état | garde de statut **DANS le `WHERE`** (`updateMany` conditionnel) — jamais de « lire puis écrire » |
| Preuve | `tests/security/*` **verts** + CI (CodeQL, Semgrep, Trivy, Gitleaks, IOC Shai-Hulud) **verte** |

> **En cas de doute** sur une exposition (identité, montant, snowflake, token, chemin de fichier) : **ne pas exposer**, et poser la question. Toute exception doit être **écrite** (décision datée dans le plan du module) **et testée**.

---

## 5. 🧩 Par type de surface

### 5.1 Schéma / données (`prisma`)
- **0 migration** = l'idéal. Si le schéma change : `npx prisma migrate dev --name description_courte`, migration **committée avec** `schema.prisma`, **additive** et **idempotente** (`ADD COLUMN IF NOT EXISTS`), **jamais** de reset destructif, `npx prisma validate` + `migrate diff` **sans écart** (cf. `docs/agents/prisma-schema-change.md`). **Prévenir le user AVANT.**

### 5.2 CRON (nouvelle tâche) — `docs/agents/add-cron-task.md`
`verifyCronSecret(req)` **fail-closed** · `recordCronExecution(id, { success, durationMs, summary, details })` · tâche déclarée dans **`KNOWN_CRON_TASKS`** (`src/lib/cron-telemetry.ts`) ⇒ visible dans `/god?tab=cron-status` · ligne crontab VPS **documentée dans `docs/MAINTENANCE.md`** · test unitaire + appel `curl` local.

### 5.3 Discord — `docs/agents/discord-module.md`
Une entité = **un seul message** (édition, jamais de repost) · boutons **désactivés plutôt que retirés** · réponses **éphémères jamais muettes** · **jamais** de montant ni de snowflake dans un contenu public · ping **revalidé côté serveur** · publication **non bloquante** (`syncStatus = FAILED` + rejouable) · `@everyone` interdit · rôles par **permission**, **jamais** un nom de rôle en dur.

### 5.4 God (`/god`)
`isSuperAdmin()` **fail-closed** (page **et** action) · **audit** de chaque mutation · réglages **bornés** et validés · jamais d'action « par guilde » sans vérification d'appartenance.

### 5.5 Documentation du module (obligatoire — `docs/RULES.md` § doc)
Source unique = **`src/lib/docs-catalog.ts`** (fiche du module, permissions, nouvelles fonctions) ⇒ **`npm run seed:docs`** en local (+ `npm run build:seeds` si demandé) · pas de markdown brut, pas de nom de rôle Discord en dur, pas d'exemple propre à une guilde · **tour** (`tour-provider.tsx`) mis à jour si un écran change.

---

## 6. 🌿 Git / CI-CD (rappel `docs/agents/git-push.md`)

1. `git fetch origin dev && git merge origin/dev --no-edit` (**obligatoire** si la branche a plus de 24 h) puis **`npm install --package-lock-only`** si `package.json` a bougé — sinon `npm ci` casse en CI (`EUSAGE`, lockfile désynchronisé).
2. `git status --short` → **stager uniquement** les fichiers voulus.
3. **Ne jamais committer** : `.env*`, `docs/audits/`, `src/audit-*`, `AUDIT_*.md`, **`src/temp/**`**, sondes/artefacts, scripts jetables.
4. Commit avec préfixe (`feat:` · `fix:` · `docs:` · `chore:` · `refactor:`) + description en français : le **hook pre-commit** (secret scanning + lint-staged + `tsc --noEmit`) doit être **vert**.
5. `git push -u origin HEAD` → **PR vers `dev`** (jamais `dev`/`main` en direct) → `gh pr checks <n>` **jusqu'au vert** → merge → branche supprimée → `git checkout dev && git pull`.
6. **Jamais de merge sur rouge** · **jamais** de test désactivé pour verdir · **un seul `build` à la fois** (jamais pendant un `next dev` ⇒ déléguer à la CI et le dire).

## 7. 🧪 Vérifications obligatoires (avant la PR — la CI les refait)

```bash
npm run test:run          # suite complète (seuil : au moins le total de la branche de départ)
npx tsc --noEmit          # 0 erreur
npx eslint <fichiers>     # 0 erreur (warnings préexistants : à documenter, pas à masquer)
npm run build             # exit 0 — ou délégué à la CI si `next dev` tourne (le dire)
npm run seed:docs         # si `docs-catalog.ts` a changé (DB locale)
# si schéma touché :
npx prisma validate && npx prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script
```

La CI **`Verify & Build`** enchaîne : `npm ci` → intégrité du lockfile → scan IOC → `prisma generate` → audit sécurité → **Semgrep** → **Trivy** → `lint` → `tsc` → **tsc du bot Discord** → tests → **build** (+ **CodeQL** sur PR, scan **Gitleaks** hebdomadaire).

## 8. ✅ Checklist de sortie (fin de session)

- [ ] Chaque constat : **cause mesurée** + correctif **testé** + **preuve** (capture avant/après ou mesure chiffrée).
- [ ] `npm run test:run` **vert** · `npx tsc --noEmit` **0** · `eslint` **0 erreur** · `build` **0** (ou délégué à la CI).
- [ ] `tests/security/*` **verts** · **0 migration** non voulue (sinon **additive + idempotente**).
- [ ] Sécurité repassée (§4) : auth, isolation guilde, RBAC/God, Zod borné, fail-closed, logger, rate limit, garde d'état dans le `WHERE`.
- [ ] Docs : `docs/ROADMAP.md` + `docs/agents/activeContext.md` + **§25 du plan** du module + fiche `seed-docs` si le module change + mémo `memo-<AAAA-MM-JJ>-<sujet>.md` (zone volatile).
- [ ] `debug.md` (zone volatile `src/temp/`) mis à jour (constats traités / restants / décisions).
- [ ] PR → `dev` · **CI verte** · merge · branche supprimée · `dev` repullé · `gh pr list --state open` **vide**.
- [ ] Rapport final **court** : ce qui est fait · ce qui reste · ce que **le user** doit faire (ops).

## 9. 🖥️ Environnement & pièges connus

- **Windows / PowerShell** : `[guildId]` (et tout `[...]`) = **caractères génériques** ⇒ utiliser **`-LiteralPath`** (`Select-String`, `Get-ChildItem`) — un `-Path` contenant `[guildId]` ne matche **rien**, silencieusement · **ne jamais** écrire avec `>` (UTF-16 ⇒ fichiers corrompus) · `cmd /c findstr` gère mal les guillemets ⇒ préférer `Select-String` puis lire le fichier écrit dans `src/temp/`.
- **Versions** : Node **22** (CI) · npm **11** (CI l'installe en global) · **`npx prisma` toujours épinglé** (`prisma@7.9.1`) — sinon une RC casse le build/le déploiement.
- **Dev local** : `next dev` sur le port **3000** ; `.env` relu **au boot** (redémarrer `next dev` après modification) ; **un seul build à la fois**.
- **Discord** : `DISCORD_OUTBOX_ENABLED` peut être actif en beta (les messages partent aussi par l'outbox) ; les interactions exigent une signature Ed25519 valide (±300 s).
- **Données de jeu** : source de vérité = **`https://api.dofusdb.fr`** (c'est la source du siphon) — les moteurs de recherche classiques et `dofusbook`/`dofus.com` sont **inaccessibles depuis l'agent** (captcha / 403).

---

## 10. 📋 Bloc à coller (prompt de session générique)

> Remplacer chaque `<…>` ; **supprimer** les lignes qui ne s'appliquent pas.
> En temps normal, **rien à copier** : `AGENTS.md` (racine) est chargé automatiquement par l'assistant.
> Ce bloc ne sert que pour un cadrage long, ou un assistant qui n'ouvrirait pas le dépôt.

```
CONTEXTE — projet SigilOS (Next 16 + Prisma 7 + Discord). Avant de coder, lis :
docs/ROADMAP.md · docs/agents/activeContext.md (en-tête + bloc du module/sujet) ·
docs/RULES.md (§ Security) · docs/SECURITY.md ·
docs/agents/{git-push,prisma-schema-change,add-cron-task,discord-module}.md
et le plan/mémo du module s'il existe. Vérifie le code : la doc peut être en retard.

CHANTIER — <type : bug | feature | UI/UX | refonte | docs | ops> sur <module/périmètre>.
Objectif : <une phrase>.
Constats / demandes (captures fournies) : <1 ligne par constat>.
DoD : <ce qui doit être vrai à la fin>.
Hors périmètre : <…>.

MÉTHODE — 1) mesure la CAUSE RACINE avant de corriger (sonde _probe-*.mjs,
requête SQL en lecture seule, curl de route, logs) et écris la mesure ; 2) corrige au bon
étage : règle pure src/lib/** > serveur src/server/** > composant, UNE source de vérité par
règle ; 3) test unitaire du comportement + non-régression des tests existants ;
4) preuve : capture avant/après ou mesure chiffrée ; 5) 1 chantier = 1 branche = 1 PR
vers `dev` ; 6) pas de scope creep (note les idées en « reste ») ; 7) STOP et demande-moi
avant : migration de schéma, changement d'interface publique Discord, action God,
suppression de données, ou si une mesure contredit le brief.

SÉCURITÉ (non négociable) — auth sur CHAQUE action (auth()/getUserContext) · isolation par
`guildId` INTERNE, jamais un snowflake venant du client · RBAC + `isSuperAdmin()`
fail-closed (page ET action) + audit · Zod borné sur toute entrée utilisateur ET sur les
données d'API externes · fail-closed si Discord/Redis échoue · secrets `process.env` sans
fallback · comparaison `timingSafeEqual` · `logger` (jamais `console.log`) · rate limit sur
les mutations (429 propre) · garde d'état DANS le `WHERE` · `src/proxy.ts` (jamais
middleware.ts) · tests/security/* verts · 0 migration (sinon additive + idempotente, et
demande-moi AVANT).

VÉRIFS avant PR — npm run test:run · npx tsc --noEmit · npx eslint <fichiers touchés> ·
npm run build (délégué à la CI si `next dev` tourne — dis-le) · npm run seed:docs si
docs-catalog.ts a changé. Push : docs/agents/git-push.md (sync origin/dev +
`npm install --package-lock-only` si package.json a bougé), hook pre-commit vert, PR vers
`dev`, `gh pr checks` jusqu'au vert, merge, branche supprimée, `dev` repullé.

LIVRABLE — commit(s) `fix(…)/feat(…)` en français · PR mergée et CI verte · docs à jour
(docs/ROADMAP.md + docs/agents/activeContext.md + §25 du plan + mémo
memo-<date>-<sujet>.md) · debug.md à jour · rapport final ≤ 15 lignes
(fait / reste / ops côté user).
```

---

## 11. 🧾 Exemples d'amorces spécifiques du dépôt (même esprit, plus détaillées)

- **Module Marché — phase de debug + clôture** : `refonte-marche/AMORCE-DERNIERE-PHASE-DEBUG.md` (+ `AMORCE-DEBUG-A-COLLER.txt`) : tableau des constats, playbook par zone de fichiers, harnais de preuve, ops du user.
- **Lots de chantier (historique)** : `refonte-marche/AMORCE-LOT3-A-COLLER.txt`, `AMORCE-LOT4-A-COLLER.txt`, `AMORCES-A-COPIER.md`.
- **Plan maître type** : `refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` (§0.1.bis modes d'exécution, §21 tâches, §25 journal) — le format à copier pour tout nouveau module.



