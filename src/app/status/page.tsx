"use client";

import { useEffect, useState } from "react";

interface ServiceStatus {
    status: "up" | "down" | "not_configured";
    latency?: number;
}

interface HealthData {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    services: {
        database: ServiceStatus;
        redis: ServiceStatus;
    };
    version?: string;
}

function StatusBadge({ status }: { status: "up" | "down" | "not_configured" | "healthy" | "degraded" | "unhealthy" }) {
    const config = {
        up: { color: "bg-emerald-500", text: "Opérationnel", icon: "🟢" },
        healthy: { color: "bg-emerald-500", text: "Opérationnel", icon: "🟢" },
        down: { color: "bg-red-500", text: "Hors ligne", icon: "🔴" },
        unhealthy: { color: "bg-red-500", text: "Critique", icon: "🔴" },
        degraded: { color: "bg-amber-500", text: "Dégradé", icon: "🟡" },
        not_configured: { color: "bg-gray-500", text: "Non configuré", icon: "⚪" },
    };

    const { color, text, icon } = config[status] || config.down;

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${color} text-white`}>
            {icon} {text}
        </span>
    );
}

function ServiceCard({
    name,
    status,
    latency
}: {
    name: string;
    status: "up" | "down" | "not_configured";
    latency?: number;
}) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${status === "up" ? "bg-emerald-500 animate-pulse" :
                        status === "down" ? "bg-red-500" : "bg-gray-500"
                    }`} />
                <span className="font-medium text-gray-200">{name}</span>
            </div>
            <div className="flex items-center gap-4">
                {latency !== undefined && (
                    <span className="text-sm text-gray-400">{latency}ms</span>
                )}
                <StatusBadge status={status} />
            </div>
        </div>
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
        const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div className="max-w-2xl mx-auto px-4 py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-4">
                        🏰 SigilOS Status
                    </h1>
                    <p className="text-gray-400">
                        État des services en temps réel
                    </p>
                </div>

                {/* Global Status */}
                <div className="bg-gray-800/30 rounded-2xl border border-gray-700 p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-1">État Global</h2>
                            <p className="text-sm text-gray-400">
                                Tous les systèmes
                            </p>
                        </div>
                        <StatusBadge status={health?.status || "unhealthy"} />
                    </div>
                </div>

                {/* Services */}
                <div className="space-y-3 mb-8">
                    <h3 className="text-lg font-medium text-gray-300 mb-4">Services</h3>

                    <ServiceCard
                        name="Base de données"
                        status={health?.services.database.status || "down"}
                        latency={health?.services.database.latency}
                    />

                    <ServiceCard
                        name="Cache Redis"
                        status={health?.services.redis.status || "down"}
                        latency={health?.services.redis.latency}
                    />
                </div>

                {/* Footer Info */}
                <div className="text-center text-sm text-gray-500 space-y-2">
                    {lastUpdated && (
                        <p>
                            Dernière mise à jour : {lastUpdated.toLocaleTimeString("fr-FR")}
                        </p>
                    )}
                    {health?.version && (
                        <p>Version : {health.version}</p>
                    )}
                    <p className="text-xs">
                        Rafraîchissement automatique toutes les 30 secondes
                    </p>
                </div>
            </div>
        </div>
    );
}
