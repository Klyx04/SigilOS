"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Database, FileText, Settings, LogOut, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navigation = [
    { name: "Game Data", href: "/god/game-data", icon: Database },
    { name: "Logs", href: "/god/logs", icon: FileText },
    { name: "Config", href: "/god/config", icon: Settings },
];

export function GodHeader() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Left: Branding */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Crown className="w-6 h-6 text-warning" />
                            <h1 className="text-xl font-bold text-foreground">
                                SigilOS <span className="text-warning">GOD</span>
                            </h1>
                        </div>
                        <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-warning/10 border border-warning/30 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                            <span className="text-xs font-medium text-warning uppercase tracking-wider">
                                Super Admin
                            </span>
                        </div>
                    </div>

                    {/* Center: Navigation */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                                        isActive
                                            ? "bg-info text-info-foreground shadow-lg shadow-indigo-600/30"
                                            : "text-muted-foreground hover:text-foreground hover:bg-elevated/50"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-elevated/50 transition-all"
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">Retour App</span>
                        </Link>
                        <button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-danger hover:text-danger hover:bg-danger/30 transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Déconnexion</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
