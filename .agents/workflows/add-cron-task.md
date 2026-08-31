---
description: Procédure complète pour ajouter, sécuriser et brancher une nouvelle tâche CRON dans SigilOS
---

# ⏱️ Workflow : Ajouter une tâche CRON dans SigilOS

Ce guide détaille la procédure standardisée pour créer une nouvelle tâche CRON HTTP ou système avec enregistrement de télémétrie en temps réel dans le panel **GOD** (`/god?tab=cron-status`).

---

## 1. 📝 Déclarer la tâche dans la télémétrie (`src/lib/cron-telemetry.ts`)

Ajouter l'identifiant et les métadonnées dans le dictionnaire `KNOWN_CRON_TASKS` :

```typescript
// src/lib/cron-telemetry.ts
export const KNOWN_CRON_TASKS: Record<string, { name: string; schedule: string; logFile?: string }> = {
    // ... existants ...
    ma_nouvelle_tache: {
        name: "Synchronisation X",
        schedule: "Quotidien 04h30", // ou "Toutes les heures", "Hebdomadaire", etc.
    },
};
```

---

## 2. 🔒 Créer la Route API (`src/app/api/cron/<nom>/route.ts`)

Chaque endpoint de cron DOIT :
1. Être protégé par `verifyCronSecret(req)` (fail-closed, `x-cron-secret`).
2. Mesurer le temps d'exécution (`startedAt = Date.now()`).
3. Enregistrer son résultat via `recordCronExecution(cronId, { success, durationMs, summary, details })`.

### Exemple de template standard :

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    // 1. 🔒 Sécurité fail-closed
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        logger.info("[MonCron] Démarrage du traitement...");

        // 2. ⚙️ Logique métier
        const result = await maFonctionMetier();
        const durationMs = Date.now() - startedAt;

        // 3. 📡 Enregistrement Télémétrie (Succès)
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("ma_nouvelle_tache", {
            success: true,
            durationMs,
            summary: `Traitement réussi : ${result.processedCount} éléments synchronisés`,
            details: result,
        });

        return NextResponse.json({ success: true, durationMs, ...result });

    } catch (error: any) {
        logger.error("[MonCron] Erreur fatale :", error);

        // 4. 📡 Enregistrement Télémétrie (Échec)
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("ma_nouvelle_tache", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur : ${error.message || "Erreur interne"}`,
        });

        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
```

---

## 3. 🖥️ Configuration VPS (Crontab)

Ajouter la ligne dans le crontab du VPS (`crontab -e`) :

```bash
# Exemple : Tous les jours à 04h30
30 4 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://sigilos.fr/api/cron/ma-nouvelle-tache > /dev/null 2>&1
```

> 💡 **Astuce** : Le crontab du VPS dispose déjà de la variable `CRON_SECRET` définie en en-tête.

---

## 4. 🧪 Vérifications & Tests

1. **Test unitaire** : Vérifier que le helper enregistre correctement l'état :
   ```bash
   npx vitest run tests/unit/cron-telemetry.test.ts
   ```
2. **Test d'appel local** :
   ```bash
   curl -H "x-cron-secret: TON_SECRET_LOCAL" http://localhost:3000/api/cron/ma-nouvelle-tache
   ```
3. **Vérification UI** :
   Rendez-vous sur `/god?tab=cron-status` pour voir la nouvelle tâche apparaître avec son badge, sa durée et son résumé en direct.
