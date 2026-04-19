import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { Database, Sparkles, Tag } from "lucide-react";
import { WorkflowExplanation } from "@/components/admin/dofus-quest-editor/WorkflowExplanation";
import { DofusQuestGodClient } from "@/components/admin/dofus-quest-editor/DofusQuestGodClient";
import DofusQuestGodManager from "@/components/admin/DofusQuestGodManager";
import { DofusTagManager } from "@/components/admin/DofusTagManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = {
    title: "GOD | Quêtes Dofus — Gestionnaire de Données",
    description: "Interface super-admin pour gérer les chaînes de quêtes de chaque Dofus",
};

export default async function QuestsDofusGodPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    // Load all Dofus items with their chain/entry counts
    const dofusItems = await db.dofusItem.findMany({
        include: {
            questChains: {
                include: {
                    entries: {
                        select: {
                            id: true,
                            name: true,
                            dofusdbId: true,
                            level: true,
                            isDungeon: true,
                            zone: true,
                            npcSubArea: true,
                            coords: true,
                            itemsRequired: true,
                            dungeonsRequired: true,
                            objectives: true,
                            stepOrder: true,
                            questType: true,
                            isOptional: true,
                            requirements: true,
                            localImageUrl: true,
                            coordinatesV3: true,
                        },
                        orderBy: { stepOrder: "asc" },
                    },
                },
                orderBy: { chainOrder: "asc" },
            },
        },
        orderBy: { slug: "asc" },
    });

    // Build stats
    const stats = dofusItems.map((d: any) => {
        const chains = d.questChains;
        const entries = chains.flatMap((c: any) => c.entries);
        const withCoords = entries.filter((e: any) => e.coords != null).length;
        const withItems = entries.filter((e: any) => {
            const items = e.itemsRequired as any;
            return Array.isArray(items) && items.length > 0;
        }).length;
        const dungeons = entries.filter((e: any) => e.isDungeon).length;
        const levels = entries.map((e: any) => e.level).filter((l: any): l is number => l != null);

        return {
            id: d.id,
            slug: d.slug,
            name: d.name,
            imageUrl: d.imageUrl,
            color: d.color,
            filterCategory: d.filterCategory,
            filterSubCategory: d.filterSubCategory,
            chainCount: chains.length,
            questCount: entries.length,
            withCoords,
            withItems,
            dungeons,
            minLevel: levels.length ? Math.min(...levels) : null,
            maxLevel: levels.length ? Math.max(...levels) : null,
            chains: chains.map((c: any) => ({
                id: c.id,
                sectionName: c.sectionName,
                chainOrder: c.chainOrder,
                coordinatesV3: c.coordinatesV3,
                entries: c.entries,
            })),
        };
    });

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-400 uppercase tracking-widest">
                        <Database className="w-4 h-4" />
                        <span>Base de Quêtes</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        Quêtes Dofus <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-purple-400 to-purple-600">
                            Gestionnaire de Données
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Inspectez, éditez et compilez les chaînes de quêtes pour tous les Dofus.
                        Données enrichies depuis DofusDB, prêtes à consommer.
                    </p>
                </div>

                {/* Global stats */}
                <div className="flex gap-4">
                    {[
                        { label: "Dofus", value: stats.length, color: "text-purple-400" },
                        { label: "Succès", value: stats.reduce((a, s) => a + s.chainCount, 0), color: "text-indigo-400" },
                        { label: "Quêtes", value: stats.reduce((a, s) => a + s.questCount, 0), color: "text-sky-400" },
                        { label: "Coords", value: stats.reduce((a, s) => a + s.withCoords, 0), color: "text-emerald-400" },
                    ].map(s => (
                        <div key={s.label} className="text-center">
                            <div className={`text-2xl font-black ${s.color} tabular-nums`}>{s.value}</div>
                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <WorkflowExplanation />

            <Tabs defaultValue="curation" className="w-full">
                <TabsList className="flex flex-wrap gap-2 w-full bg-transparent mb-8">
                    <TabsTrigger value="curation" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white bg-zinc-900/50 text-zinc-400 border border-white/5 rounded-xl px-6 py-3 font-black uppercase text-xs tracking-widest transition-all shadow-md">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Curation Engine (Compilation)
                    </TabsTrigger>
                    <TabsTrigger value="builder" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white bg-zinc-900/50 text-zinc-400 border border-white/5 rounded-xl px-6 py-3 font-black uppercase text-xs tracking-widest transition-all shadow-md">
                        <Database className="w-4 h-4 mr-2" />
                        Quest Builder (Structure Manuelle)
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white bg-zinc-900/50 text-zinc-400 border border-white/5 rounded-xl px-6 py-3 font-black uppercase text-xs tracking-widest transition-all shadow-md">
                        <Tag className="w-4 h-4 mr-2" />
                        Tags Dofus
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="curation" className="space-y-6">
                    <DofusQuestGodClient dofusItems={stats} />
                </TabsContent>
                
                <TabsContent value="builder" className="space-y-6 animate-in fade-in duration-500">
                    <DofusQuestGodManager />
                </TabsContent>

                <TabsContent value="tags" className="space-y-6 animate-in fade-in duration-500">
                    <div className="space-y-3">
                        <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                            Définissez les attributs de chaque Dofus : <strong className="text-white/70">Primordial</strong>, <strong className="text-white/70">Prérequis Sylvestre</strong>, <strong className="text-white/70">Méta</strong> et ordre d'affichage.
                            Ces tags pilotent directement l'interface utilisateur et les filtres côté membres.
                        </p>
                        <DofusTagManager />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
