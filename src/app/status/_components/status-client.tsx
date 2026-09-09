"use client";
import { useEffect, useState } from "react";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { RefreshCw, Database, Activity, Bot, Swords, Image as ImageIcon, Map } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { User } from "next-auth";

type CheckState = "up" | "degraded" | "down" | "unknown";

interface ExternalCheck {
    status: "up" | "degraded" | "down";
    latencyMs?: number;
}

interface HealthData {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    services: {
        database: { status: "up" | "down"; latency?: number };
        redis: { status: "up" | "down" | "not_configured"; latency?: number };
    };
    checks?: {
        discordBot: ExternalCheck;
        metamob: ExternalCheck;
        dofusdb: ExternalCheck;
        dofensive: ExternalCheck;
    };
    version?: string;
}

const STATE_LABEL: Record<CheckState, string> = {
    up: "En service",
    degraded: "Ralenti",
    down: "Injoignable",
    unknown: "Non vérifié",
};

const STATE_STYLE: Record<CheckState, string> = {
    up: "bg-success/5 border-success/20 text-success",
    degraded: "bg-warning/5 border-warning/20 text-warning",
    down: "bg-danger/5 border-danger/20 text-danger",
    unknown: "bg-muted/20 border-border text-muted-foreground",
};

const DOT_STYLE: Record<CheckState, string> = {
    up: "bg-success",
    degraded: "bg-warning",
    down: "bg-danger",
    unknown: "bg-muted-foreground",
};

function StatusDot({ state }: { state: CheckState }) {
    return (
        <span className={`relative flex h-3 w-3`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${DOT_STYLE[state]} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${DOT_STYLE[state]}`}></span>
        </span>
    );
}

function StateBadge({ state, detail }: { state: CheckState; detail?: string }) {
    return (
        <div className="flex items-center gap-3">
            {detail && (
                <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest hidden sm:inline">
                    {detail}
                </span>
            )}
            <div className={`text-caption font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${STATE_STYLE[state]}`}>
                {STATE_LABEL[state]}
            </div>
        </div>
    );
}

interface ServiceRow {
    key: string;
    name: string;
    usage: string;
    icon: React.ReactNode;
    state: CheckState;
    detail?: string;
}

function buildRows(health: HealthData | null): ServiceRow[] {
    const db = health?.services.database;
    const checks = health?.checks;
    return [
        {
            key: "site",
            name: "Site SigilOS",
            usage: "Pages, connexion, données des guildes",
            icon: <Database className="w-4 h-4 text-info" />,
            state: !health ? "unknown" : db?.status === "up" ? "up" : "down",
            detail: db?.latency != null ? `${db.latency} ms` : undefined,
        },
        {
            key: "discord",
            name: "Bot Discord",
            usage: "Notifications, arrivées et départs, rôles",
            icon: <Bot className="w-4 h-4 text-info" />,
            state: checks?.discordBot.status ?? "unknown",
            detail: checks?.discordBot.latencyMs != null ? `${checks.discordBot.latencyMs} ms` : undefined,
        },
        {
            key: "metamob",
            name: "Metamob",
            usage: "Quête Ocre, doublons, échanges",
            icon: <Swords className="w-4 h-4 text-info" />,
            state: checks?.metamob.status ?? "unknown",
            detail: checks?.metamob.latencyMs != null ? `${checks.metamob.latencyMs} ms` : undefined,
        },
        {
            key: "dofusdb",
            name: "DofusDB",
            usage: "Encyclopédie, images d'objets",
            icon: <ImageIcon className="w-4 h-4 text-info" />,
            state: checks?.dofusdb.status ?? "unknown",
            detail: checks?.dofusdb.latencyMs != null ? `${checks.dofusdb.latencyMs} ms` : undefined,
        },
        {
            key: "dofensive",
            name: "Dofensive",
            usage: "Fiches boss, cartes tactiques",
            icon: <Map className="w-4 h-4 text-info" />,
            state: checks?.dofensive.status ?? "unknown",
            detail: checks?.dofensive.latencyMs != null ? `${checks.dofensive.latencyMs} ms` : undefined,
        },
    ];
}

function buildIncidents(health: HealthData | null): string[] {
    if (!health) return [];
    const incidents: string[] = [];
    const rows = buildRows(health);
    for (const row of rows) {
        if (row.state === "down") incidents.push(`${row.name} est injoignable — les fonctions liées (« ${row.usage} ») peuvent ne pas répondre.`);
        else if (row.state === "degraded") incidents.push(`${row.name} est ralenti — prévoyez des délais sur « ${row.usage} ».`);
    }
    return incidents;
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
            setHealth(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const globalState: CheckState =
        !health ? "unknown"
        : health.status === "healthy" ? "up"
        : health.status === "degraded" ? "degraded"
        : "down";

    const checkedAt = health?.timestamp ? new Date(health.timestamp) : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-info animate-spin" />
            </div>
        );
    }

    const rows = buildRows(health);
    const incidents = buildIncidents(health);

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
                    <p className="text-sm text-muted-foreground">
                        Relevé {checkedAt ? `à ${checkedAt.toLocaleTimeString("fr-FR")}` : "en cours…"} — vérifié en continu
                    </p>
                </div>

                {/* Global Status Card */}
                <div className="rounded-3xl border border-border bg-surface p-8 mb-8">
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <StatusDot state={globalState} />
                                <div className={`absolute inset-0 rounded-full blur-sm opacity-50 animate-pulse ${DOT_STYLE[globalState]}`} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                                    {globalState === "up" ? "Tous les systèmes sont opérationnels" :
                                        globalState === "degraded" ? "Service perturbé" :
                                        globalState === "unknown" ? "Vérification en cours" :
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

                {/* Incidents */}
                {incidents.length > 0 && (
                    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 mb-8">
                        <h3 className="text-caption font-black text-warning uppercase tracking-widest mb-3">
                            ⚠ Ce qui ne marche pas en ce moment
                        </h3>
                        <ul className="space-y-2">
                            {incidents.map((incident, i) => (
                                <li key={i} className="text-sm text-foreground/90 leading-relaxed">
                                    • {incident}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Services List */}
                <div className="space-y-4">
                    <h3 className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Services de la plateforme
                    </h3>

                    {rows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-4 p-6 bg-surface/30 border border-border rounded-2xl hover:bg-surface/50 transition-colors group">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="p-2.5 rounded-xl bg-background/50 border border-border shrink-0">
                                    {row.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-foreground tracking-tight">{row.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{row.usage}</div>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <StateBadge state={row.state} detail={row.detail} />
                            </div>
                        </div>
                    ))}
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
