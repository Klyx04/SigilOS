# 🛡️ Plan de Hardening & Sécurité (Mise à jour après audit 2026)

> **Note :** ce fichier suit l'évolution du durcissement. Le log initial (février 2026) est conservé, puis complété par l'audit de sécurité 2026 (OWASP/ASVS).

---

## ✅ Fait (première phase — février 2026)

### 1. Redis
- [x] `docker-compose.prod.yml` : `--requirepass ${REDIS_PASSWORD}` activé
- [x] `src/lib/redis.ts` : gère l'authentification

### 2. Postgres
- [x] Sauvegardes chiffrées (GPG) vers Cloudflare R2
- [ ] Chiffrement SSL interne BDD (à renforcer si besoin)

### 3. Application
- [ ] Chiffrement des tokens OAuth au repos — **partiellement fait** (voir chantiers ouverts)

---

## ✅ Corrigé lors de l'audit 2026 (session juillet/août)

> Réf. complète en local (hors git) : `AUDIT_SECURITE_SIGILOS.md`

| Domaine | Correctif |
|---------|-----------|
| **Secret HMAC stockage** | `signStorageUrl` fail-closed (plus de secret en dur) |
| **SSRF proxy-image** | Whitelist de domaines exacte + blocage IP internes/protocoles |
| **Path traversal storage** | check `startsWith(storageRoot)` → check séparateur exact |
| **Fail-open RBAC Discord** | `memberFetchFailed` ne fait plus fail-open sans profil ACTIVE |
| **Rate-limit** | validation format IP + plafond mémoire (`MAX_IP_COUNTER_ENTRIES`) |
| **Bot Discord** | `DATABASE_URL` propre + intent `GuildMessageTyping` retiré |
| **Cloudflare Workers** | fail-closed si `WORKER_SECRET` absent + comparaison temps constant + erreurs neutres |
| **CI/CD** | `AUTH_SECRET` plus injecté sur les PR + Trivy épinglé |
| **Ladder sync** | valeurs `totalXp`/`classe`/`level` bornées |

---

## 🚧 Chantiers ouverts (à traiter — priorité du plus critique au moins)

1. **Authentification WebSocket (Socket.IO)** — le canal temps réel n'a aucune vérification d'identité / appartenance guilde. Vecteur : `guildId` arbitraire dans le handshake. **Priorité 1.**
2. **Chiffrement des tokens OAuth (Discord)** — `prisma.account.updateMany()` n'applique pas les hooks de chiffrement → tokens potentiellement en clair.
3. **SSRF dans `image-downloader.ts`** (outil God) — accepter `http://169.254.169.254`, IP internes.
4. **Durée du JWT** — 7 jours actuellement → cible 8h (NIST SP 800-63B).
5. **CSP nonce-based** — `script-src 'unsafe-inline'` à remplacer par nonce.
6. **Clé de chiffrement de secours** (`encryption.ts`) — fallback dev en dur à supprimer.
7. **Cache permissions 60s** — réduire la fenêtre de révocation.
8. **Grafana** — vérifier que `GRAFANA_PASSWORD` est défini (sinon admin par défaut).
9. **Caddy** — ajouter un rate-limit au niveau proxy.

---

## 📌 Règles à respecter pour tout futur code (voir RULES.md)

- **Fail-closed** : jamais accorder l'accès si une vérification échoue.
- **Pas de secret/fallback en dur** dans le code.
- **Comparaison de secrets en temps constant**.
- **Bornes validation** sur toute donnée issue d'une API externe.
- **Vérifier l'appartenance guilde** avant toute écriture multi-tenant.

---

*-- Plan de hardening maintenu après l'audit 2026 (refresh du log initial). --*