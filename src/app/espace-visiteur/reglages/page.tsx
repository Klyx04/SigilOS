import { requirePublicAccount } from "@/server/public-account";
import { ExportDeleteCard } from "../_components/export-delete-card";
import { SettingsForm } from "../_components/settings-form";

export const metadata = {
    title: "Réglages — espace visiteur | SigilOS",
    description: "Visibilité, export et suppression de ta vie publique.",
};

export default async function ReglagesPage() {
    const { profile } = await requirePublicAccount();

    return (
        <div className="space-y-6">
            <SettingsForm
                showOnDirectory={profile.showOnDirectory}
                showPresence={profile.showPresence}
                showRushProgress={profile.showRushProgress}
            />
            <ExportDeleteCard />
        </div>
    );
}
