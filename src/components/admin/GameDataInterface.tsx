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
import DofusQuestGodManager from "./DofusQuestGodManager";
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
                    <TabsTrigger value="dofus-quests" className="data-[state=active]:bg-emerald-600 flex-1 min-w-[100px]">
                        🥚 Arbres Dofus
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

                <TabsContent value="dofus-quests" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Curation Engine Stats Card */}
                        <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex flex-col gap-6 group hover:bg-zinc-900/60 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-white italic tracking-tighter uppercase">Curation Engine</div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Inspection & Enrichissement</div>
                                </div>
                            </div>
                            <p className="text-zinc-500 text-sm leading-relaxed">
                                Accédez à l'outil d'analyse avancée pour vérifier la couverture des coordonnées, 
                                les IDs DofusDB et la cohérence des chaînes de quêtes compilées.
                            </p>
                            <a 
                                href="/god/quetes-dofus" 
                                className="w-full py-4 bg-white text-black rounded-2xl flex items-center justify-center gap-3 font-black uppercase italic tracking-widest hover:bg-zinc-200 transition-all hover:scale-[1.02] shadow-2xl"
                            >
                                Ouvrir le Curation Engine
                                <ChevronRight className="w-5 h-5" />
                            </a>
                        </div>

                        {/* Database Builder Card */}
                        <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex flex-col gap-6 group hover:bg-zinc-900/60 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <Database className="w-8 h-8" />
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-white italic tracking-tighter uppercase">Quest Builder</div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Structure & Hiérarchie</div>
                                </div>
                            </div>
                            <p className="text-zinc-500 text-sm leading-relaxed">
                                Modifiez manuellement la structure des arbres, ajoutez des étapes 
                                ou créez de nouveaux Dofus dans la base de données SigilOS.
                            </p>
                            <div className="mt-auto">
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-none mb-4 font-black uppercase italic text-[9px]">Outil Interne Actif</Badge>
                            </div>
                        </div>
                    </div>

                    <DofusQuestGodManager />
                </TabsContent>

                <TabsContent value="import-export" className="space-y-4">
                    <DataExportImport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
