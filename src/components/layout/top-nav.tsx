"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
    ChevronRight,
    Menu,
    Home
} from "lucide-react";
import { SmartBar } from "./smart-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { EventTicker } from "@/components/layout/event-ticker";
import { UpcomingEvent } from "@/server/actions/event-actions";
import { CommandMenu } from "@/components/layout/command-menu";
import { CircleHelp } from "lucide-react";

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
    children?: React.ReactNode; // For Almanax Widget or other actions
    userId: string;
    events?: UpcomingEvent[];
}

export function TopNav({ sidebarProps, children, userId, events = [] }: TopNavProps) {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    // segments: ["dashboard", "guildId", "module", "subpage", ...]
    const breadcrumbSegments = segments.slice(2);

    return (
        <header className="sticky top-0 z-40 bg-zinc-950/60 backdrop-blur-[32px] backdrop-saturate-[180%] border-b border-white/[0.08] h-16 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">

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

            {/* CENTER: Event Ticker */}
            <div className="flex-1 flex justify-center px-2 min-w-0 overflow-hidden">
                <div className="w-full max-w-2xl flex justify-center">
                    <EventTicker events={events} guildId={sidebarProps.guildId} canViewCalendar={sidebarProps.user.canViewCalendar} />
                </div>
            </div>

            {/* RIGHT: Super Island (Integrated Command Center) */}
            <div className="flex items-center border border-white/10 rounded-xl bg-zinc-950/20 backdrop-blur-md relative overflow-hidden group/island shrink-0 shadow-lg">
                {/* 1. Smart Bar (Time/Members/Almanax) */}
                <div className="relative z-10 border-r border-white/10 px-1">
                    <SmartBar
                        almanax={children}
                        memberCount={sidebarProps.guildData?.memberCount}
                        onlineCount={sidebarProps.guildData?.activeCount}
                    />
                </div>

                {/* 2. Context-Aware Help (Docs) */}
                <div className="relative z-10 border-r border-white/10">
                    <Link
                        href="/docs"
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.05] transition-all group/docs active:scale-95"
                        title="Documentation Utilisateur"
                    >
                        <CircleHelp className="w-4 h-4 text-zinc-400 group-hover/docs:text-indigo-400 transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline-block text-zinc-300">Docs</span>
                    </Link>
                </div>

                {/* 3. Notification Bell */}
                <div className="relative z-10 border-r border-white/10">
                    <NotificationBell
                        userId={userId}
                        guildId={sidebarProps.guildId}
                        className="h-10 w-10 bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-white rounded-none transition-all duration-300"
                    />
                </div>

                {/* 4. User Profile (High Visibility) */}
                <div className="relative z-10">
                    {sidebarProps.user.canViewProfile ? (
                        <Link
                            href={`/dashboard/${sidebarProps.guildId}/profile`}
                            className="flex items-center gap-3 pr-5 pl-3 py-1.5 hover:bg-white/[0.05] transition-all group/profile active:scale-95"
                        >
                            <div className="relative">
                                <Avatar className="h-8 w-8 border border-white/10 group-hover/profile:border-indigo-500/50 transition-all duration-300">
                                    <AvatarImage src={sidebarProps.user.image} />
                                    <AvatarFallback className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">
                                        {sidebarProps.user.name?.slice(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#09090b] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </div>
                            <div className="flex flex-col items-start leading-none hidden xl:flex">
                                <span className="text-[12px] font-black text-zinc-200 group-hover/profile:text-white transition-colors tracking-tight">
                                    {sidebarProps.user.name}
                                </span>
                            </div>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-3 pr-5 pl-3 py-1.5">
                            <div className="relative">
                                <Avatar className="h-8 w-8 border border-white/10 opacity-80">
                                    <AvatarImage src={sidebarProps.user.image} />
                                    <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400 font-bold">
                                        {sidebarProps.user.name?.slice(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-700 border-2 border-[#09090b] rounded-full" />
                            </div>
                            <div className="flex flex-col items-start leading-none hidden xl:flex">
                                <span className="text-[12px] font-black text-zinc-500 tracking-tight">
                                    {sidebarProps.user.name}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header >
    );
}
