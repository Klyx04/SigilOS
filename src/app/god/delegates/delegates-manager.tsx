"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GOD_SCOPES, type GodScope } from "@/lib/god-scopes";
import { ShieldCheck, Users, UserPlus, Ban, Loader2, KeyRound, Clock, RotateCcw, AlertTriangle, CheckCheck } from "lucide-react";
import { grantDelegate, revokeDelegate, updateDelegateScopes } from "@/server/actions/god-delegate-actions";
import { cn } from "@/lib/utils";

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

export function DelegatesManager({ initialDelegates }: { initialDelegates: Delegate[] }) {
    const [delegates, setDelegates] = useState<DelegateInput[]>(initialDelegates.map(deserialize));
    const [isPending, startTransition] = useTransition();

    const [discordId, setDiscordId] = useState("");
    const [selectedScopes, setSelectedScopes] = useState<GodScope[]>([]);
    const [expiresAt, setExpiresAt] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingScopes, setEditingScopes] = useState<{ id: string; scopes: GodScope[] } | null>(null);

    function toggleScope(scope: GodScope) {
        setSelectedScopes(prev =>
            prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
        );
    }

    function handleGrant() {
        if (!discordId.trim()) { toast.error("Veuillez renseigner un Discord ID"); return; }
        if (selectedScopes.length === 0) { toast.error("Sélectionnez au moins un scope"); return; }
        startTransition(async () => {
            const res = await grantDelegate({
                discordId: discordId.trim(),
                scopes: selectedScopes,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            });
            if (res.success && res.data) {
                toast.success("Délégué ajouté");
                setDelegates(prev => [...prev, deserialize(res.data!)]);
                setDiscordId(""); setSelectedScopes([]); setExpiresAt(""); setShowForm(false);
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

    function handleUpdateScopes(id: string) {
        if (!editingScopes || editingScopes.scopes.length === 0) { toast.error("Sélectionnez au moins un scope"); return; }
        startTransition(async () => {
            const res = await updateDelegateScopes(id, editingScopes.scopes);
            if (res.success) {
                toast.success("Scopes mis à jour");
                setDelegates(prev => prev.map(d => d.id === id ? { ...d, scopes: editingScopes.scopes } : d));
                setEditingScopes(null);
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        });
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-violet-400" /> Accès délégués
                    </h2>
                    <p className="text-xs text-zinc-500">Les sub-gods ne peuvent voir que ce qui est explicitement accordé (fail-closed).</p>
                </div>
                <Button onClick={() => setShowForm(v => !v)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2">
                    {showForm ? <Ban className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showForm ? "Annuler" : "Accorder un accès"}
                </Button>
            </div>

            {showForm && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5">
                    <div className="space-y-1">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Discord ID</label>
                        <Input value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="Ex: 123456789012345678" className="bg-zinc-950/60 border-white/10 text-white" />
                        <p className="text-[10px] text-zinc-600">ID Discord de l'utilisateur (17-19 chiffres)</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Scopes</label>
                        <div className="flex flex-wrap gap-2">
                            {GOD_SCOPES.map(scope => {
                                const active = selectedScopes.includes(scope);
                                return (
                                    <button key={scope} type="button" onClick={() => toggleScope(scope)}
                                        className={cn("px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                                            active ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                                : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10")}>
                                        {SCOPE_LABELS[scope] || scope}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">Expiration (optionnel)</label>
                        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="bg-zinc-950/60 border-white/10 text-white" />
                    </div>
                    <Button onClick={handleGrant} disabled={isPending} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Accorder l'accès
                    </Button>
                </div>
            )}

            {delegates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-center space-y-3">
                    <Users className="w-12 h-12 text-zinc-600" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-white">Aucun délégué</h4>
                        <p className="text-xs text-zinc-500">Accordez un premier accès pour commencer.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {delegates.map(d => (
                        <div key={d.id}
                            className={cn("rounded-2xl border bg-zinc-950/40 backdrop-blur-md p-5 space-y-4",
                                d.status === "REVOKED" ? "border-red-500/20 opacity-70" :
                                d.status === "EXPIRED" ? "border-amber-500/20" : "border-white/10")}>
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
                                <Badge className={cn("shrink-0 text-[10px] uppercase",
                                    d.status === "ACTIVE" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                    d.status === "EXPIRED" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                                    d.status === "REVOKED" && "bg-red-500/10 text-red-400 border border-red-500/20")}>
                                    {d.status}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {d.scopes.map(s => (
                                    <span key={s} className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-300">
                                        {SCOPE_LABELS[s] || s}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <Clock className="w-3 h-3" />
                                {d.expiresAt ? `Expire ${new Date(d.expiresAt).toLocaleDateString("fr-FR")}` : "Sans expiration"}
                                {d.revokedAt && <span className="text-red-400">· Révoqué {new Date(d.revokedAt).toLocaleDateString("fr-FR")}</span>}
                            </div>

                            {d.isActive && editingScopes?.id === d.id ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {GOD_SCOPES.map(scope => {
                                            const active = editingScopes.scopes.includes(scope);
                                            return (
                                                <button key={scope} type="button"
                                                    onClick={() => setEditingScopes(prev => prev ? {
                                                        ...prev,
                                                        scopes: prev.scopes.includes(scope)
                                                            ? prev.scopes.filter(s => s !== scope)
                                                            : [...prev.scopes, scope],
                                                    } : prev)}
                                                    className={cn("px-2 py-1 rounded-md border text-[10px] font-bold transition-all",
                                                        active ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                                            : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10")}>
                                                    {SCOPE_LABELS[scope] || scope}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleUpdateScopes(d.id)} disabled={isPending} className="bg-violet-600 text-white text-xs gap-1">
                                            <CheckCheck className="w-3 h-3" /> Sauvegarder
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingScopes(null)} className="text-xs border-white/10 bg-white/5 text-zinc-300">
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {d.isActive && (
                                        <Button size="sm" variant="outline" onClick={() => setEditingScopes({ id: d.id, scopes: d.scopes as GodScope[] })} className="text-xs border-white/10 bg-white/5 text-zinc-300">
                                            <RotateCcw className="w-3 h-3 mr-1" /> Scopes
                                        </Button>
                                    )}
                                    {d.isActive && (
                                        <Button size="sm" onClick={() => handleRevoke(d.id)} disabled={isPending} className="text-xs bg-red-600/80 hover:bg-red-600 text-white gap-1">
                                            <Ban className="w-3 h-3" /> Révoquer
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
