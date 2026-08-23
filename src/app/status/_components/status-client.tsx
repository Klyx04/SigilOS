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
        up: "bg-success",
        down: "bg-danger",
        degraded: "bg-warning",
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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-info animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col relative overflow-hidden landing-theme">

            <PublicHeader user={user} activePage="status" isMember={isMember} />

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
                {/* Title */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-foreground mb-2 pt-12">
                        État des Services
                    </h1>
                </div>

                {/* Global Status Card */}
                <div className="rounded-3xl border border-border bg-surface p-8 mb-8">
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <StatusDot status={globalStatus} />
                                <div className={`absolute inset-0 rounded-full blur-sm opacity-50 animate-pulse ${globalStatus === "up" ? "bg-success" : "bg-danger"}`} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                                    {globalStatus === "up" ? "Tous les systèmes sont opérationnels" :
                                        globalStatus === "degraded" ? "Performance dégradée" :
                                            "Incident en cours"}
                                </h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                    {lastUpdated ? `Vérifié à ${lastUpdated.toLocaleTimeString("fr-FR")}` : "Vérification..."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchHealth}
                            className="p-3 rounded-xl bg-surface hover:bg-elevated transition-all border border-border hover:border-border"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={`w-5 h-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Services List */}
                <div className="space-y-4">
                    <h3 className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Services de la plateforme
                    </h3>

                    {/* Site Web */}
                    <div className="flex items-center justify-between p-6 bg-surface/30 border border-border rounded-2xl hover:bg-surface/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-background/50 border border-border">
                                <Database className="w-4 h-4 text-info" />
                            </div>
                            <span className="font-bold text-foreground tracking-tight">Core API & Database</span>
                        </div>
                        <div className="flex items-center gap-6">
                            {health?.services.database.latency && (
                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest">{health.services.database.latency}ms latency</span>
                            )}
                            <div className={`text-caption font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${siteStatus === "up" ? "bg-success/5 border-success/20 text-success" : "bg-danger/5 border-danger/20 text-danger"
                                }`}>
                                {siteStatus === "up" ? "Opérationnel" : "Hors ligne"}
                            </div>
                        </div>
                    </div>

                    {/* Bot Discord */}
                    <div className="flex items-center justify-between p-6 bg-surface/30 border border-border rounded-2xl hover:bg-surface/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-background/50 border border-border">
                                <ShieldCheck className="w-4 h-4 text-info" />
                            </div>
                            <span className="font-bold text-foreground tracking-tight">Discord Integration</span>
                        </div>
                        <div className={`text-caption font-black uppercase tracking-widest px-3 py-1 rounded-lg border bg-success/5 border-success/20 text-success`}>
                            Connecté
                        </div>
                    </div>
                </div>

                {/* Info */}
                <p className="text-center text-xs text-muted-foreground mt-12">
                    Rafraîchissement automatique toutes les 30 secondes
                </p>
            </main>

            {/* Footer */}
            <GalacticFooter isMember={isMember} />
        </div>
    );
}
