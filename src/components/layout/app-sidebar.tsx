"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Calendar,
    Users,
    ScrollText,
    Sparkles,
    Crown,
    Trophy,
    Award,
    Key,
    Compass,
    Shield,
    Gavel,
    Swords,
    FileText,
    ChevronDown,
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
    EyeOff,
    Settings,
    CheckCircle,
    Rocket,
    History,
    Bug,
    Coins,
    Map,
    CalendarClock,
    Ticket,
    UserCheck,
    Terminal,
} from "lucide-react";
import { SidebarSearch } from "./sidebar-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { getUnreadNotifications } from "@/server/actions/notification-actions";
import { isNavLockedDuringOnboarding } from "@/lib/onboarding-gating";

interface AppSidebarProps {
    guildId: string;
    user: UserContext;
    guildData: GuildHeaderData;
    modules?: GuildModulesState;
    userGuilds?: { id: string; name: string; iconUrl: string | null }[];
    className?: string;
    roadmapEnabled?: boolean;
}

export function AppSidebar({
    guildId,
    user,
    guildData,
    userGuilds = [],
    modules = DEFAULT_MODULES,
    roadmapEnabled = false,
    className
}: AppSidebarProps) {
    const [mounted, setMounted] = useState(false);
    const [localPinnedHrefs, setLocalPinnedHrefs] = useState<string[]>(user.pinnedNavItems || []);
    const [localHiddenHrefs, setLocalHiddenHrefs] = useState<string[]>(user.hiddenNavItems || []);
    const [notifications, setNotifications] = useState<any[]>([]);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // #62 — garde anti-race : quand un changement local (pin/hide) est en vol,
    // on N'ÉCRASE PAS l'état optimiste avec des props serveur potentiellement
    // obsolètes. Sans cela, un pin récent « clignote » ou saute (perçu comme
    // « les onglets se mettent en favoris tout seuls »).
    const localPinMutations = useRef(0);

    useEffect(() => {
        setMounted(true);
        const fetchNotifs = async () => {
            try {
                const res = await getUnreadNotifications(guildId);
                if (res.success && res.data) {
                    setNotifications(res.data);
                }
            } catch (e) {
                console.error("Failed to fetch sidebar notifications", e);
            }
        };
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 10000);
        return () => clearInterval(interval);
    }, []);

    const getUnreadCount = (href: string) => {
        if (href.endsWith("/missions")) return notifications.filter(n => n.category === "MISSION").length;
        if (href.endsWith("/songes")) return notifications.filter(n => n.category === "SONGES").length;
        if (href.endsWith("/calendar")) return notifications.filter(n => n.category === "EVENT").length;
        if (href.endsWith("/sondages")) return notifications.filter(n => n.category === "POLL").length;
        if (href.endsWith("/donjons-et-quetes")) return notifications.filter(n => n.category === "DONJONS").length;
        if (href.endsWith("/ladder")) return notifications.filter(n => n.category === "SUCCESS").length;
        if (href.endsWith("/quete-ocre")) return notifications.filter(n => n.category === "OCRE").length;
        return 0;
    };

    // Sync local state when user prop changes (after server revalidation)
    // Stabilize synchronization from server props
    const pinnedHrefsString = JSON.stringify(user.pinnedNavItems || []);
    const hiddenHrefsString = JSON.stringify(user.hiddenNavItems || []);

    useEffect(() => {
        // #62 — on ne resynchronise l'état local QUE si aucun changement local
        // n'est en vol (compteur de mutations). Sinon, une révalidation serveur
        // avec des props obsolètes écraserait le pin optimiste → « les onglets se
        // mettent en favoris tout seuls » (ou au contraire disparaissent).
        if (localPinMutations.current > 0) return;
        setLocalPinnedHrefs(user.pinnedNavItems || []);
        setLocalHiddenHrefs(user.hiddenNavItems || []);
    }, [pinnedHrefsString, hiddenHrefsString]);

    const checkIsActive = (href: string, exact = false, aliases?: string[]) => {
        if (exact) return pathname === href;
        if (pathname.startsWith(href)) return true;
        if (aliases) {
            return aliases.some(alias => pathname.startsWith(alias));
        }
        // Lien vers un onglet (ex : /profile?tab=planning) : actif si pathname + query correspondent
        if (href.includes("?")) {
            const [base, query] = href.split("?");
            if (pathname !== base) return false;
            const params = new URLSearchParams(query);
            for (const [key, value] of params) {
                if (searchParams.get(key) !== value) return false;
            }
            return true;
        }
        return false;
    };

    const [progressionOpen, setProgressionOpen] = useState(
        true
    );

    const [toolsOpen, setToolsOpen] = useState(
        true
    );

    const [infoOpen, setInfoOpen] = useState(
        true
    );

    const [othersOpen, setOthersOpen] = useState(
        true
    );

    const [adminOpen, setAdminOpen] = useState(
        true
    );

    const [pinnedOpen, setPinnedOpen] = useState(true);

    // --- NAVIGATION GROUPS ---
    // #66bis/#72 : reflète l'ensemble des cartes du Centre Admin — inclut les RBAC
    // déléguables (points, validation, relances). Sans cela, un membre autorisé
    // accédait à sa page admin en URL directe sans voir le « Centre Admin ».
    const hasAnyAdminPermission = user.isAdmin || user.canManageMembers || user.canManageRelance || user.canManageMissions || user.canValidateMissions || user.canEditPresentation || user.canViewAuditLogs || user.canViewSettings || user.canManageRBAC || user.canManagePoints || false;

    // 1. HORS SECTION
    const NAV_GLOBAL = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard, imgSrc: "/assets/nav/grid.png", exact: true, color: "indigo", visible: user.isMember && user.canViewDashboard, isDashboard: true },
    ];

    // 3. PROGRESSION
    const NAV_PROGRESSION = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, imgSrc: "/assets/nav/quests.png", color: "amber", tourKey: "missions", visible: user.canViewMissions && modules.missions },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, imgSrc: "/assets/nav/trophy.png", color: "amber", tourKey: "ladder", visible: user.canViewLadder && modules.ladder },
        { name: "Succès/Fiches BOSS", href: `/dashboard/${guildId}/succes`, icon: Award, imgSrc: "/assets/nav/achievement.png", color: "amber", tourKey: "succes", visible: user.canViewSucces && modules.succes },
        { name: "Les guides", href: `/dashboard/${guildId}/quetes-dofus`, imgSrc: "/assets/nav/sylvestre-white.png", color: "amber", tourKey: "quetes", visible: user.canViewQuests && modules.quests },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, imgSrc: "/assets/nav/archimonster.png", color: "amber", tourKey: "ocre", visible: user.canViewOcre && modules.ocre },
    ];

    // 4. OUTILS
    const NAV_TOOLS: any[] = [
        { name: "Donjons & Quêtes", href: `/dashboard/${guildId}/donjons-et-quetes`, icon: Swords, imgSrc: "/assets/nav/boss.png", color: "indigo", tourKey: "donjons", visible: user.canViewQuests && modules.donjons },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: Sparkles, imgSrc: "/assets/nav/infinite.png", color: "indigo", tourKey: "songes", visible: user.canViewSonges && modules.songes },
        { name: "Galerie Guilde", href: `/dashboard/${guildId}/galerie-stuff`, icon: Star, imgSrc: "/assets/nav/panoplie.png", color: "indigo", tourKey: "galerie", visible: user.canViewStuffGallery && modules.gallery },
        { name: "Services Guilde", href: `/dashboard/${guildId}/services`, icon: Activity, imgSrc: "/assets/nav/exchange.png", color: "indigo", tourKey: "services", visible: user.canViewServices && modules.services },
        { name: "Planning", href: `/dashboard/${guildId}/planning`, icon: CalendarClock, imgSrc: "/assets/nav/hourglass.png", color: "indigo", tourKey: "availability", visible: user.canViewAvailability && modules.availability },
    ];

    // 5. AUTRES
    const NAV_OTHERS = [
        { name: "Mini-Jeux", href: `/dashboard/${guildId}/mini-jeux`, icon: Gamepad2, imgSrc: "/assets/nav/dice.png", color: "cyan", tourKey: "minigames", visible: user.canViewMiniGames && modules.minigames },
        { name: "Sondages", href: `/dashboard/${guildId}/sondages`, icon: Gavel, imgSrc: "/assets/nav/chat.png", color: "cyan", tourKey: "polls", visible: user.canViewPolls && modules.polls },
        { name: "Carte du Monde", href: `/dashboard/${guildId}/worldmap`, icon: Compass, imgSrc: "/assets/nav/world.png", color: "cyan", visible: user.canViewWorldmap && modules.worldmap },
        { name: "Roadmap", href: "/roadmap", icon: Rocket, color: "amber", visible: roadmapEnabled },
    ];

    const NAV_ADMIN_TOP = { 
        name: "Centre Admin", 
        href: `/dashboard/${guildId}/admin`, 
        icon: Shield, 
        exact: true, 
        color: "rose", 
        visible: hasAnyAdminPermission,
        prefetch: false,
        aliases: [
            `/dashboard/${guildId}/admin/permissions`,
            `/dashboard/${guildId}/admin/settings`,
            `/dashboard/${guildId}/admin/modules`,
            `/dashboard/${guildId}/admin/presentation`,
            `/dashboard/${guildId}/admin/validation`,
            `/dashboard/${guildId}/admin/members`,
            `/dashboard/${guildId}/admin/points`,
            `/dashboard/${guildId}/missions/manage`,
            `/dashboard/${guildId}/admin/logs`,
            `/dashboard/${guildId}/reaction-roles`,
            `/dashboard/${guildId}/tickets`,
            `/dashboard/${guildId}/admin/commandes`,
        ]
    };

    // 5. REGISTRY FOR PINNED ITEMS
    // We register all items that can be pinned
    const NAV_REGISTRY = [
        ...NAV_GLOBAL,
        ...NAV_PROGRESSION,
        ...NAV_TOOLS,
        ...NAV_OTHERS,
        NAV_ADMIN_TOP,
        { name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, imgSrc: "/assets/nav/genealogy.png", color: "emerald", visible: user.canViewRoster && modules.roster },
        { name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, imgSrc: "/assets/nav/calendar.png", color: "emerald", visible: user.canViewCalendar && modules.calendar },
        { name: "Ressources Dofus", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, imgSrc: "/assets/nav/resources.png", color: "emerald", visible: user.canViewResources && modules.resources },
        { name: "Commandes Bot Discord", href: `/dashboard/${guildId}/commandes`, icon: Terminal, imgSrc: "/assets/nav/cog.png", color: "emerald", visible: user.canViewCommands },
        { 
            name: "La guilde", 
            href: `/dashboard/${guildId}/guild-hub`, 
            icon: Sparkles, 
            imgSrc: "/assets/nav/guild.png",
            color: "emerald",
            visible: (user.canViewWelcome || user.canViewPresentation || user.canViewStats),
            aliases: [
                `/dashboard/${guildId}/welcome`,
                `/dashboard/${guildId}/presentation`,
                `/dashboard/${guildId}/stats`,
            ]
        },

        // ADMIN SUB-ROUTES (Searchable & Pinnable)
        { name: "Paramètres Généraux", href: `/dashboard/${guildId}/admin/settings`, icon: Settings, color: "amber", visible: user.canViewSettings },
        { name: "Rôles & Permissions", href: `/dashboard/${guildId}/admin/permissions`, icon: Shield, color: "zinc", visible: user.canManageRBAC },
        { name: "Commandes Slash Discord", href: `/dashboard/${guildId}/admin/commandes`, icon: Terminal, color: "emerald", visible: user.canManageRBAC || user.isAdmin },
        { name: "Gestion des Modules", href: `/dashboard/${guildId}/admin/modules`, icon: Hammer, color: "indigo", visible: user.isDiscordAdmin },
        { name: "Identité de Guilde", href: `/dashboard/${guildId}/admin/presentation`, icon: BookOpen, color: "emerald", visible: user.canEditPresentation },
        { name: "Gestion des Missions", href: `/dashboard/${guildId}/missions/manage`, icon: Swords, color: "emerald", visible: user.canManageMissions },
        { name: "Validation", href: `/dashboard/${guildId}/admin/validation`, icon: CheckCircle, color: "emerald", visible: user.canValidateMissions },
        { name: "Audit & Membres", href: `/dashboard/${guildId}/admin/members`, icon: Users, color: "cyan", visible: user.canManageMembers || user.canManageRelance },
        { name: "Recrutement & Cycle de Vie", href: `/dashboard/${guildId}/admin/recruitment`, icon: UserCheck, color: "emerald", visible: user.canManageMembers },
        { name: "Points de Contribution", href: `/dashboard/${guildId}/admin/points`, icon: Coins, color: "amber", visible: user.canManagePoints },
        { name: "Rôles par Réaction", href: `/dashboard/${guildId}/reaction-roles`, icon: Sparkles, color: "purple", visible: user.canManageReactionRoles && modules.reactionRoles },
        { name: "Bot Tickets & Support", href: `/dashboard/${guildId}/tickets`, icon: Ticket, color: "amber", visible: user.canManageTickets && modules.tickets },
        { name: "Logs d'Audit", href: `/dashboard/${guildId}/admin/logs`, icon: FileText, color: "rose", visible: user.canViewAuditLogs && modules.logs },
        { name: "Documentation", href: "/docs", icon: BookOpen, color: "teal", visible: true },
        { name: "Mises à jour", href: "/changelog", icon: History, color: "indigo", visible: true },
        { name: "Tracker de Bugs", href: `/dashboard/${guildId}/tracker`, icon: Bug, color: "amber", visible: true },
    ];

    // --- NAVIGATION GROUPS ---

    // Verrou onboarding : tant que la mise en route n'est pas terminée,
    // l'admin ne voit QUE le Centre Admin (le reste — Dashboard, La guilde,
    // Commandes… — fuyait à la 1re arrivée). God exempté (inspection).
    const hideNonAdminNav = isNavLockedDuringOnboarding({
        isOnboardingComplete: !!user.isOnboardingComplete,
        isSuperAdmin: !!user.isSuperAdmin,
    });

    // Permissions helpers — computed once
    const showProgressionGroup = Boolean(
        (user.canViewMissions && modules.missions && !localPinnedHrefs.includes(`/dashboard/${guildId}/missions`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/missions`)) ||
        (user.canViewSonges && modules.songes && !localPinnedHrefs.includes(`/dashboard/${guildId}/songes`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/songes`)) ||
        (user.canViewLadder && modules.ladder && !localPinnedHrefs.includes(`/dashboard/${guildId}/ladder`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/ladder`)) ||
        (user.isMember && user.canViewQuests && modules.quests && !localPinnedHrefs.includes(`/dashboard/${guildId}/quetes-dofus`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/quetes-dofus`)) ||
        (user.canViewOcre && modules.ocre && !localPinnedHrefs.includes(`/dashboard/${guildId}/quete-ocre`) && !localHiddenHrefs.includes(`/dashboard/${guildId}/quete-ocre`))
    );

    const showAdminGroup = hasAnyAdminPermission && !localPinnedHrefs.includes(NAV_ADMIN_TOP.href) && !localHiddenHrefs.includes(NAV_ADMIN_TOP.href);

    const pinnedItems = localPinnedHrefs
        .filter(href => !localHiddenHrefs.includes(href))
        .map(href => NAV_REGISTRY.find(item => item.href === href))
        .filter(item => item && item.visible !== false) as any[];

    const hiddenItems = localHiddenHrefs
        .map(href => NAV_REGISTRY.find(item => item.href === href))
        .filter(item => item && item.visible !== false) as any[];

    const [hiddenOpen, setHiddenOpen] = useState(true);

    // Navbar redimensionnable à la volée (desktop) : largeur persistée en
    // localStorage, propagée au layout via la variable CSS --app-sidebar-width
    // (consommée uniquement par le layout dashboard fixe).
    const APP_SIDEBAR_DEFAULT = 280;
    const APP_SIDEBAR_MIN = 232;
    const APP_SIDEBAR_MAX = 400;
    const [sidebarWidth, setSidebarWidth] = useState(APP_SIDEBAR_DEFAULT);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const sidebarWidthRef = useRef(sidebarWidth);
    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
        document.documentElement.style.setProperty("--app-sidebar-width", `${sidebarWidth}px`);
    }, [sidebarWidth]);
    useEffect(() => {
        try {
            const saved = localStorage.getItem("sigilos-app-sidebar-width");
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!Number.isNaN(parsed)) setSidebarWidth(Math.min(Math.max(parsed, APP_SIDEBAR_MIN), APP_SIDEBAR_MAX));
            }
        } catch { /* localStorage indisponible — largeur par défaut */ }
    }, []);
    useEffect(() => {
        if (!isResizingSidebar) return;
        const onMove = (e: MouseEvent) => {
            const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
            const next = Math.min(Math.max(e.clientX - left, APP_SIDEBAR_MIN), APP_SIDEBAR_MAX);
            setSidebarWidth(next);
        };
        const onUp = () => {
            setIsResizingSidebar(false);
            try { localStorage.setItem("sigilos-app-sidebar-width", String(sidebarWidthRef.current)); } catch { /* ignore */ }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizingSidebar]);

    const handleTogglePin = async (href: string) => {
        // Optimistic Update
        localPinMutations.current++;
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
        } finally {
            localPinMutations.current--;
        }
    };

    const handleToggleHide = async (href: string) => {
        // Optimistic Update
        localPinMutations.current++;
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
        } finally {
            localPinMutations.current--;
        }
    };

    return (
        <div ref={sidebarRef} className={cn("relative flex flex-col h-full bg-background border-r border-border", className)}>

            {/* 1. HEADER: BRAND & GUILD SWITCHER */}
            <div className="p-4 pb-2 space-y-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-4 px-1 group transition-all">
                    <div className="relative h-9 w-9 transition-colors duration-150  ">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            sizes="36px"
                            className="object-contain transition-all"
                        />
                    </div>
                    <span className="text-lg font-bold tracking-[0.2em] text-foreground/90 uppercase transition-all group-hover:text-foreground">
                        SIGIL<span className="text-primary tracking-[0.18em]">OS</span>
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
                                            <AvatarFallback className="text-caption bg-muted text-muted-foreground">
                                                {guildData.name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-body-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate w-[130px]">
                                            {guildData.name}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-64 bg-background/98 border border-border shadow-2xl p-1 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150"
                                align="start"
                                sideOffset={8}
                            >
                                <DropdownMenuLabel className="px-3 py-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                                    Changer de guilde
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border mx-1 mb-2" />
                                <div className="space-y-0.5 p-1">
                                    {userGuilds.map((g) => (
                                        <DropdownMenuItem key={g.id} asChild>
                                            <Link
                                                href={`/dashboard/${g.id}`}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150",
                                                    g.id === guildId
                                                        ? "bg-primary/10 border border-primary/20 text-foreground"
                                                        : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Avatar className="h-6 w-6 rounded-md border border-border/20">
                                                    <AvatarImage src={g.iconUrl || undefined} />
                                                    <AvatarFallback className="text-caption bg-muted/60 text-muted-foreground/60">
                                                        {g.name?.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={cn("text-sm font-semibold truncate", g.id === guildId ? "text-foreground" : "")}>
                                                        {g.name}
                                                    </span>
                                                    {g.id === guildId && <span className="text-caption font-medium text-muted-foreground">Connecté</span>}
                                                </div>
                                                {g.id === guildId && (
                                                    <div className="ml-auto w-1 h-4 bg-primary/80 rounded-full" />
                                                )}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                                <DropdownMenuSeparator className="bg-border mx-1" />
                                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-caption text-muted-foreground font-bold uppercase tracking-widest cursor-not-allowed opacity-50">
                                    <Plus className="h-3.5 w-3.5" />
                                    Rejoindre une guilde
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                )}

                {userGuilds.length === 1 && (
                    <div
                        className="w-full flex items-center gap-2 h-11 px-2 rounded-xl bg-muted/40 border border-border/40"
                        title={guildData.name}
                    >
                        <Avatar className="h-6 w-6 rounded-lg border border-border/20 shrink-0">
                            <AvatarImage src={guildData.iconUrl || undefined} />
                            <AvatarFallback className="text-caption bg-muted text-muted-foreground">
                                {guildData.name?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-body-sm font-semibold text-muted-foreground truncate min-w-0 flex-1">
                            {guildData.name}
                        </span>
                        <Shield className="h-3 w-3 text-primary/60 shrink-0" />
                    </div>
                )}


            </div>

            {/* 2. SCROLLABLE NAVIGATION — Fixed for responsiveness */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                <div className="h-full px-3 py-6 overflow-y-auto overscroll-contain custom-scrollbar">
                    <nav className="space-y-8 pb-10">
                        <AnimatePresence mode="popLayout" initial={false}>

                        {/* SECTION: FAVORI / PINNED (masquée pendant l'onboarding) */}
                        {!hideNonAdminNav && pinnedItems.length > 0 && (
                                <div key="section-favorites" className="space-y-1 relative group/section">
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
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
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
                                                    unreadCount={getUnreadCount(item.href)}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                    <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-300" />
                                </div>
                        )}

                        {/* SECTION: GLOBAL (DASHBOARD CARD — masquée pendant l'onboarding) */}
                        {!hideNonAdminNav && (
                        <div key="section-global" className="mb-10 px-1">
                            <div className="space-y-1">
                                {NAV_GLOBAL.filter(i => i.visible !== false && !localPinnedHrefs.includes(i.href) && !localHiddenHrefs.includes(i.href)).map((item) => (
                                <NavItem 
                                    key={item.href} 
                                    item={item} 
                                    isActive={checkIsActive(item.href, (item as any).exact)} 
                                    isPinned={false}
                                    onPin={handleTogglePin}
                                    unreadCount={getUnreadCount(item.href)}
                                />
                            ))}
                            </div>
                        </div>
                        )}

                        {!hideNonAdminNav && (
                        <div key="section-informations" className="relative group/section" data-tour-section="informations">
                            <SectionTitle 
                                label="Informations" 
                                collapsible 
                                isOpen={infoOpen} 
                                onToggle={() => setInfoOpen(!infoOpen)} 
                            />
                            {infoOpen && (
                                <motion.div 
                                    key="motion-info"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="space-y-1 px-1 overflow-hidden"
                                >
                                    {/* La guilde - Hub Link */}
                                    {(user.canViewWelcome || user.canViewPresentation || user.canViewStats) && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/guild-hub`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/guild-hub`) && (
                                            <NavItem 
                                                key={`nav-hub`}
                                                item={{ 
                                                    name: "La guilde", 
                                                    href: `/dashboard/${guildId}/guild-hub`, 
                                                    icon: Sparkles, 
                                                    imgSrc: "/assets/nav/guild.png",
                                                    color: "emerald",
                                                    tourKey: "la-guilde",
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
                                                unreadCount={getUnreadCount(`/dashboard/${guildId}/guild-hub`)}
                                            />
                                    )}

                                    {/* Annuaire - Direct Link (verrou module : invisible tant que l'admin n'active pas le module) */}
                                    {user.canViewRoster && modules.roster &&
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/members`) &&
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/members`) && (
                                        <NavItem 
                                            key={`nav-roster`}
                                                item={{ name: "Annuaire", href: `/dashboard/${guildId}/members`, icon: Users, imgSrc: "/assets/nav/genealogy.png", color: "emerald", tourKey: "annuaire" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/members`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                            unreadCount={getUnreadCount(`/dashboard/${guildId}/members`)}
                                        />
                                    )}
                                    
                                    {/* Calendrier - Direct Link (verrou module : invisible tant que l'admin n'active pas le module) */}
                                    {user.canViewCalendar && modules.calendar &&
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/calendar`) &&
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/calendar`) && (
                                        <NavItem 
                                            key={`nav-calendar`}
                                                item={{ name: "Calendrier", href: `/dashboard/${guildId}/calendar`, icon: Calendar, imgSrc: "/assets/nav/calendar.png", color: "emerald", tourKey: "calendar" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/calendar`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                            unreadCount={getUnreadCount(`/dashboard/${guildId}/calendar`)}
                                        />
                                    )}

                                    {/* Ressources - Direct Link */}
                                    {user.canViewResources && modules.resources && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/ressources`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/ressources`) && (
                                        <NavItem 
                                            key={`nav-resources`}
                                                item={{ name: "Ressources Dofus", href: `/dashboard/${guildId}/ressources`, icon: BookOpen, imgSrc: "/assets/nav/resources.png", color: "emerald", tourKey: "ressources" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/ressources`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                            unreadCount={getUnreadCount(`/dashboard/${guildId}/ressources`)}
                                        />
                                    )}

                                    {/* Commandes Bot - Direct Link */}
                                    {user.canViewCommands && 
                                    !localPinnedHrefs.includes(`/dashboard/${guildId}/commandes`) && 
                                    !localHiddenHrefs.includes(`/dashboard/${guildId}/commandes`) && (
                                        <NavItem 
                                            key={`nav-commandes`}
                                                item={{ name: "Commandes Bot Discord", href: `/dashboard/${guildId}/commandes`, icon: Terminal, imgSrc: "/assets/nav/cog.png", color: "emerald", tourKey: "commandes" }} 
                                            isActive={checkIsActive(`/dashboard/${guildId}/commandes`)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                            unreadCount={0}
                                        />
                                    )}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-150" />
                        </div>
                        )}

                        {/* SECTION: PROGRESSION (masquée pendant l'onboarding) */}
                        {!hideNonAdminNav && showProgressionGroup && (
                            <div key="section-progression" className="relative group/section" data-tour-section="progression">
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
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
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
                                                unreadCount={getUnreadCount(item.href)}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                                <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-300" />
                            </div>
                        )}

                        {!hideNonAdminNav && (
                        <div key="section-tools" className="relative group/section">
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
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
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
                                            unreadCount={getUnreadCount(item.href)}
                                        />
                                    ))}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-300" />
                        </div>
                        )}

                        {!hideNonAdminNav && (
                        <div key="section-others" className="relative group/section">
                            <SectionTitle 
                                label="Autres" 
                                collapsible 
                                isOpen={othersOpen} 
                                onToggle={() => setOthersOpen(!othersOpen)} 
                            />
                            {othersOpen && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
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
                                            unreadCount={getUnreadCount(item.href)}
                                        />
                                    ))}
                                </motion.div>
                            )}
                            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-300" />
                        </div>
                        )}

                        {/* SECTION: SUPERVISION (ADMIN) — seule visible pendant l'onboarding */}
                        {showAdminGroup && (
                            <div key="section-supervision" className="relative group/section">
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
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="space-y-1 px-1 overflow-hidden"
                                    >
                                        <NavItem 
                                            item={NAV_ADMIN_TOP} 
                                            isActive={checkIsActive(NAV_ADMIN_TOP.href, NAV_ADMIN_TOP.exact, NAV_ADMIN_TOP.aliases)} 
                                            isPinned={false}
                                            onPin={handleTogglePin}
                                            onHide={handleToggleHide}
                                            unreadCount={getUnreadCount(NAV_ADMIN_TOP.href)}
                                        />
                                    </motion.div>
                                )}
                                <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-300" />
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
                                    <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                                        {hiddenItems.map((item) => (
                                            <NavItem 
                                                key={`hidden-${item.href}`} 
                                                item={item} 
                                                isActive={checkIsActive(item.href, (item as any).exact, (item as any).aliases)} 
                                                isHidden={true}
                                                onHide={handleToggleHide}
                                                unreadCount={getUnreadCount(item.href)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        </AnimatePresence>
                    </nav>
                </div>
            </div>

            {/* 3. FOOTER: COMMAND CENTER HUD */}
            <div className="p-4 bg-surface/40 border-t border-border space-y-4 relative">
                
                {!mounted ? (
                    <div className="w-full h-24 bg-surface animate-pulse rounded-2xl" />
                ) : (
                    <div className="space-y-4">
                        {/* Search Module */}
                        <div className="relative group/search">
                            <SidebarSearch guildId={guildId} />
                            {/* Decorative Corner Accents */}
                            <div className="absolute top-0 left-0 w-1 h-1 " />
                            <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-border-strong rounded-tr-[2px]" />
                        </div>

                        {/* Quick Access Grid */}
                        <div className="flex items-center gap-1">
                            <Link href="/docs" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors duration-150" title="Documentation">
                                <BookOpen className="w-4 h-4" />
                                <span className="text-caption font-medium">Docs</span>
                            </Link>
                            <Link href="/changelog" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors duration-150" title="Changelog">
                                <History className="w-4 h-4" />
                                <span className="text-caption font-medium">Maj</span>
                            </Link>
                            <Link href={`/dashboard/${guildId}/tracker`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors duration-150" title="Tracker de bugs">
                                <Bug className="w-4 h-4" />
                                <span className="text-caption font-medium">Bugs</span>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
            {/* Poignée de redimensionnement (desktop, largeur persistée) */}
            <div
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizingSidebar(true); }}
                title="Élargir / rétrécir la navbar — largeur sauvegardée"
                aria-hidden="true"
                className={cn(
                    "absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-success/60 transition-colors z-20 hidden lg:block",
                    isResizingSidebar && "bg-success"
                )}
            />
        </div>
    );
}

function SectionTitle({ label, collapsible: _collapsible, isOpen: _isOpen, onToggle: _onToggle }: { label: string; collapsible?: boolean; isOpen?: boolean; onToggle?: () => void }) {
    const isSupervision = label === "Supervision";
    const isInfo = label.includes("Info");
    const isOutils = label.includes("Outil");
    const isProgression = label.includes("Progression");
    const isAutres = label.includes("Autre");
    const isPinned = label.includes("Favori");

    return (
        <div className="flex items-center gap-3 px-4 py-1 mb-1 mt-2.5 group/title select-none relative">
            {/* Background Pill - UI 2026 */}
            <div className="absolute inset-x-2 inset-y-0 bg-surface bg-surface rounded-2xl -z-10 group-hover/title:bg-surface transition-colors duration-150" />
            
            <div className={cn(
                "h-5 w-[2.5px] rounded-full transition-colors duration-150  flex shrink-0",
                isSupervision ? "bg-success " : 
                isInfo ? "bg-success " :
                isOutils ? "bg-success " :
                isAutres ? "bg-success " :
                isPinned ? "bg-success " :
                "bg-success "
            )} />
            
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground/80 transition-colors duration-150 whitespace-nowrap group-hover/title:text-foreground">
                {label}
            </h4>
            
            <div className={cn(
                "flex-1 h-[1px] transition-all duration-150 opacity-20 group-hover:opacity-40",
                isSupervision ? "bg-gradient-to-r from-success via-success/50 to-transparent" : 
                isInfo ? "bg-gradient-to-r from-success via-success/50 to-transparent" :
                isOutils ? "bg-gradient-to-r from-success via-success/50 to-transparent" :
                isAutres ? "bg-gradient-to-r from-success via-success/50 to-transparent" :
                "bg-gradient-to-r from-success via-success/50 to-transparent"
            )} />        </div>
    );
}

function NavItem({ 
    item, 
    isActive, 
    isSubItem, 
    isPinned, 
    onPin,
    isHidden,
    onHide,
    unreadCount
}: { 
    item: any; 
    isActive: boolean; 
    isSubItem?: boolean;
    isPinned?: boolean;
    onPin?: (href: string) => void;
    isHidden?: boolean;
    onHide?: (href: string) => void;
    unreadCount?: number;
}) {
    const colorMap: Record<string, { text: string, bg: string, border: string, glow: string, muted: string, accent: string }> = {
        emerald: { text: "text-success", bg: "bg-success/10", border: "border-success/20", glow: "", muted: "text-success/40", accent: "bg-success" },
        amber: { text: "text-success", bg: "bg-success/10", border: "border-success/20", glow: "", muted: "text-success/40", accent: "bg-success" },
        indigo: { text: "text-success", bg: "bg-success/10", border: "border-success/20", glow: "", muted: "text-success/40", accent: "bg-success" },
        rose: { text: "text-success", bg: "bg-success/10", border: "border-success/20", glow: "", muted: "text-success/40", accent: "bg-success" },
        cyan: { text: "text-success", bg: "bg-success/10", border: "border-success/20", glow: "", muted: "text-success/40", accent: "bg-success" },
        zinc: { text: "text-foreground", bg: "bg-surface", border: "border-border", glow: "", muted: "text-muted-foreground", accent: "bg-muted" },
    };

    const scheme = colorMap[item.color || "emerald"];

    const tourKey = item.tourKey;
    return (
        <Link
            href={item.href}
            prefetch={item.prefetch ?? true}
            data-tour={
                tourKey
                    ? `sidebar-${tourKey}`
                    : item.isDashboard 
                        ? "sidebar-dashboard" 
                        : item.href?.endsWith("/missions") 
                            ? "sidebar-missions" 
                            : item.href?.endsWith("/ladder") 
                                ? "sidebar-ladder" 
                                : item.href?.endsWith("/members") 
                                    ? "sidebar-members" 
                                    : item.href?.endsWith("/calendar") 
                                        ? "sidebar-calendar" 
                                        : undefined
            }
            className={cn(
                "group relative flex items-center gap-2.5 transition-colors duration-150 rounded-xl border outline-none mx-2 mb-0.5 overflow-hidden",
                "px-3 py-1",
                isActive 
                    ? cn(
                        "z-10 bg-surface border-border",
                        scheme.glow
                    )
                    : "text-muted-foreground/70 border-transparent hover:text-foreground hover:bg-surface hover:border-border  "
            )}
        >
            {/* Glassmorphism Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

            {/* Framer Motion Indicator — neutre (fini le vert) */}
            {isActive && (
                <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            {/* Icon Container */}
            <div className={cn(
                "relative transition-colors duration-150 shrink-0 flex items-center justify-center rounded-xl z-20",
                item.imgSrc
                    ? "p-1.5 bg-[#161d27] border border-[#2a323d] group-hover:border-[#3a4550]"
                    : "p-1.5 bg-surface border border-border group-hover:border-border-strong",
                isActive 
                    ? "bg-white/[0.06] border-white/15 text-foreground shadow-inner shadow-black/20"
                    : (!item.imgSrc ? cn(scheme.text, "opacity-70 group-hover:opacity-100") : "text-muted-foreground group-hover:text-foreground")
            )}>
                {/* Neon Icon Glow — neutre */}
                {isActive && (
                    <div className="absolute inset-0 opacity-40 -z-10 bg-white/10" />
                )}

                {item.imgSrc ? (
                    <div className={cn("relative transition-transform duration-150", 
                        "h-5 w-5",
                        ""
                    )}>
                        <Image 
                            src={item.imgSrc} 
                            alt={item.name} 
                            fill 
                            sizes="24px"
                            className={cn("object-contain transition-colors duration-150", 
                                !isActive && "saturate-100",
                                isActive && ""
                            )} 
                        />
                    </div>
                ) : (
                    <item.icon className={cn(
                        "h-5 w-5", 
                        "transition-colors duration-150 ",
                        (isActive || !item.imgSrc) && ""
                    )} />
                )}
            </div>

            <div className="flex flex-col min-w-0 z-10 transition-transform duration-150 ">
                <span className={cn(
                    "text-body-sm leading-tight font-medium transition-colors duration-150",
                    isActive ? "text-foreground " : "text-muted-foreground/90 group-hover:text-foreground"
                )}>
                    {item.name}
                </span>
            </div>

            {/* Notification Badge */}
            {unreadCount !== undefined && unreadCount > 0 && (
                <div className="flex shrink-0 items-center justify-center min-w-[20px] h-5 px-1 ml-auto mr-1 bg-danger rounded-full  z-20 animate-in zoom-in">
                    <span className="text-caption font-semibold text-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
            )}

            {/* Actions Container */}
            <div className={cn("flex items-center gap-1", unreadCount && unreadCount > 0 ? "" : "ml-auto")}>
                {/* Pin Toggle */}
                {!isHidden && onPin && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPin(item.href);
                        }}
                        className={cn(
                            "p-2 rounded-xl transition-colors duration-150 group/pin flex items-center justify-center relative z-20",
                            isPinned 
                                ? "text-success bg-success/10 opacity-100 border border-success/20" 
                                : "opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-success hover:bg-success/10 hover:border-success/20"
                        )}
                    >
                        {isPinned ? (
                            <div className="relative">
                                <Star className="w-3.5 h-3.5 fill-current group-hover/pin:opacity-0 transition-colors duration-150" />
                                <X className="w-3.5 h-3.5 absolute inset-0 opacity-0 group-hover/pin:opacity-100 transition-colors duration-150" />
                            </div>
                        ) : (
                            <Star className="w-3.5 h-3.5 transition-colors duration-150 " />
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
            prefetch={false}
            className={cn(
                "group flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden",
                isActive ? "text-success text-success bg-success/5" : "text-muted-foreground hover:text-success hover:bg-foreground/[0.02]"
            )}
        >
            {/* Active Glow Background */}
            {isActive && (
                <div className="absolute inset-0 bg-success/5  pointer-events-none" />
            )}

            <div className={cn(
                "w-1.5 h-1.5 rounded-full border border-success/30 transition-all shrink-0 z-10",
                isActive ? "bg-success " : "bg-muted-foreground/30 group-hover:bg-success group-hover:border-success"
            )} />
            <span className={cn(
                "text-body-sm font-medium z-10",
                isActive ? "text-success text-success" : "text-muted-foreground/60 group-hover:text-success"
            )}>
                {item.name}
            </span>

            {isActive && (
                <div className="ml-auto h-1 w-1 rounded-full bg-success  z-10" />
            )}
        </Link>
    );
}
