import { getSystemIssues } from "@/server/actions/god-bugs-actions";
import { BugsClient } from "./bugs-client";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Bugs & Améliorations - GOD SigilOS",
};

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function GodBugsPage({ searchParams }: Props) {
    // Fail-closed : réservé aux super-admins (le layout accepte désormais les sub-gods)
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");
    const resolvedParams = await searchParams;
    const ticketParam = typeof resolvedParams?.ticket === "string" ? resolvedParams.ticket : undefined;
    const response = await getSystemIssues();
    const initialIssues = response.success ? response.data : [];

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tracker de Bugs & Améliorations</h2>
                    <p className="text-muted-foreground">
                        Gérez les bugs et suggestions d'amélioration de SigilOS (Inspiré du tracker Dofus).
                    </p>
                </div>
            </div>
            
            <BugsClient initialIssues={initialIssues as any} initialTicketParam={ticketParam} />
        </div>
    );
}
