---
name: route-securite
description: Utiliser pour créer ou relire une page, une server action ou une route API. Vérifie auth, RBAC page et action, isolation guildId, validation Zod bornée, fail-closed, rate limit, logging et absence de secret.
---
# Revue sécurité d'une route

- [ ] `await auth()` ou `getUserContext(guildId)` sur **chaque** action.
- [ ] RBAC fail-closed dans la page **et** dans l'action (`canView...`, `staffOnly...`).
- [ ] `guildId` résolu côté serveur, jamais depuis le client ; cible vérifiée avant écriture.
- [ ] Entrée validée par Zod borné (longueur, plage, enum).
- [ ] Échec Discord/Redis/tiers ⇒ refus, pas d'accès par défaut.
- [ ] Rate limit sur les mutations (Redis/DB) + `429` propre.
- [ ] `logger`, pas `console.log` ; aucun token/snowflake/e-mail.
- [ ] Pas de SQL brut, pas d'`eval`, pas de secret en dur.

Détail : `docs/RULES.md` § Security.