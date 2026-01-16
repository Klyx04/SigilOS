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

## 🚫 Forbidden Patterns

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
