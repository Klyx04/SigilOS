"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2, AlertCircle, Copy, Shield, Trash2, Check, Sparkles, Info, Search, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { DOFUS_CLASSES, getClass, ALIGNMENTS, ORDERS, getAlignment, getOrder, getAlignmentLevelSteps } from "@/lib/dofus-assets";
import NextImage from "next/image";
import { verifyDofusPseudo, isLadderManualFallbackEnabled } from "@/server/actions/profile-actions";

export type Mule = {
    id?: string;
    pseudo: string;
    classe?: string;
    level?: number;
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number;
};

interface AltPseudosProps {
    altPseudos?: any[];
    onSave?: (pseudos: Mule[]) => Promise<any>;
    readOnly?: boolean;
    maxPseudos?: number;
    guildId?: string;
}

export function AltPseudos({
    altPseudos = [],
    onSave,
    readOnly = false,
    maxPseudos = 10,
    guildId,
}: AltPseudosProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localPseudos, setLocalPseudos] = useState<Mule[]>([]);

    // Form inputs state
    const [newPseudo, setNewPseudo] = useState("");
    const [newClass, setNewClass] = useState<string>("cra");
    const [newLevel, setNewLevel] = useState<string>("200");
    const [newAlignment, setNewAlignment] = useState<string>("neutre");
    const [newOrder, setNewOrder] = useState<string | null>(null);
    const [newAlignmentLevel, setNewAlignmentLevel] = useState<number>(0);

    // Vérification du pseudo (loupe) + fallback God : même logique que l'identité.
    const [newPseudoVerified, setNewPseudoVerified] = useState(false);
    const [isVerifyingMule, setIsVerifyingMule] = useState(false);
    const [manualFallback, setManualFallback] = useState(false);

    useEffect(() => {
        let active = true;
        isLadderManualFallbackEnabled().then((enabled) => {
            if (active) setManualFallback(enabled);
        });
        return () => { active = false; };
    }, []);

    // Edit tracking state
    const [editingMuleId, setEditingMuleId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reference to form element to scroll to it nicely on edit trigger
    const formRef = useRef<HTMLDivElement>(null);

    // Sync and normalize local state when props change
    useEffect(() => {
        const normalized = altPseudos.map(p => {
            if (typeof p === "string") {
                return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200, alignment: "neutre", alignmentOrder: null, alignmentLevel: 0 };
            }
            return {
                id: p.id || crypto.randomUUID(),
                pseudo: p.pseudo || "Inconnu",
                classe: p.classe || "cra",
                level: p.level !== undefined ? p.level : 200,
                alignment: p.alignment || "neutre",
                alignmentOrder: p.alignmentOrder || null,
                alignmentLevel: p.alignmentLevel || 0
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
        setNewPseudoVerified(false);
    };

    const handleVerifyMule = async () => {
        const trimmed = newPseudo.trim();
        if (!trimmed || trimmed.length < 3 || !guildId) return;
        setIsVerifyingMule(true);
        try {
            const res = await verifyDofusPseudo(trimmed, guildId);
            if (res.success) {
                setNewPseudoVerified(true);
                toast.success("Pseudo vérifié sur le ladder Ankama");
            } else {
                setNewPseudoVerified(false);
                toast.error(res.error || "Pseudo introuvable sur le ladder Ankama");
            }
        } catch {
            setNewPseudoVerified(false);
            toast.error("Impossible de vérifier le pseudo (service indisponible).");
        } finally {
            setIsVerifyingMule(false);
        }
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
        setNewPseudoVerified(true); // pseudo déjà validé à l'ajout ; re-saisie → reset via handleInputChange
        setNewClass(mule.classe || "cra");
        setNewLevel(mule.level?.toString() || "200");
        setNewAlignment(mule.alignment || "neutre");
        setNewOrder(mule.alignmentOrder || null);
        setNewAlignmentLevel(mule.alignmentLevel || 0);

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
        setNewPseudoVerified(false);
        setNewClass("cra");
        setNewLevel("200");
        setNewAlignment("neutre");
        setNewOrder(null);
        setNewAlignmentLevel(0);
    };

    const handleAddOrUpdatePseudo = () => {
        const trimmed = newPseudo.trim();
        if (!trimmed) return;

        const validation = validatePseudo(trimmed);
        if (!validation.valid) {
            toast.error(validation.error);
            return;
        }

        // Vérif « loupe » requise (sauf si le fallback manuel God est actif).
        if (!newPseudoVerified && !manualFallback) {
            toast.error("Veuillez vérifier ce pseudo avec la loupe avant de l'ajouter.");
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
                        alignmentOrder: newAlignment === "neutre" ? null : newOrder,
                        alignmentLevel: newAlignment === "neutre" ? 0 : newAlignmentLevel
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
                alignmentOrder: newAlignment === "neutre" ? null : newOrder,
                alignmentLevel: newAlignment === "neutre" ? 0 : newAlignmentLevel
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
                if (!newPseudoVerified && !manualFallback) {
                    toast.error("Veuillez vérifier ce pseudo avec la loupe avant d'enregistrer.");
                    setIsSubmitting(false);
                    return;
                }
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
                        alignmentOrder: newAlignment === "neutre" ? null : newOrder,
                        alignmentLevel: newAlignment === "neutre" ? 0 : newAlignmentLevel
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
            if (typeof p === "string") return { id: crypto.randomUUID(), pseudo: p, classe: "cra", level: 200, alignment: "neutre", alignmentOrder: null, alignmentLevel: 0 };
            return {
                id: p.id || crypto.randomUUID(),
                pseudo: p.pseudo || "Inconnu",
                classe: p.classe || "cra",
                level: p.level !== undefined ? p.level : 200,
                alignment: p.alignment || "neutre",
                alignmentOrder: p.alignmentOrder || null,
                alignmentLevel: p.alignmentLevel || 0
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
        <Card className="bg-zinc-950/80 backdrop-blur-md border border-white/10 relative overflow-hidden group h-full flex flex-col rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                            Mes Mules & Alts
                            {!readOnly && (
                                <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                                    {localPseudos.length}/{maxPseudos}
                                </span>
                            )}
                        </h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Personnages secondaires de guilde</p>
                    </div>
                </div>

                {!readOnly && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                        className={cn(
                            "h-9 px-4 text-xs font-black uppercase tracking-wider transition-all border shadow-md rounded-xl cursor-pointer",
                            isEditing
                                ? "bg-zinc-800 text-zinc-200 border-white/10 hover:bg-zinc-700"
                                : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20 hover:text-white"
                        )}
                    >
                        {isEditing ? <X className="w-3.5 h-3.5 mr-1.5" /> : <Edit2 className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />}
                        {isEditing ? "Fermer" : "Gérer mes Mules"}
                    </Button>
                )}
            </div>

            <CardContent className="p-0 space-y-6 relative flex-1">
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
                                        "relative flex flex-col justify-between p-4 rounded-2xl bg-black/60 border transition-all group/item overflow-hidden space-y-3",
                                        editingMuleId === mule.id 
                                            ? "border-indigo-500/50 bg-indigo-950/20 shadow-[0_0_25px_rgba(99,102,241,0.2)]"
                                            : "border-white/10 hover:border-indigo-500/40 hover:bg-black/80"
                                    )}
                                >
                                    <div
                                        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25"
                                        style={{ backgroundColor: cls.color }}
                                    />

                                    {/* Top Row: Class Icon + Pseudo + Level Badge */}
                                    <div className="flex items-start justify-between gap-3 z-10">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 p-1 shadow-md" style={{ borderColor: `${cls.color}50` }}>
                                                <NextImage
                                                    src={cls.icon}
                                                    alt={cls.name}
                                                    width={36}
                                                    height={36}
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-black text-white truncate" title={mule.pseudo}>
                                                        {mule.pseudo}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: cls.color }}>
                                                        {cls.name}
                                                    </span>
                                                    <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                                                        Nv. {mule.level !== undefined ? mule.level : 200}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Row: Alignment & Order Badges */}
                                    <div className="flex flex-wrap items-center gap-1.5 z-10 pt-1 border-t border-white/5">
                                        {alignData && alignData.id !== "neutre" ? (
                                            <div className={cn(
                                                "flex items-center gap-1.5 bg-black/60 border rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                                                alignData.id === "bontarien" ? "border-blue-500/30 text-blue-300" : "border-red-500/30 text-red-300"
                                            )}>
                                                <div className="relative w-4 h-4 shrink-0 rounded-full overflow-hidden">
                                                    <NextImage src={alignData.icon} alt={alignData.name} fill className="object-cover scale-110" unoptimized />
                                                </div>
                                                <span>{alignData.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-zinc-500 font-bold italic">Neutre</span>
                                        )}

                                        {orderData && (
                                            <div className="flex items-center gap-1.5 bg-black/60 border border-amber-500/30 rounded-xl px-2.5 py-1 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                                                <div className="relative w-4 h-4 shrink-0">
                                                    <NextImage src={orderData.icon} alt={orderData.name} fill className="object-contain" unoptimized />
                                                </div>
                                                <span className="truncate max-w-[120px]" title={orderData.name}>
                                                    {orderData.name.replace("Ordre de l'", "").replace("Ordre du ", "")}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Row: Actions */}
                                    <div className="flex items-center justify-between z-10 pt-2 border-t border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`/w ${mule.pseudo} `);
                                                toast.success("Commande copiée !", { description: `/w ${mule.pseudo}` });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                            title="Copier /w dans Dofus"
                                        >
                                            <Copy className="w-3 h-3" /> /w {mule.pseudo}
                                        </button>

                                        {isEditing && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleStartEditMule(mule)}
                                                    className={cn(
                                                        "h-7 w-7 transition-all bg-black/40 rounded-lg border cursor-pointer",
                                                        editingMuleId === mule.id
                                                            ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                                                            : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                                                    )}
                                                    title="Modifier cette mule"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                                <button
                                                    onClick={() => handleRemovePseudo(mule.id!)}
                                                    className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-500/80 rounded-lg transition-all bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-xs font-bold text-zinc-500 italic py-12 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center bg-black/40 gap-3">
                        <Users className="w-8 h-8 text-zinc-600" />
                        Aucune mule enregistrée pour le moment.
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
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <Input
                                                    value={newPseudo}
                                                    onChange={handleInputChange}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Ex: Darksasuke"
                                                    className={cn(
                                                        "bg-zinc-900/80 border-white/10 h-10 pl-10 focus-visible:ring-indigo-500/50 font-medium",
                                                        newPseudoVerified && "border-emerald-500/50"
                                                    )}
                                                    maxLength={20}
                                                />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono pointer-events-none">
                                                    /w
                                                </div>
                                                {newPseudoVerified && (
                                                    <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleVerifyMule}
                                                disabled={!newPseudo.trim() || isVerifyingMule || newPseudo.trim().length < 3}
                                                className={cn(
                                                    "h-10 w-10 shrink-0 bg-zinc-900/80 border-white/10 px-0",
                                                    newPseudoVerified && "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                                                )}
                                                title="Vérifier le pseudo sur le ladder Ankama"
                                            >
                                                {isVerifyingMule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-zinc-500 ml-1">
                                            {newPseudoVerified ? (
                                                <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                                                    <UserCheck className="w-3 h-3" /> Pseudo validé sur le ladder Ankama.
                                                </span>
                                            ) : manualFallback ? (
                                                <span className="text-amber-400/90 font-semibold">
                                                    Saisie manuelle autorisée (fallback actif) — vérification Ankama désactivée.
                                                </span>
                                            ) : (
                                                <span>Vérification requise : cliquez sur la loupe <Search className="inline w-3 h-3 mb-0.5" /> pour valider le pseudo avant de l'ajouter.</span>
                                            )}
                                        </p>
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
                                                            setNewAlignmentLevel(0);
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
                                                            onClick={() => { setNewOrder(order.id); setNewAlignmentLevel(0); }}
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

                                    {/* Tranche d'alignement (Niveau) */}
                                    {newAlignment !== "neutre" && newOrder && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                <label className="text-[11px] text-zinc-300 font-black uppercase tracking-wider">Tranche d'Alignement</label>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setNewAlignmentLevel(0)}
                                                    className={cn(
                                                        "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                        newAlignmentLevel === 0
                                                            ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                                            : "bg-black/20 border-white/5 text-zinc-500 hover:text-zinc-300"
                                                    )}
                                                >
                                                    Aucune
                                                </button>
                                                {getAlignmentLevelSteps((ORDERS as any)[newAlignment]?.find((o: any) => o.id === newOrder)).map(({ level, title }) => (
                                                    <button
                                                        key={level}
                                                        type="button"
                                                        onClick={() => setNewAlignmentLevel(level)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                            newAlignmentLevel === level
                                                                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                                                : "bg-black/20 border-white/5 text-zinc-500 hover:text-zinc-300"
                                                        )}
                                                        title={title || `Niveau ${level}`}
                                                    >
                                                        {level} · {title || `Niv ${level}`}
                                                    </button>
                                                ))}
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
