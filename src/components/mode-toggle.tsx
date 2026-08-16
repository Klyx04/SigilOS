"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
    const { setTheme, forcedTheme } = useTheme();

    // #16 — kill-switch God : quand le thème est forcé en sombre, on ne propose
    // plus aucun choix de thème (le toggle God masque ce menu).
    if (forcedTheme) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-white/10 bg-black/20 backdrop-blur-md">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Clair
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Sombre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    Système
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
