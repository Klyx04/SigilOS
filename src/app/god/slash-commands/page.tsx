import { redirect } from "next/navigation";
import { getGodRoute } from "@/lib/god-route";

export default async function GodSlashCommandsRedirectPage() {
    const godRoute = await getGodRoute();
    redirect(`${godRoute}?tab=slash-commands`);
}
