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
    Ghost, // Legacy for Archimonstres
    Crown, // New for Quête Ocre
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
    userGuilds = [],
}: {
    guildId: string,
    user: UserContext,
    guildData: GuildHeaderData,
    userGuilds?: { id: string, name: string, iconUrl: string | null }[],
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
        { name: "Tableau de bord", href: `/dashboard/${guildId}`, icon: LayoutDashboard, color: "text-info", exact: true, visible: true },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: BookOpen, color: "text-violet-400", visible: true },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "text-success", visible: user.isMember || user.canViewCalendar },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "text-info", visible: user.canViewRoster },
    ];



    // Group 2: Features / Gameplay
    // Colors are explicit to help identification
    const NAV_GROUP_FEATURES = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "text-success", shadow: "shadow-emerald-500/50", visible: user.canViewMissions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "text-fuchsia-400", shadow: "shadow-fuchsia-500/50", visible: user.canViewSonges },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, icon: Crown, color: "text-warning", shadow: "shadow-amber-500/50", visible: user.canViewOcre },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "text-yellow-400", shadow: "shadow-yellow-500/50", visible: user.canViewLadder },
    ];

    // Group 3: Tools
    const NAV_GROUP_TOOLS = [
        { name: "Services", href: `/dashboard/${guildId}/services`, icon: Key, color: "text-orange-400", visible: true },
        { name: "Recherche", href: `/dashboard/${guildId}/finder`, icon: Compass, color: "text-muted-foreground", visible: true },
    ];

    const ADMIN_ITEMS = [
        { name: "Gestion Droits", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, visible: user.isAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "Éditer Présentation", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "Centre Validation", href: `/dashboard/${guildId}/admin/validation`, icon: Gavel, visible: user.canValidateMissions || user.isAdmin },
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
            "bg-background/80 dark:bg-black/60 backdrop-blur-3xl backdrop-saturate-150 border-b border-border shadow-2xl py-1"
        )}>
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-4">

                {/* --- ZONE A: BRANDING & CONTEXT (Left) --- */}
                <div className="flex items-center gap-6 shrink-0">

                    {/* 1. App Brand (SigilOS) - LARGER & BRIGHTER */}
                    <Link href="/" className="hidden xl:flex items-center gap-3 group/brand select-none hover:brightness-125 transition-all">
                        <div className="relative h-10 w-10 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            <Image
                                src="/assets/ui/logo-v2.png"
                                alt="SigilOS"
                                fill
                                sizes="40px"
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-xl font-black tracking-[0.2em] text-foreground leading-none font-heading relative top-[1px]">
                                SIGIL<span className="text-primary drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">OS</span>
                            </span>
                        </div>
                    </Link>

                    {/* Divider */}
                    <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden xl:block" />

                    {/* 2. Guild Context / Switcher */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div
                                className="flex items-center gap-3 group select-none relative cursor-pointer hover:bg-foreground/5 p-1 rounded-xl transition-all"
                                title="Changer de guilde"
                            >
                                {/* Glow effect for guild branding */}
                                <div className="absolute -inset-1 bg-surface rounded-xl blur-md opacity-0 group-hover:opacity-100 transition duration-300"></div>

                                <div className="relative">
                                    <Avatar className="h-10 w-10 border-2 border-border group-hover:border-primary/50 transition-all shadow-lg rounded-xl">
                                        <AvatarImage src={guildData.iconUrl || undefined} />
                                        <AvatarFallback className="bg-muted text-muted-foreground font-black text-xs rounded-xl">
                                            {guildData.name?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {userGuilds.length > 1 && (
                                        <div className="absolute -bottom-1 -right-1 bg-primary text-caption font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                                            {userGuilds.length}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col relative pr-6">
                                    <span className="text-caption font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Guilde Active</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1 max-w-[150px]">
                                            {guildData.name}
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 bg-background border border-border text-foreground p-2 shadow-2xl mt-4 rounded-2xl backdrop-blur-2xl">
                            <DropdownMenuLabel className="text-caption font-black uppercase tracking-widest text-muted-foreground px-2 py-2">
                                Vos Guildes SigilOS
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-surface mx-1 mb-2" />
                            <div className="grid gap-1">
                                {userGuilds.map((g) => (
                                    <DropdownMenuItem key={g.id} asChild>
                                        <Link
                                            href={`/dashboard/${g.id}`}
                                            className={cn(
                                                "flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border border-transparent",
                                                g.id === guildId
                                                    ? "bg-primary/10 border-primary/20"
                                                    : "hover:bg-surface hover:border-border"
                                            )}
                                        >
                                            <Avatar className="h-9 w-9 border border-border rounded-lg">
                                                <AvatarImage src={g.iconUrl || undefined} />
                                                <AvatarFallback className="bg-surface text-caption font-bold">
                                                    {g.name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    g.id === guildId ? "text-primary" : "text-foreground"
                                                )}>
                                                    {g.name}
                                                </span>
                                                {g.id === guildId && (
                                                    <span className="text-caption font-bold text-primary uppercase tracking-widest">Actuel</span>
                                                )}
                                            </div>
                                            {g.id === guildId && (
                                                <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />
                                            )}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* --- ZONE B: COMMAND NAV (Center) --- */}
                <nav className="flex-1 hidden md:flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-muted/40 border border-border shadow-inner">

                        <TooltipProvider delayDuration={0}>
                            {NAV_GROUP_CORE.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href, item.exact)} />
                            ))}

                            <div className="w-px h-6 bg-elevated mx-3" />

                            {NAV_GROUP_FEATURES.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}

                            <div className="w-px h-6 bg-elevated mx-3" />

                            {NAV_GROUP_TOOLS.filter(i => i.visible).map(item => (
                                <NavIcon key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </TooltipProvider>

                    </div>
                </nav>

                {/* --- ZONE C: SYSTEM TRAY (Right) --- */}
                <div className="flex items-center gap-4 shrink-0">


                    <div className="flex items-center gap-2">
                        {/* Admin - Explicit Button */}
                        {hasAnyAdminPermission && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className={cn(
                                        "h-10 px-4 flex items-center gap-2.5 rounded-xl transition-all duration-300 outline-none font-black text-caption uppercase tracking-[0.15em] border",
                                        isActive(`/dashboard/${guildId}/admin`)
                                            ? "bg-warning/10 text-warning border-warning/30 "
                                            : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                                    )}>
                                        <Shield className={cn("w-4 h-4", isActive(`/dashboard/${guildId}/admin`) ? "text-warning" : "text-muted-foreground")} />
                                        <span className="hidden xl:inline">Administration</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-background border border-border text-foreground p-1 shadow-2xl backdrop-blur-xl">
                                    <div className="px-2 py-1.5 text-caption font-black uppercase tracking-widest text-muted-foreground">
                                        Administration
                                    </div>
                                    <DropdownMenuSeparator className="bg-surface" />
                                    {ADMIN_ITEMS.filter(i => i.visible).map(item => (
                                        <DropdownMenuItem key={item.href} asChild>
                                            <Link href={item.href} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-surface cursor-pointer group">
                                                <div className="p-1 rounded bg-surface group-hover:bg-warning/20 transition-colors">
                                                    <item.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-warning" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground group-hover:text-foreground">{item.name}</span>
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
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border"
                                )}
                            >
                                <NotificationBell userId={user.id} guildId={guildId} mode="simple" />
                            </Link>
                        )}
                    </div>

                    {/* User Profile - RESTORED NAME */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="outline-none group">
                            <div className="flex items-center gap-3 pl-1 pr-3 py-1.5 rounded-2xl bg-muted/40 hover:bg-muted border border-border hover:border-primary/30 transition-all cursor-pointer shadow-inner">
                                <div className="relative">
                                    <Avatar className="h-8 w-8 border border-border group-hover:border-primary/50 transition-all shadow-lg">
                                        <AvatarImage src={user.image} />
                                        <AvatarFallback className="bg-muted text-caption font-black text-muted-foreground">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full " />
                                </div>
                                <div className="flex flex-col items-start min-w-[70px]">
                                    <span className="text-xs font-black text-foreground leading-none tracking-tight group-hover:text-primary transition-colors">{user.name}</span>
                                    {user.isAdmin ? (
                                        <span className="text-caption font-black uppercase tracking-[0.1em] text-info dark:text-info mt-1 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                                            Admin
                                        </span>
                                    ) : (
                                        <span className="text-caption font-bold uppercase tracking-wider opacity-50 leading-none mt-1" style={{ color: roleColorHex }}>
                                            {user.roleName}
                                        </span>
                                    )}
                                </div>
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-background border border-border text-foreground p-1.5 shadow-2xl mt-2 rounded-xl backdrop-blur-2xl">
                            <div className="bg-muted/40 rounded-xl p-4 mb-2 flex items-center gap-4 border border-border">
                                <Avatar className="h-14 w-14 border-2 border-border shadow-2xl scale-110">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-muted text-xl font-black">{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-black text-base text-foreground tracking-tight">{user.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <div className="text-caption font-black uppercase tracking-[0.1em] text-muted-foreground">En ligne</div>
                                    </div>
                                    {user.isAdmin && (
                                        <div className="mt-2 text-caption font-black uppercase tracking-widest bg-info/20 text-info dark:text-info px-2 py-0.5 rounded border border-info/30 w-fit">
                                            Staff {guildData.name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-1">
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-foreground/5 group">
                                        <LayoutDashboard className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="font-bold text-xs">Mon Profil</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/${guildId}/admin/settings`} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-foreground/5 group">
                                        <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="font-bold text-xs">Paramètres</span>
                                    </Link>
                                </DropdownMenuItem>
                            </div>

                            <DropdownMenuSeparator className="bg-border mx-1 my-1" />

                            <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-danger/10 group focus:bg-danger/10">
                                <LogOut className="w-4 h-4 text-danger group-hover:text-danger transition-colors" />
                                <span className="font-bold text-xs text-danger group-hover:text-danger">Déconnexion</span>
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
                            ? "bg-elevated"
                            : "hover:bg-surface"
                    )}
                >
                    <item.icon
                        className={cn(
                            "w-6 h-6 transition-all duration-300 stroke-[2px]", // Bigger, bolder
                            isActive ? item.color || "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                            // Use color hint on hover even if not active?
                            !isActive && "group-",
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
                            "absolute -bottom-1 w-5 h-0.5 rounded-full ",
                            item.color ? item.color.replace('text-', 'bg-') : "bg-background"
                        )} />
                    )}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-caption font-bold uppercase tracking-wider bg-popover/95 border-border text-foreground shadow-xl">
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
