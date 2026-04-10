"use client";

import { useState, useEffect } from "react";
import { getDofusHealthReport, compileDofusChain, compileAllDofus } from "@/server/actions/dofus-quest-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    Activity, AlertCircle, CheckCircle2, 
    RefreshCw, ImageOff, Link2, Search, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function DofusHealthChecker() {
    const [report, setReport] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [compiling, setCompiling] = useState<string | null>(null);
    const [isBulkCompiling, setIsBulkCompiling] = useState(false);

    const loadReport = async () => {
        setLoading(true);
        const res = await getDofusHealthReport();
        if (res.success && res.data) {
            setReport(res.data);
        }
        setLoading(false);
    };

    useEffect(() => { loadReport(); }, []);

    const handleCompile = async (slug: string) => {
        setCompiling(slug);
        const res = await compileDofusChain(slug);
        if (res.success) {
            toast.success(`Compilation de ${slug} terminée`);
            loadReport();
        } else {
            toast.error(res.error);
        }
        setCompiling(null);
    };

    const handleBulkCompile = async () => {
        if (!confirm("Attention : Cela va re-compiler TOUS les Dofus (26+). Temps estimé: 1-2 min. Continuer ?")) return;
        setIsBulkCompiling(true);
        const res = await compileAllDofus();
        if (res.success) {
            toast.success("Toute la matrice a été re-compilée.");
            loadReport();
        } else {
            toast.error(res.error);
        }
        setIsBulkCompiling(false);
    };

    const emptyCount = report.filter(d => d.status === "EMPTY").length;
    const criticalCount = report.filter(d => d.status === "CRITICAL").length;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Dofus Opérationnels</p>
                        <h4 className="text-3xl font-black text-white italic">{report.length - emptyCount - criticalCount}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Vides (0 Quêtes)</p>
                        <h4 className="text-3xl font-black text-amber-500 italic">{emptyCount}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Search className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl flex items-center justify-between shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Données Critiques</p>
                        <h4 className="text-3xl font-black text-rose-500 italic">{criticalCount}</h4>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-zinc-900/20 flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        Rapport de Santé
                    </h3>
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={handleBulkCompile} 
                            size="sm" 
                            variant="outline" 
                            disabled={isBulkCompiling}
                            className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-xl h-9"
                        >
                            <Zap className={`w-4 h-4 mr-2 ${isBulkCompiling ? 'animate-pulse' : ''}`} />
                            {isBulkCompiling ? 'Compilation...' : 'Re-Seed All'}
                        </Button>
                        <Button 
                            onClick={loadReport} 
                            size="sm" 
                            variant="outline" 
                            className="bg-black/40 border-white/5 text-zinc-400 hover:text-white rounded-xl h-9"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Rafraîchir
                        </Button>
                    </div>

                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20">
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dofus</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">État</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contenu</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Image</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {report.sort((a, b) => b.totalQuests === 0 ? 1 : -1).map((dofus) => (
                                <tr key={dofus.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-white/5 p-1">
                                                <img src={dofus.imageUrl} alt="" className="w-full h-full object-contain" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white">{dofus.name}</div>
                                                <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">{dofus.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {dofus.status === "EMPTY" ? (
                                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase font-black text-[9px]">Vide</Badge>
                                        ) : dofus.status === "CRITICAL" ? (
                                            <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 uppercase font-black text-[9px]">Critique</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase font-black text-[9px]">OK</Badge>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-bold text-zinc-400">
                                            {dofus.chainsCount} sections • {dofus.totalQuests} quêtes
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {dofus.imageUrl?.includes("api.dofusdb.fr") ? (
                                            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-bold uppercase">
                                                <ImageOff className="w-3 h-3" /> URL Morte
                                            </div>
                                        ) : !dofus.imageUrl ? (
                                            <div className="flex items-center gap-2 text-zinc-600 text-[10px] font-bold uppercase">
                                                Manquante
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase">
                                                <Link2 className="w-3 h-3" /> OK
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            disabled={compiling === dofus.slug}
                                            onClick={() => handleCompile(dofus.slug)}
                                            className="h-8 text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg"
                                        >
                                            {compiling === dofus.slug ? 'Compiles...' : 'Re-Seed'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
