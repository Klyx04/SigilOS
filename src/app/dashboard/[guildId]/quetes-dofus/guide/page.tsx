import { redirect } from "next/navigation";

export default async function GuideRedirectPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/quetes-dofus`);
}
