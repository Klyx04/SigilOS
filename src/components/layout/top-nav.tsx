"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
    ChevronRight,
    Menu,
    Home,
    ScrollText,
    Gamepad2,
    Loader2,
    Plus,
    Minus,
    CircleHelp,
    Rocket,
    Shield,
    Search as SearchIcon,
    MessageSquare
} from "lucide-react";
import { SmartBar } from "./smart-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { FeedBell } from "@/components/notifications/feed-bell";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { EventTicker } from "@/components/layout/event-ticker";
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

// Helper to format breadcrumbs
const formatSegment = (segment: string) => {
    // Detect CUIDs or long technical IDs (e.g. for runs, missions, etc)
    // SigilOS IDs are typically cuids (starts with c, ~24-25 chars)
    if (segment.length > 20) {
        return "Détails";
    }

    return segment
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

function DeferredEventTicker({ 
    eventsPromise, 
    guildId, 
    canViewCalendar 
}: { 
    eventsPromise: Promise<UpcomingEvent[]>, 
    guildId: string, 
    canViewCalendar: boolean 
}) {
    const events = use(eventsPromise);
    return <EventTicker events={events} guildId={guildId} canViewCalendar={canViewCalendar} />;
}

export function TopNav({ sidebarProps, userId, events = [], eventsPromise, roadmapEnabled = false }: TopNavProps) {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    // segments: ["dashboard", "guildId", "module", "subpage", ...]
    const breadcrumbSegments = segments.slice(2);

    const [isArcadeOpen, setIsArcadeOpen] = useState(false);
    const [roomCount, setRoomCount] = useState(0);

    return (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-border h-14 px-4 lg:px-6 flex items-center justify-between gap-4 transition-all duration-300">

            {/* LEFT: Mobile Trigger & Breadcrumbs */}
            <div className="flex items-center gap-6 shrink-0">

                {/* Mobile Sidebar Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[260px] border-r border-border bg-background">
                        <SheetTitle className="sr-only">Menu de Navigation Mobile</SheetTitle>
                        <SheetDescription className="sr-only">Accédez aux différents modules et outils de votre guilde.</SheetDescription>
                        <AppSidebar {...sidebarProps} />
                    </SheetContent>
                </Sheet>

                {/* Breadcrumbs */}
                <nav className="hidden sm:flex items-center text-[11px] font-black tracking-tighter uppercase italic text-muted-foreground/60">
                    <Link href={`/dashboard/${sidebarProps.guildId}`} className="hover:text-primary transition-all flex items-center gap-1.5 group">
                        <Home className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">Dashboard</span>
                    </Link>

                    {breadcrumbSegments.length > 0 && <ChevronRight className="h-3 w-3 mx-2 text-muted-foreground/30" />}

                    {breadcrumbSegments.map((segment, index) => {
                        const href = `/dashboard/${sidebarProps.guildId}/${breadcrumbSegments.slice(0, index + 1).join("/")}`;
                        const isLast = index === breadcrumbSegments.length - 1;

                        return (
                            <div key={href} className="flex items-center">
                                 <Link
                                    href={href}
                                    className={cn(
                                        "transition-all truncate max-w-[100px] lg:max-w-[180px] hover:text-foreground",
                                        isLast 
                                            ? "text-foreground font-black uppercase tracking-[0.2em] text-[10px]" 
                                            : "text-muted-foreground/60 dark:text-muted-foreground/50 font-bold"
                                    )}
                                >
                                    {formatSegment(segment)}
                                </Link>
                                {!isLast && <ChevronRight className="h-3 w-3 mx-1.5 text-muted-foreground/20" />}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* CENTER: Integrated Ticker & Search (2026 Standard) */}
            <div className="flex-1 flex items-center justify-center gap-4 px-2 min-w-0">

                {/* Event Ticker (Primary visibility) */}
                <div className="hidden md:flex flex-1 max-w-xl justify-center items-center gap-4">
                    <LiveStreamBadge guildId={sidebarProps.guildId} />
                    {eventsPromise ? (
                        <Suspense fallback={
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/[0.03] border border-border/50 animate-pulse">
                                <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                                <div className="h-3 w-32 bg-muted/60 rounded-full" />
                            </div>
                        }>
                            <DeferredEventTicker 
                                eventsPromise={eventsPromise} 
                                guildId={sidebarProps.guildId} 
                                canViewCalendar={sidebarProps.user.canViewCalendar} 
                            />
                        </Suspense>
                    ) : (
                        <EventTicker events={events} guildId={sidebarProps.guildId} canViewCalendar={sidebarProps.user.canViewCalendar} />
                    )}
                </div>
            </div>

            {/* RIGHT: Super Island (Integrated Command Center) */}
            <div className="flex items-center gap-2">
                <div className="flex items-center h-9 border border-border rounded-xl bg-muted/50 dark:bg-foreground/[0.03] backdrop-blur-xl shrink-0 overflow-hidden">
                    {/* 1. Smart Bar (Hidden on Mobile) */}
                    <div className="hidden sm:block border-r border-border">
                        <SmartBar
                            memberCount={sidebarProps.guildData?.memberCount}
                            onlineCount={sidebarProps.guildData?.activeCount}
                        />
                    </div>

                    {/* 2. Interactive Tools */}
                    <div className="flex items-center px-1">
                        {roadmapEnabled && (
                            <Link href="/roadmap" className="p-2.5 text-muted-foreground hover:text-amber-500 transition-colors" title="Roadmap">
                                <Rocket className="w-4 h-4" />
                            </Link>
                        )}

                        {sidebarProps.user.isAdmin && (
                            <Link href={`/dashboard/${sidebarProps.guildId}/admin/permissions`} className="p-2.5 text-muted-foreground hover:text-rose-500 transition-colors" title="RBAC / Permissions">
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
                                    "h-10 px-4 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 rounded-none transition-all flex items-center gap-2",
                                    isArcadeOpen && "bg-emerald-500/20"
                                )}
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-tighter hidden xl:inline">Live</span>
                                <span className="bg-emerald-500 text-emerald-950 text-[9px] font-black px-1.5 py-0.5 rounded-md">
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
                        className="h-9 px-3 flex items-center justify-center gap-2 text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all group relative mr-2 ring-1 ring-indigo-500/10 hover:ring-indigo-500/30"
                        title="Chat de Guilde"
                    >
                        <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Chat Live</span>
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse border-[2px] border-background" />
                    </button>
                )}

                {/* 4. User Profile (Standalone Dropdown) */}
                <div className="flex items-center ml-2">
                    {sidebarProps.user.canViewProfile ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-2xl hover:bg-white/[0.03] dark:hover:bg-foreground/5 transition-all group outline-none relative overflow-hidden active:scale-95"
                                >
                                    {/* Hover Highlight Layer */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                                    
                                    <div className="flex flex-col items-end leading-tight hidden lg:flex">
                                        <span className="text-[11px] font-black text-foreground/90 group-hover:text-primary transition-colors uppercase italic tracking-tighter">
                                            {sidebarProps.user.name}
                                        </span>
                                        <span className="text-[9px] uppercase tracking-tighter text-muted-foreground group-hover:text-muted-foreground/80 font-black">
                                            {sidebarProps.user.roleName || "Membre"}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Avatar className="h-9 w-9 border border-border/40 ring-0 group-hover:ring-4 group-hover:ring-primary/10 transition-all duration-300 rounded-xl shadow-xl flex-shrink-0 relative z-10">
                                            <AvatarImage src={sidebarProps.user.image || ""} />
                                            <AvatarFallback className="text-[11px] font-black bg-muted text-muted-foreground">
                                                {sidebarProps.user.name?.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {/* Pulse effect on hover */}
                                        <div className="absolute inset-0 rounded-xl bg-primary/20 scale-100 group-hover:scale-125 opacity-0 group-hover:opacity-100 blur-md transition-all duration-500" />
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                                className="w-56 bg-background/95 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl p-1.5 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200" 
                                align="end" 
                                sideOffset={10}
                            >
                                <DropdownMenuLabel className="p-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40 italic">
                                    Contrôle Utilisateur
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5 mx-1" />
                                <DropdownMenuItem asChild className="focus:bg-primary/5 focus:text-primary cursor-pointer rounded-xl m-1 py-3 px-4 transition-all duration-500 group/item relative overflow-hidden">
                                    <Link href={`/dashboard/${sidebarProps.guildId}/profile`} className="flex items-center gap-3 relative z-10 font-black">
                                        {/* Shine Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 translate-x-[-100%] group-focus/item:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                                        
                                        <div className="p-2 rounded-lg bg-muted group-focus/item:bg-primary/20 group-focus/item:scale-110 transition-all duration-300 shadow-sm group-focus/item:shadow-primary/20">
                                            <Users className="w-4 h-4 text-muted-foreground group-focus/item:text-primary transition-colors" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] uppercase tracking-[0.2em] group-focus/item:translate-x-1 transition-transform duration-300">Mon Profil</span>
                                            <span className="text-[8px] font-bold opacity-30 group-focus/item:opacity-60 transition-opacity uppercase tracking-tighter">Identité & Classe</span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem asChild className="focus:bg-primary/5 focus:text-primary cursor-pointer rounded-xl m-1 py-3 px-4 transition-all duration-500 group/item relative overflow-hidden">
                                    <Link href={`/dashboard/${sidebarProps.guildId}/profile?tab=settings`} className="flex items-center gap-3 relative z-10 font-black">
                                        {/* Shine Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 translate-x-[-100%] group-focus/item:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />

                                        <div className="p-2 rounded-lg bg-muted group-focus/item:bg-primary/20 group-focus/item:scale-110 transition-all duration-300 shadow-sm group-focus/item:shadow-primary/20">
                                            <Settings className="w-4 h-4 text-muted-foreground group-focus/item:text-primary transition-colors" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] uppercase tracking-[0.2em] group-focus/item:translate-x-1 transition-transform duration-300">Réglages</span>
                                            <span className="text-[8px] font-bold opacity-30 group-focus/item:opacity-60 transition-opacity uppercase tracking-tighter">Préférences & Notifications</span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator className="bg-white/5 mx-1" />
                                
                                <DropdownMenuItem 
                                    onClick={() => signOut()} 
                                    className="text-rose-500 focus:text-rose-400 focus:bg-rose-500/5 cursor-pointer rounded-xl m-1 py-3 px-4 transition-all duration-500 group/item relative overflow-hidden"
                                >
                                    {/* Shine Effect (Red) */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/10 to-rose-500/0 translate-x-[-100%] group-focus/item:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />

                                    <div className="p-2 rounded-lg bg-rose-500/10 group-focus/item:bg-rose-500/20 group-focus/item:scale-110 transition-all duration-300 shadow-sm relative z-10">
                                        <LogOut className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col relative z-10 font-black">
                                        <span className="text-[11px] uppercase tracking-[0.2em] group-focus/item:translate-x-1 transition-transform duration-300">Déconnexion</span>
                                        <span className="text-[8px] font-bold opacity-30 group-focus/item:opacity-60 transition-opacity uppercase tracking-tighter">Sécurisée</span>
                                    </div>
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
