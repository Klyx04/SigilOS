import { Activity } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { SondagesWIPState } from "./sondages-wip-state";
import { isModuleEnabled } from "@/server/actions/module-actions";

export default async function PollsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewPolls) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;
    if (!isAdmin && !await isModuleEnabled(guildId, "polls")) {
        redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <Activity
                        className="w-12 h-12 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                        strokeWidth={1.5}
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Sondages</h1>
                    <p className="text-zinc-400">Exprimez votre avis sur les décisions de la guilde.</p>
                </div>
            </div>

            <SondagesWIPState guildId={guildId} />
        </div>
    );
}
