"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    Gavel,
    Swords,
    FileText,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
    Plus,
    Hammer,
    Activity,
    TrendingUp,
    Bell,
    Search,
    Gamepad2,
    SunMoon,
    Star,
    X,
    Eye,
    EyeOff
} from "lucide-react";
import { SidebarSearch } from "./sidebar-search";
import { ThemeToggle } from "./ThemeToggle";
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
import { togglePinnedNavItem, toggleHiddenNavItem } from "@/server/actions/profile-actions";
import { toast } from "sonner";

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
    const [localPinnedHrefs, setLocalPinnedHrefs] = useState<string[]>(user.pinnedNavItems || []);
    const [localHiddenHrefs, setLocalHiddenHrefs] = useState<string[]>(user.hiddenNavItems || []);
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync local state when user prop changes (after server revalidation)
    // Stabilize synchronization from server props
    const pinnedHrefsString = JSON.stringify(user.pinnedNavItems || []);
    const hiddenHrefsString = JSON.stringify(user.hiddenNavItems || []);

    useEffect(() => {
        setLocalPinnedHrefs(user.pinnedNavItems || []);
        setLocalHiddenHrefs(user.hiddenNavItems || []);
    }, [pinnedHrefsString, hiddenHrefsString]);

    const checkIsActive = (href: string, exact = false, aliases?: string[]) => {
        if (exact) return pathname === href;
        if (pathname.startsWith(href)) return true;
        if (aliases) {
            return aliases.some(alias => pathname.startsWith(alias));
        }
        return false;
    };

    // Auto-expand sections if any sub-route is active
    const progressionRoutes = [
        `/dashboard/${guildId}/missions`,
        `/dashboard/${guildId}/songes`,
        `/dashboard/${guildId}/quete-ocre`,
        `/dashboard/${guildId}/quetes-dofus`,
        `/dashboard/${guildId}/ladder`,
    ];
    const [progressionOpen, setProgressionOpen] = useState(
        () => progressionRoutes.some(r => pathname.startsWith(r))
    );

    const toolsRoutes = [
        `/dashboard/${guildId}/galerie-stuff`,
        `/dashboard/${guildId}/donjons-et-quetes`,
        `/dashboard/${guildId}/services`,
    ];
    const [toolsOpen, setToolsOpen] = useState(
        () => toolsRoutes.some(r => pathname.startsWith(r))
    );

    const infoRoutes = [
        `/dashboard/${guildId}/guild-hub`,
        `/dashboard/${guildId}/welcome`,
        `/dashboard/${guildId}/presentation`,
        `/dashboard/${guildId}/stats`,
        `/dashboard/${guildId}/members`,
        `/dashboard/${guildId}/calendar`,
        `/dashboard/${guildId}/ressources`,
    ];
    const [infoOpen, setInfoOpen] = useState(
        () => infoRoutes.some(r => pathname.startsWith(r))
    );

    const othersRoutes = [
        `/dashboard/${guildId}/mini-jeux`,
        `/dashboard/${guildId}/sondages`,
        `/dashboard/${guildId}/worldmap`,
    ];
    const [othersOpen, setAutresOpen] = useState(
        () => othersRoutes.some(r => pathname.startsWith(r))
    );

    const adminRoutes = [
        `/dashboard/${guildId}/admin`,
        `/dashboard/${guildId}/missions/manage`,
    ];
    const [adminOpen, setAdminOpen] = useState(
        () => adminRoutes.some(r => pathname.startsWith(r))
    );

    const [pinnedOpen, setPinnedOpen] = useState(true);

    // --- NAVIGATION GROUPS ---
    const hasAnyAdminPermission = user.isAdmin || user.canManageMembers || user.canManageMissions || user.canEditPresentation || user.canViewAuditLogs || user.canViewSettings || user.canManageRBAC || false;

    // 1. HORS SECTION
    const NAV_GLOBAL = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, exact: true, color: "zinc", visible: user.isMember && user.canViewDashboard, isDashboard: true },
    ];

    // 3. PROGRESSION
    const NAV_PROGRESSION = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "amber", visible: user.canViewMissions && modules.missions },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "amber", visible: user.canViewSonges && modules.songes },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "amber", visible: user.canViewLadder && modules.ladder },
        { name: "Les Dofus", href: `/dashboard/${guildId}/quetes-dofus`, imgSrc: "/module-dofus/Dofus_Sylvestre.png", color: "amber", visible: user.canViewQuests && modules.quests },
    ];

    // 4. OUTILS
    const NAV_TOOLS: any[] = [
        { name: "Galerie Guilde", href: `/dashboard/${guildId}/galerie-stuff`, icon: Star, color: "indigo", visible: user.canViewStuffGallery && modules.resources },
        { name: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, icon: Swords, color: "indigo", visible: user.canViewQuests && modules.donjons },
        { name: "Services Guilde", href: `/dashboard/${guildId}/services`, icon: Activity, color: "indigo", visible: user.canViewServices && modules.services },
    ];

    // 5. AUTRES
    const NAV_OTHERS = [
        { name: "Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, icon: Gamepad2, color: "cyan", visible: user.canViewMiniGames },
        { name: "Sondages", href: `/dashboard/${guildId}/sondages`, icon: Gavel, color: "cyan", visible: user.canViewPolls && modules.polls },
        { name: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, icon: Compass, color: "cyan", visible: user.canViewWorldmap && modules.worldmap },
    ];

    const NAV_ADMIN_TOP = { 
        name: "Centre Admin", 
        href: `/dashboard/${guildId}/admin`, 
        icon: Shield, 
        exact: true, 
        color: "rose", 
        visible: hasAnyAdminPermission,
        aliases: [
            `/dashboard/${guildId}/admin/permissions`,
            `/dashboard/${guildId}/admin/settings`,
            `/dashboard/${guildId}/admin/presentation`,
            `/dashboard/${guildId}/admin/validation`,
            `/dashboard/${guildId}/admin/members`,
            `/dashboard/${guildId}/missions/manage`,
            `/dashboard/${guildId}/admin/logs`,
        ]
    };

    // 5. REGISTRY FOR PINNED ITEMS
    // We register all items that can be pinned
    const NAV_REGISTRY = [
        ...NAV_GLOBAL,
        ...NAV_PROGRESSION,
        ...NAV_TOOLS,
        NAV_ADMIN_TOP,
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "emerald", visible: user.canViewRoster },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "emerald", visible: user.canViewCalendar },
        { name: "Ressources Dofus", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, color: "emerald", visible: user.canViewResources && modules.resources },
        { 
            name: "La guilde", 
            href: `/dashboard/${guildId}/guild-hub`, 
            icon: Sparkles, 
            color: "emerald",
            visible: (user.canViewWelcome || user.canViewPresentation || user.canViewStats),
            aliases: [
                `/dashboard/${guildId}/welcome`,
                `/dashboard/${guildId}/presentation`,
                `/dashboard/${guildId}/stats`,
            ]
        },
        { name: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, icon: Swords, color: "indigo", visible: user.canViewQuests && modules.donjons },
        { name: "Services Guilde", href: `/dashboard/${guildId}/services`, icon: Activity, color: "indigo", visible: user.canViewServices && modules.services },
        { name: "Sondages", href: `/dashboard/${guildId}/sondages`, icon: Gavel, color: "cyan", visible: user.canViewPolls && modules.polls },
        { name: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, icon: Compass, color: "cyan", visible: user.canViewWorldmap && modules.worldmap },
    ];

    // --- NAVIGATION GROUPS ---

    // Permissions helpers — computed once
    const showProgressionGroup = Boolean(
        (user.canViewMissions && modules.missions && !localPinnedHrefs.includes(`/dashboard/${guildId}/missions`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/missions`)) ||
        (user.canViewSonges && modules.songes && !localPinnedHrefs.includes(`/dashboard/${guildId}/songes`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/songes`)) ||
        (user.canViewLadder && modules.ladder && !localPinnedHrefs.includes(`/dashboard/${guildId}/ladder`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/ladder`)) ||
        (user.isMember && user.canViewQuests && modules.quests && !localPinnedHrefs.includes(`/dashboard/${guildId}/quetes-dofus`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/quetes-dofus`))
    );

    const showAdminGroup = hasAnyAdminPermission && !localPinnedHrefs.includes(NAV_ADMIN_TOP.href) && !localHiddenHrefs.includes(NAV_ADMIN_TOP.href);

    const pinnedItems = localPinnedHrefs
        .filter(href => !localHiddenHrefs.includes(href))
        .map(href => NAV_REGISTRY.find(item => item.href === href))
        .filter(item => item && item.visible !== false) as any[];

    const hiddenItems = localHiddenHrefs
        .map(href => NAV_REGISTRY.find(item => item.href === href))
        .filter(item => item && item.visible !== false) as any[];

    const [hiddenOpen, setHiddenOpen] = useState(false);

    const handleTogglePin = async (href: string) => {
        // Optimistic Update
        setLocalPinnedHrefs(prev => 
            prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
        );

        try {
            const res = await togglePinnedNavItem({ guildId, href });
            if (!res.success) {
                toast.error("Erreur lors du changement de favori");
                setLocalPinnedHrefs(user.pinnedNavItems || []);
            }
        } catch (error) {
            toast.error("Erreur serveur");
            setLocalPinnedHrefs(user.pinnedNavItems || []);
        }
    };

    const handleToggleHide = async (href: string) => {
        // Optimistic Update
        setLocalHiddenHrefs(prev => 
            prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
        );

        try {
            const res = await toggleHiddenNavItem({ guildId, href });
            if (!res.success) {
                toast.error("Erreur lors du changement de visibilité");
                setLocalHiddenHrefs(user.hiddenNavItems || []);
            }
        } catch (error) {
            toast.error("Erreur serveur");
            setLocalHiddenHrefs(user.hiddenNavItems || []);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-background border-r border-border", className)}>

            {/* 1. HEADER: BRAND & GUILD SWITCHER */}
            <div className="p-4 pb-2 space-y-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 px-1 group transition-all">
                    <div className="relative h-7 w-7 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_var(--primary)]">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            sizes="28px"
                            className="object-contain transition-all"
                        />
                    </div>
                    <span className="text-sm font-black tracking-[0.4em] text-foreground/90 uppercase transition-all group-hover:text-foreground">
                        SIGIL<span className="text-primary tracking-[0.3em]">OS</span>
                    </span>
                </Link>

                {/* Guild Switcher - Only if multiple guilds */}
                {userGuilds.length > 1 && (
                    !mounted ? (
                        <div className="w-full h-10 bg-muted/60 border border-border/50 rounded-xl animate-pulse" />
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-between h-11 bg-muted/40 border border-border/40 hover:bg-muted/60 hover:border-border/60 text-left px-2 rounded-xl group transition-all"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar className="h-6 w-6 rounded-lg border border-border/20 shrink-0">
                                            <AvatarImage src={guildData.iconUrl || undefined} />
                                            <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                                                {guildData.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[11px] font-black text-muted-foreground group-hover:text-foreground transition-colors truncate w-[130px]">
                                            {guildData.name}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-64 bg-background/98 border border-border shadow-2xl p-1 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
                                align="start"
                                sideOffset={8}
                            >
                                <DropdownMenuLabel className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black italic">
                                    Changer de guilde
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border mx-1 mb-2" />
                                <div className="space-y-0.5 p-1">
                                    {userGuilds.map((g) => (
                                        <DropdownMenuItem key={g.id} asChild>
                                            <Link
                                                href={`/dashboard/${g.id}`}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                                                    g.id === guildId
                                                        ? "bg-primary/10 border border-primary/20 text-foreground"
                                                        : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Avatar className="h-6 w-6 rounded-md border border-border/20">
                                                    <AvatarImage src={g.iconUrl || undefined} />
                                                    <AvatarFallback className="text-[9px] bg-muted/60 text-muted-foreground/60">
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
                                <DropdownMenuSeparator className="bg-border mx-1" />
                                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest cursor-not-allowed opacity-50">
                                    <Plus className="h-3.5 w-3.5" />
                                    Rejoindre une guilde
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                )}


            </div>

            {/* 2. SCROLLABLE NAVIGATION — Fixed for responsiveness */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                <ScrollArea className="h-full px-3 py-6 no-scrollbar">
                    <nav className="space-y-8 pb-10">
                        <AnimatePresence mode="popLayout" initial={false}>

                        {/* SECTION: FAVORI / PINNED */}
                        {pinnedItems.length > 0 && (
                                <div className="space-y-1 relative group/section">
                                    <SectionTitle 
                                        label="Favoris" 
                                        collapsible 
                                        isOpen={pinnedOpen} 
                                        onToggle={() => setPinnedOpen(!pinnedOpen)} 
                                    />
                                    {pinnedOpen && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="space-y-1 px-1 overflow-hidden"
                                        >
                                            {pinnedItems.map((item) => (
                                                <NavItem 
                                                    key={`pin-${item.href}`} 
                                                    item={item} 
                                                    isActive={checkIsActive(item.href, (item as any).exact, (item as any).aliases)} 
                                                    isPinned={true}
                                                    onPin={handleTogglePin}
                                                    onHide={handleToggleHide}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                    <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                                </div>
                        )}

                        {/* SECTION: GLOBAL (HORS SECTION) */}
                        <div className="mb-6">
                            <div className="space-y-0.5">
                                {NAV_GLOBAL.filter(i => i.visible !== false && !localPinnedHrefs.includes(i.href) && !localHiddenHrefs.includes(i.href)).map((item) => (
                                <NavItem 
                                    key={item.href} 
                                    item={item} 
                                    isActive={checkIsActive(item.href, (item as any).exact)} 
                                    isPinned={false}
                                    onPin={handleTogglePin}
                                />
                            ))}
                            </div>
                        </div>

                        <div className="relative group/section">
                            <SectionTitle 
                                label="Informations" 
                                collapsible 
                                isOpen={infoOpen} 
                                onToggle={() => setInfoOpen(!infoOpen)} 
                            />
                            {infoOpen && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="space-y-1 px-1 overflow-hidden"
                                >
                                    {/* La guilde - Hub Link */}
                                    {(user.canViewWelcome || user.canViewPresentation || user.canViewStats) && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/guild-hub`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/guild-hub`) && (
                                        <NavItem 
                                            item={{ 
                                                name: "La guilde", 
                                                href: `/dashboard/${guildId}/guild-hub`, 
                                                icon: Sparkles, 
                                                color: "emerald",
                                                aliases: [
                                                    `/dashboard/${guildId}/welcome`,
                                                    `/dashboard/${guildId}/presentation`,
                                                    `/dashboard/${guildId}/stats`,
                                                ]
                                            }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/guild-hub`, false, [
                                                `/dashboard/${guildId}/welcome`,
                                                `/dashboard/${guildId}/presentation`,
                                                `/dashboard/${guildId}/stats`,
                                            ])} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    )}

                                    {/* Annuaire - Direct Link */}
                                    {user.canViewRoster && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/members`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/members`) && (
                                        <NavItem 
                                            item={{ name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, color: "emerald" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/members`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    )}
                                    
                                    {/* Calendrier - Direct Link */}
                                    {user.canViewCalendar && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/calendar`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/calendar`) && (
                                        <NavItem 
                                            item={{ name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, color: "emerald" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/calendar`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    )}

                                    {/* Ressources - Direct Link */}
                                    {user.canViewResources && modules.resources && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/ressources`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/ressources`) && (
                                        <NavItem 
                                            item={{ name: "Ressources Dofus", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, color: "emerald" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/ressources`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    )}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                        </div>

                        {/* SECTION: PROGRESSION */}
                        {showProgressionGroup && (
                            <div className="relative group/section">
                                <SectionTitle 
                                    label="Progression" 
                                    collapsible 
                                    isOpen={progressionOpen} 
                                    onToggle={() => setProgressionOpen(!progressionOpen)} 
                                />
                                {progressionOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="space-y-1 px-1 overflow-hidden"
                                    >
                                        {NAV_PROGRESSION.filter(i => i.visible !== false && !localPinnedHrefs.includes(i.href) && !localHiddenHrefs.includes(i.href)).map((item) => (
                                            <NavItem 
                                                key={item.href} 
                                                item={item} 
                                                isActive={checkIsActive(item.href)} 
                                                isPinned={false}
                                                onPin={handleTogglePin}
                                                onHide={handleToggleHide}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                                <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                            </div>
                        )}

                        <div className="relative group/section">
                            <SectionTitle 
                                label="Outils" 
                                collapsible 
                                isOpen={toolsOpen} 
                                onToggle={() => setToolsOpen(!toolsOpen)} 
                            />
                            {toolsOpen && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="space-y-1 px-1 overflow-hidden"
                                >
                                    {NAV_TOOLS.filter(i => i.visible !== false && !localPinnedHrefs.includes(i.href) && !localHiddenHrefs.includes(i.href)).map((item) => (
                                        <NavItem 
                                            key={item.href} 
                                            item={item} 
                                            isActive={checkIsActive(item.href, (item as any).exact, (item as any).aliases)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    ))}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                        </div>

                        <div className="relative group/section">
                            <SectionTitle 
                                label="Autres" 
                                collapsible 
                                isOpen={othersOpen} 
                                onToggle={() => setAutresOpen(!othersOpen)} 
                            />
                            {othersOpen && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="space-y-1 px-1 overflow-hidden"
                                >
                                    {NAV_OTHERS.filter(i => i.visible !== false && !localPinnedHrefs.includes(i.href) && !localHiddenHrefs.includes(i.href)).map((item) => (
                                        <NavItem 
                                            key={item.href} 
                                            item={item} 
                                            isActive={checkIsActive(item.href, (item as any).exact, (item as any).aliases)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    ))}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-zinc-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                        </div>

                        {/* SECTION: SUPERVISION (ADMIN) */}
                        {showAdminGroup && (
                            <div className="relative group/section">
                                <SectionTitle 
                                    label="Supervision" 
                                    collapsible 
                                    isOpen={adminOpen} 
                                    onToggle={() => setAdminOpen(!adminOpen)} 
                                />
                                {adminOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="space-y-1 px-1 overflow-hidden"
                                    >
                                        <NavItem 
                                            item={NAV_ADMIN_TOP} 
                                            isActive={checkIsActive(NAV_ADMIN_TOP.href, NAV_ADMIN_TOP.exact, NAV_ADMIN_TOP.aliases)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                        />
                                    </motion.div>
                                )}
                                <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-rose-500/20 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-1000" />
                            </div>
                        )}

                        {/* SECTION: MASQUÉS */}
                        {hiddenItems.length > 0 && (
                            <div className="space-y-0.5 pt-4">
                                <Separator className="bg-border mb-6" />
                                <SectionTitle 
                                    label="Éléments Masqués" 
                                    collapsible 
                                    isOpen={hiddenOpen} 
                                    onToggle={() => setHiddenOpen(!hiddenOpen)} 
                                />
                                {hiddenOpen && (
                                    <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                                        {hiddenItems.map((item) => (
                                            <NavItem 
                                                key={`hidden-${item.href}`} 
                                                item={item} 
                                                isActive={checkIsActive(item.href, (item as any).exact, (item as any).aliases)} 
                                                isHidden={true}
                                                onHide={handleToggleHide}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        </AnimatePresence>
                    </nav>
                </ScrollArea>
            </div>

            {/* 3. FOOTER: SEARCH & QUICK LINKS */}
            <div className="p-4 bg-white/[0.02] border-t border-white/5 space-y-4 backdrop-blur-xl">
                {!mounted ? (
                    <div className="w-full h-24 bg-white/5 animate-pulse rounded-2xl" />
                ) : (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <SidebarSearch guildId={guildId} />
                            </div>
                            <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                <ThemeToggle />
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Link 
                                href="/docs" 
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80 hover:text-emerald-400 transition-all group shadow-sm"
                            >
                                <BookOpen className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                Doc
                            </Link>
                            <Link 
                                href="/changelog" 
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/80 hover:text-indigo-400 transition-all group shadow-sm"
                            >
                                <ScrollText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                Logs
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ label, collapsible, isOpen, onToggle }: { label: string; collapsible?: boolean; isOpen?: boolean; onToggle?: () => void }) {
    const isSupervision = label === "Supervision";
    const isInfo = label.includes("Info");
    const isOutils = label.includes("Outil");
    const isProgression = label.includes("Progression");
    const isAutres = label.includes("Autre");
    const isPinned = label.includes("Favori");

    return (
        <div 
            className={cn(
                "flex items-center gap-4 px-4 py-2 mb-2 mt-4 group/title select-none relative",
                collapsible && "cursor-pointer"
            )}
            onClick={onToggle}
        >
            {/* Background Pill - UI 2026 */}
            <div className="absolute inset-x-2 inset-y-0 bg-white/[0.02] dark:bg-white/[0.03] rounded-2xl -z-10 group-hover/title:bg-white/[0.05] transition-colors duration-500" />
            
            <div className={cn(
                "h-5 w-[2.5px] rounded-full transition-all duration-500 shadow-glow flex shrink-0",
                isSupervision ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]" : 
                isInfo ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]" :
                isOutils ? "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]" :
                isAutres ? "bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]" :
                isPinned ? "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]" :
                "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
            )} />
            
            <h4 className="text-[11px] font-black uppercase tracking-[0.35em] text-muted-foreground/60 transition-all duration-300 whitespace-nowrap group-hover/title:text-foreground group-hover/title:tracking-[0.45em]">
                {label}
            </h4>
            
            <div className={cn(
                "flex-1 h-[1px] transition-all duration-700 opacity-20 group-hover:opacity-40",
                isSupervision ? "bg-gradient-to-r from-rose-500 via-rose-500/50 to-transparent" : 
                isInfo ? "bg-gradient-to-r from-emerald-500 via-emerald-500/50 to-transparent" :
                isOutils ? "bg-gradient-to-r from-indigo-500 via-indigo-500/50 to-transparent" :
                isAutres ? "bg-gradient-to-r from-cyan-500 via-cyan-500/50 to-transparent" :
                "bg-gradient-to-r from-amber-500 via-amber-500/50 to-transparent"
            )} />
            
            {collapsible && (
                <div className="p-1 rounded-lg bg-white/5 border border-white/5 transition-all group-hover/title:border-white/10">
                    <ChevronRight className={cn("w-3 h-3 text-muted-foreground/40 transition-all duration-500", isOpen && "rotate-90 text-primary")} />
                </div>
            )}
        </div>
    );
}

function NavItem({ 
    item, 
    isActive, 
    isSubItem, 
    isPinned, 
    onPin,
    isHidden,
    onHide
}: { 
    item: any; 
    isActive: boolean; 
    isSubItem?: boolean;
    isPinned?: boolean;
    onPin?: (href: string) => void;
    isHidden?: boolean;
    onHide?: (href: string) => void;
}) {
    const colorMap: Record<string, { text: string, bg: string, border: string, glow: string, muted: string, accent: string }> = {
        emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-[0_0_25px_rgba(16,185,129,0.2)]", muted: "text-emerald-400/40", accent: "bg-emerald-500" },
        amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-[0_0_25px_rgba(245,158,11,0.2)]", muted: "text-amber-400/40", accent: "bg-amber-500" },
        indigo: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "shadow-[0_0_25px_rgba(99,102,241,0.2)]", muted: "text-indigo-400/40", accent: "bg-indigo-500" },
        rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-[0_0_25px_rgba(244,63,94,0.2)]", muted: "text-rose-400/40", accent: "bg-rose-500" },
        cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "shadow-[0_0_25px_rgba(6,182,212,0.2)]", muted: "text-cyan-400/40", accent: "bg-cyan-500" },
        zinc: { text: "text-foreground", bg: "bg-white/5", border: "border-white/10", glow: "shadow-[0_0_25px_rgba(255,255,255,0.05)]", muted: "text-muted-foreground", accent: "bg-zinc-400" },
    };

    const scheme = colorMap[item.color || "emerald"];

    return (
        <Link
            href={item.href}
            className={cn(
                "group relative flex items-center gap-3.5 transition-all duration-500 rounded-2xl border outline-none mx-2 mb-1 overflow-hidden",
                item.isDashboard ? "px-5 py-4 bg-muted/30 border-border/50" : "px-4 py-3",
                isActive 
                    ? cn(
                        "z-10 bg-white/[0.03] backdrop-blur-md border-white/10",
                        scheme.glow
                    )
                    : "text-muted-foreground/70 border-transparent hover:text-foreground hover:bg-white/[0.04] hover:border-white/5 hover:translate-x-1 active:scale-[0.98]"
            )}
        >
            {/* Glassmorphism Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Framer Motion Indicator */}
            {isActive && (
                <motion.div
                    layoutId="sidebar-active-pill"
                    className={cn(
                        "absolute left-0 top-0 bottom-0 w-[3px]",
                        scheme.accent
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            {/* Icon Container */}
            <div className={cn(
                "relative transition-all duration-500 shrink-0 flex items-center justify-center rounded-xl z-20",
                item.isDashboard ? "p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "p-2 bg-white/[0.06] border border-white/10 group-hover:border-white/20",
                isActive && !item.isDashboard 
                    ? cn(scheme.bg, scheme.text, scheme.border, "shadow-inner shadow-black/20") 
                    : (!item.imgSrc ? cn(scheme.text, "opacity-70 group-hover:opacity-100") : "text-muted-foreground group-hover:text-foreground")
            )}>
                {/* Neon Icon Glow */}
                {isActive && (
                    <div className={cn(
                        "absolute inset-0 blur-md opacity-40 -z-10",
                        scheme.accent
                    )} />
                )}

                {item.imgSrc ? (
                    <div className={cn("relative transition-transform duration-500", 
                        item.isDashboard ? "h-6 w-6" : "h-5 w-5",
                        "group-hover:scale-110 group-hover:rotate-[3deg]"
                    )}>
                        <Image 
                            src={item.imgSrc} 
                            alt={item.name} 
                            fill 
                            sizes="24px"
                            className={cn("object-contain transition-all duration-500", 
                                !isActive && "opacity-80 saturate-100 group-hover:opacity-100",
                                isActive && "drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.6)]"
                            )} 
                        />
                    </div>
                ) : (
                    <item.icon className={cn(
                        item.isDashboard ? "h-6 w-6" : "h-5 w-5", 
                        "transition-all duration-500 group-hover:scale-110 group-hover:rotate-[8deg]",
                        (isActive || !item.imgSrc) && "drop-shadow-[0_0_8px_currentColor]"
                    )} />
                )}
            </div>

            <div className="flex flex-col min-w-0 z-10 transition-transform duration-500 group-hover:translate-x-0.5">
                <span className={cn(
                    "text-[12px] font-bold uppercase tracking-[0.15em] transition-all duration-300",
                    isActive ? "text-foreground drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "text-muted-foreground/90 group-hover:text-foreground"
                )}>
                    {item.name}
                </span>
                {item.isDashboard && (
                    <span className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-tight">Accès Principal</span>
                )}
            </div>

            {/* Actions Container */}
            <div className="ml-auto flex items-center gap-1">
                {/* Pin Toggle */}
                {!isHidden && onPin && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPin(item.href);
                        }}
                        className={cn(
                            "p-2 rounded-xl transition-all duration-300 group/pin flex items-center justify-center relative z-20",
                            isPinned 
                                ? "text-amber-500 bg-amber-500/10 opacity-100 border border-amber-500/20" 
                                : "opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20"
                        )}
                    >
                        {isPinned ? (
                            <div className="relative">
                                <Star className="w-3.5 h-3.5 fill-current group-hover/pin:opacity-0 transition-all duration-300" />
                                <X className="w-3.5 h-3.5 absolute inset-0 opacity-0 group-hover/pin:opacity-100 transition-all duration-300" />
                            </div>
                        ) : (
                            <Star className="w-3.5 h-3.5 transition-all duration-300 group-hover/pin:scale-110" />
                        )}
                    </button>
                )}
            </div>
        </Link>
    );
}



function AdminSubItem({ item, isActive }: { item: any; isActive: boolean }) {
    return (
        <Link
            href={item.href}
            className={cn(
                "group flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden",
                isActive ? "text-rose-600 dark:text-rose-300 bg-rose-500/5" : "text-muted-foreground hover:text-rose-500 hover:bg-foreground/[0.02]"
            )}
        >
            {/* Active Glow Background */}
            {isActive && (
                <div className="absolute inset-0 bg-rose-500/5 blur-xl pointer-events-none" />
            )}

            <div className={cn(
                "w-1.5 h-1.5 rounded-full border border-rose-500/30 transition-all shrink-0 z-10",
                isActive ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-muted-foreground/30 group-hover:bg-rose-400 group-hover:border-rose-500"
            )} />
            <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] z-10",
                isActive ? "text-rose-700 dark:text-rose-100" : "text-muted-foreground/60 group-hover:text-rose-500"
            )}>
                {item.name}
            </span>

            {isActive && (
                <div className="ml-auto h-1 w-1 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] z-10" />
            )}
        </Link>
    );
}
