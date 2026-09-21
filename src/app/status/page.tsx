import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { StatusClient } from "./_components/status-client";
import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: { absolute: "Status des services | SigilOS" },
    description: "État en temps réel des services SigilOS : API, bot Discord, base de données et performance. Uptime et incidents.",
    alternates: {
        canonical: `${getAppBaseUrl()}/status`,
    },
};

export default async function StatusPage() {
    const session = await auth();
    const userContext = await getUserContext();

    return (
        <StatusClient
            user={session?.user}
            isMember={userContext.isMember}
        />
    );
}
