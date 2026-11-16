import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * GuildAreaSwitch — bascule **Guildes / Visiteurs** de la partie guildes.
 *
 * Décision du 16/11/2026 : les visiteurs vivent dans `Guildes & Users`, pas dans
 * une nouvelle entrée de sidebar (le God a déjà trop d'onglets). Les deux vues sont
 * des URL réelles : aucun état client, retour arrière et favoris fonctionnent.
 */
export function GuildAreaSwitch({
    active,
    godRoute,
}: {
    active: "guilds" | "visiteurs";
    godRoute: string;
}) {
    const items = [
        { id: "guilds" as const, label: "Guildes", href: `${godRoute}?tab=guilds` },
        { id: "visiteurs" as const, label: "Visiteurs", href: `${godRoute}?tab=guilds&vue=visiteurs` },
    ];

    return (
        <nav
            aria-label="Vue de la partie guildes"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface/10 p-1"
        >
            {items.map((item) => {
                const isActive = active === item.id;
                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                            isActive
                                ? "bg-elevated text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
