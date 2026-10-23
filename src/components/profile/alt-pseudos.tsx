"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Plus, X, Save, Edit2, AlertCircle, Copy, Shield, Trash2, Check, Sparkles, Search, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { DOFUS_CLASSES, getClass, ALIGNMENTS, ORDERS, getAlignment, getOrder } from "@/lib/dofus-assets";
import NextImage from "next/image";
import { verifyDofusPseudo, isLadderManualFallbackEnabled } from "@/server/actions/profile-actions";
import { logger } from "@/lib/logger";

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
    altPseudos?: (Mule | string)[];
    onSave?: (pseudos: Mule[]) => Promise<unknown>;
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

    // Vérification du pseudo (loupe) + fallback God
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
        setNewPseudoVerified(true);
        setNewClass(mule.classe || "cra");
        setNewLevel(mule.level?.toString() || "200");
        setNewAlignment(mule.alignment || "neutre");
        setNewOrder(mule.alignmentOrder || null);
        setNewAlignmentLevel(mule.alignmentLevel || 0);

        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);

        toast.info(`Modification de ${mule.pseudo} chargée dans le formulaire`);
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

        if (!newPseudoVerified && !manualFallback) {
            toast.error("Veuillez vérifier ce pseudo avec la loupe avant de l'ajouter.");
            return;
        }

        let lvl = parseInt(newLevel, 10);
        if (isNaN(lvl) || lvl < 0 || lvl > 200) lvl = 200;

        if (editingMuleId) {
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
            logger.error("Save alt pseudos error", { err: error });
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
        <Card className="bg-surface/40 backdrop-blur-md border border-border relative overflow-hidden h-full flex flex-col rounded-2xl shadow-xs p-5 sm:p-6 gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-lg font-bold text-foreground">
                                Mes Mules & Personnages
                            </h3>
                            {!readOnly && (
                                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25">
                                    {localPseudos.length}/{maxPseudos}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Personnages secondaires et rerolls pour faciliter les contacts en jeu.
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                        className={cn(
                            "h-9 px-3.5 text-xs font-medium transition-all rounded-xl border",
                            isEditing
                                ? "bg-surface text-foreground border-border hover:bg-surface/80"
                                : "border-border hover:border-accent/40 text-foreground hover:bg-surface"
                        )}
                    >
                        {isEditing ? <X className="w-3.5 h-3.5 mr-1.5" /> : <Edit2 className="w-3.5 h-3.5 mr-1.5" />}
                        {isEditing ? "Fermer l'édition" : "Gérer mes mules"}
                    </Button>
                )}
            </div>

            <CardContent className="p-0 space-y-6 relative flex-1">
                {/* Mules Grid */}
                {localPseudos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                        {localPseudos.map((mule) => {
                            const cls = getClass(mule.classe || "cra") || DOFUS_CLASSES[0];
                            const alignData = mule.alignment ? getAlignment(mule.alignment) : null;
                            const orderData = mule.alignment && mule.alignmentOrder ? getOrder(mule.alignment, mule.alignmentOrder) : null;

                            return (
                                <div
                                    key={mule.id}
                                    className={cn(
                                        "relative flex flex-col justify-between p-3.5 rounded-xl bg-surface/50 hover:bg-surface/80 border transition-all space-y-3",
                                        editingMuleId === mule.id 
                                            ? "border-accent/60 bg-accent/10 shadow-xs" 
                                            : "border-border hover:border-accent/30"
                                    )}
                                >
                                    {/* Top Row: Class Icon + Pseudo + Level */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 p-1">
                                            <NextImage
                                                src={cls.icon}
                                                alt={cls.name}
                                                width={30}
                                                height={30}
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate" title={mule.pseudo}>
                                                {mule.pseudo}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[11px] font-semibold text-muted-foreground truncate" style={{ color: cls.color }}>
                                                    {cls.name}
                                                </span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                                                    Nv. {mule.level !== undefined ? mule.level : 200}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Row: Alignment & Order Badges */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
                                        {alignData && alignData.id !== "neutre" ? (
                                            <div className="flex items-center gap-1.5 bg-surface/80 border border-border rounded-lg px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                <div className="relative w-3.5 h-3.5 shrink-0 rounded-full overflow-hidden">
                                                    <NextImage src={alignData.icon} alt={alignData.name} fill className="object-cover scale-110" unoptimized />
                                                </div>
                                                <span>{alignData.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground italic">Neutre</span>
                                        )}

                                        {orderData && (
                                            <div className="flex items-center gap-1.5 bg-surface/80 border border-border rounded-lg px-2 py-0.5 text-[11px] font-medium text-foreground">
                                                <div className="relative w-3.5 h-3.5 shrink-0">
                                                    <NextImage src={orderData.icon} alt={orderData.name} fill className="object-contain" unoptimized />
                                                </div>
                                                <span className="truncate max-w-[110px]" title={orderData.name}>
                                                    {orderData.name.replace("Ordre de l'", "").replace("Ordre du ", "")}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Row: /w Action and Edit controls */}
                                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`/w ${mule.pseudo} `);
                                                toast.success("Commande copiée !", { description: `/w ${mule.pseudo}` });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface hover:bg-surface/80 hover:text-accent border border-border text-[11px] font-medium text-muted-foreground transition-colors cursor-pointer"
                                            title="Copier le message chuchoté"
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
                                                        "h-7 w-7 rounded-lg border",
                                                        editingMuleId === mule.id
                                                            ? "border-accent text-accent bg-accent/10"
                                                            : "border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                                                    )}
                                                    title="Modifier"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemovePseudo(mule.id!)}
                                                    className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg border border-border"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground py-10 border border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-surface/20 gap-2.5">
                        <Users className="w-6 h-6 text-muted-foreground opacity-50" />
                        <span>Aucun personnage secondaire enregistré pour le moment.</span>
                    </div>
                )}

                {/* Edit Mode Panel */}
                {isEditing && (
                    <div ref={formRef} className="p-4 sm:p-5 bg-surface/30 border border-border rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                                {editingMuleId ? (
                                    <>
                                        <Edit2 className="w-3.5 h-3.5 text-accent" />
                                        Modifier : <span className="text-accent">{newPseudo}</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3.5 h-3.5 text-accent" />
                                        Ajouter un personnage
                                    </>
                                )}
                            </h4>
                            {editingMuleId && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={handleCancelFormEdit}
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Annuler la sélection
                                </Button>
                            )}
                        </div>

                        {localPseudos.length < maxPseudos || editingMuleId ? (
                            <div className="flex flex-col gap-4">
                                {/* 1. Class Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Classe du personnage</label>
                                    <div className="flex bg-surface/60 p-2 rounded-xl border border-border overflow-x-auto gap-2">
                                        {DOFUS_CLASSES.map((cls) => (
                                            <button
                                                key={cls.id}
                                                type="button"
                                                onClick={() => setNewClass(cls.id)}
                                                className={cn(
                                                    "h-10 w-10 rounded-xl shrink-0 flex items-center justify-center transition-all border",
                                                    newClass === cls.id
                                                        ? "bg-accent/15 border-accent text-accent shadow-xs scale-105"
                                                        : "bg-surface border-border opacity-60 hover:opacity-100 hover:bg-surface/80"
                                                )}
                                                title={cls.name}
                                            >
                                                <NextImage
                                                    src={cls.icon}
                                                    alt={cls.name}
                                                    width={24}
                                                    height={24}
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Pseudo & Level Fields */}
                                <div className="flex flex-col sm:flex-row gap-3 items-start">
                                    <div className="flex-1 w-full space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Pseudo en jeu</label>
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <Input
                                                    value={newPseudo}
                                                    onChange={handleInputChange}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Ex: Darksasuke"
                                                    className={cn(
                                                        "bg-surface border-border h-9 pl-9 text-xs font-medium rounded-xl focus:border-accent/50",
                                                        newPseudoVerified && "border-success/50"
                                                    )}
                                                    maxLength={20}
                                                />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono pointer-events-none">
                                                    /w
                                                </div>
                                                {newPseudoVerified && (
                                                    <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleVerifyMule}
                                                disabled={!newPseudo.trim() || isVerifyingMule || newPseudo.trim().length < 3}
                                                className={cn(
                                                    "h-9 w-9 shrink-0 bg-surface border-border p-0 rounded-xl",
                                                    newPseudoVerified && "text-success border-success/30 bg-success/10"
                                                )}
                                                title="Vérifier sur Ankama"
                                            >
                                                {isVerifyingMule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                            </Button>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                                            {newPseudoVerified ? (
                                                <span className="text-success font-semibold flex items-center gap-1.5">
                                                    <UserCheck className="w-3 h-3" /> Pseudo validé sur le ladder Ankama.
                                                </span>
                                            ) : manualFallback ? (
                                                <span className="text-muted-foreground">
                                                    Saisie manuelle autorisée (fallback actif).
                                                </span>
                                            ) : (
                                                <span>Cliquez sur la loupe pour valider le pseudo avant de l&apos;ajouter.</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="w-full sm:w-28 space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Niveau</label>
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
                                            className="bg-surface border-border h-9 font-mono text-center text-xs font-bold rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* 3. Optional Alignment & Order Selection */}
                                <div className="space-y-3 bg-surface/50 p-3.5 rounded-xl border border-border">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <Shield className="w-3.5 h-3.5 text-accent" />
                                            <label className="text-xs font-semibold text-foreground">Alignement (optionnel)</label>
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
                                                                const available = ORDERS[align.id as keyof typeof ORDERS];
                                                                if (available && available.length > 0) {
                                                                    setNewOrder(available[0].id);
                                                                }
                                                            }
                                                        }}
                                                        className={cn(
                                                            "h-9 px-3 rounded-lg flex items-center gap-2 transition-all border text-xs font-medium",
                                                            isSel 
                                                                ? "bg-accent/15 border-accent text-accent font-semibold"
                                                                : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-surface/80"
                                                        )}
                                                    >
                                                        <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 border border-border">
                                                            <NextImage src={align.icon} alt={align.name} fill className="object-cover scale-110" unoptimized />
                                                        </div>
                                                        {align.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Dependent Order Specialization List */}
                                    {newAlignment !== "neutre" && (
                                        <div className="space-y-2 pt-2 border-t border-border">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-accent" />
                                                <label className="text-xs font-semibold text-foreground">Ordre</label>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {(ORDERS[newAlignment as keyof typeof ORDERS] || []).map((order) => {
                                                    const isSel = newOrder === order.id;
                                                    return (
                                                        <button
                                                            key={order.id}
                                                            type="button"
                                                            onClick={() => { setNewOrder(order.id); setNewAlignmentLevel(0); }}
                                                            className={cn(
                                                                "h-9 px-2.5 rounded-lg flex items-center gap-2 transition-all border text-left text-xs font-medium",
                                                                isSel
                                                                    ? "bg-accent/15 border-accent text-accent font-semibold"
                                                                    : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-surface/80"
                                                            )}
                                                        >
                                                            <div className="relative w-5 h-5 shrink-0 bg-black/40 rounded flex items-center justify-center p-0.5 border border-border overflow-hidden">
                                                                <NextImage src={order.icon} alt={order.name} fill className="object-contain" unoptimized />
                                                            </div>
                                                            <span className="truncate" title={order.name}>
                                                                {order.name.replace("Ordre de l'", "").replace("Ordre du ", "")}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Form Submission Action */}
                                <div className="flex justify-end pt-1">
                                    <Button
                                        onClick={handleAddOrUpdatePseudo}
                                        disabled={!newPseudo.trim()}
                                        className="h-9 px-4 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80 rounded-xl"
                                    >
                                        {editingMuleId ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 mr-1.5" /> Mettre à jour
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5 mr-1.5" /> Ajouter à la liste
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-warning flex items-center gap-2 bg-warning/10 p-2.5 rounded-lg border border-warning/20">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Limite de {maxPseudos} personnages atteinte.
                            </p>
                        )}

                        <div className="flex justify-end pt-3 border-t border-border">
                            <Button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                className="h-9 px-5 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80 rounded-xl"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enregistrement...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5 mr-1.5" /> Enregistrer les modifications
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
