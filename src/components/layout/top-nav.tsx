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
import { getDocForRoute } from "@/config/docs-mapping";
import { CircleHelp } from "lucide-react";

// Helper to format breadcrumbs
const formatSegment = (segment: string) => {
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
    const segments = pathname.split("/").filter(Boolean).slice(1);
    const relevantSegments = segments.slice(1);

    return (
        <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 h-20 px-4 md:px-6 flex items-center justify-between gap-4">

            {/* LEFT: Mobile Trigger & Breadcrumbs */}
            <div className="flex items-center gap-4 shrink-0">

                {/* Mobile Sidebar Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden -ml-2 text-zinc-400 hover:text-white">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[280px] border-r border-white/10 bg-zinc-950">
                        <AppSidebar {...sidebarProps} />
                    </SheetContent>
                </Sheet>

                {/* Breadcrumbs */}
                <nav className="hidden sm:flex items-center text-sm font-medium text-zinc-500">
                    <Link href={`/dashboard/${sidebarProps.guildId}`} className="hover:text-zinc-300 transition-colors flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        {/* <span className="sr-only">Dashboard</span> */}
                    </Link>

                    {relevantSegments.slice(1).map((segment, index) => {
                        const href = `/dashboard/${sidebarProps.guildId}/${relevantSegments.slice(1, index + 1).join("/")}`;
                        const isLast = index === relevantSegments.slice(1).length - 1;

                        return (
                            <div key={href} className="flex items-center">
                                <ChevronRight className="w-4 h-4 mx-1 text-zinc-700" />
                                <Link
                                    href={href}
                                    className={cn(
                                        "transition-colors truncate max-w-[80px] lg:max-w-[150px]",
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
                    <EventTicker events={events} guildId={sidebarProps.guildId} />
                </div>
            </div>

            {/* RIGHT: Status Bar & Account */}
            <div className="flex items-center justify-end gap-3 shrink-0">

                {/* CommandMenu removed as per user request */}
                {/* <CommandMenu /> */}

                {/* Smart Bar (Time/Members/Almanax) */}
                <div className="scale-90 origin-right">
                    <SmartBar
                        almanax={children}
                        memberCount={sidebarProps.guildData?.memberCount}
                        onlineCount={sidebarProps.guildData?.activeCount}
                    />
                </div>

                {/* Context-Aware Help */}
                {/* Context-Aware Help */}
                <Link
                    href={`/docs/${getDocForRoute(pathname)}`}
                    target="_blank"
                    className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:text-white hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all group overflow-hidden"
                    title="Documentation Utilisateur"
                >
                    <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                    <CircleHelp className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 animate-pulse" />
                    <span className="text-xs font-medium hidden lg:inline-block">Docs</span>
                </Link>

                {/* Notification Bell (Bigger & More Visible) */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
                    <NotificationBell
                        userId={userId}
                        guildId={sidebarProps.guildId}
                        className="h-10 w-10 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-zinc-300 hover:text-white rounded-full transition-all duration-300"
                    />
                </div>

            </div>
        </header>
    );
}
