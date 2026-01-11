"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, UserCircle, Shield, Menu, ScrollText, ClipboardList, Swords, Gavel, Palmtree, Bug, Trophy } from "lucide-react";
import { UserWidget } from "./user-widget";
import type { UserContext } from "@/server/actions/user-actions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

type Props = {
    className?: string;
    user: UserContext;
    guildId: string;
};

export function AppSidebar({ className, user, guildId }: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string, exact = false) => {
        return exact ? pathname === href : pathname.startsWith(href);
    };

    // Dynamic Navigation Items
    const NAV_ITEMS = [
        { name: "Vue d'ensemble", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true, visible: true },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, visible: user.canViewMissions },
        { name: "Validation", href: `/dashboard/${guildId}/missions/validation`, icon: Gavel, visible: user.canValidateMissions },
        { name: "Bourse Archis", href: `/dashboard/${guildId}/archimonstres`, icon: Bug, visible: true },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, visible: true },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, visible: true },
        { name: "Mon Profil", href: `/dashboard/${guildId}/profile`, icon: UserCircle, visible: true },
    ];

    const NavContent = () => (
        <div className="flex flex-col h-full py-6">
            <div className="px-6 mb-8">
                <Link href={`/dashboard/${guildId}`} className="flex items-center gap-2">
                    <span className="text-3xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary animate-pulse-slow">
                        SIGILOS
                    </span>
                </Link>
            </div>

            <div className="flex-1 px-4 space-y-1">
                {NAV_ITEMS.filter(item => item.visible).map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                        <Button
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 h-12 text-base font-medium",
                                isActive(item.href, item.exact)
                                    ? "bg-primary/10 text-primary border-r-2 border-primary rounded-r-none"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive(item.href, item.exact) ? "text-primary" : "text-muted-foreground")} />
                            {item.name}
                        </Button>
                    </Link>
                ))}

                {/* Admin Link - Only visible if admin */}
                {user.isAdmin && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Administration
                        </p>
                        <Link href={`/dashboard/${guildId}/admin`} onClick={() => setMobileOpen(false)}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-12 text-base font-medium",
                                    isActive(`/dashboard/${guildId}/admin`) && !isActive(`/dashboard/${guildId}/admin/absence`)
                                        ? "bg-amber-500/10 text-amber-500 border-r-2 border-amber-500 rounded-r-none"
                                        : "text-muted-foreground hover:bg-amber-500/5 hover:text-amber-500"
                                )}
                            >
                                <Shield className="h-5 w-5 text-amber-500" />
                                Gestion Droits
                            </Button>
                        </Link>
                        <Link href={`/dashboard/${guildId}/missions/manage`} onClick={() => setMobileOpen(false)}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-12 text-base font-medium",
                                    isActive(`/dashboard/${guildId}/missions/manage`)
                                        ? "bg-amber-500/10 text-amber-500 border-r-2 border-amber-500 rounded-r-none"
                                        : "text-muted-foreground hover:bg-amber-500/5 hover:text-amber-500"
                                )}
                            >
                                <Swords className="h-5 w-5 text-amber-500" />
                                Gestion Missions
                            </Button>
                        </Link>
                        <Link href={`/dashboard/${guildId}/admin/absence`} onClick={() => setMobileOpen(false)}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-12 text-base font-medium",
                                    isActive(`/dashboard/${guildId}/admin/absence`)
                                        ? "bg-cyan-500/10 text-cyan-400 border-r-2 border-cyan-400 rounded-r-none"
                                        : "text-muted-foreground hover:bg-cyan-500/5 hover:text-cyan-400"
                                )}
                            >
                                <Palmtree className="h-5 w-5 text-cyan-400" />
                                Gestion Absences
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            <div className="px-4 mt-auto space-y-4">
                <UserWidget user={user} guildId={guildId} />

                {/* Footer / Legal Section */}
                <div className="px-2 py-2 border-t border-white/5 flex flex-col gap-1">
                    <p className="text-[10px] text-muted-foreground/40 font-mono text-center">
                        v0.1.0-Alpha
                    </p>
                    <div className="flex justify-center gap-3 text-[10px] text-muted-foreground/60">
                        <Link href="#" className="hover:text-primary transition-colors">Légal</Link>
                        <span>•</span>
                        <Link href="#" className="hover:text-primary transition-colors">Confidentialité</Link>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Trigger */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary">
                        SIGILOS
                    </span>
                </div>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 border-r-border bg-sidebar/95 backdrop-blur-xl">
                        <NavContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className={cn("hidden md:flex w-72 flex-col border-r border-sidebar-border bg-sidebar/50 h-screen sticky top-0 backdrop-blur-xl", className)}>
                <NavContent />
            </div>
        </>
    );
}
