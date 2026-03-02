import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ComingSoonBanner } from "@/components/coming-soon-banner";
import { Map } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function MiniJeuxPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewWorldmap) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Carte & Mini-Jeux"
                description="Explorez le monde des Douze et accédez aux outils cartographiques"
                icon={Map}
                backHref={`/dashboard/${guildId}`}
            />
            <ComingSoonBanner
                title="Carte du Monde & Mini-Jeux"
                description="Une carte interactive inspirée de dofusdb.fr/fr/tools/map, intégrée directement dans SigilOS avec des outils de guilde uniques."
                icon={Map}
                accentColor="cyan"
                features={[
                    "Carte du monde interactive — Naviguer entre zones et sous-zones",
                    "Localisation des donjons, quêtes et points d'intérêt",
                    "Mini-jeux communautaires de guilde",
                    "Intégration avec les modules Donjons & Quêtes et Songes",
                    "Assets cartographiques extraits du jeu officiel",
                    "Marqueurs personnalisés et partage de positions entre membres",
                ]}
            />
        </div>
    );
}
