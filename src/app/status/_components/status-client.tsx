"use client";
import { useEffect, useState } from "react";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Image from "next/image";
import { RefreshCw, Activity } from "lucide-react";
import { DiscordIcon } from "@/components/shared/icons";
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

/** Couleur d'un état — un état, une couleur, rien d'autre. */
const STATE_TAG: Record<CheckState, string> = {
    up: "border-success/40 text-success",
    degraded: "border-warning/40 text-warning",
    down: "border-danger/40 text-danger",
    unknown: "text-muted-foreground",
};

const DOT_STYLE: Record<CheckState, string> = {
    up: "bg-success",
    degraded: "bg-warning",
    down: "bg-danger",
    unknown: "bg-muted-foreground",
};

/**
 * Pastille d'état : un point, sans animation. L'ancien rendu superposait trois
 * couches (point + halo flouté + `animate-pulse`) pour dire la même chose — et
 * une page d'état qui clignote en permanence ne se laisse pas lire.
 */
function StatusDot({ state }: { state: CheckState }) {
    return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_STYLE[state]}`} aria-hidden="true" />;
}

/**
 * Icône d'un service — l'identifiant visuel réel du tiers, servi depuis nos
 * propres fichiers et jamais depuis son site.
 *
 * Provenance des copies locales (`public/assets/brands/`, relevé du 16/09/2026) :
 *   metamob.png    https://www.metamob.fr/img/favicon-96.png              — 96×96
 *   dofusdb.png    https://dofusdb.fr/icons/android-icon-192x192.png      — 192×192
 *   dofensive.png  https://www.dofensive.com/favicon.ico                  — entrée 48×48 de l'ICO
 *
 * Le dossier s'appelle `brands/` (et non `status/`) parce que ces mêmes logos
 * sont aussi cités comme **sources** dans les guides : un seul original par
 * marque, partagé (`src/lib/source-icons.ts`).
 *
 * En local : aucune requête sortante depuis le navigateur du visiteur, aucune
 * dépendance à la disponibilité du tiers, et la CSP reste `img-src 'self'`.
 * `alt` vide : le nom du service est écrit à côté, l'image est décorative.
 */
const SERVICE_ICON_CLASS = "h-5 w-5 shrink-0 object-contain";

function ServiceIcon({ src }: { src: string }) {
    return <Image src={src} alt="" width={20} height={20} aria-hidden="true" className={SERVICE_ICON_CLASS} />;
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
            icon: <ServiceIcon src="/assets/ui/logo-v2.png" />,
            state: !health ? "unknown" : db?.status === "up" ? "up" : "down",
            detail: db?.latency != null ? `${db.latency} ms` : undefined,
        },
        {
            key: "discord",
            name: "Bot Discord",
            usage: "Notifications, arrivées et départs, rôles",
            icon: <DiscordIcon className={`${SERVICE_ICON_CLASS} text-[#5865F2]`} />,
            state: checks?.discordBot.status ?? "unknown",
            detail: checks?.discordBot.latencyMs != null ? `${checks.discordBot.latencyMs} ms` : undefined,
        },
        {
            key: "metamob",
            name: "Metamob",
            usage: "Quête Ocre, doublons, échanges",
            icon: <ServiceIcon src="/assets/brands/metamob.png" />,
            state: checks?.metamob.status ?? "unknown",
            detail: checks?.metamob.latencyMs != null ? `${checks.metamob.latencyMs} ms` : undefined,
        },
        {
            key: "dofusdb",
            name: "DofusDB",
            usage: "Encyclopédie, images d'objets",
            icon: <ServiceIcon src="/assets/brands/dofusdb.png" />,
            state: checks?.dofusdb.status ?? "unknown",
            detail: checks?.dofusdb.latencyMs != null ? `${checks.dofusdb.latencyMs} ms` : undefined,
        },
        {
            key: "dofensive",
            name: "Dofensive",
            usage: "Fiches boss, cartes tactiques",
            icon: <ServiceIcon src="/assets/brands/dofensive.png" />,
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

    const rows = buildRows(health);
    const incidents = buildIncidents(health);

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden landing-theme">

            <PublicHeader user={user} activePage="status" isMember={isMember} />

            {/* Main Content */}
            <main className="flex-1">
              <div className="reg-shell py-12">
                {/* Title */}
                <header className="mb-10">
                    <h1 className="text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold leading-[1.12] tracking-tight text-foreground">
                        État des Services
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Relevé {checkedAt ? `à ${checkedAt.toLocaleTimeString("fr-FR")}` : "en cours…"} — vérifié en continu
                    </p>
                </header>

                {/* Données : le titre et la fraîcheur restent rendus côté serveur,
                    seul le relevé attend le fetch client (avant, la page ne servait
                    qu'un spinner : ni titre, ni contenu pour les moteurs). */}
                {loading ? (
                    <div className="reg-panel bg-surface flex items-center gap-3 p-6">
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">Relevé des services en cours…</p>
                    </div>
                ) : (
                <>
                {/* Global Status Card */}
                <div className="reg-panel bg-surface p-6 mb-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <StatusDot state={globalState} />
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-foreground">
                                    {globalState === "up" ? "Tous les systèmes sont opérationnels" :
                                        globalState === "degraded" ? "Service perturbé" :
                                        globalState === "unknown" ? "Vérification en cours" :
                                            "Incident en cours"}
                                </h2>
                                <p className="reg-mono mt-1 text-xs text-muted-foreground">
                                    {lastUpdated ? `Vérifié à ${lastUpdated.toLocaleTimeString("fr-FR")}` : "Vérification..."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchHealth}
                            className="reg-btn reg-btn-secondary shrink-0"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                            <span className="hidden sm:inline">Rafraîchir</span>
                        </button>
                    </div>
                </div>

                {/* Incidents */}
                {incidents.length > 0 && (
                    <div className="reg-callout reg-callout-accent mb-8">
                        <h3 className="text-sm font-semibold text-warning">
                            Ce qui ne marche pas en ce moment
                        </h3>
                        <ul className="mt-3 space-y-2">
                            {incidents.map((incident, i) => (
                                <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                                    • {incident}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Services — un tableau : service, ce qu'il couvre, latence, état */}
                <h2 className="reg-eyebrow flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                    Services de la plateforme
                </h2>

                <div className="mt-4 overflow-x-auto">
                    <table className="reg-table">
                        <thead>
                            <tr>
                                <th scope="col">Service</th>
                                <th scope="col" className="hidden sm:table-cell">Ce qu&apos;il couvre</th>
                                <th scope="col" className="hidden w-[7rem] md:table-cell">Latence</th>
                                <th scope="col" className="w-[9rem] text-right">État</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.key}>
                                    <th
                                        scope="row"
                                        className="border-b border-border py-[0.85rem] pr-4 text-left align-middle text-sm font-semibold normal-case tracking-normal text-foreground"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <span className="inline-flex shrink-0 items-center justify-center">{row.icon}</span>
                                            {row.name}
                                        </span>
                                    </th>
                                    <td className="hidden text-sm text-muted-foreground sm:table-cell">
                                        {row.usage}
                                    </td>
                                    <td className="hidden align-middle md:table-cell">
                                        <span className="reg-mono text-xs text-muted-foreground">
                                            {row.detail ?? "—"}
                                        </span>
                                    </td>
                                    <td className="align-middle text-right">
                                        <span className={`reg-tag ${STATE_TAG[row.state]}`}>
                                            {STATE_LABEL[row.state]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
                )}

                {/* Info */}
                <p className="mt-10 text-xs text-muted-foreground">
                    Rafraîchissement automatique toutes les 30 secondes
                </p>
              </div>
            </main>

            {/* Footer */}
            <GalacticFooter isMember={isMember} />
        </div>
    );
}
