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
    Compass, // New for Finder
    Key, // New for Services (Passages)
    Users,
    Trophy,
    Ghost, // New for Archimonstres
    Sparkles,
    ScrollText,
    Dna
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

    // --- NAVIGATION CONFIG ---
    // Icons are now LARGER and carry their COLOR INTINTIONALLY by default (muted)

    // Group 1: Core / Management
    const NAV_GROUP_CORE = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, color: "text-blue-400", exact: true, visible: true },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: BookOpen, color: "text-violet-400", visible: true },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "text-cyan-400", visible: user.isMember || user.canViewCalendar },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "text-indigo-400", visible: user.canViewRoster },
    ];



    // Group 2: Features / Gameplay
    // Colors are explicit to help identification
    const NAV_GROUP_FEATURES = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "text-emerald-400", shadow: "shadow-emerald-500/50", visible: user.canViewMissions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "text-fuchsia-400", shadow: "shadow-fuchsia-500/50", visible: user.canViewSonges },
        { name: "Bourse", href: `/dashboard/${guildId}/archimonstres`, icon: Ghost, color: "text-amber-400", shadow: "shadow-amber-500/50", visible: user.canViewArchis },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "text-yellow-400", shadow: "shadow-yellow-500/50", visible: user.canViewLadder },
    ];

    // Group 3: Tools
    const NAV_GROUP_TOOLS = [
        { name: "Services", href: `/dashboard/${guildId}/passages`, icon: Key, color: "text-orange-400", visible: true },
        { name: "Recherche", href: `/dashboard/${guildId}/finder`, icon: Compass, color: "text-zinc-400", visible: true },
    ];

    const ADMIN_ITEMS = [
        { name: "Gestion Droits", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, visible: user.isAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "Éditer Présentation", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "Validation", href: `/dashboard/${guildId}/missions/validation`, icon: Gavel, visible: user.canValidateMissions },
        { name: "Gestion Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "Logs", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.isAdmin },
    ];

    const hasAnyAdminPermission = user.isAdmin || user.canManageMissions || user.canValidateMissions || user.canEditPresentation;
    const roleColorHex = user.roleColor && user.roleColor !== 0
        ? `#${user.roleColor.toString(16).padStart(6, '0')}`
        : "var(--primary)";

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
            // V3: Background is darker/solid to separate from content. Border is explicit.
            "bg-[#030304]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl py-2"
        )}>
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

                {/* --- ZONE A: BRANDING & CONTEXT (Left) --- */}
                <div className="flex items-center gap-6 shrink-0">

                    {/* 1. App Brand (SigilOS) - LARGER & BRIGHTER */}
                    <Link href="/" className="hidden xl:flex items-center gap-3 group/brand select-none hover:brightness-125 transition-all">
                        <div className="relative h-10 w-10 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            <Image
                                src="/assets/ui/logo-v2.png"
                                alt="SigilOS"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-xl font-black tracking-[0.2em] text-white leading-none font-heading relative top-[1px]">
                                SIGIL<span className="text-primary drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">OS</span>
                            </span>
                        </div>
                    </Link>

                    {/* Divider */}
                    <div className="h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden xl:block" />

                    {/* 2. Guild Context */}
                    <Link
                        href={`/dashboard/${guildId}`}
                        className="flex items-center gap-3 group select-none relative"
                        title="Retour au Dashboard"
                    >
                        {/* Glow effect for guild branding */}
                        <div className="absolute -inset-3 bg-white/5 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>

                        <div className="relative">
                            <Avatar className="h-10 w-10 border-2 border-white/10 group-hover:border-white/30 transition-colors shadow-lg rounded-xl">
                                <AvatarImage src={guildData.iconUrl || undefined} />
                                <AvatarFallback className="bg-zinc-900 text-zinc-500 font-black text-xs rounded-xl">
                                    {guildData.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="flex flex-col relative">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-none mb-0.5"> Guilde</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-base font-black text-white tracking-wide uppercase group-hover:text-primary transition-colors line-clamp-1 max-w-[150px]">
                                    {guildData.name}
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* --- ZONE B: COMMAND NAV (Center) --- */}
                <nav className="flex-1 hidden md:flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#0A0A0C] border border-white/5 shadow-inner">

                        <TooltipProvider delayDuration={0}>
                            {NAV_GROUP_CORE.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href, item.exact)} />
                            ))}

                            <div className="w-px h-6 bg-white/10 mx-3" />

                            {NAV_GROUP_FEATURES.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}

                            <div className="w-px h-6 bg-white/10 mx-3" />

                            {NAV_GROUP_TOOLS.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </TooltipProvider>

                    </div>
                </nav>

                {/* --- ZONE C: SYSTEM TRAY (Right) --- */}
                <div className="flex items-center gap-4 shrink-0">

                    {/* ALMANAX WIDGET */}
                    <div className="hidden 2xl:block opacity-90 hover:opacity-100 transition-opacity scale-95 border-r border-white/10 pr-4 mr-0">
                        {almanaxWidget}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Admin - Explicit Button */}
                        {hasAnyAdminPermission && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className={cn(
                                        "h-9 px-3 flex items-center gap-2 rounded-lg transition-all duration-300 outline-none font-bold text-[10px] uppercase tracking-wider border",
                                        isActive(`/dashboard/${guildId}/admin`)
                                            ? "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                            : "bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-white"
                                    )}>
                                        <Shield className="w-3.5 h-3.5" />
                                        <span className="hidden xl:inline">Admin</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-[#0A0A0C]/95 backdrop-blur-xl border border-white/10 text-white p-1 shadow-2xl">
                                    <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Administration
                                    </div>
                                    <DropdownMenuSeparator className="bg-white/5" />
                                    {ADMIN_ITEMS.filter(i => i.visible).map(item => (
                                        <DropdownMenuItem key={item.href} asChild>
                                            <Link href={item.href} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-white/5 cursor-pointer group">
                                                <div className="p-1 rounded bg-white/5 group-hover:bg-amber-500/20 transition-colors">
                                                    <item.icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-500" />
                                                </div>
                                                <span className="text-xs font-bold text-zinc-300 group-hover:text-white">{item.name}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Notification Bell */}
                        {user.id && (
                            <Link
                                href={`/dashboard/${guildId}/notifications`}
                                className={cn(
                                    "h-9 w-9 flex items-center justify-center rounded-lg transition-all duration-300",
                                    isActive('notifications')
                                        ? "text-primary bg-primary/10 border border-primary/20"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
                                )}
                            >
                                <NotificationBell userId={user.id} mode="simple" />
                            </Link>
                        )}
                    </div>

                    {/* User Profile - RESTORED NAME */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="outline-none group">
                            <div className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-pointer">
                                <Avatar className="h-8 w-8 border border-white/10 group-hover:border-primary/50 transition-all shadow-md">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-[10px] font-bold">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-[80px]">
                                    <span className="text-xs font-bold text-white leading-none truncate max-w-[100px]">{user.name}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 leading-none mt-1" style={{ color: roleColorHex }}>
                                        {user.roleName}
                                    </span>
                                </div>
                                <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-[#0A0A0C]/95 backdrop-blur-xl border border-white/10 text-white p-1.5 shadow-2xl mt-2 rounded-xl">
                            <div className="bg-white/5 rounded-lg p-3 mb-1 flex items-center gap-3">
                                <Avatar className="h-12 w-12 border-2 border-white/10 shadow-xl">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-lg font-black">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-bold text-sm text-white">{user.name}</div>
                                    <div className="text-[10px] font-bold uppercase mt-0.5 tracking-wide text-zinc-400">{user.roleName}</div>
                                </div>
                            </div>

                            <div className="grid gap-1">
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5 group">
                                        <LayoutDashboard className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
                                        <span className="font-bold text-xs">Mon Profil</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/${guildId}/admin/settings`} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5 group">
                                        <Settings className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                                        <span className="font-bold text-xs">Paramètres</span>
                                    </Link>
                                </DropdownMenuItem>
                            </div>

                            <DropdownMenuSeparator className="bg-white/5 my-1" />

                            <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-red-500/10 group focus:bg-red-500/10">
                                <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors" />
                                <span className="font-bold text-xs text-red-400 group-hover:text-red-300">Déconnexion</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>
            </div>
        </header>
    );
}

// Sub-component for clean rendering
// V3: INCREASED SIZE, ADDED DEFAULT COLOR HINTS
// Sub-component for clean rendering
// V3: INCREASED SIZE, ADDED DEFAULT COLOR HINTS
function NavIcon({ item, isActive }: { item: any, isActive: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={item.href}
                    className={cn(
                        "relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 group", // Square-ish rounded for "App" feel
                        isActive
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                    )}
                >
                    <item.icon
                        className={cn(
                            "w-6 h-6 transition-all duration-300 stroke-[2px]", // Bigger, bolder
                            isActive ? item.color || "text-white" : "text-zinc-500 group-hover:text-zinc-300",
                            // Use color hint on hover even if not active?
                            !isActive && "group-hover:scale-110",
                            !isActive && item.color ? `group-hover:${item.color.replace('text-', 'text-opacity-80 text-')}` : "" // Trick to apply color on hover
                        )}
                        style={
                            isActive && item.shadow
                                ? { filter: `drop-shadow(0 0 8px ${getColor(item.color)})` }
                                : !isActive
                                    ? { filter: 'grayscale(100%) opacity(0.7)' } // Default is grayscale to reduce noise, color on hover/active
                                    : {}
                        }
                    />

                    {/* Active Indicator Bar (Top or Bottom? Let's do Bottom Glow) */}
                    {isActive && (
                        <span className={cn(
                            "absolute -bottom-1 w-5 h-0.5 rounded-full shadow-[0_0_10px_currentColor]",
                            item.color ? item.color.replace('text-', 'bg-') : "bg-white"
                        )} />
                    )}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px] font-bold uppercase tracking-wider bg-black/90 border-white/10 text-white shadow-xl">
                {item.name}
            </TooltipContent>
        </Tooltip>
    );
}

function getColor(twClass: string | undefined) {
    if (!twClass) return "white";
    if (twClass.includes("emerald")) return "#10b981";
    if (twClass.includes("purple")) return "#c084fc";
    if (twClass.includes("amber")) return "#fbbf24";
    if (twClass.includes("yellow")) return "#facc15";
    if (twClass.includes("blue")) return "#60a5fa";
    if (twClass.includes("violet")) return "#a78bfa";
    if (twClass.includes("cyan")) return "#22d3ee";
    if (twClass.includes("indigo")) return "#818cf8";
    if (twClass.includes("fuchsia")) return "#e879f9";
    if (twClass.includes("orange")) return "#fb923c";
    return "white";
}
