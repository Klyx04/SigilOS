"use client";

/**
 * Coquille de démo — navigation entre les écrans (lot S-2a).
 *
 * Traduit l'ordre réel des modules du produit sans dupliquer sa sidebar : un écran
 * actif, et l'état « bientôt » pour les briques à venir (sorties, succès).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function DemoNav() {
    const { t } = useI18n();
    const d = t.demoPage;
    const pathname = usePathname();

    const items = [
        { href: "/demo", label: d.navOverview, ready: true },
        { href: "/demo/annuaire", label: d.navDirectory, ready: true },
        { href: "/demo/songes", label: d.navSonges, ready: true },
        { href: "/demo/sorties", label: d.navOutings, ready: false },
        { href: "/demo/succes", label: d.navAchievements, ready: false },
    ];

    return (
        <nav aria-label={d.bannerLabel} className="border-b border-border bg-background">
            <div className="reg-shell flex flex-wrap items-center gap-x-1 gap-y-1 py-2">
                {items.map((item) => {
                    if (!item.ready) {
                        return (
                            <span
                                key={item.href}
                                className="reg-mono flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs uppercase tracking-wide text-subtle-foreground"
                            >
                                {item.label}
                                <span className="rounded-sm border border-border px-1 text-[9px]">{d.navSoon}</span>
                            </span>
                        );
                    }
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "rounded-sm px-2.5 py-1.5 text-sm font-semibold transition-colors",
                                active ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
