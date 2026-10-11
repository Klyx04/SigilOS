"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

    // Déslop 10/10/2026 — onglets plats sur tokens (fini le violet codé en dur, le
    // `motion.layoutId` à ressort et les flous) : l'onglet actif se lit par le fond
    // surélevé + la bordure, jamais par une couleur de famille.
    const TABS = [
        { value: "almanax", label: "Almanax", icon: Flame, tourKey: "ressources-almanax-tab" },
        { value: "news", label: "Actualités", icon: BookOpen, tourKey: null },
        { value: "encyclopedia", label: "Encyclopédie", icon: Library, tourKey: null },
        { value: "creators", label: "Créateurs", icon: Tv, tourKey: null },
        { value: "links", label: "Liens & Outils", icon: Link2, tourKey: "ressources-links-tab" },
        { value: "guides", label: "Guides", icon: BookMarked, tourKey: null }
    ];

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="flex justify-center mb-8" data-tour="ressources-tabs">
                <TabsList className="h-auto p-1.5 bg-surface/60 border border-border rounded-2xl gap-1 flex-wrap justify-center">
                    {TABS.map((t) => (
                        <TabsTrigger
                            key={t.value}
                            value={t.value}
                            {...(t.tourKey ? { "data-tour": t.tourKey } : {})}
                            className="relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors
                                     data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-elevated
                                     data-[state=active]:text-foreground data-[state=active]:bg-elevated data-[state=active]:border data-[state=active]:border-border-strong"
                        >
                            <span className="flex items-center gap-2">
                                <t.icon className="w-4 h-4" />
                                <span>{t.label}</span>
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>

            <TabsContent value="almanax" className="mt-6 border-none p-0 outline-none">
                {almanaxSection}
            </TabsContent>

            <TabsContent value="news" className="mt-6 border-none p-0 outline-none">
                {newsSection}
            </TabsContent>

            <TabsContent value="encyclopedia" className="mt-6 border-none p-0 outline-none">
                {encyclopediaSection}
            </TabsContent>

            <TabsContent value="creators" className="mt-6 border-none p-0 outline-none">
                {creatorsSection}
            </TabsContent>

            <TabsContent value="links" className="mt-6 border-none p-0 outline-none">
                {linksSection}
            </TabsContent>

            <TabsContent value="guides" className="mt-6 border-none p-0 outline-none">
                {guidesSection}
            </TabsContent>
        </Tabs>
    );
}
