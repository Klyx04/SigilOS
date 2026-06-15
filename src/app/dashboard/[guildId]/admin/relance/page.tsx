import { redirect } from "next/navigation";

/**
 * The dedicated Relance page has been merged into the Members Management page
 * (Admin > Members > Audit & Sync tab).
 * 
 * This redirect ensures old links/bookmarks don't break.
 */
export default async function RelancePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/admin/members`);
}
