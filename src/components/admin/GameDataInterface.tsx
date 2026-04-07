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
import { Sparkles, ChevronRight, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState("families");

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap justify-start gap-1 w-full bg-slate-800/50 mb-6 p-2 rounded-xl h-auto">
                    <TabsTrigger value="families" className="data-[state=active]:bg-indigo-600 flex-1 min-w-[100px]">
                        🦎 Familles
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="data-[state=active]:bg-indigo-600 flex-1 min-w-[100px]">
                        🗺️ Zones
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="data-[state=active]:bg-indigo-600 flex-1 min-w-[100px]">
                        ⚔️ Challenges
                    </TabsTrigger>
                    <TabsTrigger value="dungeons" className="data-[state=active]:bg-indigo-600 flex-1 min-w-[100px]">
                        🏰 Donjons
                    </TabsTrigger>
                    <TabsTrigger value="songes" className="data-[state=active]:bg-purple-600 flex-1 min-w-[100px]">
                        🌙 Songes
                    </TabsTrigger>
                    <TabsTrigger value="quests" className="data-[state=active]:bg-cyan-600 flex-1 min-w-[100px]">
                        📜 Quêtes
                    </TabsTrigger>
                    <TabsTrigger value="mini-games" className="data-[state=active]:bg-amber-600 flex-1 min-w-[100px]">
                        🎮 Mini-Jeux
                    </TabsTrigger>
                    <TabsTrigger value="import-export" className="data-[state=active]:bg-indigo-600 flex-1 min-w-[100px]">
                        📦 Import/Export
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="mini-games" className="space-y-4">
                    <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <div className="w-10 h-10 flex items-center justify-center text-2xl">🎮</div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Gestion des Mini-Jeux</h3>
                            <p className="text-zinc-500 text-sm font-medium max-w-md mx-auto">
                                Vous pouvez gérer ici le statut de maintenance de la plateforme, la blacklist des maps du Sigil-Guesser et consulter les signalements effectués par les joueurs.
                            </p>
                        </div>
                        <a 
                            href="/god/mini-games" 
                            className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest italic text-xs rounded-xl shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-all active:scale-95"
                        >
                            Ouvrir le Panneau de Gestion
                        </a>
                    </div>
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
