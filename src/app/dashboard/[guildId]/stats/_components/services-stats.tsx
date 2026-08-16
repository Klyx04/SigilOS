"use client";

import { Handshake, Package, ArrowDownCircle, ArrowUpCircle, Users, Box } from "lucide-react";

interface ServicesStatsProps {
    services: {
        loans: {
            total: number;
            active: number;
            returned: number;
            cancelled: number;
            topLenders: { name: string; value: number }[];
        };
        vault: {
            totalDeposits: number;
            totalWithdrawals: number;
            topContributors: { name: string; value: number }[];
            topItem: string | null;
        };
    };
    loansEnabled?: boolean;
    vaultEnabled?: boolean;
}

export default function ServicesStats({ services, loansEnabled = true, vaultEnabled = true }: ServicesStatsProps) {
    const { loans, vault } = services;
    const showLoans = loansEnabled && loans.total > 0;
    const showVault = vaultEnabled && vault.totalDeposits > 0;

    if (!showLoans && !showVault) {
        return (
            <div className="text-center text-muted-foreground text-xs py-4 italic">
                Aucune donnée disponible pour les services actuellement.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Prêts ── */}
            {showLoans && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-warning" />
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Prêts</h4>
                    </div>

                    {/* KPIs prêts */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: "Total", value: loans.total, color: "text-foreground" },
                            { label: "En cours", value: loans.active, color: "text-info" },
                            { label: "Rendus", value: loans.returned, color: "text-success" },
                            { label: "Annulés", value: loans.cancelled, color: "text-muted-foreground" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="rounded-lg bg-surface border border-white/8 p-3 text-center">
                                <p className={`text-xl font-black ${color}`}>{value}</p>
                                <p className="text-caption text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Top prêteurs */}
                    {loans.topLenders.length > 0 && (
                        <div>
                            <h5 className="text-caption font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Users className="w-3 h-3" /> Top prêteurs
                            </h5>
                            <div className="space-y-1.5">
                                {loans.topLenders.map((l, i) => (
                                    <div key={l.name} className="flex items-center gap-2 text-sm">
                                        <span className="w-4 text-muted-foreground font-mono text-xs">{i + 1}.</span>
                                        <span className="flex-1 text-foreground font-medium truncate">{l.name}</span>
                                        <span className="text-warning font-black text-xs">{l.value} prêt{l.value > 1 ? "s" : ""}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Coffre ── */}
            {showVault && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-success" />
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Coffre Guilde</h4>
                    </div>

                    {/* KPIs coffre */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-success/5 border border-success/15 p-3 text-center">
                            <ArrowDownCircle className="w-4 h-4 text-success mx-auto mb-1" />
                            <p className="text-xl font-black text-success">{vault.totalDeposits}</p>
                            <p className="text-caption text-muted-foreground uppercase tracking-wider mt-0.5">Dépôts</p>
                        </div>
                        <div className="rounded-lg bg-orange-500/5 border border-orange-500/15 p-3 text-center">
                            <ArrowUpCircle className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                            <p className="text-xl font-black text-orange-400">{vault.totalWithdrawals}</p>
                            <p className="text-caption text-muted-foreground uppercase tracking-wider mt-0.5">Retraits</p>
                        </div>
                    </div>

                    {/* Item le plus stocké */}
                    {vault.topItem && (
                        <div className="flex items-center gap-2 rounded-lg bg-surface border border-white/8 px-3 py-2">
                            <Box className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <p className="text-xs text-muted-foreground">Item le + stocké : <span className="text-foreground font-bold">{vault.topItem}</span></p>
                        </div>
                    )}

                    {/* Top contributeurs coffre */}
                    {vault.topContributors.length > 0 && (
                        <div>
                            <h5 className="text-caption font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Users className="w-3 h-3" /> Top contributeurs
                            </h5>
                            <div className="space-y-1.5">
                                {vault.topContributors.map((c, i) => (
                                    <div key={c.name} className="flex items-center gap-2 text-sm">
                                        <span className="w-4 text-muted-foreground font-mono text-xs">{i + 1}.</span>
                                        <span className="flex-1 text-foreground font-medium truncate">{c.name}</span>
                                        <span className="text-success font-black text-xs">{c.value} op.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
