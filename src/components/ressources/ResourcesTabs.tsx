"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Flame, BookOpen, Library, Tv, Link2, BookMarked } from "lucide-react";
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
    guidesSection: React.ReactNode;
}

export function ResourcesTabs({
    initialTab,
    guildId,
    isSuperAdmin,
    almanaxSection,
    newsSection,
    encyclopediaSection,
    creatorsSection,
    linksSection,
    guidesSection
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
        { value: "almanax", label: "Almanax", icon: Flame, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", tourKey: "ressources-almanax-tab" },
        { value: "news", label: "Actualités", icon: BookOpen, color: "text-info", bg: "bg-info/10", border: "border-info/20", tourKey: "ressources-news-tab" },
        { value: "encyclopedia", label: "Encyclopédie", icon: Library, color: "text-info", bg: "bg-info/10", border: "border-info/20", tourKey: null },
        { value: "creators", label: "Créateurs", icon: Tv, color: "text-danger", bg: "bg-danger/10", border: "border-danger/20", tourKey: null },
        { value: "links", label: "Liens & Outils", icon: Link2, color: "text-success", bg: "bg-success/10", border: "border-success/20", tourKey: "ressources-links-tab" },
        { value: "guides", label: "Guides", icon: BookMarked, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", tourKey: null }
    ];

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex justify-center mb-10" data-tour="ressources-tabs">
                <TabsList className="relative h-auto p-2 bg-surface/40 backdrop-blur-2xl border border-border rounded-3xl gap-2 shadow-2xl flex-wrap justify-center">
                    {TABS.map((t) => (
                        <TabsTrigger
                            key={t.value}
                            value={t.value}
                            {...(t.tourKey ? { "data-tour": t.tourKey } : {})}
                            className="relative px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 
                                     data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-surface
                                     data-[state=active]:text-foreground z-10 border border-transparent data-[state=active]:border-border overflow-hidden"
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

            <TabsContent value="guides" className="mt-6 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-200">
                {guidesSection}
            </TabsContent>
        </Tabs>
    );
}
