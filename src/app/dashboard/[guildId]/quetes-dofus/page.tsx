import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ComingSoonBanner } from "@/components/coming-soon-banner";
import { BookMarked } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function QuetesDofusPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewQuests) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "quests");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Quêtes Dofus"
                description="Optimisez vos quêtes de Dofus et trouvez des compagnons de route"
                icon={BookMarked}
                backHref={`/dashboard/${guildId}`}
            />
            <ComingSoonBanner
                title="Optimisation des Quêtes Dofus"
                description="Un panneau unique et inédit pour gérer vos quêtes en commun, intégrer les donjons et ressources nécessaires, et suivre votre progression vers les Dofus."
                icon={BookMarked}
                accentColor="amber"
                imageSrc="/exemples/exemple-suivi-quetes.png"
                imageAlt="Preview — Progression Neurale des Dofus"
                features={[
                    "Suivi de progression des quêtes Dofus (Émeraude, Turquoise, Ocre...)",
                    "Quêtes en commun — Matchmaking entre membres de guilde",
                    "Intégration des donjons, ressources et étapes par quête",
                    "Panneau visuel unique — Arbre de progression neuronal",
                    "Import des données quêtes depuis DofusDB / game data",
                    "Notifications quand un membre est sur la même étape que vous",
                ]}
            />
        </div>
    );
}
