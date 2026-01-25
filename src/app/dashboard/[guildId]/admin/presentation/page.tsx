import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { PresentationForm } from "./_components/presentation-form";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function PresentationAdminPage({ params }: Props) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated) {
        return <AccessDenied />;
    }

    // Check permissions: must be admin OR have presentation:edit permission
    if (!user.isAdmin && !user.canEditPresentation) {
        // Log the unauthorized access attempt with member/external differentiation
        await logAdminAccessDenied(guildId, "/admin/presentation");
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Présentation de la Guilde</h1>
                <p className="text-zinc-400 mt-1">
                    Configurez la page de présentation publique de votre guilde
                </p>
            </div>

            <PresentationForm guildId={guildId} />
        </div>
    );
}
