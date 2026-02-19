import { Key } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";

export default async function PassagesPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewServices) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;
    if (!isAdmin && !await isModuleEnabled(guildId, "services")) {
        redirect(`/dashboard/${guildId}`);
    }
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <Key
                        className="w-12 h-12 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                        strokeWidth={1.5}
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Services Guilde</h1>
                    <p className="text-zinc-400">Vendez ou achetez des passages et services de guilde.</p>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in duration-500">
                <div className="p-4 rounded-full bg-white/5 mb-4 animate-pulse">
                    <Key className="w-8 h-8 text-white/50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Module en construction</h3>
                <p className="text-zinc-500 max-w-md text-center">
                    Cette fonctionnalité sera bientôt disponible. Elle permettra de proposer et rechercher des services rémunérés (Passages, PL, Métiers).
                </p>
            </div>
        </div>
    );
}
