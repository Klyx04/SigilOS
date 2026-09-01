import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Award } from "lucide-react";
import { GodBadgesPanel } from "./_components/god-badges-panel";
import { getBadgesCatalogAction } from "@/server/actions/badge-actions";

export default async function GodBadgesPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    const isGod = await isSuperAdmin();
    if (!isGod) redirect("/dashboard");

    const res = await getBadgesCatalogAction();
    const badges = res.success ? res.data || [] : [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="GOD · Studio Badges & Succès (#198.2)"
                description="Création et personnalisation des badges de plateforme, succès et trophées de communauté."
                icon={Award}
                iconColor="#f59e0b"
                backHref="/god"
            />

            <GodBadgesPanel initialBadges={badges} />
        </div>
    );
}
