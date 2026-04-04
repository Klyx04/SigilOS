"use client";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { GodSidebar } from "./god-sidebar";
import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function MobileGodSidebarSheet({ user, unreadCount }: { user: any, unreadCount: number }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Close the sliding navigation drawer automatically whenever a link is clicked
    useEffect(() => {
        setOpen(false);
    }, [pathname, searchParams]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button className="flex p-2.5 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors">
                    <Menu className="w-5 h-5" />
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r border-white/10 bg-[#050505] w-[280px]">
                <SheetTitle className="sr-only">Menu de Navigation Modérateur</SheetTitle>
                {/* 
                  Passing the required props to the child sidebar component.
                  We force it to display fully inside the sheet with flex and w-full.
                */}
                <GodSidebar user={user} unreadCount={unreadCount} className="w-full h-full flex" />
            </SheetContent>
        </Sheet>
    );
}
