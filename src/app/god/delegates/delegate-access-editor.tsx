"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOD_BRICKS } from "@/lib/god-bricks";
import { SCOPE_TO_BRICKS, SUBGOD_USABLE_SCOPES } from "@/lib/god-scopes";
import { syncBrickAccessForDelegate, listBrickGrants } from "@/server/actions/god-delegate-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";
import type { BrickGrantView } from "./types";

interface DelegateAccessEditorProps {
    delegateId: string;
    delegateName: string | null;
    /** Grants ACTIFS de ce délégué (pour pré-remplir les briques cochées). */
    activeGrants: BrickGrantView[];
    onClose: () => void;
    /** Remonte la liste de grants rafraîchie après une sauvegarde. */
    onGrantsChanged?: (grants: BrickGrantView[]) => void;
}

/**
 * Éditeur d'accès d'un délégué, affiché INLINE dans sa carte.
 * Coche des briques (pré-remplies depuis ses grants actifs) + durée + justification.
 * syncBrickAccessForDelegate = diff atomique (crée / révoque / prolonge).
 */
export function DelegateAccessEditor({ delegateId, delegateName, activeGrants, onClose, onGrantsChanged }: DelegateAccessEditorProps) {
    const router = useRouter();
    const [selectedBricks, setSelectedBricks] = useState<string[]>(activeGrants.map(g => g.brickId));
    const [durationValue, setDurationValue] = useState<number>(30);
    const [durationUnit, setDurationUnit] = useState<"minutes" | "hours" | "days">("days");
    const [reason, setReason] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const durationMinutes = useMemo(() => {
        const mult = durationUnit === "hours" ? 60 : durationUnit === "days" ? 60 * 24 : 1;
        return Math.max(5, Math.round(durationValue * mult));
    }, [durationValue, durationUnit]);

    // Toutes les briques "sous-god" exploitables (union des scopes utilisables)
    const allSubgodBricks = useMemo(() => {
        const ids = new Set<string>();
        for (const s of SUBGOD_USABLE_SCOPES) {
            for (const id of SCOPE_TO_BRICKS[s] || []) ids.add(id);
        }
        return GOD_BRICKS.filter((b) => ids.has(b.id));
    }, []);

    const toggleBrick = (brickId: string) => {
        setSelectedBricks((prev) => (prev.includes(brickId) ? prev.filter((b) => b !== brickId) : [...prev, brickId]));
    };

    const handleSave = async () => {
        setLoading(true);
        const res = await syncBrickAccessForDelegate({ delegateId, brickIds: selectedBricks, durationMinutes, reason: reason.trim() });
        setLoading(false);
        if (!res.success) return toast.error(res.error || "Erreur lors de la mise à jour");
        toast.success(`Accès mis à jour : ${res.data?.created ?? 0} créé(s), ${res.data?.revoked ?? 0} révoqué(s)`);
        const list = await listBrickGrants();
        if (list.success) onGrantsChanged?.(list.data ?? []);
        onClose();
        router.refresh();
    };

    return (
        <div className="space-y-4">

            <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Briques (coche celles à accorder)</div>
                <div className="grid grid-cols-1 gap-1.5">
                    {allSubgodBricks.map((b) => {
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
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-1.5">
                    <Timer className="w-3 h-3" /> Durée (min 5, max 90 jours)
                </label>
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

            <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading} className="border-white/10 bg-white/5 text-zinc-300">Annuler</Button>
                <Button onClick={handleSave} disabled={loading} className="bg-violet-500 hover:bg-violet-400 text-white font-bold">
                    {loading ? "Enregistrement..." : "Enregistrer"}
                </Button>
            </div>
        </div>
    );
}

