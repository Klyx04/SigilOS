"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createDreamRun } from "@/server/actions/songes/dream-run-actions";
import { DIFFICULTIES, OBJECTIVES, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
import { useRouter } from "next/navigation";

export function CreateRunButton({ guildId }: { guildId: string }) {
    const [open, setOpen] = useState(false);
    const [difficulty, setDifficulty] = useState<DifficultyKey>("REVE_III");
    // Change to array
    const [objectives, setObjectives] = useState<ObjectiveKey[]>([]);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleCreate = () => {
        if (objectives.length === 0) {
            setError("Veuillez sélectionner au moins un objectif.");
            return;
        }
        setError(null);

        startTransition(async () => {
            // Send array to server action
            const result = await createDreamRun(guildId, { difficulty, objectives });

            if (result.success) {
                setOpen(false);
                setObjectives([]); // Reset
                router.refresh();
            } else {
                setError(result.error || "Erreur inconnue");
            }
        });
    };

    const toggleObjective = (obj: ObjectiveKey) => {
        setObjectives(prev =>
            prev.includes(obj)
                ? prev.filter(o => o !== obj)
                : [...prev, obj]
        );
    };

    const isParadoxeOrMore = difficulty.startsWith("PARADOXE") || difficulty.startsWith("CAUCHEMAR");

    // Filter objectives based on difficulty
    const availableObjectives = Object.entries(OBJECTIVES).filter(([key]) => {
        if (key === "FUN") return false; // Hide FUN as requested
        if (key === "DROP_LEGENDE" || key === "SUCCES_NO_ACHAT") {
            return isParadoxeOrMore;
        }
        return true;
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-500 text-white gap-2">
                    <Plus className="w-4 h-4" />
                    Créer une Run
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        🌙 Nouvelle Run Songes
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {/* Difficulty */}
                    <div className="space-y-2">
                        <Label className="text-purple-200">Difficulté</Label>
                        <Select value={difficulty} onValueChange={(v) => {
                            setDifficulty(v as DifficultyKey);
                            // Clear restricted objectives if difficulty drops below Paradoxe
                            const isNewParadoxe = v.startsWith("PARADOXE") || v.startsWith("CAUCHEMAR");
                            if (!isNewParadoxe) {
                                setObjectives(prev => prev.filter(o => o !== "DROP_LEGENDE" && o !== "SUCCES_NO_ACHAT"));
                            }
                        }}>
                            <SelectTrigger className="bg-purple-900/30 border-purple-500/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                {Object.entries(DIFFICULTIES).map(([key, value]) => (
                                    <SelectItem
                                        key={key}
                                        value={key}
                                        className="text-white focus:bg-purple-700/50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: value.couleur }}
                                            />
                                            {value.label}
                                            <span className="text-white/50 text-xs">
                                                ({value.xpBonus}% XP/Butin)
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Objective */}
                    <div className="space-y-2">
                        <Label className="text-purple-200">Objectifs (Choix multiple)</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {availableObjectives.map(([key, value]) => {
                                const isSelected = objectives.includes(key as ObjectiveKey);
                                return (
                                    <div
                                        key={key}
                                        onClick={() => toggleObjective(key as ObjectiveKey)}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                            ${isSelected
                                                ? "bg-purple-600/30 border-purple-500 text-purple-100"
                                                : "bg-purple-900/20 border-purple-500/20 text-purple-400 hover:bg-purple-900/40"
                                            }
                                        `}
                                    >
                                        <div className="text-lg">{value.icon}</div>
                                        <div className="text-sm font-medium">{value.label}</div>
                                        {isSelected && (
                                            <div className="ml-auto w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        onClick={handleCreate}
                        disabled={isPending}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Création...
                            </>
                        ) : (
                            "Créer la Run"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
