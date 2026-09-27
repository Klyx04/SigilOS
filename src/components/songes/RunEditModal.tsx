"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { SongesPicto } from "./SongesPicto";
import { SONGES_BUTTON } from "@/lib/songes/ui";
import { toLocalDateTimeInput } from "@/lib/date-utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTIES, OBJECTIVES, EPREUVES_SONGE } from "@/lib/songes/types";
import { updateDreamRun } from "@/server/actions/songes/dream-run-actions";
import type { DreamRun } from "@prisma/client";
import { toast } from "sonner";

interface RunEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildId: string;
    run: DreamRun;
}

/**
 * Chantier Songes — Modale « Modifier la Run » (leader ou admin).
 * Branchée dans RunCard (RunDetailHeader était orphelin / jamais rendu).
 */
export function RunEditModal({ isOpen, onClose, guildId, run }: RunEditModalProps) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [difficulty, setDifficulty] = useState<string>(run.difficulty);
    const [objectives, setObjectives] = useState<string[]>(
        Array.isArray(run.objectives) ? (run.objectives as string[]) : (run.objective ? [run.objective] : [])
    );
    const [epreuveCode, setEpreuveCode] = useState<string>(run.epreuveCode || "");
    // Date & heure UNIFIÉES avec le reste de l'app (sélecteur partagé), et
    // réellement OPTIONNELLES : aucune date ⇒ `null` (jamais un 21:00 inventé qui
    // laissait croire à un départ programmé). Heure locale, sans décalage UTC.
    const [scheduledAt, setScheduledAt] = useState<string>(() => toLocalDateTimeInput(run.scheduledAt));
    const [currentFloor, setCurrentFloor] = useState<string>(String(run.currentFloor));

    const toggleObjective = (key: string) => {
        setObjectives(prev => (prev.includes(key) ? prev.filter(o => o !== key) : [...prev, key]));
    };

    const handleSubmit = async () => {
        setPending(true);
        try {
            const res = await updateDreamRun(guildId, run.id, {
                difficulty: difficulty as any,
                objectives: objectives as any,
                epreuveCode: epreuveCode || null,
                // Champ vide ⇒ aucune date (null), pas une date invalide.
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                mentionRoleIds: [],
                currentFloor: currentFloor ? Math.max(0, Math.min(26, parseInt(currentFloor, 10) || 0)) : undefined,
            });
            if (res.success) {
                toast.success("Run mise à jour !");
                onClose();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        } catch (e) {
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setPending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
            <DialogContent className="bg-background border-border text-foreground sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
                        <Pencil className="w-5 h-5 text-purple-400" />
                        Modifier la Run
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-5">
                    <div className="space-y-2">
                        <label className="text-caption font-black text-muted-foreground uppercase tracking-widest">Difficulté</label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger className="w-full bg-surface border-border text-sm font-medium">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border z-[200]">
                                {Object.entries(DIFFICULTIES).map(([key, d]) => (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                            <SongesPicto asset={d.asset} size={16} title={d.label} />
                                            {d.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-black text-foreground/40 uppercase tracking-widest">Épreuve (optionnel)</label>
                        <Select value={epreuveCode} onValueChange={setEpreuveCode}>
                            <SelectTrigger className="w-full bg-surface border-border text-sm font-medium">
                                <SelectValue placeholder="Run standard" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border z-[200]">
                                <SelectItem value="">Run standard</SelectItem>
                                {EPREUVES_SONGE.map((e) => (
                                    <SelectItem key={e.code} value={e.code}>
                                        <span className="flex items-center gap-2">
                                            <SongesPicto asset={e.asset} size={16} title={e.label} />
                                            {e.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!epreuveCode && (
                            <div className="space-y-1.5">
                                <label className="text-caption font-black text-foreground/40 uppercase tracking-widest">Objectifs</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(OBJECTIVES).map(([key, obj]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => toggleObjective(key)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                                                objectives.includes(key)
                                                    ? "bg-purple-500/10 border-purple-500/40 text-foreground"
                                                    : "bg-surface border-border text-foreground/60 hover:border-border-strong"
                                            }`}
                                        >
                                            <SongesPicto asset={obj.asset} size={18} title={obj.label} />
                                            <span className="text-xs font-bold">{obj.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-black text-foreground/40 uppercase tracking-widest">
                            Date de départ <span className="normal-case font-medium">(optionnel)</span>
                        </label>
                        {/* Même sélecteur que le reste de l'app : « Sans heure » possible,
                            et aucune date = « Sans date pour l'instant » (jamais un 21:00
                            inventé qui faisait croire à un départ programmé). */}
                        <DateTimePicker
                            value={scheduledAt}
                            onChange={setScheduledAt}
                            timeOptional
                            placeholder="Sans date pour l'instant"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-caption font-black text-foreground/40 uppercase tracking-widest">Étage actuel (0-26)</label>
                        <Input
                            type="number"
                            min={0}
                            max={26}
                            value={currentFloor}
                            onChange={(e) => setCurrentFloor(e.target.value)}
                            className="bg-surface border-border text-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <Button variant="ghost" onClick={onClose} disabled={pending} className={SONGES_BUTTON.ghost}>Annuler</Button>
                    <Button onClick={handleSubmit} disabled={pending} className={SONGES_BUTTON.primary}>
                        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

