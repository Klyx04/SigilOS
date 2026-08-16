"use client";

/**
 * ThemeToggle — bouton compact pour la top-nav (Phase 0 GROK).
 * Désactivé si God force le sombre (kill-switch, disabled). Skeleton avant mount.
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme, setTheme, forcedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <span
                className="inline-flex size-8 items-center justify-center rounded-[6px]"
                aria-hidden
            />
        );
    }

    const locked = Boolean(forcedTheme);
    const isDark = resolvedTheme === "dark";

    return (
        <button
            type="button"
            disabled={locked}
            aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            title={locked ? "Thème verrouillé par GOD" : isDark ? "Mode clair" : "Mode sombre"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="inline-flex size-8 items-center justify-center rounded-[6px] text-muted-foreground transition-[background-color,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
            {isDark ? (
                <Moon className="size-4" aria-hidden />
            ) : (
                <Sun className="size-4" aria-hidden />
            )}
        </button>
    );
}
