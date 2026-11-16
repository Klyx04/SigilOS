import Link from "next/link";
import { requirePublicAccount } from "@/server/public-account";
import { getAccountNotificationsEnabled } from "@/server/account-notifications";
import { AccountNotificationsSettings } from "../_components/account-notifications-settings";
import { ExportDeleteCard } from "../_components/export-delete-card";
import { SettingsForm } from "../_components/settings-form";
import { VisitorSection } from "../_components/visitor-section";

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
            <VisitorSection
                title="Visite guidée"
                description="Le tour de l'espace visiteur est rejouable à tout moment : navigation, profil et Metamob. Il ne s'ouvre plus tout seul une fois la première visite passée."
            >
                <Link
                    href="/espace-visiteur/general?tour=1"
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Revoir la visite guidée
                </Link>
            </VisitorSection>
        </div>
    );
}
