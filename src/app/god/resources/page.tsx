import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getContentCreators, getResourceCategories } from "@/server/actions/resources-actions";
import { GodResourcesClient } from "./god-resources-client";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";

export const metadata = {
    title: "Ressources & Créateurs Globaux - GOD SigilOS",
};

export default async function GodResourcesPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    // Obtenir une guilde de référence pour le God Hub (ou la première guilde active)
    const referenceGuild = await db.guildConfig.findFirst({
        select: { id: true, discordGuildId: true }
    });

    const targetGuildId = referenceGuild?.discordGuildId || referenceGuild?.id || "global";

    const creators = await getContentCreators(targetGuildId);
    const categories = await getResourceCategories(targetGuildId);

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ressources & Créateurs Globaux</h2>
                    <p className="text-muted-foreground">
                        Hub d'administration centralisé : pilotez les créateurs officiels, les liens et surveillez la validité des URLs sur l'ensemble de la plateforme.
                    </p>
                </div>
            </div>

            <GodResourcesClient
                initialCreators={creators as any}
                initialCategories={categories as any}
                godGuildId={targetGuildId}
            />
        </div>
    );
}
