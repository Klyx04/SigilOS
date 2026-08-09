"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOD_BRICKS } from "@/lib/god-bricks";
import { SCOPE_TO_BRICKS, SUBGOD_USABLE_SCOPES, type GodScope } from "@/lib/god-scopes";
import { grantBrickAccess } from "@/server/actions/god-delegate-actions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Shield, Users, Layers, Timer, Lock } from "lucide-react";

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

const SCOPE_LABELS: Record<GodScope, string> = {
    guilds: "Guildes (whitelist)",
    "game-data": "Données de Jeu",
    users: "Tickets (support)",
    logs: "Logs",
    news: "Docs",
    maintenance: "Maintenance",
};

interface BrickGrantsManagerProps {
    delegates: { id: string; userId: string; userName: string | null }[];
    activeDelegateIds?: string[];
}

export function BrickGrantsManager({ delegates, activeDelegateIds = [] }: BrickGrantsManagerProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [delegateId, setDelegateId] = useState<string>("");
    // Multi : scopes cochés + briques cochées (toutes briques confondues)
    const [selectedScopes, setSelectedScopes] = useState<GodScope[]>([]);
    const [selectedBricks, setSelectedBricks] = useState<string[]>([]);
    // Durée flexible : valeur + unité (minutes / heures / jours), convertie en minutes avant envoi.
    const [durationValue, setDurationValue] = useState<number>(30);
    const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("minutes");
    const durationMinutes = useMemo(() => {
        const mult = durationUnit === "hours" ? 60 : durationUnit === "days" ? 60 * 24 : 1;
        return Math.max(5, Math.round(durationValue * mult));
    }, [durationValue, durationUnit]);
    const [reason, setReason] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const activeDelegates = useMemo(() => {
        const activeSet = new Set(activeDelegateIds);
        if (activeSet.size === 0) return delegates;
        return delegates.filter((d) => activeSet.has(d.id));
    }, [delegates, activeDelegateIds]);

    // Briques disponibles pour les scopes sélectionnés
    const availableBricksByScope = useMemo(() => {
        const map: Record<GodScope, (typeof GOD_BRICKS)[number][]> = {} as any;
        for (const s of selectedScopes) {
            const ids = SCOPE_TO_BRICKS[s] || [];
            map[s] = GOD_BRICKS.filter((b) => ids.includes(b.id));
        }
        return map;
    }, [selectedScopes]);

    const totalSelectedBricks = selectedBricks.length;

    const toggleScope = (s: GodScope) => {
        const has = selectedScopes.includes(s);
        if (has) {
            // Dé-cocher le scope : retire aussi ses briques de la sélection
            const scopeBrickIds = (SCOPE_TO_BRICKS[s] || []);
            setSelectedScopes(prev => prev.filter(x => x !== s));
            setSelectedBricks(prev => prev.filter(b => !scopeBrickIds.includes(b)));
        } else {
            setSelectedScopes(prev => [...prev, s]);
        }
    };

    const toggleBrick = (brickId: string) => {
        setSelectedBricks(prev =>
            prev.includes(brickId) ? prev.filter(b => b !== brickId) : [...prev, brickId]
        );
    };

    const reset = () => { setStep(1); setDelegateId(""); setSelectedScopes([]); setSelectedBricks([]); setDurationValue(30); setDurationUnit("minutes"); setReason(""); };

    const handleGrant = async () => {
        if (!delegateId) return toast.error("Choisis le délégué");
        if (totalSelectedBricks === 0) return toast.error("Coche au moins une brique");
        if (!reason.trim()) return toast.error("Justification obligatoire");
        setLoading(true);
        let ok = true;
        for (const brickId of selectedBricks) {
            const res = await grantBrickAccess({ delegateId, brickId, durationMinutes, reason: reason.trim() });
            if (!res.success) { ok = false; toast.error(res.error || `Erreur ${brickId}`); }
        }
        setLoading(false);
        if (ok) {
            toast.success(`Accès accordé (${totalSelectedBricks} brique${totalSelectedBricks > 1 ? "s" : ""})`);
            reset();
        }
    };

    const canNext = step === 1 ? !!delegateId : step === 2 ? totalSelectedBricks > 0 : false;

    return (
        <div className="space-y-8">
            {/* STEPPER 3 ÉTAPES */}
            <div className="rounded-3xl border border-white/5 bg-zinc-900/10 backdrop-blur-xl p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    {[{ n: 1, label: "Délégué", icon: Users }, { n: 2, label: "Scopes & Briques", icon: Layers }, { n: 3, label: "Durée & Validation", icon: Lock }].map((s) => (
                        <div key={s.n} className={cn("flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                            step >= s.n ? "bg-violet-500/15 border-violet-500/40 text-violet-300" : "bg-white/5 border-white/10 text-zinc-500")}>
                            <s.icon className="w-4 h-4" /> <span>{s.n}. {s.label}</span>
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Délégué (actifs uniquement)</label>
                        <Select value={delegateId} onValueChange={(v) => { setDelegateId(v); setStep(2); }}>
                            <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Choisir un délégué actif" /></SelectTrigger>
                            <SelectContent>
                                {activeDelegates.length === 0 && <div className="p-3 text-xs text-zinc-500">Aucun délégué actif — commence par en créer un.</div>}
                                {activeDelegates.map((d) => <SelectItem key={d.id} value={d.id}>{d.userName || d.userId}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Scopes à accorder (un ou plusieurs)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {SUBGOD_USABLE_SCOPES.map((s) => {
                                const active = selectedScopes.includes(s);
                                return (
                                    <div key={s} className={cn("rounded-2xl border transition-all p-4",
                                        active ? "bg-violet-500/15 border-violet-500/40" : "bg-white/5 border-white/10")}>
                                        <button type="button" onClick={() => toggleScope(s)}
                                            className="w-full text-left flex items-center justify-between gap-3">
                                            <div className="font-black text-sm uppercase tracking-widest text-zinc-200">{SCOPE_LABELS[s]}</div>
                                            <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center text-[10px]",
                                                active ? "bg-violet-500 border-violet-400 text-white" : "border-white/20 text-transparent")}>✓</div>
                                        </button>
                                        {active && (
                                            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> Briques du scope (coche celles à accorder)
                                                </div>
                                                {(availableBricksByScope[s] || []).map((b) => {
                                                    const on = selectedBricks.includes(b.id);
                                                    return (
                                                        <button key={b.id} type="button" onClick={() => toggleBrick(b.id)}
                                                            className={cn("w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs transition-all",
                                                                on ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200" : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200")}>
                                                            <span>{b.label}</span>
                                                            <span className={cn("w-4 h-4 rounded border flex items-center justify-center text-[9px]",
                                                                on ? "bg-emerald-500 border-emerald-400 text-white" : "border-white/20 text-transparent")}>✓</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {totalSelectedBricks > 0 && (
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Sélection : {totalSelectedBricks} brique{totalSelectedBricks > 1 ? "s" : ""}</div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedBricks.map((id) => {
                                        const brick = GOD_BRICKS.find(b => b.id === id);
                                        return <Badge key={id} className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">{brick?.label || id}</Badge>;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
                            <Users className="w-4 h-4 text-violet-400" /> Délégué : <span className="text-white">{delegates.find(d => d.id === delegateId)?.userName || delegateId}</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold"><Layers className="w-4 h-4 text-violet-400" /> Scopes & briques :</div>
                            <div className="flex flex-wrap gap-1.5 pl-6">
                                {selectedScopes.map(s => <Badge key={s} className="bg-violet-500/10 text-violet-300 border-violet-500/30">{SCOPE_LABELS[s]}</Badge>)}
                                {selectedBricks.map(id => {
                                    const brick = GOD_BRICKS.find(b => b.id === id);
                                    return <Badge key={id} className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">{brick?.label || id}</Badge>;
                                })}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-2"><Timer className="w-4 h-4" /> Durée (min 5, max 90 jours)</label>
                            <div className="flex items-center gap-3">
                                <Input type="number" min={1} value={durationValue} onChange={(e) => setDurationValue(Number(e.target.value))} className="w-24" />
                                <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as "minutes" | "hours" | "days")}>
                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="minutes">minutes</SelectItem>
                                        <SelectItem value="hours">heures</SelectItem>
                                        <SelectItem value="days">jours</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-[10px] text-zinc-500 font-mono">= {durationMinutes} min</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Justification * (auditée)</label>
                            <Input placeholder="Pourquoi cet accès ?" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="border-white/10 bg-white/5 text-zinc-300">← Retour</Button>
                            <Button onClick={handleGrant} disabled={loading || totalSelectedBricks === 0} className="bg-violet-500 hover:bg-violet-400 text-white font-bold">{loading ? "Accord en cours..." : "Confirmer l'accès"}</Button>
                        </div>
                    </div>
                )}

                {step < 3 && (
                    <div className="flex justify-end">
                        <Button onClick={() => canNext && setStep(step === 1 ? 2 : 3)} disabled={!canNext} className="bg-violet-500 hover:bg-violet-400 text-white font-bold">Suivant →</Button>
                    </div>
                )}
            </div>
        </div>
    );
}