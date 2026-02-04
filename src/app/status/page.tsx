"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { ArrowLeft, RefreshCw } from "lucide-react";

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

export default function StatusPage() {
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
        <div className="min-h-screen bg-black flex flex-col">
            {/* Simple Header */}
            <header className="border-b border-white/5 bg-black/60 backdrop-blur-md">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            width={32}
                            height={32}
                            className="rounded-lg"
                        />
                        <span className="font-bold text-white">SigilOS</span>
                    </Link>
                    <span className="text-xs text-zinc-500 font-mono">
                        {health?.version || "v1.0.0"}
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
                {/* Title */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        État des Services
                    </h1>
                    <p className="text-zinc-400">
                        Statut en temps réel de la plateforme SigilOS
                    </p>
                </div>

                {/* Global Status Card */}
                <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/10 rounded-2xl p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <StatusDot status={globalStatus} />
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {globalStatus === "up" ? "Tous les systèmes sont opérationnels" :
                                        globalStatus === "degraded" ? "Performance dégradée" :
                                            "Incident en cours"}
                                </h2>
                                <p className="text-sm text-zinc-400">
                                    {lastUpdated ? `Vérifié à ${lastUpdated.toLocaleTimeString("fr-FR")}` : "Vérification..."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchHealth}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            title="Rafraîchir"
                        >
                            <RefreshCw className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Services List */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                        Services
                    </h3>

                    {/* Site Web */}
                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${siteStatus === "up" ? "bg-emerald-500" : "bg-red-500"}`} />
                            <span className="font-medium text-white">Site Web</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {health?.services.database.latency && (
                                <span className="text-xs text-zinc-500 font-mono">{health.services.database.latency}ms</span>
                            )}
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${siteStatus === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                {siteStatus === "up" ? "Opérationnel" : "Hors ligne"}
                            </span>
                        </div>
                    </div>

                    {/* Bot Discord */}
                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="font-medium text-white">Bot Discord</span>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                            Connecté
                        </span>
                    </div>
                </div>

                {/* Info */}
                <p className="text-center text-xs text-zinc-500 mt-12">
                    Rafraîchissement automatique toutes les 30 secondes
                </p>
            </main>

            {/* Footer */}
            <GalacticFooter />
        </div>
    );
}
