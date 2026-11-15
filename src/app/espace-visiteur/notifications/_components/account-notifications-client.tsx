"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameIcon } from "@/components/shared/game-icon";
import { Button } from "@/components/ui/button";
import {
    notificationCategoryIcon,
    notificationCategoryLabel,
} from "@/lib/notification-categories";
import {
    markAccountNotificationRead,
    markAllAccountNotificationsRead,
} from "@/server/actions/account-notification-actions";
import type { AccountNotificationView } from "@/server/account-notifications";
import { cn } from "@/lib/utils";

/**
 * Liste de la boîte **compte** (rang 65, lot N3).
 *
 * Aucun filtre par guilde, aucune action de guilde : les deux mutations sont
 * celles de `account-notification-actions.ts` (session + `guildId: null`).
 * La date est formatée dans un fuseau fixe pour éviter un décalage d'hydratation.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
});

function formatDate(value: Date | string): string {
    return DATE_FORMAT.format(new Date(value));
}

export function AccountNotificationsClient({
    items,
    unread,
    total,
}: {
    items: AccountNotificationView[];
    unread: number;
    total: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const markRead = (id: string) => {
        startTransition(async () => {
            const result = await markAccountNotificationRead(id);
            if (result.success) {
                router.refresh();
            } else {
                toast.error(result.error ?? "Mise à jour impossible.");
            }
        });
    };

    const markAll = () => {
        startTransition(async () => {
            const result = await markAllAccountNotificationsRead();
            if (result.success) {
                toast.success("Tout est marqué comme lu.");
                router.refresh();
            } else {
                toast.error(result.error ?? "Mise à jour impossible.");
            }
        });
    };

    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <GameIcon
                    src="/assets/dofus/game-icons/bell-off.png"
                    className="mx-auto h-10 w-10 opacity-80"
                />
                <p className="mt-3 text-sm font-medium text-foreground">
                    Aucune notification pour le moment.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Les réponses à tes signalements et les nouveautés du site apparaîtront ici.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    {total} notification{total > 1 ? "s" : ""}
                    {unread > 0
                        ? ` · ${unread} non lue${unread > 1 ? "s" : ""}`
                        : " · tout est lu"}
                </p>
                {unread > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={markAll}
                        disabled={isPending}
                        className="self-start sm:self-auto"
                    >
                        Tout marquer comme lu
                    </Button>
                )}
            </div>

            <ul className="space-y-2">
                {items.map((notification) => {
                    const selfLink = notification.link === pathname;

                    return (
                        <li
                            key={notification.id}
                            className={cn(
                                "rounded-xl border bg-surface p-4",
                                notification.read ? "border-border" : "border-primary/30 bg-primary/5"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <GameIcon
                                    src={notificationCategoryIcon(notification.category)}
                                    className="mt-0.5 h-6 w-6 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">
                                            {notification.title}
                                        </p>
                                        {!notification.read && (
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                                Nouveau
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                                        {notification.message}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {formatDate(notification.createdAt)} ·{" "}
                                        {notificationCategoryLabel(notification.category)}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        {notification.link && !selfLink && (
                                            <Link
                                                href={notification.link}
                                                className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                                            >
                                                Ouvrir
                                            </Link>
                                        )}
                                        {!notification.read && (
                                            <button
                                                type="button"
                                                onClick={() => markRead(notification.id)}
                                                disabled={isPending}
                                                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                            >
                                                Marquer comme lue
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
