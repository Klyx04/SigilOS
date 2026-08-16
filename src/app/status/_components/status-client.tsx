"use client";
import { useEffect, useState } from "react";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { RefreshCw, Database, Activity, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { User } from "next-auth";

interface HealthData {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    services: {
        database: { status: "up" | "down"; latency?: number };
        redis: { status: "up" | "down" | "not_configured"; latency?: number };
    };
    version?: string;
}

function StatusDot({ status }: { status: "up" | "down" | "degraded" }) {
    const colors = {
        up: "bg-emerald-500",
        down: "bg-red-500",
        degraded: "bg-amber-500",
    };
    return (
        <span className={`relative flex h-3 w-3`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status]}`}></span>
        </span>
    );
}

export function StatusClient({ user, isMember }: { user?: User; isMember: boolean }) {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchHealth = async () => {
        try {
            const res = await fetch("/api/health");
            const data = await res.json();
            setHealth(data);
            setLastUpdated(new Date());
        } catch {
            setHealth({
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                services: {
                    database: { status: "down" },
                    redis: { status: "down" },
                },
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    // Determine user-friendly statuses
    const siteStatus = health?.services.database.status === "up" ? "up" : "down";
    const globalStatus = health?.status === "healthy" ? "up" : health?.status === "degraded" ? "degraded" : "down";

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col relative overflow-hidden landing-theme">

            <PublicHeader user={user} activePage="status" isMember={isMember} />

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
                {/* Title */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-white mb-2 pt-12">
                        État des Services
                    </h1>
                </div>

                {/* Global Status Card */}
                <div className="rounded-3xl border border-white/10 bg-[#101313] p-8 mb-8">
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <StatusDot status={globalStatus} />
                                <div className={`absolute inset-0 rounded-full blur-sm opacity-50 animate-pulse ${globalStatus === "up" ? "bg-emerald-500" : "bg-red-500"}`} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                    {globalStatus === "up" ? "Tous les systèmes sont opérationnels" :
                                        globalStatus === "degraded" ? "Performance dégradée" :
                                            "Incident en cours"}
                                </h2>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                                    {lastUpdated ? `Vérifié à ${lastUpdated.toLocaleTimeString("fr-FR")}` : "Vérification..."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchHealth}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Services List */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Services de la plateforme
                    </h3>

                    {/* Site Web */}
                    <div className="flex items-center justify-between p-6 bg-zinc-900/30 border border-white/5 rounded-2xl hover:bg-zinc-900/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-white/5">
                                <Database className="w-4 h-4 text-indigo-400" />
                            </div>
                            <span className="font-bold text-white tracking-tight">Core API & Database</span>
                        </div>
                        <div className="flex items-center gap-6">
                            {health?.services.database.latency && (
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{health.services.database.latency}ms latency</span>
                            )}
                            <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${siteStatus === "up" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"
                                }`}>
                                {siteStatus === "up" ? "Opérationnel" : "Hors ligne"}
                            </div>
                        </div>
                    </div>

                    {/* Bot Discord */}
                    <div className="flex items-center justify-between p-6 bg-zinc-900/30 border border-white/5 rounded-2xl hover:bg-zinc-900/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-white/5">
                                <ShieldCheck className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="font-bold text-white tracking-tight">Discord Integration</span>
                        </div>
                        <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-emerald-400`}>
                            Connecté
                        </div>
                    </div>
                </div>

                {/* Info */}
                <p className="text-center text-xs text-zinc-500 mt-12">
                    Rafraîchissement automatique toutes les 30 secondes
                </p>
            </main>

            {/* Footer */}
            <GalacticFooter isMember={isMember} />
        </div>
    );
}
