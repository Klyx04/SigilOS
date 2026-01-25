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

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Develop & commit
git commit -m "feat: description"

# 3. Merge into dev
git checkout dev && git merge feat/my-feature --no-ff

# 4. Delete branch
git branch -d feat/my-feature
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
