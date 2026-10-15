"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, FileImage, Trophy, Coins, ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getPendingValidationsCount } from "@/server/actions/admin-actions";
import { cn } from "@/lib/utils";

interface ValidatorInboxClientProps {
    guildId: string;
    initialData: {
        pendingMissions: number;
        pendingAchievements: number;
        pendingKamas?: number;
        pendingReactivations?: number;
        total: number;
    };
}

type FilterType = "all" | "missions" | "achievements" | "kamas" | "reactivations";

const CATEGORIES: Record<FilterType, { label: string; icon: any; img?: string }> = {
    all: {
        label: "Tout",
        icon: CheckCircle2,
    },
    missions: {
        label: "Missions",
        icon: FileImage,
    },
    achievements: {
        label: "Succès",
        icon: Trophy,
        img: "/assets/dofus/game-icons/trophy-1.png",
    },
    kamas: {
        label: "Kamas",
        icon: Coins,
        img: "/assets/dofus/game-icons/kamas.png",
    },
    reactivations: {
        label: "Retours",
        icon: ClipboardList,
    },
};

export function ValidatorInboxClient({ guildId, initialData }: ValidatorInboxClientProps) {
    const [data, setData] = useState(initialData);
    const [filter, setFilter] = useState<FilterType>("all");

    const refresh = useCallback(async () => {
        try {
            const res = await getPendingValidationsCount(guildId);
            if (res.success && res.data) {
                setData(res.data as any);
            }
        } catch (err) {
            console.error("Failed to fetch pending validations", err);
        }
    }, [guildId]);

    useEffect(() => {
        // Fast polling: 5 seconds for snappy updates across staff
        const interval = setInterval(refresh, 5000);

        const onFocus = () => {
            refresh();
        };

        const onVisibilityChange = () => {
            if (!document.hidden) {
                refresh();
            }
        };

        const onStorage = (e: StorageEvent) => {
            if (e.key === "sigilos:last-validation") {
                refresh();
            }
        };

        const onCustomEvent = () => {
            refresh();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("storage", onStorage);
        window.addEventListener("sigilos:pending-validations-changed", onCustomEvent);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("sigilos:pending-validations-changed", onCustomEvent);
        };
    }, [refresh]);

    const pendingKamas = (data as any).pendingKamas ?? 0;
    const pendingReactivations = (data as any).pendingReactivations ?? 0;

    const displayCount =
        filter === "missions" ? data.pendingMissions :
            filter === "achievements" ? data.pendingAchievements :
                filter === "kamas" ? pendingKamas :
                    filter === "reactivations" ? pendingReactivations :
                        data.total;

    // Disappears completely when there is nothing left to validate
    if (data.total === 0) return null;

    const href = `/dashboard/${guildId}/admin/validation` + (filter !== "all" ? `?type=${filter === "reactivations" ? "retours" : filter}` : "");
    const currentCategory = CATEGORIES[filter];

    return (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border bg-surface/95 shadow-md backdrop-blur-sm w-72 transition-all">
            {/* Header: Status & Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Validations en attente
                    </span>
                </div>
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 tabular-nums">
                    {data.total}
                </span>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", "missions", "achievements", "kamas", "reactivations"] as FilterType[]).map((f) => {
                    const count = f === "all" ? data.total : f === "missions" ? data.pendingMissions : f === "achievements" ? data.pendingAchievements : f === "kamas" ? pendingKamas : pendingReactivations;
                    if (f !== "all" && count === 0) return null;
                    const cfg = CATEGORIES[f];
                    const active = filter === f;

                    return (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors",
                                active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-elevated/40 text-muted-foreground border-border hover:bg-elevated hover:text-foreground"
                            )}
                        >
                            {cfg.img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cfg.img} alt="" className="w-3 h-3 object-contain" />
                            ) : (
                                <cfg.icon className="w-3 h-3" />
                            )}
                            <span>{cfg.label}</span>
                            <span className={cn("ml-0.5 tabular-nums text-[10px] font-bold opacity-80", active && "opacity-100")}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Action CTA link */}
            <Link
                href={href}
                className="group flex items-center justify-between p-2.5 rounded-lg bg-elevated/50 hover:bg-elevated border border-border hover:border-border-strong transition-all"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                        {displayCount}
                    </span>
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground leading-tight">
                            {filter === "all" ? "Toutes les demandes" : currentCategory.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                            Traiter sur le tableau
                        </span>
                    </div>
                </div>
                <div className="p-1.5 rounded-md bg-surface group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground border border-border transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
            </Link>
        </div>
    );
}
