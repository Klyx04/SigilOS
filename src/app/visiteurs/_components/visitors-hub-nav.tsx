import Link from "next/link";
import { GameIcon } from "@/components/shared/game-icon";
import { cn } from "@/lib/utils";
import { buildVisitorsHubHref, type VisitorsHubView } from "@/lib/visitors-hub";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Bascule **Profils / Succès / Échanges** du hub « Communauté SigilOS ».
 *
 * Un lien, pas un état client : chaque vue a sa propre URL (`?vue=succes`, `?vue=echanges`),
 * donc le retour arrière, le partage et le rafraîchissement fonctionnent. La vue profils
 * reste l'URL nue `/visiteurs`.
 */
export function VisitorsHubNav({
    vue,
    labels,
}: {
    vue: VisitorsHubView;
    labels: Translations["visitorsPage"];
}) {
    const items = [
        {
            id: "profils" as const,
            label: labels.hub.profiles,
            icon: "/assets/dofus/modules/character.png",
            href: buildVisitorsHubHref({ vue: "profils" }),
        },
        {
            id: "succes" as const,
            label: labels.hub.successes,
            icon: "/assets/dofus/game-icons/trophy-1.png",
            href: buildVisitorsHubHref({ vue: "succes" }),
        },
        {
            id: "echanges" as const,
            label: labels.hub.exchanges,
            icon: "/assets/dofus/game-icons/shop.png",
            href: buildVisitorsHubHref({ vue: "echanges" }),
        },
    ];

    return (
        <nav aria-label={labels.hub.navLabel} className="mt-8 border-b border-border">
            <ul className="flex flex-wrap gap-1">
                {items.map((item) => {
                    const active = vue === item.id;
                    return (
                        <li key={item.id}>
                            <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-t-md px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active &&
                                        "border-b-2 border-accent bg-elevated font-semibold text-foreground"
                                )}
                            >
                                <GameIcon src={item.icon} className="size-4" />
                                {item.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
