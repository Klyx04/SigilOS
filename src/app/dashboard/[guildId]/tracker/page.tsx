import { getMemberTrackerTickets } from "@/server/actions/god-bugs-actions";
import { MemberTrackerView } from "@/components/tracker/member-tracker-view";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Bug, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

interface TrackerPageProps {
    params: Promise<{
        guildId: string;
    }>;
    searchParams: Promise<{ bug?: string | string[] }>;
}

export const metadata = {
    title: "Tracker des signalements — SigilOS",
    description: "Suivez les bugs et améliorations signalés par les membres, et les réponses de l'équipe.",
};

const REF_PATTERN = /^SIG-[0-9A-Za-z-]{1,28}$/;

export default async function MemberTrackerPage({ params, searchParams }: TrackerPageProps) {
    const { guildId } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const resolvedSearch = await searchParams;
    const rawRef = typeof resolvedSearch.bug === "string" ? resolvedSearch.bug : undefined;
    const initialRef = rawRef && REF_PATTERN.test(rawRef) ? rawRef : undefined;

    const response = await getMemberTrackerTickets(guildId, {
        page: 1,
        perPage: 20,
        ref: initialRef,
    });

    if (!response.success) {
        // Non-membre, guilde inconnue ou erreur : retour au dashboard, jamais un tracker vide trompeur.
        redirect(`/dashboard/${guildId}`);
    }

    const initialData = "data" in response ? response.data : [];
    const initialTotal = "total" in response ? response.total : 0;
    const initialPage = "page" in response ? response.page : 1;
    const initialTotalPages = "totalPages" in response ? response.totalPages : 1;
    const initialStats = "stats" in response
        ? response.stats
        : { total: 0, open: 0, resolved: 0, ignored: 0 };

    return (
        <div className="relative flex-1 overflow-hidden">
            <AuroraBackground className="pointer-events-none absolute inset-0 z-0 opacity-10" />

            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2 text-caption font-medium uppercase tracking-wide text-warning">
                            <Bug className="h-4 w-4" />
                            Système de suivi
                        </div>
                        <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Tracker des signalements
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Consultez les bugs et améliorations signalés, leur avancement et les réponses de l&apos;équipe.
                            La pseudo d&apos;un membre n&apos;est visible que dans sa propre guilde.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ModuleHelpActions
                            docSlug="signalements"
                            docTitle="Signaler un problème et suivre sa résolution"
                        />
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-caption text-muted-foreground">
                            <ShieldCheck className="h-4 w-4 text-success" />
                            Accès membre vérifié
                        </div>
                    </div>
                </header>

                <MemberTrackerView
                    guildId={guildId}
                    initialData={initialData}
                    initialTotal={initialTotal}
                    initialPage={initialPage}
                    initialTotalPages={initialTotalPages}
                    initialStats={initialStats}
                    initialRef={initialRef}
                />
            </div>

            <footer className="relative z-10 border-t border-border px-4 py-3 text-caption text-muted-foreground sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Flux de données actif
                    </span>
                    <span>SigilOS · Tracker</span>
                </div>
            </footer>
        </div>
    );
}
