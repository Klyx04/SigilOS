"use server";

import { db } from "@/lib/prisma";

/**
 * 📖 Lecture **publique** du singleton `PlatformConfig`.
 *
 * Appelée par les coques hors God (dashboard de guilde, docs, landing) pour lire
 * des drapeaux **non sensibles** (`donationsEnabled`, `maintenanceMode`,
 * `autoOnboardingEnabled`…). Aucune garde d'accès : la config ne contient que des
 * drapeaux d'affichage publics, et un échec BDD est **géré par l'appelant**
 * (`success: false` ⇒ valeur par défaut côté appelant).
 *
 * ⚠️ Ne pas confondre avec `getPlatformConfig()` de `god-mini-games-actions.ts`,
 * qui est **God-only** (jette « Unauthorized » pour tout autre appelant) et sert
 * les onglets God.
 *
 * Historique : ce lecteur vivait dans `god-roadmap-actions.ts`, supprimé avec la
 * Roadmap Pro (chantier « purge des onglets morts du God », 28/09/2026).
 */
export async function getPlatformConfig() {
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" }
        });
        return { success: true, data: config };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
