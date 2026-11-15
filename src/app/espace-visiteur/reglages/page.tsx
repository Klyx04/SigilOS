import { requirePublicAccount } from "@/server/public-account";
import { getAccountNotificationsEnabled } from "@/server/account-notifications";
import { AccountNotificationsSettings } from "../_components/account-notifications-settings";
import { ExportDeleteCard } from "../_components/export-delete-card";
import { SettingsForm } from "../_components/settings-form";

export const metadata = {
    title: "Réglages — espace visiteur | SigilOS",
    description: "Visibilité, notifications, export et suppression de ta vie publique.",
};

export default async function ReglagesPage() {
    const { userId, profile } = await requirePublicAccount();
    const notificationsEnabled = await getAccountNotificationsEnabled(userId);

    return (
        <div className="space-y-6">
            <SettingsForm
                showOnDirectory={profile.showOnDirectory}
                showPresence={profile.showPresence}
                showRushProgress={profile.showRushProgress}
            />
            <AccountNotificationsSettings enabled={notificationsEnabled} />
            <ExportDeleteCard />
        </div>
    );
}
