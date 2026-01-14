import { SongesSettingsClient } from "./_components/songes-settings-client";

export default async function SongesAdminPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    return <SongesSettingsClient guildId={guildId} />;
}
