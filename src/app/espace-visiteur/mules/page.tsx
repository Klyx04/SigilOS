import { requirePublicAccount } from "@/server/public-account";
import { MulesForm } from "../_components/mules-form";

export const metadata = {
    title: "Mules — espace visiteur | SigilOS",
    description: "Tes personnages secondaires, déclarés une seule fois pour tout l'espace visiteur.",
};

export default async function MulesPage() {
    const { profile } = await requirePublicAccount();
    return <MulesForm mules={profile.altPseudos} serverId={profile.dofusServerId} />;
}
