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
import ArchimonstreManager from "./ArchimonstreManager";
import { GameDataMonsterManager } from "./GameDataMonsterManager";
import { Sparkles, ChevronRight, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState("families");

    return (
        <div className="bg-surface/50 backdrop-blur-sm rounded-lg border border-border/50 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap justify-start gap-1 w-full bg-elevated/50 mb-6 p-2 rounded-xl h-auto">
                    <TabsTrigger value="families" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        🦎 Familles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        🗺️ Zones
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        ⚔️ Succès
                    </TabsTrigger>
                    <TabsTrigger value="dungeons" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        🏰 Donjons
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        📜 Quêtes
                    </TabsTrigger>
                    <TabsTrigger value="import-export" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        📦 Import/Export
                    </TabsTrigger>
                    <TabsTrigger value="legendary" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        ✨ Légendaires
                    </TabsTrigger>
                    <TabsTrigger value="archimonstres" className="data-[state=active]:bg-warning flex-1 min-w-[100px]">
                        🏹 Archimonstres
                    </TabsTrigger>
                    <TabsTrigger value="monstres-speciaux" className="data-[state=active]:bg-info flex-1 min-w-[100px]">
                        💀 Monstres Spéciaux
                    </TabsTrigger>
                </TabsList>

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
                    <QuestSyncPanel />
                    <GameQuestManager />
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
