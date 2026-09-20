---
description: How to add Discord button/modal interactions for a new SigilOS module
---

# Adding Discord Interactions to a New Module

When adding a new module that has **Discord embed buttons** (join, leave, vote, etc.), follow this checklist to ensure consistency, security, and maintainability.

## Architecture Overview

```
Discord User clicks button
        ↓
POST /api/discord/interactions (route.ts)
        ↓
1. Signature verification
2. Rate limiting
3. Account lookup (findUserByDiscordId)
4. RBAC Permission Gate (DISCORD_PERM_MAP)  ← centralized
5. Module-specific logic (prefix branching)
        ↓
Ephemeral response to Discord
```

## Step-by-Step Checklist

### 1. Define Permission (if needed)

**File:** `src/lib/permissions.ts`

```typescript
// In PERMISSIONS object:
NEW_MODULE_VIEW: "new_module:view",

// In PERMISSION_DETAILS:
[PERMISSIONS.NEW_MODULE_VIEW]: {
    label: "Nom du Module",
    description: "Accès au module X.",
    module: "tools" // or appropriate module category
},
```

> **Module categories:** admin, missions, profile, songes, features, tools, info, calendar
> Add a new category in `PERMISSION_MODULES` only if the module is large enough to warrant its own section in the admin RBAC page.

### 2. Register in RBAC Gate

**File:** `src/app/api/discord/interactions/route.ts`

Add an entry to `DISCORD_PERM_MAP` (around line ~115):

```typescript
const DISCORD_PERM_MAP: Record<string, string> = {
    calendar: PERMISSIONS.CALENDAR_VIEW,
    songes:   PERMISSIONS.SONGES_JOIN,
    dj:       PERMISSIONS.FINDER_VIEW,
    poll:     PERMISSIONS.POLLS_VIEW,
    new_mod:  PERMISSIONS.NEW_MODULE_VIEW,  // ← add here
};
```

This **automatically** enforces RBAC for all buttons with `custom_id` starting with `new_mod:*`.

### 3. Build the Embed with Buttons

**File:** Your module's service or actions file (e.g., `src/server/actions/new-module-actions.ts`)

```typescript
// Use sendChannelMessage from @/server/discord
const components = [{
    type: 1, // Action Row
    components: [
        {
            type: 2, style: 1,
            label: "S'inscrire",
            emoji: { name: "✅" },
            custom_id: `new_mod:join:${entityId}`,   // prefix:action:id
        },
        {
            type: 2, style: 4,
            label: "Se désinscrire",
            emoji: { name: "🚪" },
            custom_id: `new_mod:leave:${entityId}`,
        },
    ]
}];
```

**Rules for `custom_id`:**
- Format: `prefix:action:entityId`
- `prefix` MUST match the key in `DISCORD_PERM_MAP`
- `entityId` should be the DB record's CUID
- Max 100 characters

### 4. Handle the Interaction

**File:** `src/app/api/discord/interactions/route.ts`

Add a new `else if` branch in the type 3 (button click) handler:

```typescript
} else if (prefix === "new_mod") {
    if (action === "join") {
        const { internalJoinNewMod } = await import("@/server/actions/new-module-actions");
        result = await internalJoinNewMod(entityId, account.userId);

        if (result?.success) {
            return NextResponse.json({
                type: 4,
                data: { content: "✅ Tu as rejoint avec succès !", flags: 64 },
            });
        }
    } else if (action === "leave") {
        // ...
    }
}
```

### 5. Create Internal Variants (no session)

Discord interactions bypass NextAuth sessions. Create `internal*` functions that:
- Accept `userId` and/or `profileId` directly (no `getUserContext`)
- Still validate DB state (post exists, not already joined, etc.)
- Use **correct Prisma relation names** (check `schema.prisma`!)

```typescript
// ⚠️ Common bug: using the TYPE name instead of the FIELD name
// WRONG: include: { guildConfig: { ... } }
// RIGHT: include: { guild: { ... } }  ← match the field name in schema
```

### 6. Suppress URL Previews

If your notification messages contain URLs, add `{ suppressEmbeds: true }`:

```typescript
await sendChannelMessage(channelId, `Message with [link](${url})`, {
    suppressEmbeds: true,  // prevents Discord unfurl preview (big logo)
});
```

### 7. Handle Modals (if needed)

If user input is required (like Songes candidature), use Discord Modals:

1. **Button click** → Return `type: 9` (Modal response)
2. **Modal submit** → Handle in `payload.type === 5` section
3. **Add RBAC check** in the modal submit handler too (same pattern)

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Wrong Prisma relation name | Always check `schema.prisma` field name, not model name |
| Missing RBAC on modals | Modal submits (type 5) need their own RBAC check |
| URL preview pollution | Use `{ suppressEmbeds: true }` for plain messages with URLs |
| `guild_id` vs `guildId` | Discord payload `guild_id` = snowflake. DB `guildId` = internal CUID. Never mix. |
| No permission mapping = locked out | Owners + Discord admins always bypass RBAC. Regular members need role mapping in admin page. |
| `type: 6` (ACK muet) en réponse à un bouton | Un défer non résolu côté client : aucune confirmation (« bien inscrit »), bulle « Le message n'a pas pu être chargé ». Répondre en `type: 4` éphémère (`ephemeralDiscordMessage`), ou `type: 6` **suivi** d'un `editInteractionMessage` (pattern tickets). |
| Embed rafraîchi en tâche de fond (`.catch()`) | Compteur/pseudos périmés si le PATCH échoue ou est coupé. **Attendre** le PATCH avant de répondre, avec un plafond (< 3 s : `refreshEmbedWithinDeadline` du service calendrier) pour ne jamais expirer l'interaction. |
| Fenêtre anti-spam partagée entre deux actions | Clé `userId:eventId` ⇒ « S'inscrire » puis « Se désinscrire » se bloquent mutuellement. Clé **par action**, armée seulement quand l'action a réellement changé l'état. |
| ID `outbox:<jobId>` stocké comme `discordMessageId` | Avec `DISCORD_OUTBOX_ENABLED=true` (bêta), `sendChannelMessage` renvoie `outbox:<jobId>` (écriture **en file**), pas un ID Discord : tout `PATCH /channels/{salon}/messages/outbox:…` finit en **404** et l'embed reste **figé** (constat raids du 19/09/2026, déjà vécu sur le Marché et le status Discord). Toujours : valider avec `isDiscordSnowflake` (`src/lib/discord-ids.ts`), passer `storeMessageIdKey` à l'enqueue, et **résoudre** l'ID (Redis) avant d'éditer. |
| Bouton d'inscription qui n'enregistre pas ce que le menu demande | « S'inscrire » sans classe puis « choisir sa classe » après coup = roster « Sans classe » illisible. Un bouton d'inscription ouvre une **modale** (classe + message) traitée en `type 5` (`prefix:apply:<id>`) : une seule écriture, un seul message de confirmation. |

## Testing

1. Create a post/entity from the web dashboard
2. Check the Discord channel for the embed with buttons
3. Click buttons as a non-admin user to verify RBAC
4. Click buttons as an admin to verify bypass
5. Verify ephemeral error messages are clear and helpful
