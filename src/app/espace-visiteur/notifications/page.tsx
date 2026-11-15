import { requirePublicSession } from "@/server/public-account";
import { listAccountNotifications } from "@/server/account-notifications";
import { AccountNotificationsClient } from "./_components/account-notifications-client";

export const metadata = {
    title: "Notifications — espace visiteur | SigilOS",
    description: "Tes réponses aux signalements et les nouveautés du site.",
};

/**
 * Boîte de notifications du **compte** (rang 65, lot N3).
 *
 * Garde `requirePublicSession` : un visiteur connecté **sans profil public** doit
 * pouvoir lire ses notifications. La page ne dépend que de `User` (`userId`),
 * jamais d'un `guildId` ni d'un `UserProfile`.
 */
export default async function AccountNotificationsPage() {
    const { userId } = await requirePublicSession();
    const page = await listAccountNotifications(userId);

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
                <p className="text-sm text-muted-foreground">
                    Tes réponses aux signalements et les nouveautés du site.
                </p>
            </header>

            <AccountNotificationsClient
                items={page.items}
                unread={page.unread}
                total={page.total}
            />
        </div>
    );
}
