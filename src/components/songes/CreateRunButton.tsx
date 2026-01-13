"use client";

import { useState } from "react";
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

export function CreateRunButton() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [difficulty, setDifficulty] = useState<DifficultyKey>("REVE_III");
    const [objective, setObjective] = useState<ObjectiveKey>("FUN");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleCreate = async () => {
        setLoading(true);
        setError(null);

        const result = await createDreamRun({ difficulty, objective });

        if (result.success) {
            setOpen(false);
            router.refresh();
        } else {
            setError(result.error || "Erreur inconnue");
        }

        setLoading(false);
    };

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
                        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyKey)}>
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
                        <Label className="text-purple-200">Objectif</Label>
                        <Select value={objective} onValueChange={(v) => setObjective(v as ObjectiveKey)}>
                            <SelectTrigger className="bg-purple-900/30 border-purple-500/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a0933] border-purple-500/30">
                                {Object.entries(OBJECTIVES).map(([key, value]) => (
                                    <SelectItem
                                        key={key}
                                        value={key}
                                        className="text-white focus:bg-purple-700/50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{value.icon}</span>
                                            {value.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                    >
                        {loading ? (
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
