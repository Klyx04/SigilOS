"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    getHarvestResourcesSummary,
    checkDofusDbApiHealth,
} from "@/server/actions/game-data-actions";
import {
    Activity,
    CheckCircle2,
    Database,
    ExternalLink,
    Globe2,
    Loader2,
    MapPin,
    Pickaxe,
    RefreshCw,
    Search,
    Sparkles,
    Trees,
    Wheat,
    Fish,
    Leaf
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HarvestSummary {
    jobs: { id: number; name: string; icon: string; img: string; resourceCount: number; totalSpots: number }[];
    totalResources: number;
    totalSpots: number;
    zaapCount: number;
    lastUpdated: string;
}

interface ApiHealthReport {
    endpoints: { name: string; url: string; status: number; latencyMs: number; ok: boolean }[];
    allOk: boolean;
    timestamp: string;
}

export function DofusDbHarvestSyncManager() {
    const [summary, setSummary] = useState<HarvestSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [fullJobData, setFullJobData] = useState<any[]>([]);
    const [healthReport, setHealthReport] = useState<ApiHealthReport | null>(null);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await getHarvestResourcesSummary();
            if (res.success && res.data) {
                setSummary(res.data);
                if (res.data.jobs.length > 0 && selectedJobId === null) {
                    setSelectedJobId(res.data.jobs[0].id);
                }
            }
            const raw = await fetch('/game-data/harvest-resources.json');
            if (raw.ok) {
                const json = await raw.json();
                setFullJobData(json);
            }
        } catch (err) {
            toast.error("Erreur lors du chargement des récoltables");
        } finally {
            setIsLoading(false);
        }
    };

    const runHealthCheck = async () => {
        setIsCheckingHealth(true);
        try {
            const res = await checkDofusDbApiHealth();
            if (res.success && res.data) {
                setHealthReport(res.data);
                if (res.data.allOk) {
                    toast.success("Toutes les API DofusDB répondent avec succès !");
                } else {
                    toast.warning("Certaines API DofusDB semblent instables.");
                }
            }
        } catch {
            toast.error("Échec du diagnostic DofusDB");
        } finally {
            setIsCheckingHealth(false);
        }
    };

    const currentJob = fullJobData.find(j => j.id === selectedJobId) || fullJobData[0];
    const filteredResources = (currentJob?.resources || []).filter((r: any) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.level).includes(searchQuery)
    );

    return (
        <div className="space-y-8">
            {/* Header & Health Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                            <Pickaxe className="w-5 h-5" />
                        </span>
                        <h2 className="text-xl font-bold text-foreground">Gestionnaire Récoltables & Cartes DofusDB</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Inspection des ressources de récolte du Monde des Douze, points de spawn et synchronisation avec DofusDB.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={runHealthCheck}
                        disabled={isCheckingHealth}
                        size="sm"
                        variant="outline"
                        className="border-border text-xs gap-2 font-bold"
                    >
                        {isCheckingHealth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-sky-500" />}
                        <span>Tester API DofusDB</span>
                    </Button>
                    <Button
                        onClick={loadData}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-2 font-bold"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Recharger Données</span>
                    </Button>
                </div>
            </div>

            {/* Health Diagnostics Panel */}
            {healthReport && (
                <div className="p-5 rounded-2xl bg-elevated border border-border space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sky-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Statut API DofusDB</span>
                        </div>
                        <span className="text-caption text-muted-foreground font-mono">{new Date(healthReport.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {healthReport.endpoints.map((ep, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-bold text-foreground">{ep.name}</p>
                                    <p className="text-caption text-muted-foreground font-mono">{ep.latencyMs} ms</p>
                                </div>
                                {ep.ok ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-caption flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> 200 OK
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 font-black text-caption">
                                        KO ({ep.status || "Timeout"})
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-border bg-surface shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-caption font-bold uppercase tracking-wider">Métiers Répertoriés</CardDescription>
                        <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Trees className="w-5 h-5 text-emerald-500" />
                            <span>{summary?.jobs.length || 0}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-caption text-muted-foreground">Bûcheron, Mineur, Paysan, Alchi, Pêcheur</p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-surface shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-caption font-bold uppercase tracking-wider">Ressources Uniques</CardDescription>
                        <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            <span>{summary?.totalResources || 0}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-caption text-muted-foreground">Types de récoltables indexés</p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-surface shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-caption font-bold uppercase tracking-wider">Nœuds Cartographiés</CardDescription>
                        <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-sky-500" />
                            <span>{summary?.totalSpots.toLocaleString() || 0}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-caption text-muted-foreground">Positions GPS de spawn sur la carte</p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-surface shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-caption font-bold uppercase tracking-wider">Réseau de Zaaps</CardDescription>
                        <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Globe2 className="w-5 h-5 text-purple-500" />
                            <span>{summary?.zaapCount || 0}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-caption text-muted-foreground">Téléporteurs officiels Dofus 3.5</p>
                    </CardContent>
                </Card>
            </div>

            {/* Jobs Selector Pills */}
            <div className="flex flex-wrap gap-2 pb-2">
                {summary?.jobs.map((job) => {
                    const isSelected = selectedJobId === job.id;
                    return (
                        <button
                            key={job.id}
                            onClick={() => setSelectedJobId(job.id)}
                            className={cn(
                                "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all shadow-sm",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                                    : "bg-surface hover:bg-elevated border-border text-foreground"
                            )}
                        >
                            <span className="text-base">{job.icon}</span>
                            <span>{job.name}</span>
                            <span className={cn(
                                "text-caption px-2 py-0.5 rounded-full font-mono",
                                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-elevated text-muted-foreground"
                            )}>
                                {job.resourceCount}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Resources List for Selected Job */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : currentJob ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">{currentJob.icon}</div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{currentJob.name}</h3>
                                <p className="text-xs text-muted-foreground">{currentJob.resources?.length || 0} ressources disponibles</p>
                            </div>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Filtrer (nom, niveau)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-surface border-border text-xs"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredResources.map((res: any) => {
                            const spotCount = res.totalSpots || res.spots?.length || 0;
                            return (
                                <div
                                    key={res.id}
                                    className="p-3.5 rounded-2xl border border-border bg-surface hover:bg-elevated/70 transition-all flex flex-col justify-between gap-3 group shadow-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        {res.img ? (
                                            <img
                                                src={res.img}
                                                alt={res.name}
                                                className="w-10 h-10 rounded-xl bg-elevated border border-border object-contain p-1 shrink-0 group-hover:scale-105 transition-transform"
                                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-base shrink-0">
                                                📦
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-xs font-black text-foreground truncate">{res.name}</span>
                                            </div>
                                            <span className="text-caption font-bold text-muted-foreground">Niveau {res.level}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                                        <span className="text-caption text-muted-foreground flex items-center gap-1 font-mono font-bold">
                                            <MapPin className="w-3 h-3 text-sky-500" />
                                            {spotCount} nœuds
                                        </span>
                                        <a
                                            href={`https://dofusdb.fr/fr/database/item/${res.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-caption text-muted-foreground hover:text-sky-500 flex items-center gap-1 transition-colors"
                                        >
                                            <span>DofusDB</span>
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
