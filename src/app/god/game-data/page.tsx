import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";

/**
 * 🔄 Dé-doublonnage des points d'entrée game-data.
 * L'interface Game Data vit de façon canonique dans l'onglet `/god?tab=game-data`
 * (sidebar god : stats réelles via GameDataStatsServer + GameDataInterface + EventZoneManager
 * + cartes d'accès « Avis de Recherche »). Cette page dédiée `/god/game-data` ne produisait
 * qu'un doublon (header + stat-cards factices à « Sync OK » + GameDataInterface montée une
 * 2e fois + EventZoneManager monté une 2e fois). On redirige vers l'onglet canonique.
 *
 * La garde fail-closed du layout (`/god/game-data/layout.tsx`) reste en place : un sous-god
 * n'atteint cette route que s'il possède au moins une brique game-data.
 */
export const metadata = {
    title: "GOD | Game Data",
};

export default async function GameDataPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    if (!(await isSuperAdmin())) {
        if (await canAccessBrick("game-data")) redirect("/god?tab=game-data");
        redirect("/");
    }

    redirect("/god?tab=game-data");
}