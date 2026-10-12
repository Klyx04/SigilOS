import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import AccessDenied from "@/components/access-denied";
import { SongesSettingsClient } from "./_components/songes-settings-client";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Moon } from "lucide-react";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

export default async function SongesAdminPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isAdmin) return <AccessDenied />;

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Notifications Songes"
                description="Configurez les notifications Discord pour les nouveaux étages de Songes."
                imageSrc="/assets/ui/icons/songes.png"
                backHref={`/dashboard/${guildId}/admin/settings`}
                actions={<ModuleHelpActions docSlug="songes" docTitle="Notifications Songes" />}
            />
            <SongesSettingsClient guildId={guildId} />
        </div>
    );
}
