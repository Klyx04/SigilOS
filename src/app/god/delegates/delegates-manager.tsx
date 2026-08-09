"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Users, UserPlus, Ban, Loader2, KeyRound, Clock, AlertTriangle } from "lucide-react";
import { grantDelegate, revokeDelegate, revokeBrickAccess } from "@/server/actions/god-delegate-actions";
import { GOD_BRICKS } from "@/lib/god-bricks";
import { cn } from "@/lib/utils";
import type { BrickGrantView } from "./brick-grants-manager";

type Delegate = {
    id: string; userId: string; userName: string | null; discordId: string | null;
    scopes: string[]; grantedBy: string; grantedAt: Date;
    expiresAt: Date | null; revokedAt: Date | null; guildId: string | null;
};

type DelegateInput = {
    id: string; userId: string; userName: string | null; discordId: string | null;
    scopes: string[]; grantedBy: string; grantedAt: string;
    expiresAt: string | null; revokedAt: string | null; guildId: string | null;
    isActive: boolean; status: "ACTIVE" | "EXPIRED" | "REVOKED";
};

const SCOPE_LABELS: Record<string, string> = {
    guilds: "Guildes", "game-data": "Game Data", users: "Utilisateurs",
    logs: "Logs", news: "News", maintenance: "Maintenance",
};

function deserialize(raw: Delegate): DelegateInput {
    const now = Date.now();
    const expired = !!raw.expiresAt && new Date(raw.expiresAt).getTime() < now;
    const status = raw.revokedAt ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE";
    return {
        id: raw.id, userId: raw.userId, userName: raw.userName, discordId: raw.discordId,
        scopes: raw.scopes, grantedBy: raw.grantedBy, grantedAt: new Date(raw.grantedAt).toISOString(),
        expiresAt: raw.expiresAt ? new Date(raw.expiresAt).toISOString() : null,
        revokedAt: raw.revokedAt ? new Date(raw.revokedAt).toISOString() : null, guildId: raw.guildId,
        isActive: status === "ACTIVE", status,
    };
}

/**
 * 🔄 P2+ — Crée un délégué "vierge" (sans scopes). Les accès réels (scopes → briques)
 * se gèrent dans le BrickGrantsManager (stepper 3 étapes), unique endroit d'accord.
 */
export function DelegatesManager({ initialDelegates, initialGrants = [] }: { initialDelegates: Delegate[]; initialGrants?: BrickGrantView[] }) {
    const [delegates, setDelegates] = useState<DelegateInput[]>(initialDelegates.map(deserialize));
    const [grants, setGrants] = useState<BrickGrantView[]>(initialGrants);
    const [isPending, startTransition] = useTransition();

    const [discordId, setDiscordId] = useState("");
    const [showForm, setShowForm] = useState(false);

    function handleRevokeGrant(grantId: string) {
        startTransition(async () => {
            const res = await revokeBrickAccess(grantId);
            if (res.success) {
                toast.success("Accès révoqué");
                setGrants(prev => prev.map(g => g.id === grantId ? { ...g, revokedAt: new Date().toISOString() } : g));
            } else {
                toast.error(res.error || "Erreur lors de la révocation");
            }
        });
    }

    function handleGrant() {
        if (!discordId.trim()) { toast.error("Veuillez renseigner un Discord ID"); return; }
        startTransition(async () => {
            // Délégué vierge : les scopes sont accordés via le stepper de briques.
            const res = await grantDelegate({ discordId: discordId.trim(), scopes: [], expiresAt: null });
            if (res.success && res.data) {
                toast.success("Délégué ajouté — accorde ensuite les accès via le stepper");
                setDelegates(prev => [...prev, deserialize(res.data!)]);
                setDiscordId(""); setShowForm(false);
            } else {
                toast.error(res.error || "Erreur lors de l'ajout");
            }
        });
    }

    function handleRevoke(id: string) {
        startTransition(async () => {
            const res = await revokeDelegate(id);
            if (res.success) {
                toast.success("Délégué révoqué");
                setDelegates(prev => prev.map(d => d.id === id ? { ...d, status: "REVOKED", isActive: false } : d));
            } else {
                toast.error(res.error || "Erreur lors de la révocation");
            }
        });
    }

    const activeDelegates = delegates.filter(d => d.isActive);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-violet-400" /> Délégués
                    </h2>
                    <p className="text-xs text-zinc-500">Crée un sous-god, puis accorde-lui des accès via le stepper (scope → briques).</p>
                </div>
                <Button onClick={() => setShowForm(v => !v)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2">
                    {showForm ? <Ban className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showForm ? "Annuler" : "Créer un délégué"}
                </Button>
            </div>

            {showForm && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5 max-w-md">
                    <div className="space-y-1">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Discord ID</label>
                        <Input value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="Ex: 123456789012345678" className="bg-zinc-950/60 border-white/10 text-white" />
                        <p className="text-[10px] text-zinc-600">ID Discord de l'utilisateur (17-19 chiffres)</p>
                    </div>
                    <Button onClick={handleGrant} disabled={isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Créer le délégué
                    </Button>
                    <p className="text-[10px] text-zinc-500">Le délégué est créé sans accès. Accorde ensuite ses permissions dans le stepper « Accorder un accès ».</p>
                </div>
            )}

            {activeDelegates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-center space-y-3">
                    <Users className="w-12 h-12 text-zinc-600" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-white">Aucun délégué actif</h4>
                        <p className="text-xs text-zinc-500">Crée un premier délégué pour commencer.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeDelegates.map(d => (
                        <div key={d.id} className="rounded-2xl border border-white/10 bg-zinc-950/40 backdrop-blur-md p-5 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-black text-white truncate flex items-center gap-2">
                                        {d.userName || "Utilisateur"}
                                        {!d.discordId && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                        {d.discordId ? `<@${d.discordId}>` : "Aucun Discord lié"}
                                    </div>
                                </div>
                                <Badge className="shrink-0 text-[10px] uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIF</Badge>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <Clock className="w-3 h-3" />
                                {d.scopes.length > 0
                                    ? d.scopes.map(s => SCOPE_LABELS[s] || s).join(" · ")
                                    : "Aucun accès accordé — utilise le stepper"}
                            </div>

                            {/* B1 — Grants du délégué, directement dans sa carte */}
                            <div className="space-y-2">
                                {grants.filter(g => g.delegateId === d.id && !g.revokedAt).map(g => {
                                    const brick = GOD_BRICKS.find(b => b.id === g.brickId);
                                    const gExpired = g.expiresAt ? new Date(g.expiresAt).getTime() < Date.now() : false;
                                    return (
                                        <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="text-xs font-bold text-white truncate">{brick?.label || g.brickId}</div>
                                                <div className="text-[10px] text-zinc-500 truncate">{g.reason || "—"}</div>
                                                <div className="text-[10px] text-zinc-600 font-bold">
                                                    {g.expiresAt
                                                        ? (gExpired ? "Expiré" : `Expire dans ${Math.max(0, Math.floor((new Date(g.expiresAt).getTime() - Date.now()) / 60000))} min`)
                                                        : "Sans expiration"}
                                                </div>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => handleRevokeGrant(g.id)} disabled={isPending}
                                                className="shrink-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[10px]">Révoquer</Button>
                                        </div>
                                    );
                                })}
                                {grants.filter(g => g.delegateId === d.id && !g.revokedAt).length === 0 && (
                                    <div className="text-[10px] text-zinc-600">Aucun accès actif</div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => handleRevoke(d.id)} disabled={isPending} className="text-xs bg-red-600/80 hover:bg-red-600 text-white gap-1">
                                    <Ban className="w-3 h-3" /> Révoquer
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}