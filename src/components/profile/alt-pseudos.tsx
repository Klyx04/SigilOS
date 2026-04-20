"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2, AlertCircle, Copy, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import NextImage from "next/image";

export type Mule = {
    id?: string;
    pseudo: string;
    classe?: string;
    level?: number;
};

interface AltPseudosProps {
    altPseudos?: any[];
    onSave?: (pseudos: Mule[]) => Promise<any>;
    readOnly?: boolean;
    maxPseudos?: number;
}

export function AltPseudos({
    altPseudos = [],
    onSave,
    readOnly = false,
    maxPseudos = 10,
}: AltPseudosProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localPseudos, setLocalPseudos] = useState<Mule[]>([]);

    const [newPseudo, setNewPseudo] = useState("");
    const [newClass, setNewClass] = useState<string>("cra");
    const [newLevel, setNewLevel] = useState<string>("200");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync and normalize local state when props change
    useEffect(() => {
        const normalized = altPseudos.map(p => {
            if (typeof p === "string") {
                return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200 };
            }
            return {
                id: p.id || crypto.randomUUID(),
                pseudo: p.pseudo || "Inconnu",
                classe: p.classe || "cra",
                level: p.level !== undefined ? p.level : 200
            };
        });
        setLocalPseudos(normalized);
    }, [altPseudos]);

    const formatPseudo = (value: string) => {
        // Supprimer les chiffres et caractères spéciaux (autorise UNIQUEMENT lettres et tirets)
        const cleaned = value.replace(/[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F-]/g, "");
        if (!cleaned) return "";
        
        // Formater : 1ère lettre majuscule, reste minuscule. Si '-', 1ère lettre après '-' majuscule.
        return cleaned
            .split("-")
            .map(part => {
                if (part.length === 0) return part;
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join("-");
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewPseudo(formatPseudo(e.target.value));
    };

    const validatePseudo = (pseudo: string): { valid: boolean; error?: string } => {
        if (pseudo.length < 3) return { valid: false, error: "Minimum 3 caractères" };
        if (pseudo.length > 20) return { valid: false, error: "Maximum 20 caractères" };
        // Le pseudo est déjà formaté par formatPseudo
        return { valid: true };
    };

    const handleAddPseudo = () => {
        const trimmed = newPseudo.trim();
        if (!trimmed) return;

        if (localPseudos.length >= maxPseudos) {
            toast.error(`Maximum ${maxPseudos} personnages`);
            return;
        }

        if (localPseudos.some(p => p.pseudo.toLowerCase() === trimmed.toLowerCase())) {
            toast.error("Ce pseudo est déjà ajouté");
            return;
        }

        const validation = validatePseudo(trimmed);
        if (!validation.valid) {
            toast.error(validation.error);
            return;
        }

        let lvl = parseInt(newLevel, 10);
        if (isNaN(lvl) || lvl < 0 || lvl > 200) lvl = 200;

        setLocalPseudos(prev => [...prev, { id: crypto.randomUUID(), pseudo: trimmed, classe: newClass, level: lvl }]);
        setNewPseudo("");
        setNewLevel("200");
    };

    const handleRemovePseudo = (idToRemove: string) => {
        setLocalPseudos(prev => prev.filter(p => p.id !== idToRemove));
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const finalPseudos = [...localPseudos];

            const trimmed = newPseudo.trim();
            if (trimmed) {
                const validation = validatePseudo(trimmed);
                if (validation.valid && !localPseudos.some(p => p.pseudo.toLowerCase() === trimmed.toLowerCase()) && localPseudos.length < maxPseudos) {
                    let lvl = parseInt(newLevel, 10);
                    if (isNaN(lvl) || lvl < 0 || lvl > 200) lvl = 200;
                    finalPseudos.push({ id: crypto.randomUUID(), pseudo: trimmed, classe: newClass, level: lvl });
                    setLocalPseudos(finalPseudos);
                    setNewPseudo("");
                } else if (!validation.valid) {
                    toast.error(validation.error);
                    setIsSubmitting(false);
                    return;
                }
            }

            if (onSave) {
                await onSave(finalPseudos);
            }
            setIsEditing(false);
            toast.success("Mules mises à jour");
        } catch (error) {
            console.error("Save alt pseudos error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        // Renormalize from props
        const normalized = altPseudos.map(p => {
            if (typeof p === "string") return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200 };
            return p;
        });
        setLocalPseudos(normalized);
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
        <Card className="bg-zinc-900/40 backdrop-blur-md border-white/10 relative overflow-hidden group h-full flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-400" />
                        Mes Mules
                        {!readOnly && (
                            <span className="text-xs text-zinc-500 bg-zinc-950/50 border border-white/5 px-2 py-0.5 rounded shadow-sm">
                                {localPseudos.length}/{maxPseudos}
                            </span>
                        )}
                    </CardTitle>
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                            className={cn(
                                "h-8 px-3 text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg rounded-xl",
                                isEditing
                                    ? "bg-zinc-800 text-zinc-200 border-white/10 hover:bg-zinc-700"
                                    : "bg-indigo-500/5 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500 hover:text-white"
                            )}
                        >
                            {isEditing ? <X className="w-3 h-3 mr-2" /> : <Edit2 className="w-3 h-3 mr-2" strokeWidth={2.5} />}
                            {isEditing ? "Annuler" : "Gérer les Mules"}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-6 relative flex-1">
                {/* Bento Grid layout for Mules */}
                {localPseudos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {localPseudos.map((mule) => {
                            const cls = getClass(mule.classe || "cra") || DOFUS_CLASSES[0];
                            return (
                                <div
                                    key={mule.id}
                                    className="relative flex flex-col justify-between p-4 rounded-2xl bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all group/item overflow-hidden"
                                >
                                    {/* Background glow matching class color */}
                                    <div
                                        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20"
                                        style={{ backgroundColor: cls.color }}
                                    />

                                    <div className="flex items-start justify-between z-10 w-full overflow-hidden gap-2">
                                        <div className="flex items-center gap-3 w-full min-w-0">
                                            <div className="w-11 h-11 rounded-[10px] bg-black/40 border border-[currentColor]/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner" style={{ color: cls.color }}>
                                                <NextImage
                                                    src={cls.icon}
                                                    alt={cls.name}
                                                    width={32}
                                                    height={32}
                                                    className="object-contain scale-[1.15]"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="flex flex-col min-w-0 w-full overflow-hidden">
                                                <span className="font-semibold text-zinc-100 truncate w-full" title={mule.pseudo}>
                                                    {mule.pseudo}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium flex items-center gap-1 mt-0.5" style={{ color: cls.color }}>
                                                    Nv. {mule.level !== undefined ? mule.level : 200}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 items-end shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`/w ${mule.pseudo} `);
                                                    toast.success("Commande copiée !", { description: `/w ${mule.pseudo}` });
                                                }}
                                                className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10 transition-all bg-black/20 rounded-md"
                                                title="Copier /w"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>

                                            {isEditing && (
                                                <button
                                                    onClick={() => handleRemovePseudo(mule.id!)}
                                                    className="h-7 w-7 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500/80 rounded-md transition-all bg-red-500/10"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-sm text-zinc-500 italic py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center bg-zinc-950/20 gap-3">
                        <Users className="w-8 h-8 text-zinc-700" />
                        Aucune mule enregistrée
                    </div>
                )}

                {/* Edit Mode Inputs */}
                {isEditing && (
                    <div className="p-4 sm:p-5 bg-zinc-950/60 border border-white/10 rounded-2xl animate-in fade-in duration-200">
                        <h4 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            Ajouter un personnage
                        </h4>

                        {localPseudos.length < maxPseudos ? (
                            <div className="flex flex-col gap-4">
                                <div className="grid gap-2 w-full">
                                    <label className="text-xs text-zinc-400 font-medium ml-1">Sélectionner une classe</label>
                                    <div className="flex bg-zinc-950/40 p-2 rounded-xl border border-white/5 overflow-x-auto gap-2 custom-scrollbar pb-3 snap-x">
                                        {DOFUS_CLASSES.map((cls) => (
                                            <button
                                                key={cls.id}
                                                type="button"
                                                onClick={() => setNewClass(cls.id)}
                                                className={cn(
                                                    "h-12 w-12 rounded-xl shrink-0 flex items-center justify-center transition-all border snap-center",
                                                    newClass === cls.id
                                                        ? "bg-zinc-800/80 border-white/20 scale-105 z-10"
                                                        : "bg-black/20 border-white/5 opacity-50 hover:opacity-100 hover:bg-zinc-800/50"
                                                )}
                                                style={{
                                                    boxShadow: newClass === cls.id ? `0 0 15px ${cls.color}30, inset 0 0 0 1px ${cls.color}50` : 'none'
                                                }}
                                                title={cls.name}
                                            >
                                                <NextImage
                                                    src={cls.icon}
                                                    alt={cls.name}
                                                    width={28}
                                                    height={28}
                                                    className="object-contain drop-shadow-md"
                                                    unoptimized
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-end">

                                    <div className="grid gap-1.5 flex-[2] w-full relative">
                                        <label className="text-xs text-zinc-400 font-medium ml-1">Pseudo</label>
                                        <Input
                                            value={newPseudo}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ex: Darksasuke"
                                            className="bg-zinc-900/80 border-white/10 h-10 pl-10 focus-visible:ring-emerald-500/50"
                                            maxLength={20}
                                        />
                                        <div className="absolute left-3 top-[34px] text-zinc-500 text-sm font-mono pointer-events-none">
                                            /w
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5 w-full sm:w-24">
                                        <label className="text-xs text-zinc-400 font-medium ml-1">Niveau</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={200}
                                            value={newLevel}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") { setNewLevel(""); return; }
                                                const num = parseInt(val, 10);
                                                if (!isNaN(num)) {
                                                    if (num > 200) setNewLevel("200");
                                                    else if (num < 0) setNewLevel("0");
                                                    else setNewLevel(num.toString());
                                                }
                                            }}
                                            onKeyDown={handleKeyDown}
                                            placeholder="200"
                                            className="bg-zinc-900/80 border-white/10 h-10 focus-visible:ring-emerald-500/50"
                                        />
                                    </div>

                                    <Button
                                        variant="sigil-emerald"
                                        onClick={handleAddPseudo}
                                        disabled={!newPseudo.trim()}
                                        className="h-10 px-6 w-full sm:w-auto"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Ajouter
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-amber-500/90 flex items-center gap-2 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                <AlertCircle className="w-4 h-4" />
                                Limite de {maxPseudos} personnages atteinte.
                            </p>
                        )}

                        <div className="flex justify-end pt-4 mt-5 border-t border-white/5">
                            <Button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                variant="sigil"
                                className="h-10 px-8 w-full sm:w-auto"
                            >
                                {isSubmitting ? (
                                    <Save className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                {isSubmitting ? "Enregistrement..." : "Enregistrer les Mules"}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
