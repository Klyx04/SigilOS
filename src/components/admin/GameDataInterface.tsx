"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MonsterFamilyManager from "./MonsterFamilyManager";
import ChallengeManager from "./ChallengeManager";
import DungeonManager from "./DungeonManager";
import ZoneManager from "./ZoneManager";
import DataExportImport from "./DataExportImport";
import LegendaryManager from "./LegendaryManager";
import GameQuestManager from "./GameQuestManager";
import QuestSyncPanel from "./QuestSyncPanel";
import { QuestSiphonPanel } from "./QuestSiphonPanel";
import ArchimonstreManager from "./ArchimonstreManager";
import { GameDataMonsterManager } from "./GameDataMonsterManager";
import { DofusDbHarvestSyncManager } from "./DofusDbHarvestSyncManager";
import { GameDataSiphonPanel } from "./GameDataSiphonPanel";
import { Sparkles, ChevronRight, Database, Pickaxe, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState("siphon");

    return (
        <div className="bg-surface/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-nowrap justify-start gap-1 w-full bg-elevated/50 mb-6 p-2 rounded-2xl h-auto overflow-x-auto custom-scrollbar">
                    <TabsTrigger value="siphon" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white shrink-0 whitespace-nowrap rounded-xl font-black gap-2 shadow-sm">
                        🛡️ Siphon & Autonomie
                    </TabsTrigger>
                    <TabsTrigger value="families" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        🦎 Familles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        🗺️ Zones
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        ⚔️ Succès
                    </TabsTrigger>
                    <TabsTrigger value="dungeons" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        🏰 Donjons
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        📜 Quêtes
                    </TabsTrigger>
                    <TabsTrigger value="harvest" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white shrink-0 whitespace-nowrap rounded-xl font-bold">
                        🌾 Récoltables & DofusDB
                    </TabsTrigger>
                    <TabsTrigger value="import-export" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        📦 Import/Export
                    </TabsTrigger>
                    <TabsTrigger value="legendary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        ✨ Légendaires
                    </TabsTrigger>
                    <TabsTrigger value="archimonstres" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white shrink-0 whitespace-nowrap rounded-xl font-bold">
                        🏹 Archis & Boss
                    </TabsTrigger>
                    <TabsTrigger value="monstres-speciaux" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 whitespace-nowrap rounded-xl font-bold">
                        💀 Monstres Spéciaux
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="siphon" className="space-y-4">
                    <GameDataSiphonPanel />
                </TabsContent>

                <TabsContent value="families" className="space-y-4">
                    <MonsterFamilyManager />
                </TabsContent>

                <TabsContent value="zones" className="space-y-4">
                    <ZoneManager />
                </TabsContent>

                <TabsContent value="challenges" className="space-y-4">
                    <ChallengeManager />
                </TabsContent>

                <TabsContent value="dungeons" className="space-y-4">
                    <DungeonManager />
                </TabsContent>

                <TabsContent value="quests" className="space-y-6">
                    <QuestSiphonPanel />
                    <QuestSyncPanel />
                    <GameQuestManager />
                </TabsContent>

                <TabsContent value="harvest" className="space-y-4">
                    <DofusDbHarvestSyncManager />
                </TabsContent>

                <TabsContent value="import-export" className="space-y-4">
                    <DataExportImport />
                </TabsContent>

                <TabsContent value="legendary" className="space-y-4">
                    <LegendaryManager />
                </TabsContent>

                <TabsContent value="archimonstres" className="space-y-4">
                    <ArchimonstreManager />
                </TabsContent>

                <TabsContent value="monstres-speciaux" className="space-y-4">
                    <GameDataMonsterManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
