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
    BookOpen,
    Calendar,
    Search,
    Coins,
    Users,
    Trophy,
    Gem,
    Sparkles,
    ScrollText,
    LayoutGrid,
    User
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

    const CORE_ITEMS = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, lucide: LayoutDashboard, color: "#3b82f6", exact: true, visible: true },
        { name: "Mon Profil", href: `/dashboard/${guildId}/profile`, lucide: User, color: "#10b981", visible: true },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, lucide: BookOpen, color: "#a855f7", visible: true },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, lucide: ScrollText, color: "#ef4444", visible: user.canViewMissions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, lucide: Sparkles, color: "#d946ef", visible: user.canViewSonges },
        { name: "Bourse", href: `/dashboard/${guildId}/archimonstres`, lucide: Gem, color: "#eab308", visible: user.canViewArchis },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, lucide: Trophy, color: "#f59e0b", visible: user.canViewLadder },
    ];

    const APP_ITEMS = [
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, lucide: Calendar, color: "#22d3ee", visible: user.isMember || user.canViewCalendar },
        { name: "Recherche", href: `/dashboard/${guildId}/finder`, lucide: Search, color: "#3b82f6", visible: true },
        { name: "Services", href: `/dashboard/${guildId}/passages`, lucide: Coins, color: "#f59e0b", visible: true },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, lucide: Users, color: "#818cf8", visible: user.canViewRoster },
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
                {/* 0. APP BRAND IDENTITY (SigilOS) */}
                <div className="hidden 2xl:flex items-center gap-4 pr-4 shrink-0 select-none group/brand">
                    <div className="relative h-12 w-12">
                        <Image
                            src="/assets/ui/logo_sigilos.png"
                            alt="SigilOS"
                            fill
                            className="object-contain mix-blend-screen transition-transform duration-500"
                        />
                    </div>
                    <div className="flex flex-col justify-center">
                        <span className="text-2xl font-black tracking-widest text-white leading-none">SIGIL<span className="text-primary">OS</span></span>
                    </div>
                </div>

                {/* 1. GUILD IDENTITY (FUSED) */}
                <Link href={`/dashboard/${guildId}`} className="flex items-center gap-3 sm:gap-4 group shrink-0 pl-4 border-l border-white/5">
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
                        <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">GUILDE</span>
                        <span className="text-lg sm:text-xl font-black italic tracking-tighter leading-none group-hover:text-primary transition-colors text-white uppercase">{guildData.name}</span>
                    </div>
                </Link>

                {/* 2. CENTER: MODULE DOCK (Icons Only) */}
                <div className="flex-1 flex items-center justify-center px-4">
                    <nav className="flex items-center gap-4 sm:gap-8 p-2">
                        <TooltipProvider delayDuration={0}>
                            {CORE_ITEMS.filter(item => item.visible).map((item) => {
                                const active = isActive(item.href, item.exact);
                                return (
                                    <Tooltip key={item.href}>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={item.href}
                                                className={cn(
                                                    "relative flex items-center justify-center transition-all duration-300 group/nav shrink-0",
                                                    active ? "scale-110" : "hover:scale-110 opacity-60 hover:opacity-100"
                                                )}
                                            >
                                                <div className={cn(
                                                    "relative w-12 h-12 sm:w-16 sm:h-16 transition-all duration-500 flex items-center justify-center",
                                                    active ? "drop-shadow-[0_0_15px_rgba(147,51,234,0.3)]" : ""
                                                )}>
                                                    <item.lucide
                                                        className={cn(
                                                            "w-6 h-6 sm:w-8 sm:h-8 transition-all duration-300",
                                                            active ? "stroke-[2px] scale-110" : "stroke-[1.5px] opacity-70 group-hover:opacity-100 group-hover:scale-110"
                                                        )}
                                                        style={{
                                                            color: item.color || "#fff",
                                                            filter: active ? `drop-shadow(0 0 8px ${item.color})` : "none"
                                                        }}
                                                    />
                                                </div>

                                                {/* Active Indicator Dot */}
                                                {active && (
                                                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_5px_var(--primary)]" />
                                                )}
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="font-bold tracking-wider bg-black/90 border-white/10 text-primary">
                                            {item.name}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}

                            {/* Separator */}
                            <div className="w-px h-8 bg-white/10 mx-2" />

                            {/* Apps Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger className="outline-none">
                                    <div className={cn(
                                        "relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 transition-all duration-300 group/nav shrink-0 opacity-60 hover:opacity-100 hover:scale-110"
                                    )}>
                                        <div className="relative flex items-center justify-center">
                                            <LayoutGrid
                                                className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.5px] text-white transition-all duration-300 group-hover:stroke-[2px]"
                                            />
                                        </div>
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-900/98 border-white/10 backdrop-blur-2xl text-white min-w-[200px] p-2">
                                    <DropdownMenuLabel className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Outils & Services</DropdownMenuLabel>
                                    {APP_ITEMS.filter(item => item.visible).map((item) => (
                                        <DropdownMenuItem key={item.href} asChild>
                                            <Link href={item.href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer group">
                                                <item.lucide
                                                    className="w-5 h-5 transition-colors"
                                                    style={{ color: item.color }}
                                                />
                                                <span className="font-medium group-hover:text-white transition-colors">{item.name}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipProvider>
                    </nav>
                </div>

                {/* 3. RIGHT: SYSTEM TRAY */}
                <div className="flex items-center gap-3 shrink-0">

                    {/* Online Status */}
                    <div className="hidden lg:block">
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-10 px-3 flex items-center justify-center gap-2 rounded-xl bg-black/40 border border-white/5 hover:border-emerald-500/50 transition-all cursor-help group/online relative">
                                        <div className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-[10px] font-black text-zinc-400 group-hover/online:text-emerald-400">
                                            {guildData.activeCount} <span className="hidden xl:inline opacity-50 font-bold">EN LIGNE</span>
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>Connectés</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>


                    {/* Admin Trigger */}
                    {
                        hasAnyAdminPermission && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="h-10 px-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500 hover:text-black transition-all group/admin shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                                        <Shield className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-wider hidden xl:inline">ADMIN</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 bg-zinc-900/98 backdrop-blur-2xl border-amber-500/20 text-white rounded-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mr-4">
                                    <DropdownMenuLabel className="text-amber-500 text-[10px] font-black uppercase tracking-widest px-2 py-2">
                                        Panneau Administration
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-amber-500/10" />
                                    {ADMIN_ITEMS.filter(item => item.visible).map(item => (
                                        <DropdownMenuItem key={item.href} className="rounded-lg focus:bg-amber-500/10 focus:text-amber-500 cursor-pointer" asChild>
                                            <Link href={item.href} className="flex items-center gap-3 py-2">
                                                <item.icon className="h-4 w-4 opacity-70" />
                                                <span className="text-xs font-bold">{item.name}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    }

                    {/* Notifications */}
                    {
                        user.id && (
                            <Link
                                href={`/dashboard/${guildId}/notifications`}
                                className={cn(
                                    "h-10 w-10 flex items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all relative group",
                                    pathname.endsWith("/notifications") && "bg-primary/20 text-primary border-primary/20"
                                )}
                            >
                                <NotificationBell userId={user.id} mode="simple" />
                            </Link>
                        )
                    }

                    {/* User Profile Trigger */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none ml-1">
                            <div className="flex items-center gap-3 p-1 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group/user pr-4">
                                <Avatar className="h-9 w-9 border-2 border-white/10 group-hover/user:border-primary/50 transition-colors shadow-lg">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-xs font-bold">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start hidden lg:flex">
                                    <span className="text-white font-bold text-xs leading-none">{user.name}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-50 leading-none mt-1" style={{ color: roleColorHex }}>
                                        {user.roleName}
                                    </span>
                                </div>
                                <ChevronDown className="h-3 w-3 text-zinc-500 group-hover/user:text-white transition-colors ml-1 hidden lg:block" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-zinc-900/98 backdrop-blur-2xl border-white/10 text-white rounded-xl p-2 mt-2 shadow-2xl">
                            <div className="relative h-24 bg-gradient-to-br from-primary/20 to-purple-900/20 rounded-lg mb-8 overflow-hidden">
                                {/* Banner Placeholder */}
                                <div className="absolute inset-0 bg-[url('/assets/ui/noise.png')] opacity-20"></div>
                                <div className="absolute -bottom-6 left-4 rounded-full p-1 bg-zinc-900">
                                    <Avatar className="h-16 w-16 border-4 border-zinc-900 shadow-xl">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-lg font-black">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>
                            <div className="px-2 pb-2">
                                <div className="font-bold text-lg leading-none">{user.name}</div>
                                <div className="text-[10px] font-bold uppercase opacity-50 mt-1" style={{ color: roleColorHex }}>{user.roleName}</div>
                            </div>

                            <DropdownMenuSeparator className="bg-white/5 my-2" />

                            <DropdownMenuItem className="rounded-lg py-2 focus:bg-white/5 cursor-pointer group" asChild>
                                <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <LayoutDashboard className="h-4 w-4 opacity-70 group-hover:text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">Mon Profil</span>
                                        <span className="text-[10px] opacity-50">Voir mes statistiques</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem className="rounded-lg py-2 focus:bg-white/5 cursor-pointer group" asChild>
                                <Link href={`/dashboard/${guildId}/notifications`} className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Zap className="h-4 w-4 opacity-70 group-hover:text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">Notifications</span>
                                        <span className="text-[10px] opacity-50">Centre de messages</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-white/5 my-2" />

                            <DropdownMenuItem className="rounded-lg py-2 focus:bg-red-500/10 focus:text-red-400 text-red-400 cursor-pointer group" onClick={() => signOut()}>
                                <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                                    <LogOut className="h-4 w-4" />
                                </div>
                                <span className="font-bold ml-3">Déconnexion</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
