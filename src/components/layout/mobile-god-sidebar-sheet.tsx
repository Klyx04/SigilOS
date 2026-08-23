"use client";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { GodSidebar } from "./god-sidebar";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function MobileGodSidebarSheet({ user, unreadCount, ticketCount = 0, activeScopes = [], accessibleBricks = [], godRoute = "/god" }: { user: any, unreadCount: number, ticketCount?: number, activeScopes?: string[], accessibleBricks?: string[], godRoute?: string }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Close the sliding navigation drawer automatically whenever a link is clicked
    // ⚠️ #108 : ne dépendre QUE de pathname (pas de searchParams) — `useSearchParams()`
    // peut renvoyer une nouvelle référence à chaque render, ce qui re-déclenchait
    // l'effet en boucle → erreur React #441 "too many re-renders" côté sous-god.
    useEffect(() => {
        setOpen((prev) => (prev ? false : prev));
    }, [pathname]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button className="flex p-2.5 items-center justify-center rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors">
                    <Menu className="w-5 h-5" />
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r border-border bg-[#050505] w-[280px]">
                <SheetTitle className="sr-only">Menu de Navigation Modérateur</SheetTitle>
                {/* 
                  Passing the required props to the child sidebar component.
                  We force it to display fully inside the sheet with flex and w-full.
                */}
                <GodSidebar user={user} unreadCount={unreadCount} ticketCount={ticketCount} activeScopes={activeScopes} accessibleBricks={accessibleBricks} godRoute={godRoute} className="w-full h-full flex" />
            </SheetContent>
        </Sheet>
    );
}
