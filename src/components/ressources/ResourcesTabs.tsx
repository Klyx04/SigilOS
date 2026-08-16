"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Flame, BookOpen, Library, Tv, Link2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ResourcesTabsProps {
    initialTab: string;
    guildId: string;
    isSuperAdmin: boolean;
    almanaxSection: React.ReactNode;
    newsSection: React.ReactNode;
    encyclopediaSection: React.ReactNode;
    creatorsSection: React.ReactNode;
    linksSection: React.ReactNode;
}

export function ResourcesTabs({
    initialTab,
    guildId,
    isSuperAdmin,
    almanaxSection,
    newsSection,
    encyclopediaSection,
    creatorsSection,
    linksSection
}: ResourcesTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState(initialTab);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        // Optional: Update URL without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", value);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const TABS = [
        { value: "almanax", label: "Almanax", icon: Flame, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", tourKey: "ressources-almanax-tab" },
        { value: "news", label: "Actualités", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", tourKey: "ressources-news-tab" },
        { value: "encyclopedia", label: "Encyclopédie", icon: Library, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", tourKey: null },
        { value: "creators", label: "Créateurs", icon: Tv, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", tourKey: null },
        { value: "links", label: "Liens & Outils", icon: Link2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", tourKey: "ressources-links-tab" }
    ];

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex justify-center mb-10" data-tour="ressources-tabs">
                <TabsList className="relative h-auto p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl gap-2 shadow-2xl flex-wrap justify-center">
                    {TABS.map((t) => (
                        <TabsTrigger
                            key={t.value}
                            value={t.value}
                            {...(t.tourKey ? { "data-tour": t.tourKey } : {})}
                            className="relative px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 
                                     data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:text-zinc-300 data-[state=inactive]:hover:bg-white/5
                                     data-[state=active]:text-white z-10 border border-transparent data-[state=active]:border-white/10 overflow-hidden"
                        >
                            <div className="flex items-center gap-3 relative z-20">
                                <t.icon className={cn("w-4 h-4 transition-transform duration-300 group-data-[state=active]:scale-110", t.color)} />
                                <span>{t.label}</span>
                            </div>
                            {activeTab === t.value && (
                                <motion.div
                                    layoutId="activeTab"
                                    className={cn("absolute inset-0 z-0", t.bg, "opacity-100 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]")}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            {/* Active indicator dot */}
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-0 data-[state=active]:opacity-100 transition-opacity" />
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>

            <TabsContent value="almanax" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {almanaxSection}
            </TabsContent>

            <TabsContent value="news" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {newsSection}
            </TabsContent>

            <TabsContent value="encyclopedia" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {encyclopediaSection}
            </TabsContent>

            <TabsContent value="creators" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {creatorsSection}
            </TabsContent>

            <TabsContent value="links" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {linksSection}
            </TabsContent>
        </Tabs>
    );
}
