# 📋 SigilOS Development Rules

> Quick reference for all development standards. See `.antigravity` for full context.

---

## 🔒 Security (Non-Negotiable)

| Rule | Implementation |
|------|----------------|
| **Auth on every action** | `await auth()` or `getUserContext(guildId)` at start |
| **Guild isolation** | All DB queries MUST filter by `guildId` |
| **Admin check for mutations** | `if (!user.isAdmin) return 403` |
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

- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] All new actions have auth checks
- [ ] Sensitive routes have permission guards
- [ ] No `console.log` in production code (use `console.error` for errors only)

---

## 🌿 Git Workflow

### 1. Branching Strategy
| Branch | Role | Rules |
|--------|------|-------|
| `main` | Production | 🔴 **Protected**. No direct commits. Deployable code only. |
| `dev` | Staging / Integration | 🟠 **Protected**. Integration branch. PRs land here. |
| `feat/*` | New Features | Source: `dev`. Example: `feat/mission-board` |
| `fix/*` | Bug Fixes | Source: `dev` (or `main` for hotfix). Example: `fix/upload-error` |

### 2. Workflow Lifecycle

#### A. Start a new task
```bash
# 1. Update dev
git checkout dev
git pull origin dev

# 2. Create branch
git checkout -b feat/my-new-feature
```

#### B. During development
```bash
# Commit often (atomic commits)
git add .
git commit -m "feat: add mission card component"

# Keep updated with dev (crucial!)
git pull origin dev
```

#### C. Finish & Merge
```bash
# 1. Push your branch
git push origin feat/my-new-feature

# 2. Open Pull Request (PR) on GitHub
# Target: dev
# Reviewers: Yourself (or team)

# 3. After merge, clean up
git checkout dev
git pull origin dev
git branch -d feat/my-new-feature
```

**Prefixes:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

---

## � Security Patterns (Copy-Paste)

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

## 📚 References

- [.antigravity](file:///a:/SigilOS/.antigravity) - Full project context
- [SECURITY.md](file:///a:/SigilOS/SECURITY.md) - Security policy
- [WORKFLOW.md](file:///a:/SigilOS/WORKFLOW.md) - Git workflow details
