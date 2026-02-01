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
- ✅ OWASP Top 10:2025 compliance
- ✅ Auth.js with Discord OAuth (httpOnly cookies, CSRF protection)
- ✅ Guild-level permission isolation (RBAC)
- ✅ Input validation with Zod
- ✅ Prisma ORM (SQL injection prevention)
- ✅ Security headers (X-Frame-Options, CSP, etc.)

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
