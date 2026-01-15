
import { auth } from "@/auth";
import { getGuildMembers } from "@/server/actions/profile-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { MemberDirectory } from "@/components/directory/member-directory";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import AccessDenied from "@/components/access-denied";

export default async function MembersPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    // RBAC: Check permission to view Roster
    const user = await getUserContext(guildId);
    if (!user.canViewRoster) {
        return <AccessDenied />;
    }

    const response = await getGuildMembers(guildId);

    if (!response.success) {
        return (
            <div className="p-8 text-center text-red-400">
                <p>Impossible de charger l'annuaire.</p>
                <p className="text-sm opacity-75">{response.error}</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Annuaire de Guilde</h1>
                    <p className="text-zinc-400">Retrouvez les artisans et membres de votre guilde.</p>
                </div>
            </div>

            <MemberDirectory initialMembers={response.data || []} guildId={guildId} />
        </div>
    );
}
