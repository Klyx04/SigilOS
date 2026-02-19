import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { StatusClient } from "./_components/status-client";

export const metadata = {
    title: "Status | SigilOS",
    description: "État des services et performance de la plateforme SigilOS.",
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
