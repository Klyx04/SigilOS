"use client";

import { useState } from "react";
import { ShieldAlert, BookOpen, ExternalLink, Check, ChevronRight, ChevronLeft, Plus, Loader2, Search, X } from "lucide-react";
import NextImage from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DO_TAGS } from "@/lib/dofus-tags";
import type { DofusBookLink } from "./builds-card";

// ─── Types ─────────────────────────────────────────────────────────────────

type BuildSource = "dofusbook" | null;

interface AddBuildModalProps {
    guildId: string;
    links: DofusBookLink[];
    onSave: (links: DofusBookLink[]) => void;
    targetUserId?: string;
    trigger?: React.ReactNode;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DOFUS_CLASSES = [
    { id: 1, name: "Féca" }, { id: 2, name: "Osamodas" }, { id: 3, name: "Enutrof" },
    { id: 4, name: "Sram" }, { id: 5, name: "Xélor" }, { id: 6, name: "Écaflip" },
    { id: 7, name: "Éniripsa" }, { id: 8, name: "Iop" }, { id: 9, name: "Crâ" },
    { id: 10, name: "Sadida" }, { id: 11, name: "Sacrieur" }, { id: 12, name: "Pandawa" },
    { id: 13, name: "Roublard" }, { id: 14, name: "Zobal" }, { id: 15, name: "Steamer" },
    { id: 16, name: "Éliotrope" }, { id: 17, name: "Huppermage" }, { id: 18, name: "Ouginak" },
    { id: 19, name: "Forgelance" }
];

const CLASS_COLORS: Record<number, string> = {
    1: "#8b5cf6", 2: "#f59e0b", 3: "#10b981", 4: "#6366f1", 5: "#3b82f6",
    6: "#ef4444", 7: "#ec4899", 8: "#f97316", 9: "#84cc16", 10: "#059669",
    11: "#dc2626", 12: "#4ade80", 13: "#7c3aed", 14: "#1e40af", 15: "#0ea5e9",
    16: "#2563eb", 17: "#9333ea", 18: "#ea580c", 19: "#06b6d4"
};

const TAG_CATEGORIES = [
    {
        name: "Éléments",
        ids: ["eau", "feu", "terre", "air", "multi", "terrefeu", "terreeau", "terreair", "feueau", "feuair", "eauair", "multinocrit"]
    },
    {
        name: "Stats & Rôles",
        ids: ["tank", "dopou", "pp", "ini", "retpm", "retpa", "sagesse", "docrit", "soin"]
    },
    {
        name: "Usage",
        ids: ["songes", "leveling"]
    }
];

type NonNullableBuildSource = "dofusbook";

const URL_VALIDATORS: Record<NonNullableBuildSource, { pattern: RegExp; placeholder: string; hint: string }> = {
    dofusbook: {
        pattern: /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/,
        placeholder: "https://d-bk.net/fr/d/...",
        hint: "Lien d-bk.net ou dofusbook.net (https requis)"
    }
};

// ─── Step indicators ────────────────────────────────────────────────────────

const STEPS = [
    { label: "Nom", icon: "✏️" },
    { label: "Lien stuff", icon: "🔗" },
    { label: "Tags", icon: "🏷️" },
    { label: "Classe", icon: "⚔️" },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function AddBuildModal({ guildId, links, onSave, targetUserId, trigger }: AddBuildModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [source, setSource] = useState<BuildSource>("dofusbook");
    const [url, setUrl] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [classId, setClassId] = useState<number | null>(null);
    const [hoveredClassId, setHoveredClassId] = useState<number | null>(null);
    
    // Search states
    const [tagSearch, setTagSearch] = useState("");
    const [classSearch, setClassSearch] = useState("");

    const reset = () => {
        setStep(0);
        setName("");
        setSource("dofusbook");
        setUrl("");
        setTags([]);
        setClassId(null);
        setTagSearch("");
        setClassSearch("");
    };

    const handleClose = (open: boolean) => {
        if (!open) reset();
        setIsOpen(open);
    };

    // Validation per step
    const isStep0Valid = name.trim().length >= 1;
    const isStep1Valid = source !== null && url.trim().length > 0 && (source ? URL_VALIDATORS[source].pattern.test(url.trim()) : false);
    const canProceed = [isStep0Valid, isStep1Valid, true, true][step];

    const handleSubmit = async () => {
        if (!isStep1Valid || !source) return;
        setIsSubmitting(true);

        const { updateDofusBookLinks } = await import("@/server/actions/profile-actions");

        const newLink: DofusBookLink = {
            id: crypto.randomUUID(),
            name: name.trim(),
            url: url.trim(),
            tags,
            classId: classId || undefined,
            previewData: null,
        };

        const updatedLinks = [...links, newLink];

        try {
            const result = await updateDofusBookLinks({ guildId, links: updatedLinks, targetUserId });
            if (result.success) {
                onSave(updatedLinks);
                setIsOpen(false);
                reset();
                toast.success("Build ajouté avec succès !");
            } else {
                toast.error(result.error || "Erreur lors de l'ajout");
            }
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const urlValidator = source ? URL_VALIDATORS[source] : null;
    const urlIsValid = urlValidator && url.trim().length > 0 ? urlValidator.pattern.test(url.trim()) : null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="sigil-emerald" size="sm" className="gap-2 h-9 px-4">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Ajouter un Build</span>
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="bg-zinc-950 border-zinc-800/60 text-zinc-200 sm:max-w-lg p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-white/5">
                    <DialogTitle className="text-lg font-black uppercase tracking-tight">
                        Importer un Build
                    </DialogTitle>

                    {/* Step progress bar */}
                    <div className="flex items-center gap-1.5 mt-3">
                        {STEPS.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 flex-1">
                                <div className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all duration-300 border shrink-0",
                                    i < step
                                        ? "bg-emerald-500 border-emerald-400 text-white"
                                        : i === step
                                            ? "bg-zinc-800 border-white/30 text-white"
                                            : "bg-zinc-900 border-white/5 text-zinc-600"
                                )}>
                                    {i < step ? <Check className="w-3 h-3" /> : i + 1}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider hidden sm:inline transition-colors",
                                    i === step ? "text-white" : "text-zinc-600"
                                )}>
                                    {s.label}
                                </span>
                                {i < STEPS.length - 1 && (
                                    <div className={cn(
                                        "flex-1 h-px transition-all duration-500",
                                        i < step ? "bg-emerald-500/50" : "bg-white/5"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                </DialogHeader>

                {/* Steps content */}
                <div className="p-6 min-h-[280px] flex flex-col">

                    {/* ── Step 0: Nom ───────────────────────────────────── */}
                    {step === 0 && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
                            <div>
                                <Label htmlFor="build-name" className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">
                                    Nom du build <span className="text-zinc-600 font-normal">(max 30 caractères)</span>
                                </Label>
                                <Input
                                    id="build-name"
                                    autoFocus
                                    placeholder="Ex: Cra Terre 200, Iop Full Sagesse..."
                                    maxLength={30}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && isStep0Valid && setStep(1)}
                                    className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 h-12 text-base focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all"
                                />
                                <div className="flex justify-end mt-1.5">
                                    <span className={cn(
                                        "text-[10px] font-bold tabular-nums transition-colors",
                                        name.length >= 28 ? "text-amber-400" : "text-zinc-600"
                                    )}>
                                        {name.length}/30
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto p-4 bg-zinc-900/50 rounded-2xl border border-white/5 text-xs text-zinc-500 leading-relaxed">
                                <span className="text-zinc-400 font-bold">Conseil :</span> Donne un nom court et descriptif comme{" "}
                                <span className="text-zinc-300 font-bold">Cra Eau PvM</span> ou{" "}
                                <span className="text-zinc-300 font-bold">Iop Terre Songes</span> pour que les autres membres s'y retrouvent facilement.
                            </div>
                        </div>
                    )}

                    {/* ── Step 1: Lien stuff ─────────────────────────────── */}
                    {step === 1 && (
                        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <Label htmlFor="build-url" className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">
                                    Lien de partage DofusBook
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="build-url"
                                        autoFocus
                                        placeholder={urlValidator?.placeholder}
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className={cn(
                                            "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 h-11 font-mono text-xs pr-10 transition-all",
                                            url.trim().length > 0 && urlIsValid === true && "border-emerald-500/50",
                                            url.trim().length > 0 && urlIsValid === false && "border-red-500/50"
                                        )}
                                    />
                                    {url.trim().length > 0 && (
                                        <div className={cn(
                                            "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center",
                                            urlIsValid ? "bg-emerald-500" : "bg-red-500/80"
                                        )}>
                                            {urlIsValid
                                                ? <Check className="w-3 h-3 text-white" />
                                                : <span className="text-white text-xs font-black">!</span>
                                            }
                                        </div>
                                    )}
                                </div>
                                <p className={cn(
                                    "text-[10px] mt-1.5 flex items-center gap-1 transition-colors",
                                    url.trim().length > 0 && urlIsValid === false ? "text-red-400" : "text-zinc-500"
                                )}>
                                    <ShieldAlert className="w-3 h-3 shrink-0" />
                                    {url.trim().length > 0 && urlIsValid === false
                                        ? "Format de lien invalide (DofusBook attendu : d-bk.net ou dofusbook.net)."
                                        : urlValidator?.hint
                                    }
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Tags ──────────────────────────────────── */}
                    {step === 2 && (
                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                    Tags <span className="text-zinc-600 font-normal">(optionnel, max 3)</span>
                                </Label>
                                {tags.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setTags([])}
                                        className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors font-bold"
                                    >
                                        Effacer tout
                                    </button>
                                )}
                            </div>

                            <div className="relative mb-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    placeholder="Rechercher un tag (ex: Eau, Soin...)"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                    className="pl-9 pr-8 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 h-9 text-xs rounded-lg focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                />
                                {tagSearch && (
                                    <button
                                        onClick={() => setTagSearch("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[190px] pr-2 custom-scrollbar">
                                {TAG_CATEGORIES.map((cat) => {
                                    const filteredIds = cat.ids.filter(tagId => {
                                        const tag = DO_TAGS.find(t => t.id === tagId);
                                        return tag && tag.label.toLowerCase().includes(tagSearch.toLowerCase());
                                    });

                                    if (filteredIds.length === 0) return null;

                                    return (
                                        <div key={cat.name}>
                                            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">{cat.name}</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {filteredIds.map(tagId => {
                                                    const tag = DO_TAGS.find(t => t.id === tagId)!;
                                                    if (!tag) return null;
                                                    const isSelected = tags.includes(tag.id);
                                                    const isDisabled = !isSelected && tags.length >= 3;
                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            type="button"
                                                            disabled={isDisabled}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setTags(prev => prev.filter(t => t !== tag.id));
                                                                } else if (tags.length < 3) {
                                                                    setTags(prev => [...prev, tag.id]);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-2.5 py-1 text-[11px] rounded-lg transition-all border font-semibold select-none flex items-center gap-1.5",
                                                                isSelected
                                                                    ? `${tag.className} shadow-md opacity-100 ring-2 ring-emerald-500/40 shadow-emerald-500/10`
                                                                    : isDisabled
                                                                        ? "bg-transparent border-white/5 text-zinc-700 opacity-30 cursor-not-allowed"
                                                                        : `${tag.className} opacity-75 saturate-75 hover:opacity-100 hover:saturate-100`
                                                            )}
                                                        >
                                                            {tag.label}
                                                            {isSelected && <Check className="w-2.5 h-2.5 ml-0.5 shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Selected summary */}
                            {tags.length > 0 ? (
                                <div className="mt-auto flex items-center gap-2 p-2.5 bg-zinc-900/50 rounded-xl border border-white/5">
                                    <span className="text-[10px] text-zinc-500 font-bold shrink-0">Sélectionnés :</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {tags.map(tid => {
                                            const tag = DO_TAGS.find(t => t.id === tid);
                                            return tag ? (
                                                <span key={tid} className={cn("px-2 py-0.5 text-[10px] rounded-md border font-semibold", tag.className)}>
                                                    {tag.label}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-auto p-2.5 bg-zinc-900/30 rounded-xl border border-dashed border-white/5 text-center">
                                    <span className="text-[10px] text-zinc-600 italic">Étape optionnelle — passe directement à Suivant si tu le souhaites</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 3: Classe ────────────────────────────────── */}
                    {step === 3 && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                                    Classe du personnage <span className="text-zinc-600 font-normal">(recommandé)</span>
                                </Label>
                                <p className="text-[10px] text-zinc-600 mb-3">
                                    Sélectionnez la classe pour une belle preview, même si DofusBook est lent.
                                </p>

                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <Input
                                        placeholder="Rechercher une classe..."
                                        value={classSearch}
                                        onChange={(e) => setClassSearch(e.target.value)}
                                        className="pl-9 pr-8 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 h-9 text-xs rounded-lg focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                    />
                                    {classSearch && (
                                        <button
                                            onClick={() => setClassSearch("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                                    {DOFUS_CLASSES.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase())).map((cls) => {
                                        const isSelected = classId === cls.id;
                                        return (
                                            <button
                                                key={cls.id}
                                                type="button"
                                                onClick={() => setClassId(isSelected ? null : cls.id)}
                                                onMouseEnter={() => setHoveredClassId(cls.id)}
                                                onMouseLeave={() => setHoveredClassId(null)}
                                                className={cn(
                                                    "relative aspect-square rounded-xl border transition-all duration-300 flex items-center justify-center overflow-hidden group bg-zinc-900/30",
                                                    isSelected
                                                        ? "scale-110 border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] z-20"
                                                        : "border-white/5 hover:border-white/20 hover:bg-zinc-900/60 z-10"
                                                )}
                                            >
                                                <div className={cn(
                                                    "relative w-8 h-8 transition-all duration-300 z-10",
                                                    isSelected
                                                        ? "scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)] opacity-100"
                                                        : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
                                                )}>
                                                    <NextImage
                                                        src={`/assets/dofus/classes/${cls.id === 19 ? 20 : cls.id}.png`}
                                                        alt={cls.name}
                                                        fill
                                                        className="object-contain"
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Class name tooltip */}
                                <div className="flex items-center justify-center h-8 mt-2">
                                    {(hoveredClassId || classId) ? (
                                        <span className="text-xs font-bold px-3 py-1.5 bg-white/10 rounded-full text-white tracking-wide shadow-inner animate-in fade-in zoom-in duration-150">
                                            {DOFUS_CLASSES.find(c => c.id === (hoveredClassId || classId))?.name}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-zinc-600 italic">
                                            Survolez pour voir le nom de la classe
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer navigation */}
                <div className="flex items-center justify-between px-6 pb-6 pt-4 border-t border-white/5 gap-3">
                    {/* Back button */}
                    <Button
                        variant="ghost"
                        onClick={() => step > 0 ? setStep(s => s - 1) : handleClose(false)}
                        disabled={isSubmitting}
                        className="text-zinc-500 hover:text-white hover:bg-white/5"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        {step === 0 ? "Annuler" : "Retour"}
                    </Button>

                    {/* Progress dots */}
                    <div className="flex gap-1.5">
                        {STEPS.map((_, i) => (
                            <div key={i} className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === step ? "w-6 bg-emerald-500" : i < step ? "w-2 bg-emerald-500/40" : "w-2 bg-zinc-800"
                            )} />
                        ))}
                    </div>

                    {/* Next / Submit button */}
                    {step < STEPS.length - 1 ? (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canProceed}
                            variant="sigil-emerald"
                            className="gap-2"
                        >
                            Suivant
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            variant="sigil-emerald"
                            className="gap-2 min-w-[130px]"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Ajout...</>
                            ) : (
                                <><Check className="w-4 h-4" /> Confirmer</>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
