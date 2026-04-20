# SigilOS Security Maintenance Handbook (2026)

This document outlines the protocols for maintaining the "Fortress" security posture implemented in April 2026.

## 🔐 Secret Rotation Policy

To mitigate the impact of a potential leak, secrets should be rotated annually or immediately upon suspicion of compromise.

| Secret | Location | Impact of Leak | Rotation Frequency |
|--------|----------|----------------|-------------------|
| `NEXTAUTH_SECRET` | `.env` | Session forgery (Critical) | 12 months |
| `CRON_SECRET` | `.env` / VPS | Unauthorized cron trigger | 6 months |
| `DISCORD_CLIENT_SECRET` | Discord Dev Portal | Account takeover risk | 12 months |
| `DATABASE_URL` | `.env` / VPS | Data breach (Critical) | On infra change |

## 🛡️ Content-Security-Policy (CSP) Management

SigilOS uses a **Nonce-based CSP**. 

### Adding a New Script
If you need to add a script (inline or external), you **MUST** pass the `nonce`:

```tsx
// Server Component Example
import { headers } from 'next/headers';

const headersList = await headers();
const nonce = headersList.get('x-nonce') ?? '';

<script nonce={nonce}>...</script>
```

> [!CAUTION]
> Never use `'unsafe-inline'` in the CSP. If a script doesn't support nonces, look for a more modern alternative or use a hash-based exception (not recommended).

## 📝 Logging Standards

### Zero Console Policy
All `console.log`, `console.warn`, and `console.error` calls are forbidden in `src/server`. Use the structured `logger` instead.

```typescript
import { logger } from "@/lib/logger";

// Info with context
logger.info("[Module] Action performed", { userId, meta: "data" });

// Errors with full stack tracing
try { ... } catch (error) {
    logger.error("[Module] Fatal failure", { error });
}
```

## 🌐 WebSocket Rate Limiting

The WebSocket server (Port 3001) is protected by a connection-level rate limit defined in `src/server/websocket/server.ts`.
- **Threshold:** 10 connections / minute / IP.
- **Enforcement:** Redis (fail-closed if Redis is down).

## 🚨 Emergency Response

If a vulnerability is found:
1. Revoke the specific secret (e.g., Change `CRON_SECRET`).
2. Update the VPS environment variables.
3. Restart the PM2/Docker process.
4. Review logs in `logger` for unauthorized access patterns.
