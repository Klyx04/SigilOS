---
paths:
  - "src/server/**"
  - "src/app/api/**"
  - "src/workers/**"
  - "src/lib/**"
---
# Règles serveur / sécurité

- Auth sur **chaque** action : `await auth()` ou `getUserContext(guildId)`.
- **RBAC fail-closed** : la permission est vérifiée dans la **page** ET dans l'**action** ; aucun repli permissif.
- **Isolation de guilde** : tout `WHERE` porte `guildId` **résolu côté serveur** ; vérifier que la cible appartient à la guilde avant écriture.
- **Zod borné** sur toute entrée utilisateur (longueur, plage) et sur les API externes.
- **Fail-closed** : Discord, Redis ou un tiers en échec ⇒ refus, jamais d'accès par défaut.
- **Aucun secret en dur** : `process.env.*` avec échec explicite ; comparaison `timingSafeEqual`.
- **Pas de SQL brut**, pas d'`eval` ; Prisma uniquement.
- `logger`, jamais `console.log` ; rien de sensible dans les logs (token, snowflake, e-mail).
- **Rate limit** sur les mutations (Redis/DB, jamais une variable mémoire) ; réponse `429` propre.
- **Garde d'état dans le `WHERE`** pour les courses (mise à jour conditionnelle).
- `src/proxy.ts`, jamais `src/middleware.ts` (Next 16 / Edge).
- Détail et contre-exemples : `docs/RULES.md` § Security.