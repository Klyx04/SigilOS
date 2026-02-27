"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2, AlertCircle, Copy } from "lucide-react";
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

    // Sync local state when props change
    useEffect(() => {
        setLocalPseudos(altPseudos);
    }, [altPseudos]);

    // Format: First letter cap, rest lowercase/alphanumeric, optional hyphen
    const formatPseudo = (value: string) => {
        // Remove characters that aren't letters, numbers, or hyphens
        const cleaned = value.replace(/[^a-zA-Z0-9-]/g, "");

        // Ensure only one hyphen max (optional, Dofus rule is looser but good for clean data)
        // cleaned = cleaned.replace(/-+/g, "-"); 

        if (cleaned.length > 0) {
            // Capitalize first letter
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        return cleaned;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPseudo(e.target.value);
        setNewPseudo(formatted);
    };

    const validatePseudo = (pseudo: string): { valid: boolean; error?: string } => {
        if (pseudo.length < 3) return { valid: false, error: "Minimum 3 caractères" };
        if (pseudo.length > 20) return { valid: false, error: "Maximum 20 caractères" };

        // Dofus pattern: Starts with letter, alphanumeric, one dash allowed inside
        const regex = /^[A-Z][a-z0-9]*(-[A-Z][a-z0-9]*)?$/;
        if (!regex.test(pseudo)) {
            return { valid: false, error: "Format invalide (Ex: Pseudo, Pseudo-Surnom)" };
        }
        return { valid: true };
    };

    const handleAddPseudo = () => {
        const trimmed = newPseudo.trim();
        if (!trimmed) return;

        if (localPseudos.length >= maxPseudos) {
            toast.error(`Maximum ${maxPseudos} personnages`);
            return;
        }

        if (localPseudos.includes(trimmed)) {
            toast.error("Ce pseudo est déjà ajouté");
            return;
        }

        const validation = validatePseudo(trimmed);
        if (!validation.valid) {
            toast.error(validation.error);
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
        toast.success("Personnages sauvegardés");
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
        <Card className="bg-black/20 backdrop-blur-md border-white/10 relative overflow-hidden group">
            {/* Subtle Glow to match other components */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Pseudo Mules
                        <span className="text-xs text-zinc-500 bg-zinc-900 border border-white/5 px-1.5 py-0.5 rounded shadow-sm">
                            {localPseudos.length}/{maxPseudos}
                        </span>
                    </CardTitle>
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                            className="h-6 px-2 text-xs hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            {isEditing ? <X className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3 relative">
                {/* Pseudos List */}
                {localPseudos.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {localPseudos.map((pseudo, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-lg transition-all",
                                    "bg-zinc-950/30 border border-white/5",
                                    "hover:bg-zinc-950/50 hover:border-white/10 group/item"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center border border-white/5 text-zinc-500 font-mono text-xs select-none">
                                        /w
                                    </div>
                                    <span className="text-sm font-medium text-zinc-200">{pseudo}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`/w ${pseudo} `);
                                            toast.success("Commande copiée !", { description: `/w ${pseudo}` });
                                        }}
                                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/10 opacity-0 group-hover/item:opacity-100 transition-all"
                                        title="Copier /w"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </Button>

                                    {isEditing && (
                                        <button
                                            onClick={() => handleRemovePseudo(index)}
                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                            title="Supprimer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-zinc-500 italic py-2 px-1 border border-dashed border-white/5 rounded flex items-center justify-center bg-zinc-900/30">
                        Aucun personnage secondaire enregistré.
                    </div>
                )}

                {/* Edit Mode Inputs */}
                {isEditing && (
                    <div className="space-y-3 pt-4 border-t border-white/5 animate-in fade-in duration-200">
                        {localPseudos.length < maxPseudos ? (
                            <div className="flex gap-2 relative">
                                <Input
                                    value={newPseudo}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Nom du personnage..."
                                    className="flex-1 bg-zinc-950/50 border-white/10 h-10 text-sm pl-9 focus-visible:ring-primary/50 focus-visible:border-primary/50"
                                    maxLength={20}
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono select-none pointer-events-none">
                                    /w
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleAddPseudo}
                                    disabled={!newPseudo.trim()}
                                    className="h-9 px-3 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/5"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs text-amber-500/90 flex items-center gap-2 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Limite de {maxPseudos} personnages atteinte.
                            </p>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button
                                size="sm"
                                variant="default"
                                onClick={handleSave}
                                className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                            >
                                <Save className="w-3.5 h-3.5 mr-2" />
                                Enregistrer les changements
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
