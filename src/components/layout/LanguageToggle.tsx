"use client";

import { useI18n } from "@/lib/i18n/client";
import { type Locale } from "@/lib/i18n/types";
import { Globe } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
    const { locale, setLocale, isPending } = useI18n();

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Changer de langue / Change language"
                    className="reg-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors border border-transparent hover:border-border/60 focus:outline-none"
                    disabled={isPending}
                >
                    <Globe className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                    <span className="font-semibold uppercase">{locale}</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 bg-popover/95 backdrop-blur-md border-border">
                <DropdownMenuItem
                    onClick={() => setLocale("fr")}
                    className={`cursor-pointer flex items-center justify-between text-xs py-2 ${
                        locale === "fr" ? "font-bold text-foreground bg-accent/40" : "text-muted-foreground"
                    }`}
                >
                    <span>🇫🇷 Français</span>
                    {locale === "fr" && <span className="text-[10px] text-accent font-mono">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setLocale("en")}
                    className={`cursor-pointer flex items-center justify-between text-xs py-2 ${
                        locale === "en" ? "font-bold text-foreground bg-accent/40" : "text-muted-foreground"
                    }`}
                >
                    <span>🇬🇧 English</span>
                    {locale === "en" && <span className="text-[10px] text-accent font-mono">✓</span>}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
