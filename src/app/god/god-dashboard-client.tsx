"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GalacticFooter } from "@/components/layout/galactic-footer";

interface GodDashboardClientProps {
    children: React.ReactNode;
    activeTab: string;
}

export function GodDashboardClient({
    children,
    activeTab,
}: GodDashboardClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const handleTabChange = (newTab: string) => {
        // Update URL without full refresh to maintain state on reload
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", newTab);
        router.push(`/god?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden bg-black">
            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto no-scrollbar bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/10 via-transparent to-transparent flex flex-col">
                <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700 flex-1 w-full relative z-10 min-h-[calc(100vh-80px)]">
                    {children}
                </div>
                
                {/* FOOTER */}
                <div className="mt-auto border-t border-white/5 bg-black/40 backdrop-blur-3xl pt-20">
                    <GalacticFooter />
                </div>
            </main>
        </div>
    );
}
