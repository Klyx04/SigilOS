"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Shield,
    Settings,
    Gavel,
    Swords,
    FileText,
    LogOut,
    ChevronDown,
    Zap,
    LayoutDashboard,
    BookOpen
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type UserContext } from "@/server/actions/user-actions";
import { type GuildHeaderData } from "@/server/actions/guild-actions";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GalacticHeader({
    guildId,
    user,
    guildData,
    almanaxWidget
}: {
    guildId: string,
    user: UserContext,
    guildData: GuildHeaderData,
    almanaxWidget: React.ReactNode
}) {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const isActive = (href: string, exact = false) => {
        return exact ? pathname === href : pathname.startsWith(href);
    };

    const NAV_ITEMS = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: "/assets/ui/icons/profile.png", lucide: LayoutDashboard, exact: true, visible: true },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: "/assets/ui/icons/members.png", lucide: BookOpen, visible: true },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: "/assets/ui/icons/missions.png", visible: user.canViewMissions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: "/assets/ui/icons/songes.png", visible: user.canViewSonges },
        { name: "Bourse", href: `/dashboard/${guildId}/archimonstres`, icon: "/assets/ui/icons/archis.png", visible: user.canViewArchis },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: "/assets/ui/icons/ladder.png", visible: user.canViewLadder },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: "/assets/ui/icons/calendar.png", visible: user.isMember || user.canViewCalendar },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: "/assets/ui/icons/members.png", visible: user.canViewRoster },
    ];

    const ADMIN_ITEMS = [
        { name: "Gestion Droits", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, visible: user.isAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "Éditer Présentation", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "Validation Missions", href: `/dashboard/${guildId}/missions/validation`, icon: Gavel, visible: user.canValidateMissions },
        { name: "Gestion Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "Logs Audit", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.isAdmin },
    ];

    const hasAnyAdminPermission = user.isAdmin || user.canManageMissions || user.canValidateMissions || user.canEditPresentation;

    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-2 sm:px-6 py-2 sm:py-4",
            scrolled ? "bg-black/60 backdrop-blur-2xl border-b border-white/10 py-2 sm:py-3" : "bg-transparent"
        )}>
            <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
                {/* 1. GUILD IDENTITY (FUSED) */}
                <Link href={`/dashboard/${guildId}`} className="flex items-center gap-2 sm:gap-4 group shrink-0">
                    <div className="relative group/avatar">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-20 group-hover/avatar:opacity-40 transition duration-500"></div>
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-white/10 relative shadow-2xl group-hover:border-primary/50 transition-colors">
                            <AvatarImage src={guildData.iconUrl || undefined} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 font-black">
                                {guildData.name?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="flex flex-col hidden sm:flex">
                        <span className="text-lg sm:text-xl font-black italic tracking-tighter leading-none group-hover:text-primary transition-colors text-white uppercase">{guildData.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 w-1 rounded-full bg-primary/50 animate-pulse"></div>
                            <span className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase hidden md:inline">SigilOS Interface</span>
                        </div>
                    </div>
                </Link>

                {/* 2. UNIFIED CONTROL BAR (Nav + Tools) */}
                <div className="flex-1 flex items-center justify-between gap-2 sm:gap-4 bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-1.5 sm:p-2 ml-2 sm:ml-6 shadow-inner shadow-black/50 overflow-hidden relative">

                    {/* Navigation Area */}
                    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade">
                        {NAV_ITEMS.filter(item => item.visible).map((item) => {
                            const active = isActive(item.href, item.exact);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex flex-col items-center justify-center min-w-[42px] sm:min-w-[64px] h-10 sm:h-14 rounded-xl transition-all relative group/nav shrink-0",
                                        active ? "bg-white/10 shadow-[0_0_15px_rgba(147,51,234,0.15)]" : "hover:bg-white/5"
                                    )}
                                >
                                    <div className={cn(
                                        "relative w-6 h-6 sm:w-7 sm:h-7 transition-all duration-300 group-hover/nav:scale-110",
                                        active ? "scale-110 drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]" : "opacity-70 group-hover/nav:opacity-100"
                                    )}>
                                        <Image
                                            src={item.icon}
                                            alt={item.name}
                                            fill
                                            className="object-contain"
                                            sizes="32px"
                                        />
                                    </div>
                                    <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wider mt-0.5 transition-colors hidden xl:inline",
                                        active ? "text-primary" : "text-zinc-500 group-hover/nav:text-zinc-300"
                                    )}>
                                        {item.name}
                                    </span>
                                    {active && (
                                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full shadow-[0_0_8px_var(--primary)]" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Divider */}
                    <div className="h-8 w-px bg-white/5 shrink-0 hidden lg:block" />

                    {/* Right Side Widgets (Fused) */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Almanax */}
                        <div className="hidden 2xl:block scale-90 origin-right">
                            {almanaxWidget}
                        </div>

                        {/* Online Status */}
                        <div className="hidden lg:block">
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/5 hover:border-emerald-500/30 transition-all cursor-help group/online">
                                            <div className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 group-hover/online:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-shadow"></span>
                                            </div>
                                            <span className="text-xs font-bold text-zinc-400 group-hover/online:text-emerald-400 transition-colors uppercase tracking-tight">
                                                {guildData.activeCount} <span className="hidden xl:inline opacity-50 font-normal ml-1">en ligne</span>
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-zinc-950 border-emerald-500/20 text-emerald-400">
                                        <p className="font-bold">Membres connectés</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Admin Button */}
                        {hasAnyAdminPermission && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="h-9 w-9 sm:w-auto sm:px-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-500 flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-black transition-all font-bold text-[10px] uppercase italic tracking-tighter hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                        <Shield className="h-4 w-4" />
                                        <span className="hidden sm:inline">ADMIN</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 bg-zinc-900/98 backdrop-blur-2xl border-amber-500/20 text-white rounded-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    <DropdownMenuLabel className="text-amber-500 text-[10px] font-black uppercase tracking-widest px-2 py-2">
                                        Administration
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-amber-500/10" />
                                    {ADMIN_ITEMS.filter(item => item.visible).map(item => (
                                        <DropdownMenuItem key={item.href} className="rounded-lg focus:bg-amber-500/10 focus:text-amber-500 cursor-pointer" asChild>
                                            <Link href={item.href} className="flex items-center gap-3">
                                                <item.icon className="h-3.5 w-3.5 opacity-70" />
                                                <span className="text-xs font-semibold">{item.name}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Notification Bell */}
                        {user.id && (
                            <div className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
                                <NotificationBell userId={user.id} />
                            </div>
                        )}

                        {/* User Profile */}
                        <DropdownMenu>
                            <DropdownMenuTrigger className="focus:outline-none">
                                <div className="flex items-center gap-3 pl-2 sm:pl-3 py-1 pr-1 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group/user">
                                    <div className="flex flex-col items-end hidden md:flex">
                                        <span className="text-white font-bold text-xs leading-none">{user.name}</span>
                                        <span className="text-[9px] font-black uppercase tracking-wider opacity-70 leading-none mt-0.5" style={{ color: roleColorHex }}>{user.roleName}</span>
                                    </div>
                                    <Avatar className="h-8 w-8 border border-white/10 group-hover/user:border-primary/50 transition-colors shadow-lg">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-xs">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-zinc-900/98 backdrop-blur-2xl border-white/10 text-white rounded-xl p-1.5 mt-2">
                                <DropdownMenuLabel className="font-bold flex flex-col p-2">
                                    <span className="text-sm">{user.name}</span>
                                    <span className="text-[10px] uppercase opacity-50" style={{ color: roleColorHex }}>{user.roleName}</span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem className="rounded-lg focus:bg-white/5 cursor-pointer" asChild>
                                    <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-2">
                                        <LayoutDashboard className="h-4 w-4 opacity-50" />
                                        <span>Mon Profil</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg focus:bg-red-500/10 focus:text-red-400 text-red-400 cursor-pointer" onClick={() => signOut()}>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    <span>Déconnexion</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </header>
    );
}
