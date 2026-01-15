"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface AltPseudosProps {
    altPseudos?: string[];
    onSave?: (pseudos: string[]) => void;
    readOnly?: boolean;
    maxPseudos?: number;
}

export function AltPseudos({
    altPseudos = [],
    onSave,
    readOnly = false,
    maxPseudos = 5,
}: AltPseudosProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localPseudos, setLocalPseudos] = useState<string[]>(altPseudos);
    const [newPseudo, setNewPseudo] = useState("");

    // Sync local state when props change (after save)
    useEffect(() => {
        setLocalPseudos(altPseudos);
    }, [altPseudos]);

    const handleAddPseudo = () => {
        const trimmed = newPseudo.trim();
        if (!trimmed) return;

        if (localPseudos.length >= maxPseudos) {
            toast.error(`Maximum ${maxPseudos} personnages`);
            return;
        }

        if (localPseudos.includes(trimmed)) {
            toast.error("Ce pseudo existe déjà");
            return;
        }

        setLocalPseudos(prev => [...prev, trimmed]);
        setNewPseudo("");
    };

    const handleRemovePseudo = (index: number) => {
        setLocalPseudos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave?.(localPseudos);
        setIsEditing(false);
        toast.success("Personnages alternatifs mis à jour");
    };

    const handleCancel = () => {
        setLocalPseudos(altPseudos);
        setIsEditing(false);
        setNewPseudo("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddPseudo();
        }
    };

    return (
        <Card className="bg-zinc-900/60 border-white/5">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Autres Personnages
                        <span className="text-xs text-zinc-600">
                            ({localPseudos.length}/{maxPseudos})
                        </span>
                    </CardTitle>
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                            className="h-8 px-3 text-xs"
                        >
                            {isEditing ? (
                                <>
                                    <X className="w-3 h-3 mr-1" />
                                    Annuler
                                </>
                            ) : (
                                <>
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    Modifier
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pseudos List */}
                {localPseudos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {localPseudos.map((pseudo, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                                    "bg-zinc-800/50 border border-white/5",
                                    "text-sm text-zinc-300"
                                )}
                            >
                                <span>{pseudo}</span>
                                {isEditing && (
                                    <button
                                        onClick={() => handleRemovePseudo(index)}
                                        className="text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-600 italic">
                        Aucun personnage alternatif enregistré
                    </p>
                )}

                {/* Add New Pseudo (when editing) */}
                {isEditing && localPseudos.length < maxPseudos && (
                    <div className="flex gap-2">
                        <Input
                            value={newPseudo}
                            onChange={(e) => setNewPseudo(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ajouter un pseudo..."
                            className="flex-1 bg-zinc-800/50 border-white/10 h-9"
                            maxLength={24}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddPseudo}
                            disabled={!newPseudo.trim()}
                            className="h-9 px-3 border-white/10"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* Save Button (when editing) */}
                {isEditing && (
                    <Button
                        onClick={handleSave}
                        className="w-full bg-primary/20 hover:bg-primary/30 text-primary"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer
                    </Button>
                )}

                {/* Helper text */}
                {!isEditing && !readOnly && (
                    <p className="text-xs text-zinc-600">
                        Ajoutez vos autres personnages in-game pour faciliter les échanges.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
