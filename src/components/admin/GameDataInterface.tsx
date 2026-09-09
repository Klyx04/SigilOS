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
import { GameItemSiphonPanel } from "./GameItemSiphonPanel";
import DefiManager from "./DefiManager";
import TitanManager from "./TitanManager";
import { DataHealthPanel } from "./DataHealthPanel";


export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState("etat");

    return (
        <div className="bg-surface/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-nowrap justify-start gap-2 w-full bg-elevated/50 mb-6 p-2.5 rounded-2xl h-auto overflow-x-auto custom-scrollbar">
                    <TabsTrigger value="etat" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold gap-2 shadow-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        📊 État des données
                    </TabsTrigger>
                    <TabsTrigger value="siphon" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold gap-2 shadow-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        🛡️ Siphon & Autonomie
                    </TabsTrigger>
                    <TabsTrigger value="items" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                        📦 Items & Ressources
                    </TabsTrigger>
                    <TabsTrigger value="families" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        🦎 Familles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        🗺️ Zones
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        ⚔️ Succès
                    </TabsTrigger>
                    <TabsTrigger value="dungeons" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        🏰 Donjons
                    </TabsTrigger>
                    <TabsTrigger value="defis" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        ⚡ Défis
                    </TabsTrigger>
                    <TabsTrigger value="titans" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        👑 Titans
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        📜 Quêtes
                    </TabsTrigger>
                    <TabsTrigger value="harvest" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        🌾 Récoltables & DofusDB
                    </TabsTrigger>
                    <TabsTrigger value="import-export" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        📦 Import/Export
                    </TabsTrigger>
                    <TabsTrigger value="legendary" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        ✨ Légendaires
                    </TabsTrigger>
                    <TabsTrigger value="archimonstres" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        🏹 Archis & Boss
                    </TabsTrigger>
                    <TabsTrigger value="monstres-speciaux" className="px-3.5 py-2 shrink-0 whitespace-nowrap rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        💀 Monstres Spéciaux
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="etat" className="space-y-4">
                    <DataHealthPanel onGoTab={setActiveTab} />
                </TabsContent>

                <TabsContent value="siphon" className="space-y-4">
                    <GameDataSiphonPanel />
                </TabsContent>

                <TabsContent value="items" className="space-y-4">
                    <GameItemSiphonPanel />
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

                <TabsContent value="defis" className="space-y-4">
                    <DefiManager />
                </TabsContent>

                <TabsContent value="titans" className="space-y-4">
                    <TitanManager />
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
