"use client";

/**
 * ModeToggle — menu segmenté Clair / Sombre / Système (Phase 0 GROK).
 * Inopérant si God force le sombre (kill-switch, disabled). Skeleton avant mount
 * (évite le flash du mauvais état pendant l'hydratation).
 */

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const OPTIONS = [
    { value: "light", label: "Clair", icon: Sun },
    { value: "dark", label: "Sombre", icon: Moon },
    { value: "system", label: "Système", icon: Monitor },
] as const;

export function ModeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme, forcedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div
                className="h-8 w-[9.5rem] rounded-[6px] border border-border bg-surface"
                aria-hidden
            />
        );
    }

    const locked = Boolean(forcedTheme);

    return (
        <div
            role="group"
            aria-label="Thème d'affichage"
            className="inline-flex h-8 items-center rounded-[6px] border border-border bg-surface p-0.5"
        >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={locked}
                        aria-pressed={active}
                        title={locked ? "Thème verrouillé par GOD" : label}
                        onClick={() => setTheme(value)}
                        className={`inline-flex h-7 items-center gap-1 rounded-[5px] px-2 text-label transition-[background-color,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            active
                                ? "bg-accent-soft text-accent"
                                : "text-muted-foreground hover:bg-background hover:text-foreground"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                        <Icon className="size-3.5" aria-hidden />
                        <span>{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
