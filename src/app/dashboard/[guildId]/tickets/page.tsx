import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import {
    getTicketGuildConfigAction,
    getTicketCategoriesAction,
    getTicketPanelsAction,
    getTicketRecordsAction,
    getTicketStatsAction,
    listTicketJourneysAction,
    listTicketFormsAction,
    listTicketTeamsAction,
} from "@/server/actions/ticket-bot-actions";
import { TicketBotManager } from "./_components/ticket-bot-manager";

interface TicketsPageProps {
    params: Promise<{ guildId: string }>;
}

export const metadata = {
    title: "Bot Tickets & Support | SigilOS",
    description: "Système complet de support Discord et modération de guilde.",
};

export default async function TicketsPage({ params }: TicketsPageProps) {
    const { guildId } = await params;
    const ctx = await getUserContext(guildId);

    if (!ctx.isAuthenticated) {
        redirect("/");
    }

    if (!ctx.canManageTickets) {
        redirect(`/dashboard/${guildId}`);
    }

    const [configRes, categoriesRes, panelsRes, recordsRes, statsRes, journeysRes, formsRes, teamsRes] =
        await Promise.all([
            getTicketGuildConfigAction(guildId),
            getTicketCategoriesAction(guildId),
            getTicketPanelsAction(guildId),
            getTicketRecordsAction(guildId),
            getTicketStatsAction(guildId),
            listTicketJourneysAction(guildId),
            listTicketFormsAction(guildId),
            listTicketTeamsAction(guildId),
        ]);

    const config = configRes.success ? configRes.data : null;
    const categories = categoriesRes.success && Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
    const panels = panelsRes.success && Array.isArray(panelsRes.data) ? panelsRes.data : [];
    const journeys = journeysRes.success && Array.isArray(journeysRes.data) ? journeysRes.data : [];
    const forms = formsRes.success && Array.isArray(formsRes.data) ? formsRes.data : [];
    const teams = teamsRes.success && Array.isArray(teamsRes.data) ? teamsRes.data : [];
    const tickets = recordsRes.success && recordsRes.data?.tickets ? recordsRes.data.tickets : [];
    const stats = statsRes.success && statsRes.data ? statsRes.data : {
        openCount: 0,
        claimedCount: 0,
        closedCount: 0,
        totalCount: 0,
        avgCsat: null,
        feedbackCount: 0,
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
            <TicketBotManager
                guildId={guildId}
                config={config}
                categories={categories}
                panels={panels}
                journeys={journeys}
                forms={forms}
                teams={teams}
                tickets={tickets}
                stats={stats}
            />
        </div>
    );
}
