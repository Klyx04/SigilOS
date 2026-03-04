"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Calendar,
    Users,
    ScrollText,
    Sparkles,
    Crown,
    Trophy,
    Key,
    Compass,
    Shield,
    Settings,
    Gavel,
    Swords,
    FileText,
    ChevronDown,
    ChevronRight,
    LogOut,
    ChevronsUpDown,
    Plus,
    Hammer,
    Activity,
    TrendingUp
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type UserContext } from "@/server/actions/user-actions";
import { type GuildHeaderData } from "@/server/actions/guild-actions";
import { type GuildModulesState, DEFAULT_MODULES } from "@/lib/module-types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AppSidebarProps {
    guildId: string;
    user: UserContext;
    guildData: GuildHeaderData;
    modules?: GuildModulesState;
    userGuilds?: { id: string; name: string; iconUrl: string | null }[];
    className?: string;
}

export function AppSidebar({
    guildId,
    user,
    guildData,
    userGuilds = [],
    modules = DEFAULT_MODULES,
    className
}: AppSidebarProps) {
    const pathname = usePathname();

    const isActive = (href: string, exact = false) => {
        return exact ? pathname === href : pathname.startsWith(href);
    };

    // Auto-expand "Progression" if any sub-route is active
    const progressionRoutes = [
        `/dashboard/${guildId}/missions`,
        `/dashboard/${guildId}/songes`,
        `/dashboard/${guildId}/quete-ocre`,
        `/dashboard/${guildId}/ladder`,
    ];
    const [progressionOpen, setProgressionOpen] = useState(
        () => progressionRoutes.some(r => pathname.startsWith(r))
    );

    // --- NAVIGATION GROUPS ---

    // --- NAVIGATION GROUPS ---
    const NAV_INFO = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true, color: "text-violet-400", visible: user.isMember && user.canViewDashboard },
        { name: "Bienvenue", href: `/dashboard/${guildId}/welcome`, icon: Sparkles, color: "text-emerald-400", visible: user.canViewWelcome },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: BookOpen, color: "text-violet-400", visible: user.isMember && user.canViewPresentation && modules.presentation },
        { name: "Stats Guilde", href: `/dashboard/${guildId}/stats`, icon: Hammer, color: "text-violet-400", visible: user.isMember && user.canViewStats && modules.stats },
        { name: "Documentation", href: `/docs`, icon: BookOpen, color: "text-violet-400", visible: user.isMember && user.canViewDocs && modules.docs },
    ];

    const NAV_ACTIVITIES_TOP = [
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "text-emerald-400", visible: user.isMember && user.canViewCalendar && modules.calendar },
    ];

    // Sub-items grouped under the collapsible "Progression" parent
    const NAV_PROGRESSION = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "text-emerald-400", visible: user.canViewMissions && modules.missions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "text-emerald-400", visible: user.canViewSonges && modules.songes },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, icon: Crown, color: "text-emerald-400", visible: user.canViewArchis && modules.ocre },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "text-emerald-400", visible: user.canViewLadder && modules.ladder },
    ];

    const showProgressionGroup = NAV_PROGRESSION.some(i => i.visible !== false);

    const NAV_TOOLS = [
        { name: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, icon: Compass, color: "text-cyan-400", visible: user.isMember && user.canViewFinder && modules.donjons },
        { name: "Services Guilde", href: `/dashboard/${guildId}/passages`, icon: Key, color: "text-cyan-400", visible: user.isMember && user.canViewServices && modules.services },
        { name: "Sondages", href: `/dashboard/${guildId}/sondages`, icon: Activity, color: "text-cyan-400", visible: user.isMember && user.canViewPolls && modules.polls },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "text-cyan-400", visible: user.isMember && user.canViewRoster && modules.roster },
        { name: "Mon Profil", href: `/dashboard/${guildId}/profile`, icon: Users, color: "text-cyan-400", visible: user.isMember && user.canViewProfile && modules.profile },
    ];

    const NAV_COMING_SOON = [
        { name: "Quêtes Dofus", href: `/dashboard/${guildId}/quetes-dofus`, icon: BookOpen, color: "text-amber-400", visible: user.isMember && user.canViewQuests && modules.quests },
        { name: "Carte & Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, icon: Compass, color: "text-cyan-400", visible: user.isMember && user.canViewWorldmap && modules.worldmap },
        { name: "Ressources", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, color: "text-violet-400", visible: user.isMember && user.canViewResources && modules.resources },
    ];

    const NAV_ADMIN_TOP = { name: "Centre Admin", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, color: "text-rose-500", visible: user.isAdmin };

    const NAV_ADMIN_SUB = [
        { name: "ADM Permissions", href: `/dashboard/${guildId}/admin/permissions`, icon: Shield, visible: user.isAdmin },
        { name: "ADM Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin },
        { name: "ADM Page Guilde", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "ADM Valid-Screens", href: `/dashboard/${guildId}/admin/validation`, icon: Gavel, visible: user.canValidateMissions || user.isAdmin },
        { name: "ADM Conf-Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "ADM Chat", href: `/dashboard/${guildId}/admin/chat`, icon: Activity, visible: user.isAdmin || user.canModerateChat },
        { name: "ADM Logs", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.isAdmin && modules.logs },
    ];

    const hasAnyAdminPermission = user.isAdmin || user.canManageMissions || user.canValidateMissions || user.canEditPresentation;

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.5)]", className)}>

            {/* 1. HEADER: BRAND & GUILD SWITCHER */}
            <div className="p-4 pb-2 space-y-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 px-2 group/brand hover:opacity-80 transition-opacity">
                    <div className="relative h-8 w-8">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-lg font-black tracking-[0.2em] text-white leading-none font-heading">
                        SIGIL<span className="text-primary">OS</span>
                    </span>
                </Link>

                {/* Guild Switcher */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-between h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-left px-3 group"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-6 w-6 rounded-md border border-white/10">
                                    <AvatarImage src={guildData.iconUrl || undefined} />
                                    <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-400">
                                        {guildData.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-zinc-200 truncate group-hover:text-white transition-colors">
                                        {guildData.name}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">
                                        Guilde Active
                                    </span>
                                </div>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-zinc-500 shrink-0" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-64 bg-zinc-950 border-zinc-500/20 text-zinc-200 shadow-[0_0_40px_rgba(0,0,0,0.8)] p-1 backdrop-blur-3xl"
                        align="start"
                        sideOffset={8}
                    >
                        <DropdownMenuLabel className="px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black">
                            Changer de guilde
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/5 mx-1" />
                        <div className="space-y-0.5 p-1">
                            {userGuilds.map((g) => (
                                <DropdownMenuItem key={g.id} asChild>
                                    <Link
                                        href={`/dashboard/${g.id}`}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                                            g.id === guildId
                                                ? "bg-primary/10 border border-primary/20 text-white"
                                                : "hover:bg-white/5 text-zinc-400 hover:text-zinc-100"
                                        )}
                                    >
                                        <Avatar className="h-6 w-6 rounded-md border border-white/10">
                                            <AvatarImage src={g.iconUrl || undefined} />
                                            <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-500">
                                                {g.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col min-w-0">
                                            <span className={cn("text-xs font-black truncate", g.id === guildId ? "text-primary" : "")}>
                                                {g.name}
                                            </span>
                                            {g.id === guildId && <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest">Connecté</span>}
                                        </div>
                                        {g.id === guildId && (
                                            <div className="ml-auto w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                                        )}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </div>
                        <DropdownMenuSeparator className="bg-white/5 mx-1" />
                        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest cursor-not-allowed opacity-50">
                            <Plus className="h-3.5 w-3.5" />
                            Rejoindre une guilde
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 2. SCROLLABLE NAVIGATION */}
            <ScrollArea className="flex-1 px-3 py-4 overflow-hidden">
                <nav className="space-y-8">

                    {/* INFORMATION */}
                    {NAV_INFO.some(i => i.visible !== false) && (
                        <div className="space-y-1.5 peer">
                            <div className="flex items-center gap-2 px-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/80 to-transparent shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 whitespace-nowrap">Information</h4>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/80 to-transparent shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
                            </div>
                            {NAV_INFO.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href, item.exact)} />
                            ))}
                        </div>
                    )}

                    {/* ACTIVITES */}
                    {(NAV_ACTIVITIES_TOP.some(i => i.visible !== false) || showProgressionGroup) && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 whitespace-nowrap">Activités</h4>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                            </div>

                            {/* Calendrier (standalone) */}
                            {NAV_ACTIVITIES_TOP.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}

                            {/* Progression group — collapsible */}
                            {showProgressionGroup && (
                                <div>
                                    {/* Parent trigger */}
                                    <button
                                        onClick={() => setProgressionOpen(o => !o)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative overflow-hidden",
                                            progressionOpen
                                                ? "bg-white/[0.05] text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/10"
                                                : "text-zinc-200 hover:text-white hover:bg-white/[0.02]"
                                        )}
                                    >
                                        {progressionOpen && (
                                            <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full animate-pulse bg-emerald-400 shadow-[0_0_12px_currentColor]" />
                                        )}
                                        <TrendingUp className={cn(
                                            "h-4 w-4 shrink-0 transition-all duration-300",
                                            progressionOpen
                                                ? "text-emerald-400 scale-110 drop-shadow-[0_0_8px_currentColor]"
                                                : "text-emerald-400 opacity-70 group-hover:opacity-100 group-hover:scale-110"
                                        )} />
                                        <span className={cn(
                                            "text-sm flex-1 text-left transition-all duration-300",
                                            progressionOpen ? "font-black tracking-tight" : "font-bold"
                                        )}>Progression</span>
                                        {progressionOpen
                                            ? <ChevronDown className="h-3.5 w-3.5 text-emerald-400/70 transition-transform duration-300" />
                                            : <ChevronRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-300" />
                                        }
                                    </button>

                                    {/* Sub-items with smooth collapse */}
                                    <div
                                        className="overflow-hidden transition-all duration-300 ease-in-out"
                                        style={{ maxHeight: progressionOpen ? `${NAV_PROGRESSION.filter(i => i.visible !== false).length * 56}px` : "0px" }}
                                    >
                                        <div className="ml-3 mt-1 pl-3 border-l border-emerald-500/20 space-y-0.5 pb-1">
                                            {NAV_PROGRESSION.filter(i => i.visible !== false).map((item) => (
                                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* OUTILS */}
                    {NAV_TOOLS.some(i => i.visible !== false) && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 whitespace-nowrap">Outils</h4>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/80 to-transparent shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
                            </div>
                            {NAV_TOOLS.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </div>
                    )}

                    {/* BIENTÔT (Coming Soon) */}
                    {NAV_COMING_SOON.some(i => i.visible !== false) && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/60 flex items-center gap-2 whitespace-nowrap">
                                    <Sparkles className="w-3 h-3" />
                                    Bientôt
                                </h4>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                            </div>
                            {NAV_COMING_SOON.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
                            ))}
                        </div>
                    )}

                    {/* ADMIN */}
                    {hasAnyAdminPermission && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-center gap-2 px-2 mb-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/60 flex items-center gap-2 whitespace-nowrap">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </h4>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
                            </div>

                            {/* Centre Admin — item principal */}
                            {NAV_ADMIN_TOP.visible && (
                                <NavItem item={{ ...NAV_ADMIN_TOP, color: "text-rose-500" }} isActive={isActive(NAV_ADMIN_TOP.href, true)} />
                            )}

                            {/* Sous-items ADM */}
                            {NAV_ADMIN_SUB.some(i => i.visible) && (
                                <div className="ml-2 mt-1 pl-3 border-l border-rose-500/20 space-y-0.5">
                                    {NAV_ADMIN_SUB.filter(i => i.visible).map((item) => (
                                        <AdminSubItem
                                            key={item.href}
                                            item={item}
                                            isActive={isActive(item.href)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </nav>
            </ScrollArea>

            {/* 3. FOOTER: USER ISLAND */}
            <div className="p-4 mt-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-auto p-2 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 rounded-xl transition-all duration-300 group/island"
                        >
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 rounded-lg border border-white/10 group-hover/island:border-primary/50 transition-all duration-500 shadow-xl group-hover/island:shadow-primary/10">
                                    <AvatarImage src={user.image || ""} />
                                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px] font-black">{(user.name || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-xs font-black text-zinc-200 truncate w-full group-hover/island:text-white transition-colors">
                                        {user.name || "Compte"}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-500 truncate w-full uppercase tracking-tighter">
                                        {user.roleName || "Membre"}
                                    </span>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 text-zinc-500 group-hover/island:text-white transition-all shrink-0" />
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl" align="end" side="right" sideOffset={12}>
                        <div className="px-2 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 rounded-md mb-1 mx-1 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Session Active</span>
                        </div>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {user.canViewProfile && (
                            <>
                                <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
                                    <Link href={`/dashboard/${guildId}/profile`}>
                                        <LayoutDashboard className="mr-2 h-4 w-4 text-zinc-500" />
                                        <span className="font-bold">Mon Profil</span>
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
                                    <Link href={`/dashboard/${guildId}/profile?tab=settings`}>
                                        <Settings className="mr-2 h-4 w-4 text-zinc-500" />
                                        <span className="font-bold">Paramètres</span>
                                    </Link>
                                </DropdownMenuItem>
                            </>
                        )}

                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => signOut()} className="text-rose-400 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span className="font-black">Déconnexion</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function NavItem({ item, isActive }: { item: any; isActive: boolean }) {
    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative overflow-hidden",
                isActive
                    ? "bg-white/[0.05] text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/10"
                    : "text-zinc-200 hover:text-white hover:bg-white/[0.02]"
            )}
        >
            {/* Active Glow Indicator */}
            {isActive && (
                <div className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full animate-pulse shadow-[0_0_12px_currentColor]",
                    item.color ? item.color.replace("text-", "bg-") : "bg-primary"
                )} />
            )}

            <item.icon
                className={cn(
                    "h-4 w-4 shrink-0 transition-all duration-300",
                    isActive
                        ? cn(item.color || "text-primary", "scale-110 drop-shadow-[0_0_8px_currentColor]")
                        : cn(item.color ? `${item.color} opacity-70 group-hover:opacity-100` : "text-zinc-500 group-hover:text-zinc-300", "group-hover:scale-110 group-hover:rotate-3 group-hover:drop-shadow-[0_0_8px_currentColor]")
                )}
            />
            <span className={cn(
                "text-sm transition-all duration-300",
                isActive ? "font-black tracking-tight" : "font-bold"
            )}>
                {item.name}
            </span>

            {/* Subtle glow behind text on active */}
            {isActive && (
                <div className={cn(
                    "absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-r from-transparent via-current to-transparent",
                    item.color ? item.color : "text-primary"
                )} />
            )}

            {/* Subtle light effect on hover */}
            {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
        </Link>
    );
}

function AdminSubItem({ item, isActive }: { item: any; isActive: boolean }) {
    // Split "ADM Permissions" → prefix "ADM" + label "Permissions"
    const [prefix, ...rest] = item.name.split(" ");
    const label = rest.join(" ");

    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 group relative overflow-hidden",
                isActive
                    ? "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
            )}
        >
            {/* Active dot */}
            {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            )}

            <item.icon className={cn(
                "h-3 w-3 shrink-0 transition-all duration-200",
                isActive ? "text-rose-400" : "text-zinc-600 group-hover:text-zinc-400"
            )} />

            <span className={cn(
                "font-mono text-[10px] font-black tracking-widest px-1 py-0.5 rounded shrink-0",
                isActive
                    ? "text-rose-400 bg-rose-500/15"
                    : "text-zinc-600 bg-zinc-800/60 group-hover:text-rose-400/70"
            )}>
                {prefix}
            </span>

            <span className={cn(
                "text-xs transition-all duration-200 truncate",
                isActive ? "font-black text-rose-200" : "font-medium group-hover:text-zinc-200"
            )}>
                {label}
            </span>
        </Link>
    );
}
