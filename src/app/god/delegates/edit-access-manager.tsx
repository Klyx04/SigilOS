"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOD_BRICKS } from "@/lib/god-bricks";
import { SCOPE_TO_BRICKS, SUBGOD_USABLE_SCOPES, type GodScope } from "@/lib/god-scopes";
import { syncBrickAccessForDelegate, listBrickGrants } from "@/server/actions/god-delegate-actions";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Shield, Users, Layers, Timer, Lock, Edit3 } from "lucide-react";
import type { BrickGrantView } from "./brick-grants-manager";

const SCOPE_LABELS: Record<GodScope, string> = {
    guilds: "Guildes (whitelist)",
    "game-data": "Données de Jeu",
    users: "Tickets (support)",
    logs: "Logs",
    news: "Docs",
    maintenance: "Maintenance",
};

interface EditAccessManagerProps {
    delegates: { id: string; userId: string; userName: string | null }[];
    initialGrants: BrickGrantView[];
    activeDelegateIds?: string[];
    onGrantsChanged?: (grants: BrickGrantView[]) => void;
}

/**
 * 🔄 P3-R — Édition EN PLACE des grants d'un délégué.
 * Sélectionne un délégué → pré-remplit avec ses grants actifs → coche/décoche
 * des briques (multi-scopes) → durée + justification → syncBrickAccessForDelegate
 * (diff atomique : crée, révoque, prolonge). Fini le "révoquer + recréer".
 */
export function EditAccessManager({ delegates, initialGrants, activeDelegateIds = [], onGrantsChanged }: EditAccessManagerProps) {
    const router = useRouter();
    const [delegateId, setDelegateId] = useState<string>("");
    const [selectedBricks, setSelectedBricks] = useState<string[]>([]);
    const [durationValue, setDurationValue] = useState<number>(30);
    const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("days");
    const [reason, setReason] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [grants] = useState<BrickGrantView[]>(initialGrants);

    const durationMinutes = useMemo(() => {
        const mult = durationUnit === "hours" ? 60 : durationUnit === "days" ? 60 * 24 : 1;
        return Math.max(5, Math.round(durationValue * mult));
    }, [durationValue, durationUnit]);

    const now = Date.now();
    const activeDelegates = useMemo(() => {
        const activeSet = new Set(activeDelegateIds);
        if (activeSet.size === 0) return delegates;
        return delegates.filter((d) => activeSet.has(d.id));
    }, [delegates, activeDelegateIds]);

    // Grants actifs du délégué choisi (pour pré-remplissage + temps restant)
    const activeGrantsOfDelegate = useMemo(() => {
        if (!delegateId) return [];
        return grants.filter((g) => g.delegateId === delegateId && !g.revokedAt && (g.expiresAt ? new Date(g.expiresAt).getTime() > now : true));
    }, [delegateId, grants, now]);

    // Toutes les briques "sous-god" exploitables (union des scopes utilisables)
    const allSubgodBricks = useMemo(() => {
        const ids = new Set<string>();
        for (const s of SUBGOD_USABLE_SCOPES) {
            for (const id of SCOPE_TO_BRICKS[s] || []) ids.add(id);
        }
        return GOD_BRICKS.filter((b) => ids.has(b.id));
    }, []);

    // Pré-remplir les briques accordées au délégué
    const startEdit = () => {
        setSelectedBricks(activeGrantsOfDelegate.map((g) => g.brickId));
        setDurationValue(30);
        setDurationUnit("days");
        setReason("");
    };

    const toggleBrick = (brickId: string) => {
        setSelectedBricks((prev) => (prev.includes(brickId) ? prev.filter((b) => b !== brickId) : [...prev, brickId]));
    };

    const handleSave = async () => {
        if (!delegateId) return toast.error("Choisis le délégué");
        if (!reason.trim()) return toast.error("Justification obligatoire (auditée)");
        setLoading(true);
        const res = await syncBrickAccessForDelegate({
            delegateId,
            brickIds: selectedBricks,
            durationMinutes,
            reason: reason.trim(),
        });
        setLoading(false);
        if (!res.success) return toast.error(res.error || "Erreur lors de la synchronisation");
        toast.success(`Accès synchronisé : ${res.data?.created ?? 0} créé(s), ${res.data?.revoked ?? 0} révoqué(s), ${res.data?.kept ?? 0} conservé(s)`);
        const list = await listBrickGrants();
        if (list.success) {
            onGrantsChanged?.(list.data ?? []);
            router.refresh();
        }
    };

    return (
        <div className="rounded-3xl border border-white/5 bg-zinc-900/10 backdrop-blur-xl p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/20">
                    <Edit3 className="w-4 h-4 text-violet-300" />
                </div>
                <div>
                    <div className="text-xs font-black text-violet-300 uppercase tracking-widest">Modifier un accès existant</div>
                    <div className="text-[11px] text-zinc-500">Édition en place — sans révoquer + recréer</div>
                </div>
            </div>

            {/* Étape 1 — Délégué */}
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-2">
                    <Users className="w-4 h-4" /> Délégué (actifs uniquement)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={delegateId} onValueChange={(v) => { setDelegateId(v); setTimeout(startEdit, 0); }}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Choisir un délégué à modifier" /></SelectTrigger>
                        <SelectContent>
                            {activeDelegates.length === 0 && <div className="p-3 text-xs text-zinc-500">Aucun délégué actif.</div>}
                            {activeDelegates.map((d) => <SelectItem key={d.id} value={d.id}>{d.userName || d.userId}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {delegateId && (
                        <Button type="button" variant="outline" onClick={startEdit} className="border-white/10 bg-white/5 text-zinc-300 text-xs">
                            Recharger la sélection
                        </Button>
                    )}
                </div>
            </div>

            {/* Étape 2 — Briques (pré-cochées si accordées) */}
            {delegateId && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Briques accordées (décoche pour révoquer, coche pour accorder)</label>
                        <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">{selectedBricks.length} sélectionnée(s)</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {allSubgodBricks.map((b) => {
                            const on = selectedBricks.includes(b.id);
                            const existing = activeGrantsOfDelegate.find((g) => g.brickId === b.id);
                            const expiresIn = existing?.expiresAt ? Math.max(0, Math.floor((new Date(existing.expiresAt).getTime() - now) / 60000)) : null;
                            return (
                                <button key={b.id} type="button" onClick={() => toggleBrick(b.id)}
                                    className={cn("w-full text-left rounded-xl border px-3 py-2 transition-all", on ? "bg-emerald-500/15 border-emerald-500/40" : "bg-white/5 border-white/10 hover:bg-white/10")}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-zinc-200">{b.label}</span>
                                        <span className={cn("w-4 h-4 rounded border flex items-center justify-center text-[9px]", on ? "bg-emerald-500 border-emerald-400 text-white" : "border-white/20 text-transparent")}>✓</span>
                                    </div>
                                    {expiresIn !== null && (
                                        <div className="text-[10px] text-zinc-500 mt-1">
                                            {expiresIn === 0 ? "⚠️ Expire maintenant" : `Existant : expire dans ${expiresIn} min`}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Étape 3 — Durée + Justification */}
            {delegateId && (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-2"><Timer className="w-4 h-4" /> Durée (appliquée aux nouveaux + prolonge les conservés)</label>
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-2"><Lock className="w-4 h-4" /> Justification * (auditée)</label>
                        <Input placeholder="Pourquoi cette modification ?" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" />
                    </div>
                    <Button onClick={handleSave} disabled={loading || !delegateId} className="bg-violet-500 hover:bg-violet-400 text-white font-bold">
                        {loading ? "Synchronisation en cours..." : "Enregistrer les changements"}
                    </Button>
                </div>
            )}

            {!delegateId && (
                <div className="flex items-center gap-2 text-xs text-zinc-500"><Shield className="w-4 h-4 text-emerald-400" /> Sélectionne un délégué pour modifier ses accès en place.</div>
            )}
        </div>
    );
}