# 📋 SigilOS Development Rules

> Quick reference for all development standards. See [CONTEXT.md](./CONTEXT.md) for full project context.

---

## 🔒 Security (Non-Negotiable)

| Rule | Implementation |
|------|----------------|
| **Auth on every action** | `await auth()` or `getUserContext(guildId)` at start |
| **Guild isolation** | All DB queries MUST filter by `guildId` |
| **Admin check for mutations** | `if (!user.isAdmin) return 403` |
| **Super-admin for GOD actions** | `await isSuperAdmin()` on lifecycle operations |
| **Input validation** | Zod schemas on all user input |
| **No secrets client-side** | Only `NEXT_PUBLIC_*` in browser code |
| **No raw SQL** | Use Prisma ORM only |
| **No eval/exec** | Never use dynamic code execution |
| **Fail-closed (jamais fail-open)** | Si une API tierce (Discord, Redis) échoue → REFUSER, jamais accorder l'accès par défaut |
| **Comparaison temps constant** | `timingSafeEqual` / `timingSafeEqualStr` pour comparer secrets & tokens |
| **Bornes validation** | Toujours borner les valeurs issues d'API externes (longueur, plage) |
| **Pas de secret codé en dur** | Toujours `process.env.*`, jamais de fallback en dur dans le code |
| **Aucun chemin machine en dur** | `os.homedir()`, variable d'env ou chemin relatif — jamais `C:\Users\<...>` / `/home/<...>` (le dépôt est **public**) |
| **Aucun identifiant personnel en dur** | IDs Discord (guilde, propriétaire), e-mails, IP → `process.env.*`, avec **échec explicite** si absent (jamais de fallback « pour la dev ») |
| **Aucune capture du poste de travail** | Jamais d'image montrant bureau, explorateur, navigateur, onglets, barre des tâches ou pseudos de tiers (même dans une capture « produit ») |
| **Zéro métadonnée dans les images** | EXIF / XMP / texte retirés (export d'éditeur, horodatage, logiciel, chemin local) — vérifié par `node scripts/check-media-metadata.mjs` |

---

## ⚠️ Règles fail-closed (issues de l'audit 2026 — CRITICAL)

> Ces règles corrigent les trous critiques trouvés lors de l'audit de sécurité. Elles sont **non-négociables**.

### 1. Ne jamais fail-open sur erreur réseau
```typescript
// ❌ INTERDIT : accorder l'accès si l'API Discord échoue
const isAuthorizedMember = hasAuthorizedRole || memberFetchFailed;

// ✅ OBLIGATOIRE (fail-closed) : refuser si on n'a pas pu vérifier
const isAuthorizedMember = (hasAuthorizedRole || isAdminFinal) && !memberFetchFailed;
```

### 2. Pas de secret/fallback en dur dans le code
```typescript
// ❌ INTERDIT : fallback de secret lisible dans le code source
const secret = process.env.AUTH_SECRET || "default_internal_secret...";

// ✅ OBLIGATOIRE : fail-closed si le secret manque
const secret = process.env.AUTH_SECRET;
if (!secret) { /* refuser / logger */ }
```

### 3. Comparaison de secrets en temps constant
```typescript
// ❌ INTERDIT : comparaison naive (timing attack)
if (provided === secret) { ... }

// ✅ OBLIGATOIRE : temps constant
function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
```

### 4. Toute donnée issue d'API externe doit être bornée
```typescript
// ✅ OBLIGATOIRE
const cleanXp = rawXp.replace(/\D/g, "").slice(0, 15);
const classe = rawClasse.slice(0, 50);
```

### 5. Vérifier l'appartenance à la guilde AVANT toute écriture
```typescript
// ✅ OBLIGATOIRE : la cible doit appartenir à la guilde du contexte
const targetBelongsToGuild = await db.userProfile.findFirst({
  where: { userId: targetUserId, guild: { discordGuildId: guildId } }
});
if (!user.isSuperAdmin && !targetBelongsToGuild) {
  return { success: false, error: "Cible invalide pour cette guilde" };
}
```

---

## 🧱 Sécurité de la chaîne d'outils (dépôt, CI/CD, dépendances)

> Ces règles visent le **dépôt et le pipeline**, pas le code applicatif. Elles sont vérifiables par
> un tiers (auditeur, OpenSSF Scorecard) **sans accès administrateur**.

| Règle | Pourquoi | Où c'est vérifié |
|---|---|---|
| **Épingler toute action TIERCE sur un SHA de commit complet** (`owner/action@<sha40> # vX`) | une action tierce peut publier du code malveillant sous un tag déplacé (supply chain) | ✅ `gitleaks`, `semgrep`, `trivy` **et** `dorny/paths-filter` (`@ceb8a2b8… # v4`, 20/09/2026) — toute nouvelle action tierce doit suivre la même règle |
| **Permissions minimales du `GITHUB_TOKEN`** (lecture par défaut, écriture **au niveau du job**) | un `write-all` donne à un workflow compromis le droit d'écrire dans le dépôt | `permissions: contents: read` en tête de `verify.yml` ; `packages: write` seulement dans `deploy.yml` |
| **Jamais `pull_request_target` exécutant du code de PR** | ce déclencheur tourne avec les secrets du dépôt | `grep -rn pull_request_target .github/` doit rester **vide** |
| **Aucun secret dans le dépôt, jamais** | le dépôt est **public** | secret scanning + push protection GitHub ; hook `pre-commit` (motifs Discord/GitHub/AWS/OpenAI/URL PostgreSQL) ; `.env*` gitignorés sauf `.env.example` |
| **Secrets de CI uniquement via GitHub Secrets / environments** | évite toute fuite par les logs d'un runner | jamais d'`AUTH_SECRET` sur un runner `pull_request` (garde-fou F-18 de `verify.yml`) |
| **Installation déterministe** : `npm ci` + lockfile avec `integrity`, `save-exact=true`, `overrides` épinglés | rejoue exactement l'arbre testé, bloque une dérive silencieuse | `verify.yml` (lockfile integrity + `npm audit --audit-level=high`), `.npmrc` |
| **Un changement de schéma Prisma = une migration** (additive, idempotente) ; **jamais** modifier une migration appliquée (checksum Prisma) | sinon beta/prod se désynchronisent au deploy | hook `pre-commit` (refus) + revue |
| **`git commit --no-verify` = décision explicite**, justifiée dans la PR | le hook porte la vérification la moins chère (secrets, tsc, migrations) | convention de PR |
| **Rapports d'audit jamais versionnés** | ils décrivent des vulnérabilités exploitables | `.gitignore` : `docs/audits/`, `AUDIT_*.md`, `src/audit-*` |
| **Médias suivis sans métadonnée** | un export d'éditeur (Photoshop…) ou une capture embarque logiciel, horodatage et parfois un chemin local de la machine — invisible dans un diff | `node scripts/check-media-metadata.mjs` (job `verify` **et** hook `pre-commit`) → **échec bloquant** |
| **Un contrôle de sécurité ne s'affaiblit que par décision écrite** (retrait d'un job, élargissement d'un `ignore`, désactivation d'une règle) | c'est ce qu'un auditeur cherche dans l'historique | revue + `docs/SECURITY.md` |

---

## 📁 Code Organization

```
src/
├── app/           # Pages & API routes
├── components/    # Reusable UI components
├── lib/           # Utilities & external APIs
└── server/
    ├── actions/   # Server Actions (main business logic)
    └── discord.ts # Discord API integration
```

---

## ✍️ Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-actions.ts` |
| Components | PascalCase | `MissionCard.tsx` |
| Functions | camelCase | `getUserContext()` |
| Types | PascalCase | `ActionResponse<T>` |
| DB Tables | PascalCase | `GuildConfig` |

---

## 📝 Logging Policy

### Production Logging Rules

**✅ RECOMMENDED:** Use the structured logger ([lib/logger.ts](file:///a:/SigilOS/src/lib/logger.ts))

```typescript
import { logger } from '@/lib/logger';

// ✅ Development only (auto-hidden in production)
logger.debug('Debugging info', { userId, guildId });
logger.info('Mission submitted', { missionId, slotIndex });

// ✅ Always logged (dev + production)
logger.warn('Rate limit approaching', { userId, remaining: 2 });
logger.error('Database error', { error: e.message, query });
```

### Console Rules (Legacy)

| Usage | Status | Alternative |
|-------|--------|-------------|
| `console.log()` | ❌ **FORBIDDEN** in production code | Use `logger.debug()` or `logger.info()` |
| `console.warn()` | ⚠️ Allowed but prefer `logger.warn()` | `logger.warn()` |
| `console.error()` | ✅ Allowed but prefer `logger.error()` | `logger.error()` |

### Auto-Redaction of Sensitive Data

The logger automatically redacts these keys:
- `password`, `token`, `secret`, `authorization`, `cookie`, `apiKey`

```typescript
logger.info('User authenticated', {
    userId: '123',
    token: 'abc123',  // ← Auto-redacted to "[REDACTED]"
    guildId: '456'    // ← OK, not sensitive
});
```

**Why use logger?**
- 🔒 Auto-redacts secrets (prevents token leaks)
- 📊 Structured JSON in production (ready for Datadog/Grafana)
- 💾 Saves disk space (~95% reduction in log volume)
- ✅ docs/RULES.md compliant by default

---

## 🧪 Before Commit Checklist

- [ ] `npm run build` passes localement
- [ ] No TypeScript errors
- [ ] SIGIL-CI (Robot) s'affiche en vert sur GitHub après le push
- [ ] All new actions have auth checks
- [ ] Sensitive routes have permission guards
- [ ] No `console.log` in production code (use `logger` from `@/lib/logger`)
- [ ] ⚠️ Drafts publics : `noindex`/`nofollow` ≠ contrôle d'accès. Le `noindex` empêche l'indexation mais **ne rend pas une URL privée** (toute personne connaissant l'URL peut lire le contenu). Ne jamais utiliser de draft `noindex` seul pour du contenu sensible, non annoncé, des données de guilde/utilisateurs, de la roadmap, des fonctionnalités non publiques ou de l'administratif. Pour ces contenus : auth de preview, Basic Auth Caddy, ou test strictement local.
  - ✅ Acceptable : drafts de guides de contenu public non sensible, pour relecture temporaire.
  - ❌ Interdit : tout autre usage de draft `noindex` comme protection d'accès.

---

## 🌿 Git Workflow

### 1. Branching Strategy
| Branch | Role | Rules |
|--------|------|-------|
| `main` | **Production** | 🔴 **Protected**. The "Real" Site. Updated only from `dev`. |
| `dev` | **Beta / Testing** | 🟠 **Protected**. Integration branch. PRs land here first. |
| `feat/*` | New Features | Source: `dev`. Deleted after merge. |
| `fix/*` | Bug Fixes | Source: `dev`. Deleted after merge. |

### 2. The Production Path (Le chemin vers la Prod)
1. **Dev Local** : Tu travailles sur ta branche `feat/ma-feature`.
2. **Integration** : Tu ouvres une PR vers `dev`. Le robot CI vérifie tout.
3. **Beta Test** : Une fois mergé dans `dev`, le site Beta se met à jour. Tu testes avec ta guilde.
4. **Release** : Si tout est OK après 24-48h, on merge `dev` vers `main`. 
   - *Zéro interruption* : Le serveur bascule automatiquement sur la nouvelle version.
   - *Sécurité* : Le robot CI re-vérifie `main` avant d'autoriser la mise en ligne.

### 3. Clean Code & Branch Hygiene
- **Zero Error Policy** : Le robot (GitHub Actions) **DOIT** être vert avant tout merge.
- **Merged = Deleted** : Une fois une branche fusionnée, efface-la (`git branch -d`). Ça évite de se perdre.
- **Warnings are Debt** : Les alertes oranges (warnings) sont tolérées pour avancer, mais ne doivent pas s'accumuler.

### 4. Workflow Lifecycle (Commandes de survie)

#### A. Commencer un nouveau but
```bash
# 1. On se met sur dev et on récupère le dernier code
git checkout dev
git pull origin dev

# 2. On crée sa branche de travail
git checkout -b feat/ma-nouvelle-idee
```

#### B. Pendant que tu codes
```bash
# Ajoute tes changements et crée un paquet (commit)
git add .
git commit -m "feat: ajout de ma fonctionnalité"

# Optionnel : Récupère les nouveautés des autres
git pull origin dev
```

#### C. Terminer et Envoyer au Robot
```bash
# 1. Envoie ta branche sur GitHub
git push origin feat/ma-nouvelle-idee

# 2. Ouvre la Pull Request sur GitHub (vers dev)
# 3. Attends le CHECK VERT du robot ✅

# 4. Une fois fusionné (Merge), on nettoie tout
git checkout dev
git pull origin dev
git branch -d feat/ma-nouvelle-idee
```

**Préfixes recommandés :** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

---

## 🔒 Security Patterns (Copy-Paste)

### 1. Server Actions (Standard)
```typescript
const ctx = await getUserContext(guildId);
if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };
if (!ctx.isMember) return { success: false, error: "Not a member" };

// Admin action?
if (!ctx.isAdmin) return { success: false, error: "Admin required" };
```

### 2. API Routes (Strict)
```typescript
import { getUserContext } from "@/server/actions/user-actions";

const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const user = await getUserContext(guildId);
if (!user.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### 3. Database Isolation (Multi-tenant)
```typescript
// ALWAY scope requests by guildId
await db.entity.findMany({
    where: { 
        guildId: guildConfig.id, // 👈 MANDATORY
        ...otherFilters 
    }
});
```

### 4. GOD Dashboard (Super-Admin)
```typescript
import { isSuperAdmin } from "@/server/actions/super-admin-actions";

const isAdmin = await isSuperAdmin();
if (!isAdmin) return { success: false, error: "Unauthorized" };

// Proceed with lifecycle action
await db.guildConfig.delete({ where: { id: guildId } });
```

---

## 🚫 Forbidden Patterns

```typescript
// ❌ NEVER DO THIS
dangerouslySetInnerHTML  // Use sanitizeHtml() first
eval()
$queryRaw()              // Use Prisma type-safe queries
process.env.SECRET in client component
fetch without try/catch

// ❌ DEPRECATED (use logger instead)
console.log('info message')          // → logger.info('info message', { context })
console.log('debug', { data })       // → logger.debug('debug', { data })

// ⚠️ LEGACY (prefer logger for better tracking)
console.warn('warning')              // → logger.warn('warning', { context })
console.error('error')               // → logger.error('error', { context })
```

---

## 🚀 Deployment Workflow (VPS)

### 1. The Deployment Script
Utilise toujours `./scripts/deploy.sh [beta|prod]` depuis la racine du projet sur le VPS.
- **Beta** : Déploie la branche `dev` sur `beta.sigilos.fr`.
- **Prod** : Déploie la branche `main` sur `sigilos.fr`.

### 2. Monitoring
Accède à la tour de contrôle sur `monitor.sigilos.fr`. 
- Authentification via GitHub uniquement.
- Ne jamais désactiver le 2FA GitHub.

### 3. Maintenance Quotidienne
Le script `maintenance.sh` tourne chaque nuit à 4h00 pour purger les caches Docker et logs. Ne pas le supprimer du Crontab.

---

## 📖 Règle de Documentation — OBLIGATOIRE

> **Toute modification d'un module existant ou création d'un nouveau module implique une mise à jour (ou création) de sa documentation officielle dans `prisma/seed-docs.ts`.**

### Déclencheurs obligatoires

| Événement | Action requise |
|-----------|----------------|
| **Nouveau module créé** (`/admin/xxx`, `/dashboard/xxx`) | Créer un doc `slug: 'nom-du-module'` dans `seed-docs.ts` avec contenu HTML riche |
| **Module existant modifié en profondeur** | Mettre à jour le contenu du doc correspondant |
| **Nouveau champ Prisma ou nouvelle Server Action** | Documenter le nouveau comportement dans la doc du module concerné |
| **Nouvelle permission RBAC ajoutée dans `permissions.ts`** | L'ajouter dans la doc `admin-permissions` (toutes les permissions doivent être documentées) |
| **Nouveau module ajouté à la sidebar** (`app-sidebar.tsx`) | Lui associer un bouton `<ModuleHelpActions docSlug="..." />` |

### Standard de Rédaction (Anti-AI-Slop)

```typescript
// ✅ OBLIGATOIRE : HTML sémantique, contenu concret et spécifique
content: `
<h2>Titre Clair et Fonctionnel</h2>
<p>Explication pratique de ce que fait ce module, sans jargon inutile.</p>
<div class="callout callout-tip">
<strong>💡 Astuce clé</strong>
Conseil pratique basé sur l'usage réel de la fonctionnalité.
</div>
<h3>Processus / Étapes</h3>
<ol>
  <li><strong>Étape 1 :</strong> Description concrète et sans ambiguïté.</li>
</ol>
`
// ❌ INTERDIT : Markdown brut (non parsé), texte générique vide de sens,
//              noms de rôles Discord en dur (@Membre, @Officier),
//              chiffres ou exemples spécifiques à une guilde.
```

### Après chaque mise à jour de `seed-docs.ts`

```bash
# TOUJOURS exécuter pour synchroniser la DB locale
npm run seed:docs

# Le VPS est mis à jour automatiquement via scripts/deploy.sh (npm run seed:docs inclus)
```

---

## 📚 References

- [CONTEXT.md](./CONTEXT.md) - Full project context
- [SECURITY.md](./SECURITY.md) - Security policy
- [DEVELOPPEMENT.md](./DEVELOPPEMENT.md) - Mise en route locale (prérequis, env, commandes)

## 🌐 Convention Proxy (Next 16) — Non-Négociable

Sur Next 16, le proxy de routage doit être **`src/proxy.ts`** (pas `src/middleware.ts`). La convention `middleware.ts` force le runtime Edge qui **inline `process.env.*` au build** → en prod les variables d'env du serveur (ex: `GOD_ROUTE`, `AUTH_SECRET`) sont invisibles au runtime. `proxy.ts` tourne toujours en Node.js et lit `process.env` au runtime.

```bash
# ❌ INTERDIT : src/middleware.ts (Edge runtime, env inlinés au build)
# ✅ OBLIGATOIRE : src/proxy.ts (Node runtime, process.env lu au runtime)
```

---

## ⏱️ Rate Limiting

| Rule | Implementation |
|------|----------------|
| **Server Actions publiques** | Limiter les appels par `userId` + `guildId` (ex: 1 requête / 500ms) |
| **Actions d'écriture (mutations)** | Rate limit plus strict que les lectures (ex: 10 mutations/min par user) |
| **Endpoints exposés aux membres** | Toujours throttle avant d'atteindre la DB, jamais après |
| **Stockage des compteurs** | Utiliser un store léger (Redis/Upstash ou table `RateLimit` en DB) — pas de variable en mémoire process (perdue au redeploy) |
| **Réponse en cas de dépassement** | Retourner `429` avec un message clair, jamais un crash silencieux |

### Pattern recommandé (Server Action)

```typescript
import { checkRateLimit } from "@/lib/rate-limit";

const allowed = await checkRateLimit(userId, "quest:toggle", { max: 10, windowMs: 60_000 });
if (!allowed) {
  return { success: false, error: "Trop de requêtes, réessaie dans quelques secondes" };
}
```

### Cas d'usage prioritaires dans SigilOS

- **Module Rush Sylvestre** : cochage/décochage de quêtes par un membre (évite le spam de clics qui surcharge la sync temps réel de `GuildStatusPanel`)
- **Discord Bot Actions** : toute action déclenchée depuis Discord doit être throttle côté serveur, pas seulement côté bot
- **GOD Dashboard** : rate limit strict sur les actions super-admin, même si rares, pour tracer toute anomalie de comportement