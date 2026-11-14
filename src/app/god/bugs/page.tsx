import { getTrackerStats, getTrackerTickets } from "@/server/actions/god-bugs-actions";
import { FeedbackTracker } from "@/components/feedback/feedback-tracker";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Signalements — GOD SigilOS",
};

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const REF_PATTERN = /^SIG-[0-9A-Za-z-]{1,28}$/;

export default async function GodBugsPage({ searchParams }: Props) {
    // Fail-closed : réservé aux super-admins (le layout accepte les sub-gods).
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const resolvedParams = await searchParams;
    const rawTicket = typeof resolvedParams?.ticket === "string" ? resolvedParams.ticket : undefined;
    const initialRef = rawTicket && REF_PATTERN.test(rawTicket) ? rawTicket : undefined;

    const [ticketsResponse, statsResponse] = await Promise.all([
        getTrackerTickets({ page: 1, perPage: 20, ref: initialRef }),
        getTrackerStats(),
    ]);

    const initialData = ticketsResponse.success && "data" in ticketsResponse ? ticketsResponse.data : [];
    const initialTotal = ticketsResponse.success && "total" in ticketsResponse ? ticketsResponse.total : 0;
    const initialPage = ticketsResponse.success && "page" in ticketsResponse ? ticketsResponse.page : 1;
    const initialTotalPages = ticketsResponse.success && "totalPages" in ticketsResponse ? ticketsResponse.totalPages : 1;
    const initialStats = statsResponse.success && "data" in statsResponse
        ? statsResponse.data
        : { total: 0, open: 0, resolved: 0, ignored: 0, internal: 0, feedback: 0 };

    return (
        <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tracker des signalements</h1>
                <p className="text-sm text-muted-foreground">
                    Suivez les bugs et améliorations signalés par les membres, répondez-leur et tenez vos notes internes.
                </p>
            </div>

            <FeedbackTracker
                initialData={initialData}
                initialTotal={initialTotal}
                initialPage={initialPage}
                initialTotalPages={initialTotalPages}
                initialStats={initialStats}
                initialRef={initialRef}
            />
        </div>
    );
}
