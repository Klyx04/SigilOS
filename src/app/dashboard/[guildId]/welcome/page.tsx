import { redirect } from "next/navigation";

export default async function WelcomePage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/guild-hub`);
}
