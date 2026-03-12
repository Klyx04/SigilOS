import { getMiniGamesStatus } from "@/server/actions/god-mini-games-actions";
import MiniGamesGodClient from "./mini-games-god-client";

export default async function GodMiniGamesPage() {
    const statuses = await getMiniGamesStatus();

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <MiniGamesGodClient initialStatuses={statuses} />
        </div>
    );
}
