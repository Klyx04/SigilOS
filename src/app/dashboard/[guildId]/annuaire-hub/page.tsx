import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AnnuaireHubPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/members`);
}
