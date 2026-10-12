/**
 * ⚠️ ROUTE DÉSACTIVÉE EN PRODUCTION
 *
 * Le seed de données doit être exécuté via le script CLI :
 *   npm run seed:game-data
 *
 * Cette route ne répond plus qu'un 410 Gone pour ne pas exposer de surface d'attaque.
 * Si tu as besoin de re-seeder, connecte-toi en SSH au VPS et lance le script manuellement.
 */
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { NextResponse } from "next/server";

export async function GET() {
    // Guard super-admin — double protection si la route est appelée par erreur
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return new Response("Unauthorized — Cette route est réservée au super-admin.", { status: 401 });
    }

    // Même pour le super-admin, on refuse en production
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            {
                error: "Cette route est désactivée en production.",
                hint: "Utilise le script CLI : npm run seed:game-data",
            },
            { status: 410 } // 410 Gone = ressource intentionnellement supprimée
        );
    }

    // En développement local uniquement, on autorise le seed
    const { seedDofusData } = await import("@/server/actions/dofus-quest-actions");
    const res = await seedDofusData("GOD");
    return NextResponse.json(res);
}
