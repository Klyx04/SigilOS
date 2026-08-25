import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getGodTicketBotFleetAction } from "@/server/actions/ticket-bot-actions";
import { GodTicketBotPanel } from "./_components/god-ticket-bot-panel";

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
    const initialFleet = fleetRes.success && fleetRes.data ? fleetRes.data : {
        guilds: [],
        totalOpenTickets: 0,
        totalTranscripts: 0,
        globalAvgCsat: null,
        totalFeedbackCount: 0,
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
            <GodTicketBotPanel initialFleet={initialFleet} />
        </div>
    );
}
