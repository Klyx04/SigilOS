"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
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
    TrendingUp,
    Bell
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
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    const checkIsActive = (href: string, exact = false, aliases?: string[]) => {
        if (exact) return pathname === href;
        if (pathname.startsWith(href)) return true;
        if (aliases) {
            return aliases.some(alias => pathname.startsWith(alias));
        }
        return false;
    };

    // Auto-expand "Progression" if any sub-route is active
    const progressionRoutes = [
        `/dashboard/${guildId}/missions`,
        `/dashboard/${guildId}/songes`,
        `/dashboard/${guildId}/quete-ocre`,
        `/dashboard/${guildId}/quetes-dofus`,
    ];
    const [progressionOpen, setProgressionOpen] = useState(
        () => progressionRoutes.some(r => pathname.startsWith(r))
    );

    const toolsRoutes = [
        `/dashboard/${guildId}/mini-jeux`,
        `/dashboard/${guildId}/mini-jeux`,
        `/dashboard/${guildId}/donjons-et-quetes`,
        `/dashboard/${guildId}/passages`,
        `/dashboard/${guildId}/sondages`,
        `/dashboard/${guildId}/members`,
        `/dashboard/${guildId}/galerie-stuff`,
        `/dashboard/${guildId}/worldmap`,
    ];
    const [infoOpen, setInfoOpen] = useState(
        () => pathname.startsWith(`/dashboard/${guildId}/calendar`)
    );
    const [toolsOpen, setToolsOpen] = useState(
        () => toolsRoutes.some(r => pathname.startsWith(r))
    );

    // Auto-expand "Supervision" if any admin route is active
    const adminRoutes = [
        `/dashboard/${guildId}/admin`,
        `/dashboard/${guildId}/missions/manage`,
    ];
    const [adminOpen, setAdminOpen] = useState(
        () => adminRoutes.some(r => pathname.startsWith(r))
    );

    // --- NAVIGATION GROUPS ---

    // --- NAVIGATION GROUPS ---
    const NAV_INFO = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true, color: "emerald", visible: user.isMember && user.canViewDashboard },
        { name: "Bienvenue", href: `/dashboard/${guildId}/welcome`, icon: Sparkles, color: "emerald", visible: user.canViewWelcome },
        { name: "Présentation", href: `/dashboard/${guildId}/presentation`, icon: BookOpen, color: "emerald", visible: user.isMember && user.canViewPresentation && modules.presentation },
        { name: "Ressources", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, color: "emerald", visible: user.isMember && user.canViewResources && modules.resources },
        { name: "Stats Guilde", href: `/dashboard/${guildId}/stats`, icon: Hammer, color: "emerald", visible: user.isMember && user.canViewStats && modules.stats },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "emerald", visible: user.canViewCalendar && modules.calendar },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "emerald", visible: user.canViewLadder && modules.ladder },
        { name: "Documentation", href: `/docs`, icon: BookOpen, color: "emerald", visible: user.isMember && user.canViewDocs && modules.docs },
    ];

    const NAV_PROGRESSION = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "amber", visible: user.canViewMissions && modules.missions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "amber", visible: user.canViewSonges && modules.songes },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, imgSrc: "/module-dofus/Dofus_Ocre.png", color: "amber", visible: user.canViewOcre && modules.ocre },
        { name: "Quêtes Dofus", href: `/dashboard/${guildId}/quetes-dofus`, imgSrc: "/module-dofus/Dofus_Sylvestre.png", color: "amber", visible: user.isMember && user.canViewQuests && modules.quests },
    ];

    const showProgressionGroup = NAV_PROGRESSION.some(i => i.visible !== false);

    const NAV_TOOLS = [
        { name: "Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, icon: Trophy, color: "indigo", visible: user.canViewMiniGames && modules.minigames }, 
        { name: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, icon: Compass, color: "indigo", visible: user.isMember && user.canViewFinder && modules.donjons },
        { name: "Services Guilde", href: `/dashboard/${guildId}/passages`, icon: Key, color: "indigo", visible: user.isMember && user.canViewServices && modules.services },
        { name: "Sondages", href: `/dashboard/${guildId}/sondages`, icon: Activity, color: "indigo", visible: user.isMember && user.canViewPolls && modules.polls },
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "indigo", visible: user.isMember && user.canViewRoster && modules.roster },
        { name: "Galerie Stuff", href: `/dashboard/${guildId}/galerie-stuff`, icon: Sparkles, color: "indigo", visible: user.isMember && user.canViewStuffGallery && modules.gallery },
        { name: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, icon: Compass, color: "indigo", visible: user.isMember && user.canViewWorldmap && modules.worldmap },
    ];

    // --- ADMIN NAVIGATION ---
    const NAV_ADMIN_SUB = [
        { name: "Permissions", href: `/dashboard/${guildId}/admin/permissions`, icon: Shield, visible: user.isDiscordAdmin },
        { name: "Paramètres", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, visible: user.isAdmin || user.canViewSettings },
        { name: "Page Guilde", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, visible: user.isAdmin || user.canEditPresentation },
        { name: "Valid-Screens", href: `/dashboard/${guildId}/admin/validation`, icon: Gavel, visible: user.canValidateMissions || user.isAdmin },
        { name: "Membres", href: `/dashboard/${guildId}/admin/members`, icon: Users, visible: user.isAdmin || user.canManageMembers || user.canManageRelance },
        { name: "Conf-Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, visible: user.canManageMissions },
        { name: "Chat Admin", href: `/dashboard/${guildId}/admin/chat`, icon: Activity, visible: user.canModerateChat },
        { name: "Audit Logs", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, visible: user.canViewAuditLogs && modules.logs },
    ];

    // Access to Supervision group is granted if user is a full admin OR has access to at least one sub-item
    const hasAnyAdminTools = NAV_ADMIN_SUB.some(i => i.visible);
    const hasAnyAdminPermission = user.isAdmin || hasAnyAdminTools || user.isSuperAdmin;

    const NAV_ADMIN_TOP = { name: "Centre Admin", href: `/dashboard/${guildId}/admin`, icon: Shield, exact: true, color: "rose", visible: hasAnyAdminPermission };

    return (
        <div className={cn("flex flex-col h-full bg-[#0a0a0b] border-r border-white/5", className)}>

            {/* 1. HEADER: BRAND & GUILD SWITCHER */}
            <div className="p-4 pb-2 space-y-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 px-1 group transition-all">
                    <div className="relative h-7 w-7 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_white]">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain transition-all"
                        />
                    </div>
                    <span className="text-sm font-black tracking-[0.4em] text-white/90 uppercase transition-all group-hover:text-white">
                        SIGIL<span className="text-primary tracking-[0.3em]">OS</span>
                    </span>
                </Link>

                {/* Guild Switcher */}
                {!mounted ? (
                    <div className="w-full h-12 bg-white/5 border border-white/10 rounded-md animate-pulse" />
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-between h-10 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-left px-2 rounded-xl group transition-all"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Avatar className="h-6 w-6 rounded-lg border border-white/10 shrink-0">
                                        <AvatarImage src={guildData.iconUrl || undefined} />
                                        <AvatarFallback className="text-[8px] bg-zinc-900 text-zinc-400">
                                            {guildData.name?.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[11px] font-bold text-zinc-300 truncate w-[130px]">
                                        {guildData.name}
                                    </span>
                                </div>
                                <ChevronsUpDown className="h-3 w-3 text-zinc-500 shrink-0" />
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
                )}
            </div>

            {/* 2. SCROLLABLE NAVIGATION — Fixed for responsiveness */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                <ScrollArea className="h-full px-2.5 py-4">
                    <nav className="space-y-4">

                        {/* SECTION: GENERAL */}
                        <div className="space-y-0.5">
                            <SectionTitle label="Information" />
                            {NAV_INFO.filter(i => i.visible !== false).map((item) => (
                                <NavItem key={item.href} item={item} isActive={checkIsActive(item.href, item.exact)} />
                            ))}
                        </div>

                        {/* SECTION: PROGRESSION */}
                        {showProgressionGroup && (
                            <div className="space-y-0.5">
                                <SectionTitle 
                                    label="Progression" 
                                    collapsible 
                                    isOpen={progressionOpen} 
                                    onToggle={() => setProgressionOpen(!progressionOpen)} 
                                />
                                {progressionOpen && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-0.5">
                                        {NAV_PROGRESSION.filter(i => i.visible !== false).map((item) => (
                                            <NavItem key={item.href} item={item} isActive={checkIsActive(item.href)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION: TOOLS */}
                        <div className="space-y-0.5">
                            <SectionTitle 
                                label="Outils" 
                                collapsible 
                                isOpen={toolsOpen} 
                                onToggle={() => setToolsOpen(!toolsOpen)} 
                            />
                            {toolsOpen && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-0.5">
                                    {NAV_TOOLS.filter(i => i.visible !== false).map((item) => (
                                        <NavItem key={item.href} item={item} isActive={checkIsActive(item.href)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SECTION: ADMIN */}
                        {hasAnyAdminPermission && (
                            <div className="space-y-0.5">
                                <SectionTitle 
                                    label="Supervision" 
                                    collapsible 
                                    isOpen={adminOpen} 
                                    onToggle={() => setAdminOpen(!adminOpen)} 
                                />
                                {adminOpen && (
                                    <div className="relative ml-4 mt-2 mb-4 pl-4 border-l border-white/5 animate-in fade-in slide-in-from-top-1 duration-200 space-y-1">
                                        {/* Connector Line Glow */}
                                        <div className="absolute left-[-1px] top-0 bottom-4 w-[1px] bg-gradient-to-b from-rose-500/50 via-rose-500/20 to-transparent" />
                                        
                                        <NavItem item={NAV_ADMIN_TOP} isActive={checkIsActive(NAV_ADMIN_TOP.href, true)} />
                                        <div className="pt-2 space-y-0.5">
                                            {NAV_ADMIN_SUB.filter(i => i.visible).map((item) => (
                                                <AdminSubItem key={item.href} item={item} isActive={checkIsActive(item.href)} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </nav>
                </ScrollArea>
            </div>

            {/* 3. FOOTER: SYSTEM STATUS & USER */}
            <div className="p-4 bg-white/[0.02] border-t border-white/5">
                {!mounted ? (
                    <div className="w-full h-12 bg-white/5 rounded-2xl animate-pulse" />
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-white/5 transition-all group">
                                <Avatar className="h-9 w-9 rounded-xl border border-white/10 shadow-lg group-hover:border-primary/50 transition-all">
                                    <AvatarImage src={user.image || ""} />
                                    <AvatarFallback className="bg-zinc-800 text-zinc-500 text-[10px] font-black">
                                        {(user.name || "U").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="text-xs font-black text-white/90 group-hover:text-white truncate">
                                        {user.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                                        {user.roleName || "Membre"}
                                    </span>
                                </div>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-zinc-950/98 border-white/10 text-zinc-200 shadow-2xl rounded-2xl" align="end" side="right" sideOffset={12}>
                            <DropdownMenuLabel className="p-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">User Control</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer rounded-xl m-1 py-1.5 px-3">
                                <Link href={`/dashboard/${guildId}/profile`} className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-zinc-500" />
                                    <span className="font-bold">Mon Profil</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer rounded-xl m-1 py-1.5 px-3">
                                <Link href={`/dashboard/${guildId}/profile?tab=settings`} className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-zinc-500" />
                                    <span className="font-bold">Réglages</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem onClick={() => signOut()} className="text-rose-400 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer rounded-xl m-1 py-1.5 px-3">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span className="font-black">Déconnexion</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ label, collapsible, isOpen, onToggle }: { label: string; collapsible?: boolean; isOpen?: boolean; onToggle?: () => void }) {
    return (
        <div 
            className={cn(
                "flex items-center gap-3 px-3 mt-8 mb-3 first:mt-2 group/title select-none",
                collapsible && "cursor-pointer"
            )}
            onClick={onToggle}
        >
            <div className={cn(
                "h-[2px] w-2 rounded-full transition-all duration-300",
                label === "Supervision" ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : 
                label.includes("Info") ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" :
                label.includes("Outil") ? "bg-indigo-500 shadow-[0_0_8px_#6366f1]" :
                "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
            )} />
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/55 group-hover/title:text-white/80 transition-colors whitespace-nowrap">
                {label}
            </h4>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            {collapsible && (
                <ChevronRight className={cn("w-3 h-3 text-white/20 transition-all duration-300 group-hover/title:text-white/40", isOpen && "rotate-90 text-primary")} />
            )}
        </div>
    );
}

function NavItem({ item, isActive, isSubItem }: { item: any; isActive: boolean; isSubItem?: boolean }) {
    const colorMap: Record<string, { text: string, bg: string, border: string, glow: string, muted: string }> = {
        emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", muted: "text-emerald-400/40" },
        amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", muted: "text-amber-400/40" },
        indigo: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]", muted: "text-indigo-400/40" },
        rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]", muted: "text-rose-400/40" },
        cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]", muted: "text-cyan-400/40" },
        zinc: { text: "text-zinc-300", bg: "bg-white/10", border: "border-white/10", glow: "shadow-[0_0_20px_rgba(255,255,255,0.05)]", muted: "text-zinc-500" },
    };

    const scheme = colorMap[item.color || "emerald"];

    return (
        <Link
            href={item.href}
            className={cn(
                "group relative flex items-center gap-3 transition-all duration-300 px-3 py-2 rounded-xl",
                isActive 
                    ? cn("bg-white/[0.08] backdrop-blur-md border border-white/10", scheme.glow)
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
            )}
        >
            {/* Color Indicator (Bar) */}
            {isActive && (
                <div className={cn(
                    "absolute left-0 w-1 h-3/5 rounded-full transition-all duration-500 -translate-x-1.5",
                    item.color === "rose" ? "bg-rose-500 shadow-[0_0_12px_#f43f5e]" : "bg-emerald-400 shadow-[0_0_12px_#10b981]"
                )} />
            )}

            <div className={cn(
                "transition-all duration-300 shrink-0 flex items-center justify-center p-1.5 rounded-lg border border-transparent",
                isActive ? cn(scheme.bg, scheme.text, scheme.border) : cn(scheme.muted, "group-hover:text-white group-hover:bg-white/5 group-hover:border-white/5")
            )}>
                {item.imgSrc ? (
                    <div className="relative h-3.5 w-3.5">
                        <Image 
                            src={item.imgSrc} 
                            alt={item.name} 
                            fill 
                            className={cn("object-contain", !isActive && "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all")} 
                        />
                    </div>
                ) : (
                    <item.icon className={cn("h-3.5 w-3.5")} />
                )}
            </div>

            <span className={cn(
                "tracking-tight transition-all truncate leading-none text-[12.5px]",
                isActive ? "font-bold text-white" : "font-medium text-white/75"
            )}>
                {item.name}
            </span>

            {isActive && (
                <div className="ml-auto">
                    <div className={cn("h-1.5 w-1.5 rounded-full", item.color === "rose" ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]" : "bg-emerald-500 shadow-[0_0_10px_#10b981]")} />
                </div>
            )}
        </Link>
    );
}

function AdminSubItem({ item, isActive }: { item: any; isActive: boolean }) {
    return (
        <Link
            href={item.href}
            className={cn(
                "group flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden",
                isActive ? "text-rose-300 bg-rose-500/5" : "text-zinc-500 hover:text-rose-400 hover:bg-white/[0.02]"
            )}
        >
            {/* Active Glow Background */}
            {isActive && (
                <div className="absolute inset-0 bg-rose-500/5 blur-xl pointer-events-none" />
            )}

            <div className={cn(
                "w-1.5 h-1.5 rounded-full border border-rose-500/30 transition-all shrink-0 z-10",
                isActive ? "bg-rose-500 shadow-[0_0_8px_#ef4444]" : "bg-zinc-700 group-hover:bg-rose-400 group-hover:border-rose-500"
            )} />
            <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] z-10",
                isActive ? "text-rose-100" : "text-zinc-500 group-hover:text-rose-300"
            )}>
                {item.name}
            </span>

            {isActive && (
                <div className="ml-auto h-1 w-1 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] z-10" />
            )}
        </Link>
    );
}
