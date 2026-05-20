"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2, AlertCircle, Copy, Shield, Trash2, Check, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { DOFUS_CLASSES, getClass, ALIGNMENTS, ORDERS, getAlignment, getOrder } from "@/lib/dofus-assets";
import NextImage from "next/image";

export type Mule = {
    id?: string;
    pseudo: string;
    classe?: string;
    level?: number;
    alignment?: string | null;
    alignmentOrder?: string | null;
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

    // Form inputs state
    const [newPseudo, setNewPseudo] = useState("");
    const [newClass, setNewClass] = useState<string>("cra");
    const [newLevel, setNewLevel] = useState<string>("200");
    const [newAlignment, setNewAlignment] = useState<string>("neutre");
    const [newOrder, setNewOrder] = useState<string | null>(null);

    // Edit tracking state
    const [editingMuleId, setEditingMuleId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reference to form element to scroll to it nicely on edit trigger
    const formRef = useRef<HTMLDivElement>(null);

    // Sync and normalize local state when props change
    useEffect(() => {
        const normalized = altPseudos.map(p => {
            if (typeof p === "string") {
                return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200, alignment: "neutre", alignmentOrder: null };
            }
            return {
                id: p.id || crypto.randomUUID(),
                pseudo: p.pseudo || "Inconnu",
                classe: p.classe || "cra",
                level: p.level !== undefined ? p.level : 200,
                alignment: p.alignment || "neutre",
                alignmentOrder: p.alignmentOrder || null
            };
        });
        setLocalPseudos(normalized);
    }, [altPseudos]);

    const formatPseudo = (value: string) => {
        const cleaned = value.replace(/[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F-]/g, "");
        if (!cleaned) return "";
        
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
        return { valid: true };
    };

    // Load mule data into the form for direct modification
    const handleStartEditMule = (mule: Mule) => {
        setEditingMuleId(mule.id || null);
        setNewPseudo(mule.pseudo);
        setNewClass(mule.classe || "cra");
        setNewLevel(mule.level?.toString() || "200");
        setNewAlignment(mule.alignment || "neutre");
        setNewOrder(mule.alignmentOrder || null);

        // Smooth scroll to form
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);

        toast.info(`Modification de ${mule.pseudo} chargée dans le formulaire ci-dessous`);
    };

    // Reset/Cancel form inputs back to default "Add" mode
    const handleCancelFormEdit = () => {
        setEditingMuleId(null);
        setNewPseudo("");
        setNewClass("cra");
        setNewLevel("200");
        setNewAlignment("neutre");
        setNewOrder(null);
    };

    const handleAddOrUpdatePseudo = () => {
        const trimmed = newPseudo.trim();
        if (!trimmed) return;

        const validation = validatePseudo(trimmed);
        if (!validation.valid) {
            toast.error(validation.error);
            return;
        }

        let lvl = parseInt(newLevel, 10);
        if (isNaN(lvl) || lvl < 0 || lvl > 200) lvl = 200;

        if (editingMuleId) {
            // Update existing mule
            setLocalPseudos(prev => prev.map(p => {
                if (p.id === editingMuleId) {
                    return {
                        ...p,
                        pseudo: trimmed,
                        classe: newClass,
                        level: lvl,
                        alignment: newAlignment,
                        alignmentOrder: newAlignment === "neutre" ? null : newOrder
                    };
                }
                return p;
            }));
            toast.success(`Personnage ${trimmed} mis à jour localement`);
            handleCancelFormEdit();
        } else {
            // Add new mule
            if (localPseudos.length >= maxPseudos) {
                toast.error(`Maximum ${maxPseudos} personnages`);
                return;
            }

            if (localPseudos.some(p => p.pseudo.toLowerCase() === trimmed.toLowerCase())) {
                toast.error("Ce pseudo est déjà ajouté");
                return;
            }

            setLocalPseudos(prev => [...prev, { 
                id: crypto.randomUUID(), 
                pseudo: trimmed, 
                classe: newClass, 
                level: lvl,
                alignment: newAlignment,
                alignmentOrder: newAlignment === "neutre" ? null : newOrder
            }]);
            toast.success(`Personnage ${trimmed} ajouté localement`);
            handleCancelFormEdit();
        }
    };

    const handleRemovePseudo = (idToRemove: string) => {
        setLocalPseudos(prev => prev.filter(p => p.id !== idToRemove));
        if (editingMuleId === idToRemove) {
            handleCancelFormEdit();
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const finalPseudos = [...localPseudos];

            // If there's content left in the input, auto-commit it first if valid
            const trimmed = newPseudo.trim();
            if (trimmed && !editingMuleId) {
                const validation = validatePseudo(trimmed);
                if (validation.valid && !localPseudos.some(p => p.pseudo.toLowerCase() === trimmed.toLowerCase()) && localPseudos.length < maxPseudos) {
                    let lvl = parseInt(newLevel, 10);
                    if (isNaN(lvl) || lvl < 0 || lvl > 200) lvl = 200;
                    finalPseudos.push({ 
                        id: crypto.randomUUID(), 
                        pseudo: trimmed, 
                        classe: newClass, 
                        level: lvl,
                        alignment: newAlignment,
                        alignmentOrder: newAlignment === "neutre" ? null : newOrder
                    });
                    setLocalPseudos(finalPseudos);
                    handleCancelFormEdit();
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
            toast.success("Mules sauvegardées avec succès");
        } catch (error) {
            console.error("Save alt pseudos error:", error);
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        const normalized = altPseudos.map(p => {
            if (typeof p === "string") return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200, alignment: "neutre", alignmentOrder: null };
            return {
                id: p.id || crypto.randomUUID(),
                pseudo: p.pseudo || "Inconnu",
                classe: p.classe || "cra",
                level: p.level !== undefined ? p.level : 200,
                alignment: p.alignment || "neutre",
                alignmentOrder: p.alignmentOrder || null
            };
        });
        setLocalPseudos(normalized);
        setIsEditing(false);
        handleCancelFormEdit();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddOrUpdatePseudo();
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
                            <span className="text-xs text-zinc-500 bg-zinc-950/50 border border-white/5 px-2 py-0.5 rounded shadow-sm font-bold">
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
                {localPseudos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {localPseudos.map((mule) => {
                            const cls = getClass(mule.classe || "cra") || DOFUS_CLASSES[0];
                            const alignData = mule.alignment ? getAlignment(mule.alignment) : null;
                            const orderData = mule.alignment && mule.alignmentOrder ? getOrder(mule.alignment, mule.alignmentOrder) : null;

                            return (
                                <div
                                    key={mule.id}
                                    className={cn(
                                        "relative flex flex-col justify-between p-4 rounded-2xl bg-zinc-950/40 border transition-all group/item overflow-hidden",
                                        editingMuleId === mule.id 
                                            ? "border-indigo-500/40 bg-indigo-950/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                                            : "border-white/5 hover:border-white/10"
                                    )}
                                >
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

                                                {/* Alignment & Order Indicator */}
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {alignData && alignData.id !== "neutre" && (
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 bg-black/50 border rounded-md px-2 py-0.5 max-w-full",
                                                            alignData.id === "bontarien" ? "border-blue-500/20" : "border-red-500/20"
                                                        )}>
                                                            <div className="relative w-5 h-5 shrink-0 rounded-full overflow-hidden border border-white/10">
                                                                <NextImage src={alignData.icon} alt={alignData.name} fill className="object-cover scale-[1.2]" unoptimized />
                                                            </div>
                                                            <span className={cn(
                                                                "text-[9px] font-bold truncate uppercase tracking-widest",
                                                                alignData.id === "bontarien" ? "text-blue-400" : "text-red-400"
                                                            )}>
                                                                {alignData.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {orderData && (
                                                        <div className="flex items-center gap-1.5 bg-black/50 border border-amber-500/20 rounded-md px-2 py-0.5 max-w-full">
                                                            <div className="relative w-5 h-5 shrink-0 bg-black/40 rounded-md border border-white/5 p-0.5 flex items-center justify-center">
                                                                <NextImage 
                                                                    src={orderData.icon} 
                                                                    alt={orderData.name} 
                                                                    fill 
                                                                    className="object-contain"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                            <span className="text-[9px] font-bold text-amber-400 truncate uppercase tracking-widest" title={orderData.name}>
                                                                {orderData.name.replace("Ordre de l'", "").replace("Ordre du ", "")}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
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
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleStartEditMule(mule)}
                                                        className={cn(
                                                            "h-7 w-7 transition-all bg-black/20 rounded-md border",
                                                            editingMuleId === mule.id
                                                                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                                                                : "border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                                                        )}
                                                        title="Modifier les détails / alignement"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <button
                                                        onClick={() => handleRemovePseudo(mule.id!)}
                                                        className="h-7 w-7 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500/80 rounded-md transition-all bg-red-500/10"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
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

                {/* Edit Mode Panel (Addition & Modification Form) */}
                {isEditing && (
                    <div ref={formRef} className="p-4 sm:p-5 bg-zinc-950/60 border border-white/10 rounded-2xl animate-in fade-in duration-200 space-y-5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wide">
                                {editingMuleId ? (
                                    <>
                                        <Edit2 className="w-4 h-4 text-indigo-400" />
                                        Modifier le personnage : <span className="text-indigo-400 italic font-black">{newPseudo}</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 text-emerald-400" />
                                        Ajouter un personnage
                                    </>
                                )}
                            </h4>
                            {editingMuleId && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleCancelFormEdit}
                                    className="h-6 px-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 rounded-md"
                                >
                                    Mode Ajout
                                </Button>
                            )}
                        </div>

                        {localPseudos.length < maxPseudos || editingMuleId ? (
                            <div className="flex flex-col gap-5">
                                {/* 1. Class Selection Grid */}
                                <div className="grid gap-2 w-full">
                                    <label className="text-[11px] text-zinc-400 font-black uppercase tracking-wider ml-1">Sélectionner une classe</label>
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
                                                    className="object-contain drop-shadow-md animate-in fade-in"
                                                    unoptimized
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Pseudo & Level Fields */}
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                    <div className="grid gap-1.5 flex-[2] w-full relative">
                                        <label className="text-[11px] text-zinc-400 font-black uppercase tracking-wider ml-1">Pseudo</label>
                                        <Input
                                            value={newPseudo}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ex: Darksasuke"
                                            className="bg-zinc-900/80 border-white/10 h-10 pl-10 focus-visible:ring-indigo-500/50 font-medium"
                                            maxLength={20}
                                        />
                                        <div className="absolute left-3 top-[32px] text-zinc-500 text-sm font-mono pointer-events-none">
                                            /w
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5 w-full sm:w-28">
                                        <label className="text-[11px] text-zinc-400 font-black uppercase tracking-wider ml-1">Niveau</label>
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
                                            className="bg-zinc-900/80 border-white/10 h-10 focus-visible:ring-indigo-500/50 font-mono text-center font-bold"
                                        />
                                    </div>
                                </div>

                                {/* 3. Optional Alignment & Order Selection */}
                                <div className="grid gap-4 bg-zinc-950/45 p-4 rounded-xl border border-white/5">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                            <label className="text-[11px] text-zinc-300 font-black uppercase tracking-wider">Alignement (Optionnel)</label>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2">
                                            {ALIGNMENTS.map((align) => {
                                                const isSel = newAlignment === align.id;
                                                return (
                                                    <button
                                                        key={align.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewAlignment(align.id);
                                                            if (align.id === "neutre") {
                                                                setNewOrder(null);
                                                            } else {
                                                                const available = (ORDERS as any)[align.id];
                                                                if (available && available.length > 0) {
                                                                    setNewOrder(available[0].id);
                                                                }
                                                            }
                                                        }}
                                                        className={cn(
                                                            "h-12 px-4 rounded-xl flex items-center gap-3 transition-all border text-xs font-bold uppercase tracking-wider relative overflow-hidden",
                                                            isSel 
                                                                ? align.id === "bontarien" ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-black shadow-[0_0_12px_rgba(59,130,246,0.15)]" :
                                                                  align.id === "brakmarien" ? "bg-red-500/10 border-red-500/40 text-red-400 font-black shadow-[0_0_12px_rgba(239,68,68,0.15)]" :
                                                                  "bg-zinc-800 border-white/20 text-white shadow-[0_0_12px_rgba(255,255,255,0.05)]"
                                                                : "bg-black/20 border-white/5 text-zinc-500 hover:text-zinc-300"
                                                        )}
                                                    >
                                                        <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 border border-white/10 shadow-md">
                                                            <NextImage src={align.icon} alt={align.name} fill className="object-cover scale-[1.25]" unoptimized />
                                                        </div>
                                                        {align.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Dependent Order Specialization List */}
                                    {newAlignment !== "neutre" && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                <label className="text-[11px] text-zinc-300 font-black uppercase tracking-wider">Ordre / Spécialisation</label>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                {(ORDERS as any)[newAlignment].map((order: any) => {
                                                    const isSel = newOrder === order.id;
                                                    return (
                                                        <button
                                                            key={order.id}
                                                            type="button"
                                                            onClick={() => setNewOrder(order.id)}
                                                            className={cn(
                                                                "h-14 px-4 rounded-xl flex items-center gap-3 transition-all border text-left text-[11px] font-black uppercase tracking-widest relative overflow-hidden",
                                                                isSel
                                                                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                                                                    : "bg-black/20 border-white/5 text-zinc-500 hover:text-zinc-300"
                                                            )}
                                                        >
                                                            <div className="relative w-9 h-9 shrink-0 bg-black/60 rounded-lg border border-white/10 flex items-center justify-center p-1 overflow-hidden shadow-inner">
                                                                <NextImage src={order.icon} alt={order.name} fill className="object-contain p-0.5" unoptimized />
                                                            </div>
                                                            <span className="truncate max-w-[140px]" title={order.name}>
                                                                {order.name.replace("Ordre de l'", "").replace("Ordre du ", "")}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Form Submission Action Row */}
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button
                                        variant="sigil-emerald"
                                        onClick={handleAddOrUpdatePseudo}
                                        disabled={!newPseudo.trim()}
                                        className="h-10 px-6 w-full sm:w-auto font-black uppercase tracking-widest text-[10px]"
                                    >
                                        {editingMuleId ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" /> Valider les Modifs
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4 mr-2" /> Ajouter
                                            </>
                                        )}
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
