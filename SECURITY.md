# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| dev     | :white_check_mark: |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in SigilOS, please report it responsibly:

1. **DO NOT** open a public issue
2. Contact the maintainer directly via Discord
3. Provide as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Measures

### Application Layer
- ✅ OWASP Top 10:2026 compliance
- ✅ Auth.js with Discord OAuth (httpOnly cookies, CSRF protection)
- ✅ Guild-level permission isolation (RBAC)
- ✅ **GOD Dashboard**: Super-admin verification on all lifecycle actions
- ✅ Input validation with Zod
- ✅ Prisma ORM (SQL injection prevention)
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ **XSS Prevention**: HTML sanitization on all user-generated content
- ✅ **CSRF Protection**: SameSite cookies + Next.js origin verification

### CSRF (Cross-Site Request Forgery) Protection

SigilOS utilizes multiple layers of CSRF protection:

#### 1. SameSite Cookies (Primary Defense)
All authentication cookies use `SameSite=Lax` (configured in [auth.config.ts](file:///a:/SigilOS/src/auth.config.ts)):
- Blocks cross-site requests from external domains
- Cookies only sent with same-site navigation or top-level GET requests
- Production cookies use `__Secure-*` prefix with `httpOnly` and `secure` flags

#### 2. Next.js Server Actions Origin Verification
Next.js 14+ Server Actions automatically verify the `Origin` header matches the request origin:
- Rejects requests from external domains
- No CSRF tokens needed for Server Actions
- Additional protection layer beyond SameSite

#### 3. Security Headers
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-Content-Type-Options: nosniff` - Prevents MIME-sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Limits referrer leakage

**Limitations:**
- Legacy browsers (IE11, pre-2016 Safari) do not support SameSite
- **Recommendation**: Block unsupported browsers via middleware (99%+ browser support as of 2026)

**Testing:**
```bash
# Attempt cross-origin Server Action call (should fail)
curl -X POST https://sigilos.fr/api/... \
  -H "Origin: https://evil.com" \
  -H "Cookie: session=..." \
  -d '{"action":"updateDofusServer"}'
# Expected: 403 Forbidden
```

### XSS (Cross-Site Scripting) Prevention

All user-generated HTML content is sanitized before rendering:

#### HTML Sanitization
- **Library**: Custom `sanitizeHtml()` function ([security.ts](file:///a:/SigilOS/src/lib/security.ts))
- **Removes**: `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers (`on*`), `javascript:` protocols
- **Applied**: Documentation content, guild presentations, user bios

#### Content Security Policy (Recommended)
While not currently enforced, implementing CSP headers would provide additional XSS protection:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

### GOD Dashboard Security (Super-Admin Actions)
- ✅ All lifecycle actions (`reactivateGuild`, `hardDeleteGuild`, etc.) verify `isSuperAdmin()`
- ✅ Hard delete confirmation modals before destructive operations
- ✅ Guild isolation respected (actions scoped by `guildId`)
- ✅ Server actions only, no client-side data manipulation
- ✅ Audit trail ready (awaiting Audit Log implementation)

### Infrastructure Layer (VPS)
- ✅ **SSH Hardening** : Port 2222, Password Auth Disabled, Root login Disabled.
- ✅ **Beta Gate** : Environnement Bêta protégé par un mur de mot de passe indépendant.
- ✅ **Monitoring Security** : Grafana protégé par GitHub OAuth + Basic Auth.
- ✅ **Database Isolation** : BDD Bêta et Prod totalement isolées.
- ✅ **Automated Defense** : Fail2Ban surveillant les tentatives d'intrusion SSH.
- ✅ **CI/CD Audits** : GitHub Actions vérifiant chaque commit (Lint, Build, Audit).

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix deployed:** Depends on severity (critical: ASAP, high: 1 week, medium: 2 weeks)
