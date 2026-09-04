import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { SuccesClient } from "@/components/succes/SuccesClient";
import { SuccesHeaderActions } from "@/components/succes/SuccesHeaderActions";

export const metadata = {
    title: "Mes Succès | SigilOS",
    description: "Coche, trouve, enchaîne. Ta checklist de succès de donjons et l'annuaire « qui a quoi » dans la guilde.",
};

export default async function SuccesPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // Module guard (#138) — RBAC dédiée, indépendante du finder DJ.
    const user = await getUserContext(guildId);
    if (!user.canViewSucces) {
        return <AccessDenied />;
    }

    if (!user.isAdmin && !(await isModuleEnabled(guildId, "succes"))) {
        redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Mes Succès"
                description="Coche, trouve, enchaîne. Tes donjons. Ta guilde."
                imageSrc="/assets/dofus/game-icons/trophy-1.png"
                backHref={`/dashboard/${guildId}`}
                actions={<SuccesHeaderActions guildId={guildId} />}
            />

            <Suspense
                fallback={
                    <div className="h-64 flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest">
                        Chargement de tes succès…
                    </div>
                }
            >
                <SuccesClient
                    guildId={guildId}
                    canEditOwnSucces={user.canEditOwnSucces}
                    canViewGuildSucces={user.canViewGuildSucces}
                />
            </Suspense>
        </div>
    );
}
