import { auth } from "@/auth";
import { getPendingSubmissions } from "@/server/actions/mission-actions";
import { ValidationQueue } from "@/components/missions/validation-queue";
import { redirect } from "next/navigation";

export default async function ValidationPage({ params }: { params: Promise<{ guildId: string }> }) {
    const session = await auth();
    if (!session?.user) redirect("/");
    const { guildId } = await params;

    const response = await getPendingSubmissions(guildId);

    if (!response.success) {
        return (
            <div className="p-8 text-center text-red-500">
                Accès refusé ou erreur: {response.error}
            </div>
        );
    }

    const submissions = response.data || [];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Validation des Preuves</h1>
                    <p className="text-zinc-400">Examinez les screenshots soumis par les membres.</p>
                </div>
                <div className="text-sm text-zinc-500 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800">
                    {submissions.length} en attente
                </div>
            </div>

            <ValidationQueue submissions={submissions} />
        </div>
    );
}
