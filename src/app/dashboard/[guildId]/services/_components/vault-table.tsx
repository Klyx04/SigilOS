"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowDownCircle, ArrowUpCircle, Package, TrendingDown, TrendingUp, ArrowDown, ArrowUp } from "lucide-react";
import { type VaultEntryWithProfile } from "@/server/actions/vault-actions";
import { type VaultSummaryItem } from "@/server/actions/vault-actions";
import { deleteVaultEntry } from "@/server/actions/vault-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import Image from "next/image";

interface VaultTableProps {
    entries: VaultEntryWithProfile[];
    summary: VaultSummaryItem[];
    guildId: string;
    currentProfileId?: string;
    isAdmin?: boolean;
}

function getName(p: { pseudoDofus?: string | null; discordNickname?: string | null; user?: { name?: string | null } }) {
    return p.pseudoDofus || p.discordNickname || p.user?.name || "Membre";
}

function formatQty(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
    return String(n);
}

export function VaultTable({ entries, summary, guildId, currentProfileId, isAdmin }: VaultTableProps) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // desc = plus récent en premier
    const [actionFilter, setActionFilter] = useState<"ALL" | "DEPOSIT" | "WITHDRAW">("ALL");

    // Tri + filtre des entrées
    const displayedEntries = useMemo(() => {
        let result = [...entries];
        // Filtre action
        if (actionFilter !== "ALL") {
            result = result.filter(e => e.action === actionFilter);
        }
        // Tri date
        result.sort((a, b) => {
            const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return sortOrder === "desc" ? -diff : diff;
        });
        return result;
    }, [entries, sortOrder, actionFilter]);

    const handleDelete = async (entryId: string) => {
        if (!confirm("Supprimer cette entrée ?")) return;
        setLoadingId(entryId);
        const result = await deleteVaultEntry(guildId, entryId);
        if (result.success) {
            toast.success("Entrée supprimée.");
            router.refresh();
        } else {
            toast.error(result.error || "Erreur.");
        }
        setLoadingId(null);
    };

    return (
        <div className="space-y-8">

            {/* ── Solde du coffre ─────────────────────────────── */}
            {summary.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Solde du coffre
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {summary.map((item) => {
                            const isPositive = item.balance >= 0;
                            return (
                                <div
                                    key={item.itemName}
                                    className={`rounded-2xl border p-5 flex items-start gap-4 transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-md ${isPositive
                                        ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
                                        : "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15"
                                        }`}
                                >
                                    {item.iconUrl ? (
                                        <div className="relative h-12 w-12 shrink-0 mt-0.5">
                                            <Image
                                                src={item.iconUrl}
                                                alt={item.itemName}
                                                fill
                                                className="object-contain drop-shadow-sm"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>
                                    ) : (
                                        <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center border shadow-inner ${isPositive ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400" : "border-rose-500/30 bg-rose-500/20 text-rose-400"
                                            }`}>
                                            <Package className="h-6 w-6" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-black text-white truncate capitalize group-hover:text-cyan-400 transition-colors">{item.itemName}</p>
                                        <p className={`text-3xl font-black mt-1 tracking-tight ${isPositive ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]"}`}>
                                            {isPositive ? "+" : ""}{formatQty(item.balance)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <TrendingDown className="h-3 w-3 text-emerald-500" />
                                                {formatQty(item.totalDeposited)} déposés
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <TrendingUp className="h-3 w-3 text-orange-400" />
                                                {formatQty(item.totalWithdrawn)} retirés
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Historique ──────────────────────────────────── */}
            <div className="space-y-3">
                {/* Barre de contrôles tri + filtre */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Historique</h3>
                    <div className="flex items-center gap-1.5">
                        {/* Filtre action */}
                        {(["ALL", "DEPOSIT", "WITHDRAW"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setActionFilter(f)}
                                className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all duration-300 ${actionFilter === f
                                    ? f === "ALL"
                                        ? "border-zinc-500/60 bg-zinc-500/20 text-zinc-300 shadow-[0_0_15px_rgba(113,113,122,0.2)]"
                                        : f === "DEPOSIT"
                                            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                            : "border-orange-500/50 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                                    : "border-white/10 bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                    }`}
                            >
                                {f === "ALL" ? <><Package className="h-3.5 w-3.5" /> Tout</> : f === "DEPOSIT" ? <><ArrowDownCircle className="h-3.5 w-3.5" /> Dépôts</> : <><ArrowUpCircle className="h-3.5 w-3.5" /> Retraits</>}
                            </button>
                        ))}

                        {/* Séparateur */}
                        <span className="w-px h-4 bg-white/10 mx-1" />

                        {/* Tri date */}
                        <button
                            onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-white/10 bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-300"
                        >
                            {sortOrder === "desc" ? <ArrowDown className="h-3.5 w-3.5 text-cyan-400" /> : <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />}
                            {sortOrder === "desc" ? "Plus récent" : "Plus ancien"}
                        </button>
                    </div>
                </div>

                {displayedEntries.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
                        <Package className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">Aucune entrée dans le coffre.</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {displayedEntries.map((entry) => {
                            const name = getName(entry.profile);
                            const isDeposit = entry.action === "DEPOSIT";
                            const isOwner = entry.profileId === currentProfileId;
                            const canDelete = isOwner || isAdmin;

                            return (
                                <div
                                    key={entry.id}
                                    className="group flex items-start gap-5 rounded-2xl border border-white/10 bg-zinc-900/40 px-5 py-4 hover:bg-zinc-900/60 hover:border-white/20 transition-all duration-300 shadow-sm hover:shadow-lg"
                                >
                                    {/* Indicateur action */}
                                    <div className={`shrink-0 p-2.5 rounded-xl border shadow-inner ${isDeposit
                                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                                        : "border-orange-500/30 bg-orange-500/20 text-orange-400"
                                        }`}>
                                        {isDeposit
                                            ? <ArrowDownCircle className="h-5 w-5 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                            : <ArrowUpCircle className="h-5 w-5 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                                        }
                                    </div>

                                    {/* Icône item si dispo */}
                                    {entry.linkedItemIconUrl && (
                                        <div className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-white/[0.03]">
                                            <Image
                                                src={entry.linkedItemIconUrl}
                                                alt={entry.itemName}
                                                fill
                                                className="object-contain p-0.5"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </div>
                                    )}

                                    {/* Contenu principal */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-white">
                                                {entry.quantity && entry.quantity > 1
                                                    ? <span className="text-zinc-400 font-bold">{formatQty(entry.quantity)}× </span>
                                                    : null
                                                }
                                                {entry.itemName}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] px-1.5 py-0 border font-black ${isDeposit
                                                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                                                    : "border-orange-500/30 text-orange-400 bg-orange-500/5"
                                                    }`}
                                            >
                                                {isDeposit ? "Dépôt" : "Retrait"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Avatar className="h-4 w-4 rounded">
                                                <AvatarImage src={entry.profile.user?.image || undefined} />
                                                <AvatarFallback className="text-[7px] bg-zinc-800">
                                                    {name.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs text-zinc-400 font-medium">{name}</span>
                                            <span className="text-[10px] text-zinc-600">·</span>
                                            <span className="text-[10px] text-zinc-600">
                                                {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        {entry.description && (
                                            <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{entry.description}</p>
                                        )}
                                    </div>

                                    {/* Preuve screenshot — grande preview cliquable */}
                                    {entry.proofUrl && (
                                        <a
                                            href={entry.proofUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Voir la preuve"
                                            className="shrink-0 relative h-20 w-28 rounded-lg overflow-hidden border border-white/15 hover:border-white/40 hover:scale-105 transition-all shadow-lg opacity-90 hover:opacity-100"
                                        >
                                            <img src={entry.proofUrl} alt="Preuve" className="absolute inset-0 w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-end justify-center pb-1">
                                                <span className="text-[9px] text-white/0 hover:text-white/80 font-bold bg-black/40 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    ↗ Ouvrir
                                                </span>
                                            </div>
                                        </a>
                                    )}

                                    {/* Supprimer */}
                                    {canDelete && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(entry.id)}
                                            disabled={loadingId === entry.id}
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
