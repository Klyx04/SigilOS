# 📋 SigilOS Development Rules

> Quick reference for all development standards. See `.antigravity` for full context.

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

## 🧪 Before Commit Checklist

- [ ] `npm run build` passes localement
- [ ] No TypeScript errors
- [ ] SIGIL-CI (Robot) s'affiche en vert sur GitHub après le push
- [ ] All new actions have auth checks
- [ ] Sensitive routes have permission guards
- [ ] No `console.log` in production code (use `console.error` for errors only)

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

## �🚫 Forbidden Patterns

```typescript
// ❌ NEVER DO THIS
dangerouslySetInnerHTML
eval()
$queryRaw()
process.env.SECRET in client component
fetch without try/catch
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

## 📚 References

- [.antigravity](./.antigravity) - Full project context
- [SECURITY.md](./SECURITY.md) - Security policy
- [README.md](./README.md) - Project overview
