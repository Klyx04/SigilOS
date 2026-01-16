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

This project implements:

- ✅ OWASP Top 10:2025 compliance
- ✅ Auth.js with Discord OAuth (httpOnly cookies, CSRF protection)
- ✅ Guild-level permission isolation (RBAC)
- ✅ Input validation with Zod
- ✅ Prisma ORM (SQL injection prevention)
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ Automated dependency scanning (Dependabot)
- ✅ CI security audits (GitHub Actions)

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix deployed:** Depends on severity (critical: ASAP, high: 1 week, medium: 2 weeks)
