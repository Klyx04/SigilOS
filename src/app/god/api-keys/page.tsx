import { redirect } from "next/navigation";
import { getGodRoute } from "@/lib/god-route";

export default async function GodApiKeysRedirectPage() {
    const godRoute = await getGodRoute();
    redirect(`${godRoute}?tab=api-keys`);
}
