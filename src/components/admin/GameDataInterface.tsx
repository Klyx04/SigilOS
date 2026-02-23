"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MonsterFamilyManager from "./MonsterFamilyManager";
import ChallengeManager from "./ChallengeManager";
import DungeonManager from "./DungeonManager";
import ZoneManager from "./ZoneManager";
import DataExportImport from "./DataExportImport";
import DreamBonusManager from "./DreamBonusManager";
import GameQuestManager from "./GameQuestManager";

export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState("families");

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-7 bg-slate-800/50 mb-6">
                    <TabsTrigger value="families" className="data-[state=active]:bg-indigo-600">
                        🦎 Familles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="data-[state=active]:bg-indigo-600">
                        🗺️ Zones
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="data-[state=active]:bg-indigo-600">
                        ⚔️ Challenges
                    </TabsTrigger>
                    <TabsTrigger value="dungeons" className="data-[state=active]:bg-indigo-600">
                        🏰 Donjons
                    </TabsTrigger>
                    <TabsTrigger value="songes" className="data-[state=active]:bg-purple-600">
                        🌙 Songes
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="data-[state=active]:bg-cyan-600">
                        📜 Quêtes
                    </TabsTrigger>
                    <TabsTrigger value="import-export" className="data-[state=active]:bg-indigo-600">
                        📦 Import/Export
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

                <TabsContent value="songes" className="space-y-4">
                    <DreamBonusManager />
                </TabsContent>

                <TabsContent value="quests" className="space-y-4">
                    <GameQuestManager />
                </TabsContent>

                <TabsContent value="import-export" className="space-y-4">
                    <DataExportImport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
