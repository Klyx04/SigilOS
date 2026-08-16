"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
    ChevronRight,
    Menu,
    Home,
    Rocket,
    Shield,
    MessageSquare
} from "lucide-react";
import { SmartBar } from "./smart-bar";
import { HeaderEventChip } from "./header-event-chip";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { FeedBell } from "@/components/notifications/feed-bell";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { UpcomingEvent } from "@/server/actions/event-actions";
import { LiveStreamBadge } from "@/components/notifications/live-stream-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Users, Settings, LogOut } from "lucide-react";
import { GamesLiveWidget } from "@/components/shared/GamesLiveWidget";
import { Suspense, use, useState } from "react";

// Helper to format breadcrumbs with friendly labels
const MODULE_NAMES: Record<string, string> = {
    members: "Membres",
    missions: "Missions",
    songes: "Songes Infinis",
    "donjons-et-quetes": "Donjons & Quêtes",
    "quete-ocre": "Quête Ocre",
    ladder: "Classement",
    services: "Services & Artisans",
    ressources: "Ressources",
    "stuff-hub": "Galerie de Stuff",
    "guild-hub": "La Guilde",
    worldmap: "Carte du Monde",
    "mini-jeux": "Mini-Jeux",
    profile: "Mon Profil",
    admin: "Administration",
    validation: "Validation",
    settings: "Paramètres",
    calendar: "Calendrier",
    polls: "Sondages",
};

const formatSegment = (segment: string) => {
    if (MODULE_NAMES[segment.toLowerCase()]) {
        return MODULE_NAMES[segment.toLowerCase()];
    }

    if (segment.length > 20) {
        return "Détails";
    }

    return decodeURIComponent(segment)
        .replace(/-/g, " ")
        .replace(/^\w/, c => c.toUpperCase());
};

interface TopNavProps {
    // Props passed down for the mobile sidebar
    sidebarProps: React.ComponentProps<typeof AppSidebar>;
    userId: string;
    events?: UpcomingEvent[];
    eventsPromise?: Promise<UpcomingEvent[]>;
    roadmapEnabled?: boolean;
}

function DeferredEventChip({ eventsPromise, guildId, canViewCalendar }: {
    eventsPromise: Promise<UpcomingEvent[]>;
    guildId: string;
    canViewCalendar: boolean;
}) {
    const events = use(eventsPromise);
    return <HeaderEventChip events={events} guildId={guildId} canViewCalendar={canViewCalendar} />;
}

export function TopNav({ sidebarProps, userId, events = [], eventsPromise, roadmapEnabled = false }: TopNavProps) {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    // segments: ["dashboard", "guildId", "module", "subpage", ...]
    const breadcrumbSegments = segments.slice(2);

    const [isArcadeOpen, setIsArcadeOpen] = useState(false);
    const [roomCount, setRoomCount] = useState(0);

    return (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border h-14 px-4 lg:px-6 flex items-center justify-between gap-4 transition-colors duration-150">

            {/* LEFT: Mobile Trigger & Clear Readable Breadcrumbs */}
            <div className="flex items-center gap-4 shrink-0">

                {/* Mobile Sidebar Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[260px] border-r border-border bg-background shadow-2xl">
                        <SheetTitle className="sr-only">Menu de Navigation Mobile</SheetTitle>
                        <SheetDescription className="sr-only">Accédez aux différents modules et outils de votre guilde.</SheetDescription>
                        <AppSidebar {...sidebarProps} />
                    </SheetContent>
                </Sheet>

                {/* Clear, High-Contrast Breadcrumbs */}
                <nav className="hidden sm:flex items-center text-xs font-medium text-muted-foreground gap-1.5">
                    <Link 
                        href={`/dashboard/${sidebarProps.guildId}`} 
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:text-foreground hover:bg-surface",
                            breadcrumbSegments.length === 0 ? "text-foreground bg-surface" : "text-muted-foreground"
                        )}
                    >
                        <Home className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Tableau de bord</span>
                    </Link>

                    {breadcrumbSegments.map((segment, index) => {
                        const href = `/dashboard/${sidebarProps.guildId}/${breadcrumbSegments.slice(0, index + 1).join("/")}`;
                        const isLast = index === breadcrumbSegments.length - 1;

                        return (
                            <div key={href} className="flex items-center gap-1.5">
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <Link
                                    href={href}
                                    className={cn(
                                        "px-2 py-1 rounded-md transition-colors truncate max-w-[120px] lg:max-w-[200px]",
                                        isLast 
                                            ? "text-foreground bg-surface border border-border" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-surface font-medium"
                                    )}
                                >
                                    {formatSegment(segment)}
                                </Link>
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* CENTER: intentionally empty — calme par défaut (direction 2026 §9.2) */}
            <div className="flex-1 min-w-0" />

            {/* RIGHT: Command Center (pilulier live + event, cloches, profil) */}
            <div className="flex items-center gap-2">
                {/* Live stream badge (déplacé hors du centre) */}
                <div className="hidden md:flex items-center shrink-0">
                    <LiveStreamBadge guildId={sidebarProps.guildId} />
                </div>

                {/* Events chip — OUTSIDE overflow-hidden pill so popover is not clipped */}
                {eventsPromise ? (
                    <Suspense fallback={null}>
                        <DeferredEventChip
                            eventsPromise={eventsPromise}
                            guildId={sidebarProps.guildId}
                            canViewCalendar={sidebarProps.user.canViewCalendar}
                        />
                    </Suspense>
                ) : (
                    <HeaderEventChip
                        events={events}
                        guildId={sidebarProps.guildId}
                        canViewCalendar={sidebarProps.user.canViewCalendar}
                    />
                )}

                <div className="flex items-center h-9 border border-border rounded-xl bg-muted/50 dark:bg-foreground/[0.03] backdrop-blur-xl shrink-0 overflow-hidden">
                    {/* 1. Smart Bar (Hidden on Mobile) */}
                    <div className="hidden sm:block border-r border-border">
                        <SmartBar
                            memberCount={sidebarProps.guildData?.memberCount}
                            onlineCount={sidebarProps.guildData?.activeCount}
                            canSearch={sidebarProps.user?.canViewRoster}
                        />
                    </div>

                    {/* Interactive Tools */}
                    <div className="flex items-center px-1">
                        {roadmapEnabled && (
                            <Link href="/roadmap" className="p-2.5 text-muted-foreground hover:text-success transition-colors" title="Roadmap">
                                <Rocket className="w-4 h-4" />
                            </Link>
                        )}

                        {sidebarProps.user.isAdmin && (
                            <Link href={`/dashboard/${sidebarProps.guildId}/admin/permissions`} className="p-2.5 text-muted-foreground hover:text-success transition-colors" title="RBAC / Permissions">
                                <Shield className="w-4 h-4" />
                            </Link>
                        )}
                        <div className="w-px h-4 bg-border/40 mx-1" />
                        <FeedBell
                            guildId={sidebarProps.guildId}
                            className="h-9 w-9 bg-transparent hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                        />
                        <NotificationBell
                            userId={userId}
                            guildId={sidebarProps.guildId}
                            className="h-9 w-9 bg-transparent hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                        />
                    </div>

                    {/* 3. Arcade (Live Games) */}
                    {roomCount > 0 && (
                        <div className="border-l border-border/40 flex items-center">
                            <Button
                                variant="ghost"
                                onClick={() => setIsArcadeOpen(!isArcadeOpen)}
                                className={cn(
                                    "h-10 px-4 bg-success/5 hover:bg-success/10 text-success rounded-none transition-all flex items-center gap-2",
                                    isArcadeOpen && "bg-success/20"
                                )}
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                </span>
                                <span className="text-caption font-semibold uppercase tracking-tighter hidden xl:inline">Live</span>
                                <span className="bg-success text-success-foreground text-caption font-semibold px-1.5 py-0.5 rounded-md">
                                    {roomCount}
                                </span>
                            </Button>
                            <GamesLiveWidget 
                                isOpen={isArcadeOpen} 
                                onOpenChange={setIsArcadeOpen} 
                                onRoomCountChange={setRoomCount}
                                guildId={sidebarProps.guildId}
                            />
                        </div>
                    )}
                </div>

                {/* Guild Chat Trigger */}
                {((sidebarProps as any).modules?.chat) && (
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent("sigilos:open-chat"))}
                        className="h-9 px-3 flex items-center justify-center gap-2 text-success text-success bg-success/10 hover:bg-success/20 border border-success/20 rounded-xl transition-colors group relative mr-2 ring-1 ring-success/10 hover:ring-success/30"
                        title="Chat de Guilde"
                    >
                        <MessageSquare className="w-4 h-4  transition-transform" />
                        <span className="text-caption font-semibold uppercase tracking-wider hidden sm:inline">Chat Live</span>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full animate-pulse border-[2px] border-background" />
                    </button>
                )}

                {/* #16/V2 — Bascule clair / sombre (désactivée si kill-switch God actif) */}
                <ThemeToggle />

                {/* 4. User Profile (Standalone Dropdown) */}
                <div className="flex items-center ml-2">
                    {sidebarProps.user.canViewProfile ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-surface transition-colors outline-none"
                                >
                                    <div className="flex flex-col items-end leading-tight hidden lg:flex">
                                        <span className="text-xs font-bold text-foreground group-hover:text-foreground transition-colors">
                                            {sidebarProps.user.name}
                                        </span>
                                        <span className="text-caption text-muted-foreground font-medium">
                                            {sidebarProps.user.roleName || "Membre"}
                                        </span>
                                    </div>
                                    <Avatar className="h-8 w-8 border border-border rounded-lg shrink-0">
                                        <AvatarImage src={sidebarProps.user.image || ""} />
                                        <AvatarFallback className="text-xs font-bold bg-elevated text-foreground">
                                            {sidebarProps.user.name?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                                className="w-52 bg-background border border-border shadow-2xl rounded-xl p-1 backdrop-blur-xl animate-in fade-in duration-150" 
                                align="end" 
                                sideOffset={8}
                            >
                                <DropdownMenuLabel className="px-3 py-2 text-caption font-bold text-muted-foreground uppercase tracking-wider">
                                    Mon Compte
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-surface" />
                                <DropdownMenuItem asChild className="focus:bg-surface cursor-pointer rounded-lg px-3 py-2.5 transition-colors">
                                    <Link href={`/dashboard/${sidebarProps.guildId}/profile`} className="flex items-center gap-2.5 text-xs font-medium text-foreground hover:text-foreground">
                                        <Users className="w-4 h-4 text-muted-foreground" />
                                        <span>Mon Profil</span>
                                    </Link>
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem asChild className="focus:bg-surface cursor-pointer rounded-lg px-3 py-2.5 transition-colors">
                                    <Link href={`/dashboard/${sidebarProps.guildId}/profile?tab=settings`} className="flex items-center gap-2.5 text-xs font-medium text-foreground hover:text-foreground">
                                        <Settings className="w-4 h-4 text-muted-foreground" />
                                        <span>Réglages</span>
                                    </Link>
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator className="bg-surface" />
                                
                                <DropdownMenuItem 
                                    onClick={() => signOut()} 
                                    className="text-danger focus:text-danger focus:bg-danger/10 cursor-pointer rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2.5 text-xs font-medium"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Déconnexion</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="h-9 w-9 rounded-xl bg-muted border border-border/40 flex items-center justify-center opacity-40">
                             <Avatar className="h-7 w-7 opacity-50 grayscale">
                                <AvatarImage src={sidebarProps.user.image || ""} />
                                <AvatarFallback>?</AvatarFallback>
                            </Avatar>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
