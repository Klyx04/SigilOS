import { redirect } from "next/navigation";

export default async function RunDetailPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/songes`);
}
