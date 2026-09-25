"use client";

/**
 * `/god/logs` — **une seule porte** pour les journaux (G11 · A9 · A10 · A11).
 *
 * Avant : deux entrées de nav (« Sécurité & Logs » `?tab=security`, 200 lignes
 * brutes, et « Audit Logs » `/god/logs`) affichaient le **même** `AuditLog` — le
 * second journalisait en plus chaque visite du God (749 lignes, **72 %** du
 * journal). Il ne reste qu'une entrée de nav ; `?tab=security` **redirige** ici.
 *
 * Les cinq onglets couvrent ce que la plateforme **écrit** réellement :
 *  ① **Journal plateforme** — actions God (`isGodLog: true`) ;
 *  ② **Journal de guilde** — `isGodLog: false`, filtrable par guilde, **lecture seule** (A11) ;
 *  ③ **Accès refusés** — `AccessAttempt` (connexions refusées) ;
 *  ④ **Audit du Marché** — `MarketAuditLog` (module Marché) ;
 *  ⑤ **Accès délégués** — `GodAccessLog`, écrit depuis l'origine et **jamais lu** (A10).
 * Les compteurs d'accès God ne sont plus des lignes de journal : ils sont agrégés
 * par jour dans l'entête de la page (A9).
 */

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Building2, CheckCircle2, KeyRound, ScrollText, ShieldX, ShoppingBag, UserX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GodMarketLogRow } from "@/server/actions/god-market-actions";
import type { GodAccessLogEntry } from "@/server/actions/audit-actions";
import { LogViewer, type GodLogRow } from "./log-viewer";
import { MarketLogView } from "./market-log-view";
import { DelegatedAccessView } from "./delegated-access-view";

interface AccessAttempt {
    id: string;
    discordId: string;
    reason: string;
    createdAt: Date | string;
    nowMember: boolean;
    guilds: Array<{ name: string; status: string }>;
}

interface LogsTabsProps {
    /** Journal **plateforme** (actions God) — page 1 rendue par le serveur. */
    platformLogs: GodLogRow[];
    platformTotal: number;
    platformSecurityCount: number;
    /** Journal **d'une guilde** (ou de toutes) — lecture seule, page 1 côté serveur. */
    guildLogs: GodLogRow[];
    guildTotal: number;
    guildSecurityCount: number;
    /** Guildes **internes** (id + nom) : filtre du journal de guilde **et** du Marché. */
    guilds: { id: string; name: string }[];
    attempts: AccessAttempt[];
    attemptsTotal: number;
    marketLogs: GodMarketLogRow[];
    /** Journal des **accès délégués** (`GodAccessLog`, A10). */
    delegatedLogs: GodAccessLogEntry[];
    delegatedTotal: number;
}

const REASON_LABELS: Record<string, string> = {
    NO_MANAGED_GUILD: "Aucune guilde gérée / whitelistée",
    DISCORD_API_ERROR: "API Discord indisponible (pas de profil connu)",
};

const TAB_TRIGGER_CLASS =
    "rounded-lg px-3 py-2 text-body-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background";

export function LogsTabs({
    platformLogs,
    platformTotal,
    platformSecurityCount,
    guildLogs,
    guildTotal,
    guildSecurityCount,
    guilds,
    attempts,
    attemptsTotal,
    marketLogs,
    delegatedLogs,
    delegatedTotal,
}: LogsTabsProps) {
    const [tab, setTab] = useState<string>("platform");

    return (
        <Tabs value={tab} onValueChange={setTab} className="w-full space-y-4">
            <TabsList className="h-auto flex-wrap justify-start rounded-xl border border-border bg-surface/60 p-1">
                <TabsTrigger value="platform" className={TAB_TRIGGER_CLASS}>
                    <ScrollText className="mr-2 h-4 w-4" />
                    Journal plateforme
                </TabsTrigger>
                <TabsTrigger value="guild" className={TAB_TRIGGER_CLASS}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Journal de guilde
                </TabsTrigger>
                <TabsTrigger value="access" className={TAB_TRIGGER_CLASS}>
                    <ShieldX className="mr-2 h-4 w-4" />
                    Accès refusés
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-elevated px-1.5 text-caption font-bold tabular-nums text-muted-foreground">
                        {attemptsTotal}
                    </span>
                </TabsTrigger>
                <TabsTrigger value="market" className={TAB_TRIGGER_CLASS}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Audit du Marché
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-elevated px-1.5 text-caption font-bold tabular-nums text-muted-foreground">
                        {marketLogs.length}
                    </span>
                </TabsTrigger>
                <TabsTrigger value="delegates" className={TAB_TRIGGER_CLASS}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Accès délégués
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-elevated px-1.5 text-caption font-bold tabular-nums text-muted-foreground">
                        {delegatedTotal}
                    </span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="platform" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <LogViewer
                    scope="platform"
                    initialLogs={platformLogs}
                    initialTotal={platformTotal}
                    initialSecurityCount={platformSecurityCount}
                />
            </TabsContent>

            {/* A11 — journal d'une guilde : lecture seule, filtrable par guilde (id interne). */}
            <TabsContent value="guild" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <LogViewer
                    scope="guild"
                    initialLogs={guildLogs}
                    initialTotal={guildTotal}
                    initialSecurityCount={guildSecurityCount}
                    guilds={guilds}
                />
            </TabsContent>

            <TabsContent value="access" className="animate-in fade-in duration-150 focus-visible:outline-none">
                {/* #84 — onglet dédié « Accès refusés » : appartenance à une guilde au moment du refus */}
                <div className="space-y-3 rounded-2xl border border-border bg-surface/40 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <ShieldX className="h-4 w-4 text-danger" />
                            <h2 className="text-base font-semibold text-foreground">Connexions refusées</h2>
                            <span className="rounded-full border border-border bg-elevated px-2 py-0.5 text-caption tabular-nums text-muted-foreground">
                                {attemptsTotal} au total
                            </span>
                        </div>
                        <span className="text-caption text-muted-foreground">
                            Candidats ayant cliqué « Se connecter » sans être dans une guilde gérée. Rétention 90 jours.
                        </span>
                    </div>

                    {attempts.length === 0 ? (
                        <p className="text-body-sm italic text-muted-foreground">Aucune tentative refusée enregistrée.</p>
                    ) : (
                        <ul className="divide-y divide-border text-body-sm">
                            {attempts.map((attempt) => (
                                <li key={attempt.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <UserX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate font-mono text-caption text-foreground">Discord ID: {attempt.discordId}</span>
                                        {attempt.nowMember ? (
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-caption text-success">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Désormais membre
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-elevated px-2 py-0.5 text-caption text-muted-foreground">
                                                <ShieldX className="h-3 w-3" />
                                                Aucune guilde SigilOS
                                            </span>
                                        )}
                                    </div>
                                    <div className="ml-auto flex flex-wrap items-center gap-3">
                                        {attempt.guilds.length > 0 ? (
                                            <span
                                                className="inline-flex items-center gap-1.5 text-caption text-muted-foreground"
                                                title={attempt.guilds.map((g) => `${g.name} — ${g.status}`).join(", ")}
                                            >
                                                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                <span className="max-w-[240px] truncate">
                                                    {attempt.guilds.map((g) => `${g.name} (${g.status})`).join(", ")}
                                                </span>
                                            </span>
                                        ) : null}
                                        <span className="text-caption text-warning">{REASON_LABELS[attempt.reason] || attempt.reason}</span>
                                        <span className="whitespace-nowrap text-caption text-muted-foreground">
                                            {formatDistanceToNow(new Date(attempt.createdAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </TabsContent>

            {/* 🧭 Audit du **Marché** — déplacé depuis la page God → Marché (décision user 18/09/2026). */}
            <TabsContent value="market" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <MarketLogView initialLogs={marketLogs} guilds={guilds} />
            </TabsContent>

            {/* A10 — `GodAccessLog` : écrit depuis l'origine, exposé ici pour la première fois. */}
            <TabsContent value="delegates" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <DelegatedAccessView initialLogs={delegatedLogs} initialTotal={delegatedTotal} />
            </TabsContent>
        </Tabs>
    );
}
