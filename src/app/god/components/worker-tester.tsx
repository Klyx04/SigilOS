"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { triggerGlobalMetamobSync, triggerGlobalLadderSync, testLadderFetch } from "@/server/actions/super-admin-actions";
import { Download, Trophy, Loader2, Beaker, Play, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function WorkerTester() {
    const [isMetamobLoading, setIsMetamobLoading] = useState(false);
    const [isLadderLoading, setIsLadderLoading] = useState(false);
    
    // Test API State
    const [testPseudo, setTestPseudo] = useState("");
    const [testServerId, setTestServerId] = useState("295"); // Imagiro by default
    const [isTestLoading, setIsTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const handleTestLadder = async () => {
        if (!testPseudo) return toast.error("Entrez un pseudo.");
        setIsTestLoading(true);
        setTestResult(null);
        const res = await testLadderFetch(testPseudo, testServerId);
        setTestResult(res);
        if (!res.success) toast.error(res.error);
        else toast.success("Test terminé.");
        setIsTestLoading(false);
    };

    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:bg-zinc-900/60 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-sm font-black text-zinc-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Service Workers & API
            </h3>
            
            <Tabs defaultValue="api" className="w-full">
                <TabsList className="mb-6 bg-black/40 border border-white/5">
                    <TabsTrigger value="api" className="text-xs uppercase font-bold tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                        <Beaker className="w-4 h-4 mr-2" />
                        API Playground
                    </TabsTrigger>
                    <TabsTrigger value="queue" className="text-xs uppercase font-bold tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                        <Terminal className="w-4 h-4 mr-2" />
                        Queues System
                    </TabsTrigger>
                </TabsList>

                {/* API TESTING ZONE */}
                <TabsContent value="api" className="space-y-4">
                    <p className="text-xs text-zinc-500 mb-4">
                        Test direct de l'API Cloudflare (Ladder). Aucune DB impactée, aucun job créé. Permet de vérifier la validité du Token et du format Dofus.com en live.
                    </p>
                    <div className="flex gap-4 items-end">
                        <div className="space-y-2 flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pseudo Dofus</label>
                            <Input 
                                placeholder="ex: Klyx" 
                                value={testPseudo} 
                                onChange={e => setTestPseudo(e.target.value)} 
                                className="bg-black/50 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2 w-32">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Server ID</label>
                            <Input 
                                placeholder="295" 
                                value={testServerId} 
                                onChange={e => setTestServerId(e.target.value)} 
                                className="bg-black/50 border-white/10 text-white"
                            />
                        </div>
                        <Button 
                            onClick={handleTestLadder} 
                            disabled={isTestLoading}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-wide transition-all"
                        >
                            {isTestLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            LANCER TEST
                        </Button>
                    </div>

                    {/* API RESULT TERMINAL */}
                    {testResult && (
                        <div className="mt-6 bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-[11px] overflow-auto max-h-64">
                            <div className="flex gap-2 items-center text-xs mb-2 border-b border-white/10 pb-2">
                                <span className={testResult.success ? "text-emerald-400" : "text-rose-400"}>
                                    {testResult.success ? "✅ Fetch & Data OK" : `❌ Erreur (Status Code: ${testResult.statusSucces})`}
                                </span>
                            </div>
                            <pre className="text-zinc-300 whitespace-pre-wrap">
                                {JSON.stringify(testResult, null, 2)}
                            </pre>
                        </div>
                    )}
                </TabsContent>

                {/* QUEUES ZONE */}
                <TabsContent value="queue" className="space-y-6">
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs my-4">
                        <strong>⚠️ ATTENTION:</strong> Injecter des jobs manuellement ici déclenchera l'opération sur tout le système. Utilisez ces boutons uniquement en cas de blocage d'un worker ou pour reset un cycle de test.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button 
                            onClick={async () => {
                                setIsMetamobLoading(true);
                                const res = await triggerGlobalMetamobSync();
                                if (res.success) toast.success(res.message);
                                else toast.error(res.error);
                                setIsMetamobLoading(false);
                            }} 
                            disabled={isMetamobLoading}
                            variant="outline"
                            className="h-auto py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20"
                        >
                            <div className="flex flex-col items-center gap-2">
                                {isMetamobLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                <span className="font-bold tracking-wider text-xs uppercase">Force Metamob Queue</span>
                            </div>
                        </Button>

                        <Button 
                            onClick={async () => {
                                setIsLadderLoading(true);
                                const res = await triggerGlobalLadderSync();
                                if (res.success) toast.success(res.message);
                                else toast.error(res.error);
                                setIsLadderLoading(false);
                            }} 
                            disabled={isLadderLoading}
                            variant="outline"
                            className="h-auto py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20"
                        >
                            <div className="flex flex-col items-center gap-2">
                                {isLadderLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                                <span className="font-bold tracking-wider text-xs uppercase">Force Ladder Queue</span>
                            </div>
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
