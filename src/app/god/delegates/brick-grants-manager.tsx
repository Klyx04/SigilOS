"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GOD_BRICKS } from "@/lib/god-bricks";
import { grantBrickAccess, revokeBrickAccess } from "@/server/actions/god-delegate-actions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listBrickGrants } from "@/server/actions/god-delegate-actions";

export interface BrickGrantView {
    id: string;
    delegateId: string;
    userId: string;
    brickId: string;
    guildId: string | null;
    startAt: string;
    expiresAt: string | null;
    grantedBy: string;
    reason: string | null;
    revokedAt: string | null;
    createdAt: string;
}

export function BrickGrantsManager({
    delegates,
    initialGrants,
}: {
    delegates: { id: string; userId: string; userName: string | null }[];
    initialGrants: BrickGrantView[];
}) {
    const [delegateId, setDelegateId] = useState<string>(delegates[0]?.id ?? "");
    const [brickId, setBrickId] = useState<string>(GOD_BRICKS[0].id);
    const [durationMinutes, setDurationMinutes] = useState<number>(30);
    const [reason, setReason] = useState<string>("");
    const [grants, setGrants] = useState<BrickGrantView[]>(initialGrants);
    const [loading, setLoading] = useState(false);

    const handleGrant = async () => {
        if (!delegateId || !brickId || !reason.trim()) {
            toast.error("Renseigne le délégué, la brique et la justification (obligatoire)");
            return;
        }
        setLoading(true);
        const res = await grantBrickAccess({ delegateId, brickId, durationMinutes, reason: reason.trim() });
        setLoading(false);
        if (res.success) {
            toast.success("Accès brique accordé");
            const list = await listBrickGrants();
            if (list.success) setGrants(list.data ?? []);
            setReason("");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleRevoke = async (grantId: string) => {
        setLoading(true);
        const res = await revokeBrickAccess(grantId);
        setLoading(false);
        if (res.success) {
            toast.success("Accès révoqué");
            const list = await listBrickGrants();
            if (list.success) setGrants(list.data ?? []);
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const now = Date.now();

    return (
        <div className="space-y-8">
            {/* FORMULAIRE D'ACCORD */}
            <div className="rounded-3xl border border-white/5 bg-zinc-900/10 backdrop-blur-xl p-6 space-y-5">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Accorder un accès par brique (JIT)</h3>
                    <p className="text-xs text-zinc-500 mt-1">Justification obligatoire. Durée min 5 min, max 90 jours.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Délégué</label>
                        <Select value={delegateId} onValueChange={setDelegateId}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un délégué" /></SelectTrigger>
                            <SelectContent>
                                {delegates.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>{d.userName || d.userId}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Brique</label>
                        <Select value={brickId} onValueChange={setBrickId}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {GOD_BRICKS.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.label} ({b.id})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Durée (minutes)</label>
                        <Input
                            type="number"
                            min={5}
                            max={90 * 24 * 60}
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Justification *</label>
                        <Input
                            placeholder="Pourquoi cet accès ?"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleGrant} disabled={loading} className="bg-violet-500 hover:bg-violet-400 text-white font-bold">
                        {loading ? "..." : "Accorder l'accès"}
                    </Button>
                </div>
            </div>

            {/* LISTE DES GRANTS */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Grants par brique</h3>
                {grants.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zinc-500 rounded-2xl border border-dashed border-white/10">Aucun grant par brique</div>
                ) : (
                    grants.map((g) => {
                        const brick = GOD_BRICKS.find((b) => b.id === g.brickId);
                        const expired = g.expiresAt ? new Date(g.expiresAt).getTime() < now : false;
                        const active = !g.revokedAt && !expired;
                        return (
                            <div key={g.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-white/5 bg-zinc-900/10 p-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-white">{brick?.label || g.brickId}</span>
                                        {active ? <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">ACTIF</Badge>
                                            : g.revokedAt ? <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30">RÉVOQUÉ</Badge>
                                            : <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">EXPIRÉ</Badge>}
                                    </div>
                                    <p className="text-xs text-zinc-500">{g.reason || "—"}</p>
                                    <p className="text-[10px] text-zinc-600 font-bold">
                                        {g.expiresAt
                                            ? active
                                                ? `Expire dans ${Math.max(0, Math.floor((new Date(g.expiresAt).getTime() - now) / 60000))} min`
                                                : `Expiré le ${new Date(g.expiresAt).toLocaleString("fr-FR")}`
                                            : "Sans expiration"}
                                    </p>
                                </div>
                                {active && (
                                    <Button onClick={() => handleRevoke(g.id)} disabled={loading} variant="destructive" size="sm">
                                        Révoquer
                                    </Button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
