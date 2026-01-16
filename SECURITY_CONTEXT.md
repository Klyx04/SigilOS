# 🔐 Security Context - SigilOS

> **Fichier à mentionner dans les futurs prompts pour maintenir la cohérence sécurité.**

---

## État de la Sécurité (2026-01-16)

✅ **Audit OWASP Top 10:2025 complété**
✅ **Automatisation CI/CD active**
✅ **Documentation à jour**

---

## Règles Obligatoires pour Nouveaux Modules

### 1. Server Actions

```typescript
// TOUJOURS commencer par:
const ctx = await getUserContext(guildId);
if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };
if (!ctx.isMember) return { success: false, error: "Not a member" };

// Pour actions admin:
if (!ctx.isAdmin) return { success: false, error: "Admin required" };
```

### 2. API Routes

```typescript
// Pattern obligatoire:
import { getUserContext } from "@/server/actions/user-actions";

const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const user = await getUserContext(guildId);
if (!user.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### 3. Prisma Queries

```typescript
// TOUJOURS filtrer par guildId:
await db.entity.findMany({
    where: { guildId: guildConfig.id }  // OBLIGATOIRE
});
```

### 4. Input Validation

```typescript
// Zod sur TOUTES les entrées utilisateur:
const schema = z.object({
    field: z.string().min(1).max(100)
});
const validated = schema.safeParse(data);
if (!validated.success) return { success: false, error: "Invalid data" };
```

---

## Fichiers de Sécurité

| Fichier | Rôle |
|---------|------|
| `.github/dependabot.yml` | Scans npm hebdomadaires |
| `.github/workflows/security-audit.yml` | CI `npm audit` |
| `next.config.ts` | Security headers |
| `SECURITY.md` | Politique de disclosure |
| `RULES.md` | Quick reference dev |

---

## Headers de Sécurité Actifs

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Checklist Avant Merge

- [ ] Toutes les actions ont `getUserContext(guildId)`
- [ ] Input validation Zod sur nouvelles entrées
- [ ] Prisma queries filtrées par `guildId`
- [ ] `npm run build` passe
- [ ] Pas de `console.log` (seulement `console.error`)
