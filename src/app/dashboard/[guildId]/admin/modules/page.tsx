import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { getGuildModules } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Puzzle } from "lucide-react";
import { ModulesClient } from "./_components/modules-client";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function AdminModulesPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isDiscordAdmin) {
        await logAdminAccessDenied(guildId, "/admin/modules");
        return <AccessDenied />;
    }

    const modules = await getGuildModules(guildId);

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Modules"
                description="Activez ou désactivez les fonctionnalités de votre guilde"
                icon={Puzzle}
                backHref={`/dashboard/${guildId}/admin`}
            />
            <ModulesClient guildId={guildId} initialModules={modules} />
        </div>
    );
}
