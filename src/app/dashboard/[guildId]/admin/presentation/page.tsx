import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import AccessDenied from "@/components/access-denied";
import { PresentationForm } from "./_components/presentation-form";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Globe } from "lucide-react";

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
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Configuration Présentation"
                description="Modifiez les informations publiques de votre guilde."
                imageSrc="/assets/ui/icons/members.png"
                backHref={`/dashboard/${guildId}/presentation`}
            />

            <PresentationForm guildId={guildId} />
        </div>
    );
}
