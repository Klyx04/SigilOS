# 🛡️ Mission : Hardening & Security Deep-Dive (Février 2026)

L'infrastructure est en place, mais l'analyse du schéma (`schema.prisma`) révèle des données sensibles (OAuth Tokens, API Keys, Heatmaps). Demain, nous renforçons le blindage interne.

---

## 🛠️ Objectifs de la session
1. **Redis Security** : Activer l'authentification (`requirepass`) pour le service Redis.
2. **Database Hardening** : Restreindre les privilèges de l'utilisateur Docker Postgres.
3. **Application Secrets** : Préparer l'implémentation du chiffrement au repos pour les champs sensibles (`metamobApiKey`, `refresh_token`) via `pgcrypto` ou une lib de cryptage applicative.
4. **OCR Tuning** : Finaliser le worker avec une gestion d'erreurs "fail-safe" pour ne jamais saturer la RAM du VPS.

---

## 🚀 Plan d'attaque (Branche : `feat/security-hardening`)

### 1. Redis
- [ ] Modifier `docker-compose.prod.yml` pour inclure `--requirepass ${REDIS_PASSWORD}`.
- [ ] Mettre à jour `src/lib/redis.ts` pour gérer l'authentification.

### 2. Postgres
- [ ] Configurer Postgres pour n'accepter que les connexions chiffrées (SSL interne).
- [ ] Vérifier la politique de sauvegarde (Dump SQL chiffré).

### 3. Application
- [ ] Créer une utility `encryption.ts` pour chiffrer/déchiffrer les tokens avant insertion en BDD.
- [ ] Migration Prisma pour refléter ces changements si nécessaire.

---

**Statut final ce soir :** Infrastructure stable, sécurisée en périphérie, mais à blinder en interne.

*-- Fin du Log de Session (Antigravity AI) --*
