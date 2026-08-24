import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles, Package, ShieldAlert, Plus, Trash2 } from "lucide-react";
import { GodIconPacksPanel } from "./_components/god-icon-packs-panel";

export default async function GodReactionRolesPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    const isGod = await isSuperAdmin();
    if (!isGod) redirect("/dashboard");

    const packs = await db.reactionRoleIconPack.findMany({
        orderBy: { createdAt: "desc" },
        include: { guild: { select: { name: true, discordGuildId: true } } }
    });

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="GOD · Packs d'Icônes Reaction Roles"
                description="Distribution globale et gestion des packs d'emojis / icônes certifiés pour toutes les guildes."
                icon={Sparkles}
                iconColor="#f59e0b"
                backHref="/god"
            />

            <GodIconPacksPanel initialPacks={packs} />
        </div>
    );
}
