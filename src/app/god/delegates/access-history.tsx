"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { History, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GOD_BRICKS } from "@/lib/god-bricks";

export interface DelegateHistoryItem { id: string; userName: string | null; status: "EXPIRED" | "REVOKED"; scopes: string[]; expiresAt: string | null; revokedAt: string | null; }
export interface GrantHistoryItem { id: string; brickId: string; status: "EXPIRED" | "REVOKED"; expiresAt: string | null; revokedAt: string | null; reason: string | null; }

const date = (v: string | null) => v ? new Date(v).toLocaleString("fr-FR") : "";

export function AccessHistory({ delegates, grants }: { delegates: DelegateHistoryItem[]; grants: GrantHistoryItem[] }) {
    const [open, setOpen] = useState(false);
    const total = delegates.length + grants.length;
    if (total === 0) return null;
    return (
        <div className="rounded-3xl border border-white/5 bg-zinc-950/40 backdrop-blur-md overflow-hidden">
            <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Historique des accès</span>
                    <Badge className="bg-zinc-500/10 text-zinc-400 border border-white/10">{total}</Badge>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="px-6 pb-6 space-y-6">
                    {delegates.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Délégations ({delegates.length})</div>
                            {delegates.map((d) => (
                                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-2.5">
                                    <span className="text-sm font-bold text-zinc-300">{d.userName || d.id}</span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {d.status === "REVOKED" ? `Révoqué ${date(d.revokedAt)}` : `Expiré ${date(d.expiresAt)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    {grants.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Accès briques ({grants.length})</div>
                            {grants.map((g) => (
                                <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-zinc-300">{GOD_BRICKS.find(b => b.id === g.brickId)?.label || g.brickId}</span>
                                        <span className="text-[10px] text-zinc-500 italic">{g.reason || ""}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {g.status === "REVOKED" ? `Révoqué ${date(g.revokedAt)}` : `Expiré ${date(g.expiresAt)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
