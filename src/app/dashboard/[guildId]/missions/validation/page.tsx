import { auth } from "@/auth";
import { getPendingSubmissions } from "@/server/actions/mission-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { ValidationQueue } from "@/components/missions/validation-queue";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ValidationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;

    // RBAC: Check permission to validate missions
    const user = await getUserContext(guildId);
    if (!user.canValidateMissions) {
        await logAdminAccessDenied(guildId, "/missions/validation");
        return <AccessDenied />;
    }

    const response = await getPendingSubmissions(guildId);

    if (!response.success) {
        return <AccessDenied />;
    }

    const submissions = response.data || [];

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Validation des Preuves"
                description="Examinez les screenshots soumis par les membres pour valider leurs missions."
                imageSrc="/assets/ui/icons/missions.png"
                backHref={`/dashboard/${guildId}/missions`}
                actions={
                    <Badge variant="outline" className="gap-2 bg-zinc-900 border-zinc-800 text-zinc-400">
                        <Clock className="w-3 h-3" />
                        {submissions.length} en attente
                    </Badge>
                }
            />

            <ValidationQueue submissions={submissions} guildId={guildId} />
        </div>
    );
}
