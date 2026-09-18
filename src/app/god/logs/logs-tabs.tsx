"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogViewer } from "./log-viewer";
import { MarketLogView } from "./market-log-view";
import { ScrollText, ShieldX, CheckCircle2, Building2, UserX, ShoppingBag } from "lucide-react";
import type { GodMarketLogRow } from "@/server/actions/god-market-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AccessAttempt {
    id: string;
    discordId: string;
    reason: string;
    createdAt: Date | string;
    nowMember: boolean;
    guilds: Array<{ name: string; status: string }>;
}

interface LogsTabsProps {
    attempts: AccessAttempt[];
    attemptsTotal: number;
    initialLogs: any[];
    initialTotal: number;
    /** Journal d'audit du **Marché** (onglet dédié — décision user 18/09/2026). */
    marketLogs: GodMarketLogRow[];
    /** Guildes **internes** (id + nom) pour le filtre du journal du marché. */
    marketGuilds: { id: string; name: string }[];
}

const REASON_LABELS: Record<string, string> = {
    NO_MANAGED_GUILD: "Aucune guilde gérée / whitelistée",
    DISCORD_API_ERROR: "API Discord indisponible (pas de profil connu)",
};

export function LogsTabs({
    attempts,
    attemptsTotal,
    initialLogs,
    initialTotal,
    marketLogs,
    marketGuilds,
}: LogsTabsProps) {
    const [tab, setTab] = useState<string>("audit");

    return (
        <Tabs value={tab} onValueChange={setTab} className="w-full space-y-4">
            <TabsList className="bg-zinc-950/80 border border-white/10 rounded-xl p-1">
                <TabsTrigger
                    value="audit"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-400 data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 transition-colors"
                >
                    <ScrollText className="w-4 h-4 mr-2" />
                    Journal d'audit
                </TabsTrigger>
                <TabsTrigger
                    value="access"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-400 data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 transition-colors"
                >
                    <ShieldX className="w-4 h-4 mr-2" />
                    Accès refusés
                    <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-zinc-800 text-xs font-bold text-zinc-300 tabular-nums">
                        {attemptsTotal}
                    </span>
                </TabsTrigger>
                <TabsTrigger
                    value="market"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-400 data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 transition-colors"
                >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Marché
                    <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-zinc-800 text-xs font-bold text-zinc-300 tabular-nums">
                        {marketLogs.length}
                    </span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <LogViewer initialLogs={initialLogs} initialTotal={initialTotal} />
            </TabsContent>

            <TabsContent value="access" className="animate-in fade-in duration-150 focus-visible:outline-none">
                {/* #84 — onglet dédié « Accès refusés », bandeau enrichi (appartenance guilde actuelle) */}
                <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <ShieldX className="w-4 h-4 text-rose-400" />
                            <h2 className="text-base font-semibold text-white">Tentatives de connexion refusées</h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-white/5 text-zinc-400 tabular-nums">
                                {attemptsTotal} au total
                            </span>
                        </div>
                        <span className="text-caption text-zinc-500">
                            Candidats ayant cliqué « Se connecter » sans être dans une guilde gérée. Rétention 90 jours.
                        </span>
                    </div>

                    {attempts.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">Aucune tentative refusée enregistrée.</p>
                    ) : (
                        <ul className="divide-y divide-white/5 text-sm">
                            {attempts.map((a) => (
                                <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-3 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <UserX className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                        <span className="font-mono text-xs text-zinc-300 truncate">Discord ID: {a.discordId}</span>
                                        {a.nowMember ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Désormais membre
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800/60 border border-white/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                <ShieldX className="w-3 h-3" />
                                                Aucune guilde SigilOS
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 ml-auto flex-wrap">
                                        {a.guilds.length > 0 && (
                                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300" title={a.guilds.map((g) => `${g.name} — ${g.status}`).join(", ")}>
                                                <Building2 className="w-3 h-3 text-zinc-500 shrink-0" />
                                                <span className="max-w-[240px] truncate">
                                                    {a.guilds.map((g) => `${g.name} (${g.status})`).join(", ")}
                                                </span>
                                            </span>
                                        )}
                                        <span className="text-xs text-rose-300/90">{REASON_LABELS[a.reason] || a.reason}</span>
                                        <span className="text-caption text-zinc-500 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </TabsContent>

            {/* 🧭 Journal d'audit du **Marché** — déplacé depuis God → Marché
                (décision user 18/09/2026) : même journal, même rétention, mais
                regroupé avec les autres logs de la plateforme. */}
            <TabsContent value="market" className="animate-in fade-in duration-150 focus-visible:outline-none">
                <MarketLogView initialLogs={marketLogs} guilds={marketGuilds} />
            </TabsContent>
        </Tabs>
    );
}