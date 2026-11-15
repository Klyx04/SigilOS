import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getGodTicketBotFleetAction } from "@/server/actions/ticket-bot-actions";
import { getGodTicketConfigAction } from "@/server/actions/god-ticket-actions";
import { GodTicketBotPanel } from "./_components/god-ticket-bot-panel";
import { GodTicketConfigPanel } from "./_components/god-ticket-config-panel";

export const metadata = {
    title: "Bot Tickets Flotte | SigilOS GOD",
    description: "Supervision globale et déploiement du moteur Bot Tickets Discord.",
};

export default async function GodTicketBotPage() {
    const isGod = await isSuperAdmin();
    if (!isGod) {
        redirect("/dashboard");
    }

    const fleetRes = await getGodTicketBotFleetAction();
    const configRes = await getGodTicketConfigAction();
    const initialFleet = fleetRes.success && fleetRes.data ? fleetRes.data : {
        guilds: [],
        totalOpenTickets: 0,
        totalTranscripts: 0,
        globalAvgCsat: null,
        totalFeedbackCount: 0,
        platformLimits: {
            transcriptsEnabled: true,
            retentionArchivesDays: 90,
            retentionNotesDays: 90,
            retentionAuditDays: 180,
            maxPerUserCap: 5,
            maxGuildCap: 100,
        },
    };

    return (
        <div className="container mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
            {configRes.success ? (
                <GodTicketConfigPanel initial={configRes.data} />
            ) : (
                <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                    {configRes.error}
                </p>
            )}
            <GodTicketBotPanel initialFleet={initialFleet} />
        </div>
    );
}
