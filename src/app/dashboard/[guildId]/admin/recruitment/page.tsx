import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Recrutement & Cycle de Vie | SigilOS",
    description: "Annuaire guilde, période d'essai, gestion des mules et historique des départs.",
};

interface AdminRecruitmentPageProps {
    params: Promise<{
        guildId: string;
    }>;
}

/**
 * Le module Recrutement & Cycle de Vie vit désormais DANS le module global
 * « Membres & Recrutement » (onglet Registre). Cette page ne fait que
 * rediriger pour préserver les bookmarks et liens existants.
 */
export default async function AdminRecruitmentPage({ params }: AdminRecruitmentPageProps) {
    const { guildId } = await params;

    const ctx = await getUserContext(guildId);

    // RBAC : comme l'onglet Registre (gestion des membres requise).
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        redirect(`/dashboard/${guildId}`);
    }

    redirect(`/dashboard/${guildId}/admin/members?tab=registre`);
}
