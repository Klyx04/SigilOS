import { redirect } from "next/navigation";

export default async function RedirectPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/admin/validation?tab=achievements`);
}
