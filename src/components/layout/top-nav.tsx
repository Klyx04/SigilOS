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
    Search as SearchIcon
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
import { GamesLiveWidget } from "@/components/shared/GamesLiveWidget";
import { useState } from "react";

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
    roadmapEnabled?: boolean;
}

export function TopNav({ sidebarProps, userId, events = [], roadmapEnabled = false }: TopNavProps) {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    // segments: ["dashboard", "guildId", "module", "subpage", ...]
    const breadcrumbSegments = segments.slice(2);

    const [isArcadeOpen, setIsArcadeOpen] = useState(false);
    const [roomCount, setRoomCount] = useState(0);

    return (
        <header className="sticky top-0 z-40 bg-[#060606]/80 backdrop-blur-2xl border-b border-white/5 h-14 px-4 lg:px-6 flex items-center justify-between gap-4 transition-all duration-300">

            {/* LEFT: Mobile Trigger & Breadcrumbs */}
            <div className="flex items-center gap-6 shrink-0">

                {/* Mobile Sidebar Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden -ml-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[260px] border-r border-white/5 bg-[#050505]">
                        <SheetTitle className="sr-only">Menu de Navigation Mobile</SheetTitle>
                        <SheetDescription className="sr-only">Accédez aux différents modules et outils de votre guilde.</SheetDescription>
                        <AppSidebar {...sidebarProps} />
                    </SheetContent>
                </Sheet>

                {/* Breadcrumbs */}
                <nav className="hidden sm:flex items-center text-[11px] font-bold tracking-tight text-white/50">
                    <Link href={`/dashboard/${sidebarProps.guildId}`} className="hover:text-emerald-400 transition-all flex items-center gap-1.5 group">
                        <Home className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">Dashboard</span>
                    </Link>

                    {breadcrumbSegments.length > 0 && <ChevronRight className="h-3 w-3 mx-2 text-zinc-800" />}

                    {breadcrumbSegments.map((segment, index) => {
                        const href = `/dashboard/${sidebarProps.guildId}/${breadcrumbSegments.slice(0, index + 1).join("/")}`;
                        const isLast = index === breadcrumbSegments.length - 1;

                        return (
                            <div key={href} className="flex items-center">
                                 <Link
                                    href={href}
                                    className={cn(
                                        "transition-all truncate max-w-[100px] lg:max-w-[180px] hover:text-white",
                                        isLast ? "text-white font-black uppercase tracking-[0.2em] text-[10px]" : "text-white/40"
                                    )}
                                >
                                    {formatSegment(segment)}
                                </Link>
                                {!isLast && <ChevronRight className="h-3 w-3 mx-1.5 text-white/10" />}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* CENTER: Integrated Ticker & Search (2026 Standard) */}
            <div className="flex-1 flex items-center justify-center gap-4 px-2 min-w-0">
                {/* Search Trigger (Hidden on small mobile, shows kbd on desktop) */}
                <div className="hidden xl:flex flex-1 max-w-[240px] relative group">
                    <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                    <input 
                        type="text"
                        placeholder="Rechercher..."
                        onFocus={() => {
                            document.dispatchEvent(new CustomEvent('open-command-menu'));
                            // Blur the input mostly so if they close the modal, they can refocus the input directly
                            setTimeout(() => {
                                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                            }, 50);
                        }}
                        className="w-full pl-9 pr-12 h-9 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/10 focus:bg-white/[0.05] focus:border-indigo-500/50 transition-all text-xs text-zinc-300 placeholder:text-zinc-500 outline-none cursor-text"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <kbd className="px-1 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-black font-mono">⌘</kbd>
                        <kbd className="px-1 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-black font-mono">K</kbd>
                    </div>
                </div>

                {/* Event Ticker (Primary visibility) */}
                <div className="flex-1 max-w-xl flex justify-center">
                    <EventTicker events={events} guildId={sidebarProps.guildId} canViewCalendar={sidebarProps.user.canViewCalendar} />
                </div>
            </div>

            {/* RIGHT: Super Island (Integrated Command Center) */}
            <div className="flex items-center gap-2">
                <div className="flex items-center h-9 border border-white/5 rounded-xl bg-white/[0.03] backdrop-blur-xl shrink-0 overflow-hidden">
                    {/* 1. Smart Bar */}
                    <div className="border-r border-white/5">
                        <SmartBar
                            memberCount={sidebarProps.guildData?.memberCount}
                            onlineCount={sidebarProps.guildData?.activeCount}
                        />
                    </div>

                    {/* 2. Interactive Tools */}
                    <div className="flex items-center px-1">
                        {roadmapEnabled && (
                            <Link href="/roadmap" className="p-2.5 text-zinc-500 hover:text-amber-400 transition-colors" title="Roadmap">
                                <Rocket className="w-4 h-4" />
                            </Link>
                        )}
                        <Link href="/changelog" className="p-2.5 text-zinc-500 hover:text-white transition-colors" title="Changelog">
                            <ScrollText className="w-4 h-4" />
                        </Link>
                        {sidebarProps.user.isAdmin && (
                            <Link href={`/dashboard/${sidebarProps.guildId}/admin/permissions`} className="p-2.5 text-zinc-500 hover:text-rose-400 transition-colors" title="RBAC / Permissions">
                                <Shield className="w-4 h-4" />
                            </Link>
                        )}
                        <div className="w-px h-4 bg-white/5 mx-1" />
                        <FeedBell
                            guildId={sidebarProps.guildId}
                            className="h-9 w-9 bg-transparent hover:bg-white/5 text-zinc-500 hover:text-white rounded-xl transition-all"
                        />
                        <NotificationBell
                            userId={userId}
                            guildId={sidebarProps.guildId}
                            className="h-9 w-9 bg-transparent hover:bg-white/5 text-zinc-500 hover:text-white rounded-xl transition-all"
                        />
                    </div>

                    {/* 3. Arcade (Live Games) */}
                    {roomCount > 0 && (
                        <div className="border-l border-white/5 flex items-center">
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

                {/* 4. User Profile (Standalone) */}
                <div className="flex items-center ml-2">
                    {sidebarProps.user.canViewProfile ? (
                        <Link
                            href={`/dashboard/${sidebarProps.guildId}/profile`}
                            className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-2xl hover:bg-white/5 transition-all group"
                        >
                            <div className="flex flex-col items-end leading-tight hidden lg:flex">
                                <span className="text-[11px] font-black text-white/90 group-hover:text-white transition-colors">
                                    {sidebarProps.user.name}
                                </span>
                                <span className="text-[9px] uppercase tracking-tighter text-zinc-500 font-bold">
                                    {sidebarProps.user.roleName || "Membre"}
                                </span>
                            </div>
                            <Avatar className="h-9 w-9 border border-white/10 ring-4 ring-transparent group-hover:ring-emerald-500/10 transition-all rounded-xl shadow-xl flex-shrink-0">
                                <AvatarImage src={sidebarProps.user.image || ""} />
                                <AvatarFallback className="text-[10px] bg-zinc-900 text-zinc-500 font-bold">
                                    {sidebarProps.user.name?.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </Link>
                    ) : (
                        <div className="h-9 w-9 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center opacity-40">
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
