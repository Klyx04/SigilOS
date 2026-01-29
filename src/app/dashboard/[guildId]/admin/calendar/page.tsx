import { CalendarSettingsClient } from "./_components/calendar-settings-client";

interface CalendarAdminPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function CalendarAdminPage({ params }: CalendarAdminPageProps) {
    const { guildId } = await params;

    return (
        <div className="container max-w-5xl py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Notifications Calendrier</h1>
                <p className="text-zinc-400 mt-1">
                    Configurez le salon Discord où les événements seront partagés.
                </p>
            </div>

            <CalendarSettingsClient guildId={guildId} />
        </div>
    );
}
