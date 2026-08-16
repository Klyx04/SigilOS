"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const toggleTheme = () => {
        setTheme(theme === "dark" || theme === "system" ? "light" : "dark");
    };

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "group relative flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-300",
                "bg-foreground/[0.03] border border-border/50 hover:bg-foreground/[0.06] hover:border-border",
                className
            )}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
            <div className="relative h-5 w-5 transition-all duration-300 group-">
                <Sun className={cn(
                    "absolute inset-0 h-5 w-5 transition-all duration-300",
                    theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                )} />
                <Moon className={cn(
                    "absolute inset-0 h-5 w-5 transition-all duration-300",
                    theme === "dark" ? "rotate-0 scale-100 opacity-100 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "-rotate-90 scale-0 opacity-0"
                )} />
            </div>
            
            {/* Visual highlight on hover */}
            <div className={cn(
                "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br",
                theme === "dark" ? "from-primary/10 to-transparent" : "from-amber-600/10 to-transparent"
            )} />
        </button>
    );
}
