# Active Context — SigilOS

## Focus actuel
Session 24/08/2026 : Chantiers #234 à #238+ (Isolation SuperAdmin/God, Vitrine lecture seule, RBAC Notifications, Synchro Embeds & Copie unitaire pseudos, Module Services complet avec ServiceRequest, Feedbacks/Livre d'or, Modération Admin et Synchro Discord bidirectionnelle).

## Branche de travail
`feat/chantier-2026-08-24-god-isolation-missions-notifs`

## Fichiers clés modifiés
- `prisma/schema.prisma` : Modèles `ServiceFeedback` et `ServiceRequest` + enums.
- `prisma/migrations/20260824120000_add_service_feedback/migration.sql`
- `prisma/migrations/20260824140000_add_service_request/migration.sql`
- `src/server/actions/user-actions.ts` : Isolation SuperAdmin / statut `isMember: false` si non-membre Discord.
- `src/server/actions/notification-actions.ts` : Filtrage RBAC des notifications visibles.
- `src/server/actions/service-actions.ts` : Persistance `ServiceRequest`, clôture, modération, récupération des demandes.
- `src/server/actions/service-feedback-actions.ts` : Soumission avis, livre d'or, classements de satisfaction, modération.
- `src/app/api/discord/interactions/route.ts` : Handlers boutons Discord `svc:reply` et `svc:close`.
- `src/app/dashboard/[guildId]/services/page.tsx` & composants (`passages-client.tsx`, `service-requests-view.tsx`, `feedbacks-view.tsx`, `feedback-modal.tsx`, `service-card.tsx`).
- `src/app/dashboard/[guildId]/missions/page.tsx` & `src/components/profile/profile-bento-grid.tsx` : Corrections mode vitrine / God.

**État des chantiers (Session 24/08/2026) :**
  - ✅ **Chantier #234 :** Isolation Multi-tenant SuperAdmin (God) `isMember: false`.
  - ✅ **Chantier #235 :** Mode lecture seule / Vitrine God (masquage validation & OCR si inactif).
  - ✅ **Chantier #236 :** RBAC strict sur les notifications Dashboard.
  - ✅ **Chantier #237 :** Synchro Embeds Discord (Songes/Calendrier/Sondages) & Copie unitaire des pseudos.
  - ✅ **Chantiers #238 & #238+ :** Système complet de Feedback, ServiceRequest, Clôture passeur (Web + bouton Discord `svc:close`), Livre d'or, Modération Admin, auto-ouverture d'avis et synchro Discord.
  - ✅ **Refonte UI/UX Anti-AI-slop :** Suppression de la bannière doublon, barre d'onglets unifiée, barres de filtres compactes et stables (suppression des scroll jumps).
  - ✅ **Tour Guide Services 100% fonctionnel :** Découpage précis des cibles (Header -> Tabs unifiés -> CTA Publier -> Grille Marketplace -> Sidebar) sans imbrication ni auto-skip.
  - ✅ **Chantier #239 :** Auto-clôture calendrier temps réel (`isCompleted` dynamique + auto-clôture backend `COMPLETED`).
  - ✅ **Chantier #240 :** Suppression intégrale du Hub Raid (bouton, modale et server action — 0 code mort).

- **Vérifications :**
  - `npx tsc --noEmit` : **0 erreur**.
  - `npm run test:run` : **328/328 tests passés** (33 fichiers).
  - `npm run build` : **Build Next.js de production réussi**.
- Migrations locales appliquées (`npx prisma migrate deploy`).
