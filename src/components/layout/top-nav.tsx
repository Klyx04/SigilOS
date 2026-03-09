"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
    ChevronRight,
    Menu,
    Home,
    ScrollText
} from "lucide-react";
import { SmartBar } from "./smart-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { FeedBell } from "@/components/notifications/feed-bell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { EventTicker } from "@/components/layout/event-ticker";
import { UpcomingEvent } from "@/server/actions/event-actions";
import { CommandMenu } from "@/components/layout/command-menu";
import { CircleHelp } from "lucide-react";
import { LiveStreamBadge } from "@/components/notifications/live-stream-badge";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
}

export function TopNav({ sidebarProps, userId, events = [] }: TopNavProps) {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    // segments: ["dashboard", "guildId", "module", "subpage", ...]
    const breadcrumbSegments = segments.slice(2);

    return (
        <header className="sticky top-0 z-40 bg-zinc-950/60 backdrop-blur-[32px] backdrop-saturate-[180%] border-b border-white/[0.08] h-[72px] px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">

            {/* LEFT: Mobile Trigger & Breadcrumbs */}
            <div className="flex items-center gap-4 shrink-0">

                {/* Mobile Sidebar Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-zinc-300 hover:text-white">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[280px] border-r border-white/10 bg-zinc-950">
                        <AppSidebar {...sidebarProps} />
                    </SheetContent>
                </Sheet>

                {/* Breadcrumbs */}
                <nav className="hidden sm:flex items-center text-sm font-black text-zinc-300">
                    <Link href={`/dashboard/${sidebarProps.guildId}`} className="hover:text-white transition-all hover:scale-110 active:scale-95 flex items-center gap-1">
                        <Home className="w-4 h-4" />
                    </Link>

                    {breadcrumbSegments.map((segment, index) => {
                        const href = `/dashboard/${sidebarProps.guildId}/${breadcrumbSegments.slice(0, index + 1).join("/")}`;
                        const isLast = index === breadcrumbSegments.length - 1;

                        return (
                            <div key={href} className="flex items-center">
                                <ChevronRight className="h-4 w-4 mx-1 text-zinc-600" />
                                <Link
                                    href={href}
                                    className={cn(
                                        "transition-colors truncate max-w-[120px] lg:max-w-[200px]",
                                        isLast ? "text-zinc-100 font-semibold" : "hover:text-zinc-300"
                                    )}
                                >
                                    {formatSegment(segment)}
                                </Link>
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* CENTER: Event Ticker & Live Badge */}
            <div className="flex-1 flex justify-center items-center gap-4 px-2 min-w-0 overflow-hidden">
                <div className="flex-1 max-w-2xl flex justify-center">
                    <EventTicker events={events} guildId={sidebarProps.guildId} canViewCalendar={sidebarProps.user.canViewCalendar} />
                </div>

                {/* LIVE Badge (Conditional) */}
                <div className="hidden lg:block shrink-0">
                    <LiveStreamBadge guildId={sidebarProps.guildId} />
                </div>
            </div>

            {/* RIGHT: Super Island (Integrated Command Center) */}
            <div className="flex items-center border border-white/10 rounded-xl bg-zinc-950/20 backdrop-blur-md relative group/island shrink-0 shadow-lg">
                {/* 1. Smart Bar (Time/Members/Almanax) */}
                <div className="relative z-10 border-r border-white/10 px-1">
                    <SmartBar
                        memberCount={sidebarProps.guildData?.memberCount}
                        onlineCount={sidebarProps.guildData?.activeCount}
                    />
                </div>

                {/* 1.5. Changelog */}
                <div className="relative z-10 border-r border-white/10 flex">
                    <Link
                        href="/changelog"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.05] transition-all group/changelog active:scale-95"
                        title="Changelog SigilOS"
                    >
                        <ScrollText className="w-4 h-4 text-zinc-400 group-hover/changelog:text-amber-400 transition-colors" />
                    </Link>
                </div>

                {/* 3. Feed Bell (Creator News) */}
                <div className="relative z-10 border-r border-white/10">
                    <FeedBell
                        guildId={sidebarProps.guildId}
                        className="h-10 w-10 bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-white rounded-none transition-all duration-300"
                    />
                </div>

                {/* 4. User Profile & System Notifications */}
                <div className="relative z-10 flex border-l border-white/5 bg-zinc-950/20 items-center">
                    {sidebarProps.user.canViewProfile ? (
                        <Link
                            href={`/dashboard/${sidebarProps.guildId}/profile`}
                            className="flex items-center gap-3 pr-5 pl-4 py-2 hover:bg-white/[0.05] transition-all group/profile"
                        >
                            <div className="flex flex-col items-end leading-none hidden xl:flex">
                                <span className="text-[12px] font-black text-zinc-300 group-hover/profile:text-white transition-colors tracking-tight">
                                    {sidebarProps.user.name}
                                </span>
                                <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                                    {sidebarProps.user.roleName || "Membre"}
                                </span>
                            </div>
                            <div className="relative group-hover/profile:scale-105 transition-transform duration-300">
                                <Avatar className="h-10 w-10 border border-white/10 ring-2 ring-transparent group-hover/profile:ring-emerald-500/30 transition-all shadow-xl">
                                    <AvatarImage src={sidebarProps.user.image || ""} />
                                    <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400 font-bold">
                                        {sidebarProps.user.name?.slice(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Notification Bell integrated into the Avatar corner */}
                                <div className="absolute -top-1 -right-1 z-30 scale-[0.85] origin-top-right translate-x-1/3 -translate-y-1/3">
                                    <NotificationBell
                                        userId={userId}
                                        guildId={sidebarProps.guildId}
                                        className="h-10 w-10 bg-zinc-900 border-2 border-white/20 text-white rounded-full hover:bg-zinc-800 transition-all shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:scale-110 active:scale-95"
                                    />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </div>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-3 pr-5 pl-4 py-1.5 opacity-50 cursor-not-allowed">
                            <div className="flex flex-col items-end leading-none hidden xl:flex">
                                <span className="text-[12px] font-black text-zinc-500 tracking-tight">
                                    {sidebarProps.user.name}
                                </span>
                                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">
                                    {sidebarProps.user.roleName || "Membre"}
                                </span>
                            </div>
                            <div className="relative">
                                <Avatar className="h-9 w-9 border border-white/10 opacity-80">
                                    <AvatarImage src={sidebarProps.user.image || ""} />
                                    <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400 font-bold">
                                        {sidebarProps.user.name?.slice(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-zinc-700 rounded-full border-2 border-[#09090b]" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
