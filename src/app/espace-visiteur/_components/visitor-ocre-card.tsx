"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RefreshCw, Sparkles } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";
import { cn } from "@/lib/utils";
import {
    getPublicOcreProgress,
    type PublicOcreProgress,
} from "@/server/actions/public-profile-actions";

/** La quête est relue toutes les 5 minutes ; le bouton permet de forcer. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Carte « Quête de l'Éternelle Moisson » du profil visiteur, alignée sur la carte interne :
 * étape, progression, Gardiens et Archimonstres, avec une synchro réelle et son heure.
 * Aucune clé ne transite par le composant : l'action serveur la lit et n'en renvoie rien.
 */
export function VisitorOcreCard() {
    const [data, setData] = useState<PublicOcreProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getPublicOcreProgress();
            setData(result);
            if (result.success) setLastSync(new Date());
        } catch {
            setData({
                success: false,
                error: "Impossible de lire ta quête Metamob pour l'instant.",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const timer = window.setInterval(() => void refresh(), REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [refresh]);

    if (!data) {
        return (
            <section className="reg-panel p-4 sm:p-5" aria-busy="true">
                <div className="h-5 w-56 animate-pulse rounded-md bg-elevated" />
                <div className="mt-4 h-24 animate-pulse rounded-md bg-elevated" />
                <span className="sr-only">Chargement de la quête Metamob…</span>
            </section>
        );
    }

    if (!data.success) {
        return (
            <section className="reg-panel p-4 sm:p-5" aria-label="Quête de l'Éternelle Moisson">
                <header className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Sparkles className="size-4 text-warning" aria-hidden="true" />
                        Quête de l&apos;Éternelle Moisson
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void refresh()}
                        disabled={loading}
                        aria-label="Forcer la synchronisation"
                    >
                        <RefreshCw
                            className={cn("size-4", loading && "animate-spin")}
                            aria-hidden="true"
                        />
                    </Button>
                </header>
                <p className="mt-2 text-sm text-muted-foreground">{data.error}</p>
            </section>
        );
    }

    const server = data.serverName
        ? ALL_DOFUS_SERVER_ENTRIES.find((entry) => entry.name === data.serverName)
        : undefined;
    const gameBadge = data.gameVersion
        ? data.gameVersion.includes("Unity")
            ? "Unity"
            : data.gameVersion.includes("Retro")
              ? "Rétro"
              : data.gameVersion
        : null;
    const stepLabel = data.stepCount
        ? `${data.currentStep} / ${data.stepCount}`
        : String(data.currentStep);
    const syncLabel =
        lastSync && mounted
            ? `Synchronisé ${formatDistanceToNow(lastSync, { locale: fr, addSuffix: true })}`
            : "Synchronisé";

    return (
        <section className="reg-panel p-4 sm:p-5" aria-label="Quête de l'Éternelle Moisson">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Sparkles className="size-4 text-warning" aria-hidden="true" />
                            Quête de l&apos;Éternelle Moisson
                        </h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">
                                {data.characterName ?? "—"}
                            </span>
                            {server ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <GameIcon src={server.icon} className="size-4" />
                                    {server.name}
                                </span>
                            ) : data.serverName ? (
                                <span>{data.serverName}</span>
                            ) : null}
                            {gameBadge ? (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    {gameBadge}
                                </Badge>
                            ) : null}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Étape actuelle</p>
                            <p className="reg-mono mt-0.5 text-lg font-semibold text-foreground">
                                {stepLabel}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Progression</p>
                            <p className="reg-mono mt-0.5 text-lg font-semibold text-success">
                                {data.progress}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                    <Bar label="Gardiens" gathered={data.bosses.gathered} total={data.bosses.total} />
                    <Bar
                        label="Archimonstres"
                        gathered={data.archis.gathered}
                        total={data.archis.total}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-[11px] text-muted-foreground">{syncLabel}</p>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void refresh()}
                            disabled={loading}
                            className="h-7 px-2 text-xs text-muted-foreground"
                        >
                            <RefreshCw
                                className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
                                aria-hidden="true"
                            />
                            Forcer la synchro
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Bar({ label, gathered, total }: { label: string; gathered: number; total: number }) {
    const max = Math.max(1, total);
    const percent = Math.min(100, Math.round((gathered / max) * 100));
    const complete = total > 0 && gathered >= total;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{label}</span>
                <span className="text-muted-foreground">
                    <span className={complete ? "font-bold text-success" : "text-foreground"}>
                        {gathered}
                    </span>
                    /{total}
                </span>
            </div>
            <Progress
                value={percent}
                className="h-1.5"
                indicatorClassName={complete ? "bg-success" : "bg-warning"}
            />
        </div>
    );
}
