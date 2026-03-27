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
            <main className="flex-1 overflow-y-auto bg-black block">
                <div className="w-full max-w-[2500px] mx-auto px-6 lg:px-12 pt-10 pb-40 relative">
                    {children}
                </div>
                
                <GalacticFooter />
            </main>
        </div>
    );
}
