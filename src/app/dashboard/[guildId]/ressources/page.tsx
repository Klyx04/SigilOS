import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ComingSoonBanner } from "@/components/coming-soon-banner";
import { Library } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function RessourcesPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewResources) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "resources");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Ressources Communautaires"
                description="Hub centralisé de tout l'écosystème Dofus"
                icon={Library}
                backHref={`/dashboard/${guildId}`}
            />
            <ComingSoonBanner
                title="Hub Ressources Dofus"
                description="Centralisez toutes les ressources communautaires autour de Dofus : sites officiels, guides, builds, actus, tweets et mises à jour en un seul endroit."
                icon={Library}
                accentColor="violet"
                features={[
                    "Agrégation des sites communautaires (DofusDB, DPNL, Dofensive...)",
                    "Flux de news et mises à jour du jeu en temps réel",
                    "Guides et builds recommandés par la communauté",
                    "Tweets et annonces officielles Ankama intégrés",
                    "Liens utiles organisés par catégorie (PvM, PvP, Craft, Quêtes)",
                    "Favoris personnalisés par membre",
                ]}
            />
        </div>
    );
}
