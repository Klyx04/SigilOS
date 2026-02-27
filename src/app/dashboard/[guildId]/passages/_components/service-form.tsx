"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X, Sword, ScrollText, Hammer, Crown, Wrench, MessageSquare, Gamepad2 } from "lucide-react";
import { createServiceListing } from "@/server/actions/service-actions";
import { ServiceCategory } from "@prisma/client";
import { toast } from "sonner";
import { DungeonPicker, type DungeonSelection } from "./dungeon-picker";
import { QuestPicker, type QuestSelection } from "./quest-picker";
import { DofusItemSearch } from "./dofus-item-search";
import { DOFUS_JOBS, type DofusItem } from "@/lib/dofusdude-client";
import { DOFUS_JOBS as _ALL_JOBS_MAP, JOB_CATEGORIES } from "@/lib/dofus-assets";
import Image from "next/image";
import { AvailabilityPreview } from "./availability-preview";

// Forgemagie-only jobs (flat list)
export const FM_JOBS = (_ALL_JOBS_MAP[JOB_CATEGORIES.FORGEMAGIE] as ReadonlyArray<{ id: string; name: string; icon: string }>)
    .map((j, i) => ({ id: i + 1, name: j.name, iconUrl: j.icon }));

// ---------------------------------------------------------------------------
// TYPES & CONSTANTS
// ---------------------------------------------------------------------------

interface ServiceFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
}

type PriceTier = { label: string; price: string };
type OcrePack = "boss" | "boss_archi" | "archi";

const OCRE_PACKS: { value: OcrePack; label: string }[] = [
    { value: "boss", label: "Pack Boss" },
    { value: "boss_archi", label: "Pack Boss + Archi" },
    { value: "archi", label: "Pack Archi" },
];

// Catégories affichées (AUTRE supprimé per spec)
const VISIBLE_CATEGORIES: { key: ServiceCategory; label: string; icon: React.ReactNode; color: string; accent: string }[] = [
    { key: "PASSAGE_DONJON", label: "Donjon", icon: <Sword className="h-5 w-5" />, color: "from-cyan-500/20 to-transparent", accent: "border-cyan-500/60 bg-cyan-500/15 text-cyan-300" },
    { key: "FORGEMAGIE", label: "Forgemagie", icon: <Hammer className="h-5 w-5" />, color: "from-amber-500/20 to-transparent", accent: "border-amber-500/60 bg-amber-500/15 text-amber-300" },
    { key: "METIER", label: "Métier", icon: <Wrench className="h-5 w-5" />, color: "from-emerald-500/20 to-transparent", accent: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
    { key: "QUETE", label: "Quête", icon: <ScrollText className="h-5 w-5" />, color: "from-violet-500/20 to-transparent", accent: "border-violet-500/60 bg-violet-500/15 text-violet-300" },
    { key: "OCRE", label: "Quête Ocre 🥚", icon: <Crown className="h-5 w-5" />, color: "from-yellow-500/20 to-transparent", accent: "border-yellow-500/60 bg-yellow-500/15 text-yellow-300" },
];

const CATEGORY_ACCENT: Record<ServiceCategory, string> = {
    PASSAGE_DONJON: "border-cyan-500/60 bg-cyan-500/10 text-cyan-300",
    FORGEMAGIE: "border-amber-500/60 bg-amber-500/10 text-amber-300",
    METIER: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
    QUETE: "border-violet-500/60 bg-violet-500/10 text-violet-300",
    OCRE: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300",
    AUTRE: "border-zinc-500/60 bg-zinc-500/10 text-zinc-300",
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export function ServiceForm({ open, onOpenChange, guildId }: ServiceFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Common
    const [category, setCategory] = useState<ServiceCategory>("PASSAGE_DONJON");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [availability, setAvailability] = useState("");
    const [contactDiscord, setContactDiscord] = useState(true);
    const [contactIngame, setContactIngame] = useState(false);

    // PASSAGE_DONJON
    const [dungeonSelection, setDungeonSelection] = useState<DungeonSelection | null>(null);
    const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);

    // QUETE
    const [questSelection, setQuestSelection] = useState<QuestSelection | null>(null);

    // FORGEMAGIE
    const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
    const [fmItem, setFmItem] = useState("");
    const [passTrans, setPassTrans] = useState("");
    const [commandeExo, setCommandeExo] = useState(false); // OUI/NON toggle
    const [fmLinkedItem, setFmLinkedItem] = useState<DofusItem | null>(null);

    // OCRE
    const [ocrePack, setOcrePack] = useState<OcrePack>("boss");

    // METIER
    const [metierMode, setMetierMode] = useState<"craft" | "pack">("craft");
    const [selectedMetierJob, setSelectedMetierJob] = useState<string>("");

    const resetForm = () => {
        setCategory("PASSAGE_DONJON");
        setTitle(""); setDescription(""); setPrice(""); setAvailability("");
        setContactDiscord(true); setContactIngame(false);
        setDungeonSelection(null); setPriceTiers([]);
        setQuestSelection(null);
        setSelectedJobs([]); setFmItem(""); setPassTrans(""); setCommandeExo(false); setFmLinkedItem(null);
        setOcrePack("boss");
        setMetierMode("craft"); setSelectedMetierJob("");
    };

    function addPriceTier() {
        if (priceTiers.length >= 6) return;
        setPriceTiers([...priceTiers, { label: "", price: "" }]);
    }
    function updatePriceTier(i: number, f: keyof PriceTier, v: string) {
        const n = [...priceTiers]; n[i] = { ...n[i], [f]: v }; setPriceTiers(n);
    }
    function removePriceTier(i: number) { setPriceTiers(priceTiers.filter((_, idx) => idx !== i)); }

    function toggleJob(name: string) {
        setSelectedJobs((prev) => prev.includes(name) ? prev.filter((j) => j !== name) : [...prev, name]);
    }

    const handleSubmit = async () => {
        if (!title.trim()) { toast.error("Le titre est requis."); return; }
        setLoading(true);
        try {
            const toJson = (v: unknown) => v as import("@prisma/client").Prisma.InputJsonValue;
            // Résoudre les labels combo (JSON d'IDs → noms lisibles)
            const allAchievements = dungeonSelection?.dungeon.achievements ?? [];
            const resolvedTiers = priceTiers.map(t => {
                try {
                    const ids = JSON.parse(t.label);
                    if (Array.isArray(ids) && ids.every((id: unknown) => typeof id === "string")) {
                        const names = allAchievements
                            .filter(a => ids.includes(a.id))
                            .map(a => a.challenge.name);
                        return { label: names.length > 0 ? names.join(" + ") : "Combo", price: t.price };
                    }
                } catch { /* label texte normal */ }
                return t;
            });
            const validTiers = resolvedTiers.filter((t) => t.label && t.price);

            const result = await createServiceListing(guildId, {
                category,
                title: title.trim(),
                description: description.trim() || null,
                price: (category === "OCRE" ? OCRE_PACKS.find(p => p.value === ocrePack)?.label : price.trim()) || null,
                availability: availability.trim() || null,
                contactMethod: [contactDiscord && "Discord", contactIngame && "En jeu"].filter(Boolean).join(" + ") || null,
                publishToDiscord: true,
                dungeonId: dungeonSelection?.dungeon.id || null,
                dungeonName: dungeonSelection?.dungeon.name || null,
                dungeonImageUrl: dungeonSelection?.dungeon.imageUrl || null,
                selectedAchievements: dungeonSelection?.selectedAchievementIds?.length ? dungeonSelection.selectedAchievementIds : null,
                selectedAchievementNames: dungeonSelection?.selectedAchievementIds?.length && dungeonSelection.dungeon.achievements.length
                    ? dungeonSelection.dungeon.achievements
                        .filter(a => dungeonSelection.selectedAchievementIds.includes(a.id))
                        .map(a => a.challenge.name)
                    : null,
                questId: questSelection?.questId ? String(questSelection.questId) : null,
                questName: questSelection?.questName || null,
                dofusItemAnkamaId: fmLinkedItem?.ankamaId || null,
                dofusItemName: fmLinkedItem?.name || null,
                dofusItemIconUrl: fmLinkedItem?.iconUrl || null,
                priceTiers: validTiers.length ? toJson(validTiers) as unknown as PriceTier[] : null,
                craftMeta: category === "FORGEMAGIE"
                    ? toJson({ fmItems: fmItem || undefined, passTrans: passTrans || undefined, commandeExo: commandeExo ? "oui" : undefined }) as unknown as { fmItems?: string; passTrans?: string; commandeExo?: string }
                    : null,
                professions: selectedJobs.length ? selectedJobs : null,
            });

            if (result.success) {
                toast.success("Annonce publiée !");
                resetForm(); onOpenChange(false); router.refresh();
            } else {
                toast.error(result.error || "Erreur lors de la publication.");
            }
        } catch {
            toast.error("Erreur inattendue.");
        } finally {
            setLoading(false);
        }
    };

    const cat = VISIBLE_CATEGORIES.find(c => c.key === category);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white max-h-[92vh] overflow-y-auto p-0 gap-0">
                {/* Gradient header */}
                <div className={`bg-gradient-to-r ${cat?.color ?? ""} px-6 pt-6 pb-4 border-b border-white/5`}>
                    <DialogTitle className="text-lg font-black flex items-center gap-2.5">
                        <span className={`p-1.5 rounded-lg border shadow-inner ${cat?.accent ?? ""}`}>{cat?.icon}</span>
                        Publier un service
                    </DialogTitle>

                    {/* Category pills */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {VISIBLE_CATEGORIES.map((c) => (
                            <button
                                key={c.key}
                                onClick={() => { setCategory(c.key); setDungeonSelection(null); setQuestSelection(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${category === c.key
                                    ? c.accent
                                    : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                                    }`}
                            >
                                {c.icon}
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-5 px-6 py-5">
                    {/* === PASSAGE_DONJON specific === */}
                    {category === "PASSAGE_DONJON" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Donjon</Label>
                            <DungeonPicker guildId={guildId} onSelect={setDungeonSelection} value={dungeonSelection} />
                        </div>
                    )}

                    {/* === QUETE specific === */}
                    {category === "QUETE" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Quête <span className="text-violet-400 font-normal">via DofusDB</span></Label>
                            <QuestPicker onSelect={setQuestSelection} value={questSelection} showSubCategory />
                        </div>
                    )}

                    {/* === OCRE specific === */}
                    {category === "OCRE" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Pack proposé</Label>
                            <div className="flex gap-2">
                                {OCRE_PACKS.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => setOcrePack(p.value)}
                                        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${ocrePack === p.value
                                            ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-300"
                                            : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* === FORGEMAGIE specific === */}
                    {category === "FORGEMAGIE" && (
                        <div className="space-y-4">
                            {/* Jobs FM avec icônes locales */}
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Métiers FM</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {FM_JOBS.map((job) => (
                                        <button
                                            key={job.id}
                                            type="button"
                                            onClick={() => toggleJob(job.name)}
                                            title={job.name}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[10px] font-medium ${selectedJobs.includes(job.name)
                                                ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                                                : "border-white/8 bg-white/3 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                                                }`}
                                        >
                                            <div className="relative h-10 w-10">
                                                <Image
                                                    src={job.iconUrl}
                                                    alt={job.name}
                                                    fill
                                                    className="object-contain"
                                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                                />
                                            </div>
                                            <span className="leading-tight text-center">{job.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Item lié (optionnel) */}
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    Item lié <span className="text-zinc-600 font-normal">(optionnel)</span>
                                </Label>
                                <DofusItemSearch
                                    category="equipment"
                                    onSelect={setFmLinkedItem}
                                    value={fmLinkedItem}
                                    onClear={() => setFmLinkedItem(null)}
                                    placeholder="Rechercher un item à forgemager..."
                                />
                            </div>

                            {/* Tarifs FM */}
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-zinc-500 text-xs">Tarif FM Items <span className="text-zinc-600">(kamas)</span></Label>
                                    <Input
                                        type="number" value={fmItem}
                                        onChange={(e) => setFmItem(e.target.value)}
                                        placeholder="Ex: 200000"
                                        className="bg-white/5 border-white/10 h-8 text-sm"
                                        min={0} max={10000000}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-zinc-500 text-xs">Passage Trans <span className="text-zinc-600">(kamas)</span></Label>
                                    <Input
                                        type="number" value={passTrans}
                                        onChange={(e) => setPassTrans(e.target.value)}
                                        placeholder="Ex: 500000"
                                        className="bg-white/5 border-white/10 h-8 text-sm"
                                        min={0} max={10000000}
                                    />
                                </div>
                                {/* Commande Exo — OUI/NON */}
                                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                                    <div>
                                        <p className="text-xs font-bold text-zinc-300">Prendre commandes Exo / Over</p>
                                        <p className="text-[10px] text-zinc-600">Acceptez-vous les commandes exo ?</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCommandeExo(v => !v)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${commandeExo ? "bg-amber-500" : "bg-zinc-700"
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${commandeExo ? "translate-x-6" : "translate-x-1"
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Titre *</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                                category === "PASSAGE_DONJON" ? "Ex: Passage Duo + Statue" :
                                    category === "FORGEMAGIE" ? "Ex: FM Cordomage / Forgemage" :
                                        category === "QUETE" ? "Ex: Aide Quête Dimensionnelle Xélor" :
                                            category === "OCRE" ? "Ex: Pack Complet pour Quête Ocre" :
                                                category === "METIER" ? "Ex: Craft Forgeron sur commande" :
                                                    "Titre de votre service"
                            }
                            className="bg-white/5 border-white/10"
                            maxLength={100}
                        />
                    </div>

                    {/* ── Tarifs pour DONJON (intelligent) ── */}
                    {category === "PASSAGE_DONJON" && (() => {
                        const selAchs = dungeonSelection?.dungeon.achievements
                            .filter(a => dungeonSelection.selectedAchievementIds.includes(a.id)) || [];
                        const hasAchs = selAchs.length > 0;

                        // Lignes auto par succès individuel + ligne Simple
                        const soloLabels: string[] = hasAchs
                            ? ["Simple (sans succès)", ...selAchs.map(a => a.challenge.name)]
                            : [];
                        // comboTiers: priceTiers dont le label est un JSON d'IDs (commence par "[")
                        // Distingue les combos des labels texte solo
                        const comboTiers = priceTiers.filter(t => {
                            if (soloLabels.includes(t.label)) return false;
                            try { const p = JSON.parse(t.label); return Array.isArray(p); }
                            catch { return false; }
                        });

                        type ComboMeta = { ids: string[]; price: string };
                        const comboMetas: ComboMeta[] = comboTiers.map((t: typeof priceTiers[number]) => {
                            try { return { ids: JSON.parse(t.label), price: t.price }; }
                            catch { return { ids: [], price: t.price }; }
                        });

                        const addComboTier = () => {
                            if (priceTiers.length >= 8) return;
                            // Démarrer avec les 2 premiers achievements auto-sélectionnés
                            const defaultIds = selAchs.slice(0, 2).map(a => a.id);
                            setPriceTiers(prev => [...prev, { label: JSON.stringify(defaultIds), price: "" }]);
                        };

                        return (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarifs par succès</Label>
                                    <div className="flex items-center gap-2">
                                        {hasAchs && selAchs.length >= 2 && (
                                            <button
                                                type="button"
                                                onClick={addComboTier}
                                                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                                            >
                                                <Plus className="h-3 w-3" /> Combo
                                            </button>
                                        )}
                                        {!hasAchs && priceTiers.length < 6 && (
                                            <button type="button" onClick={addPriceTier} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                                                <Plus className="h-3 w-3" /> Ajouter
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {hasAchs ? (
                                    <div className="space-y-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
                                        <p className="text-[10px] text-cyan-400 font-bold">Prix par configuration :</p>

                                        {/* Lignes solo */}
                                        {soloLabels.map((lbl, i) => {
                                            const existing = priceTiers.find(t => t.label === lbl);
                                            return (
                                                <div key={lbl} className="flex gap-2 items-center">
                                                    <span className={`text-xs font-bold shrink-0 w-44 truncate ${i === 0 ? "text-zinc-400" : "text-cyan-300"}`}>
                                                        {i === 0 ? "⚪" : "✨"} {lbl}
                                                    </span>
                                                    <Input
                                                        value={existing?.price ?? ""}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPriceTiers(prev => {
                                                                const filtered = prev.filter(t => t.label !== lbl);
                                                                return val ? [...filtered, { label: lbl, price: val }] : filtered;
                                                            });
                                                        }}
                                                        placeholder="Ex: 200k"
                                                        className="bg-white/5 border-white/10 h-8 text-sm flex-1"
                                                        maxLength={50}
                                                    />
                                                </div>
                                            );
                                        })}

                                        {/* Lignes combo avec icônes cliquables */}
                                        {comboTiers.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-white/8 space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Combos multi-succès</p>
                                                {comboMetas.map((meta, ci) => {
                                                    const comboTier = comboTiers[ci];
                                                    const tierIdx = priceTiers.indexOf(comboTier);
                                                    // Label lisible : noms des achievements sélectionnés
                                                    const selectedAchNames = selAchs
                                                        .filter(a => meta.ids.includes(a.id))
                                                        .map(a => a.challenge.name);

                                                    const toggleAchInCombo = (achId: string) => {
                                                        const newIds = meta.ids.includes(achId)
                                                            ? meta.ids.filter(id => id !== achId)
                                                            : [...meta.ids, achId];
                                                        updatePriceTier(tierIdx, "label", JSON.stringify(newIds));
                                                    };

                                                    return (
                                                        <div key={tierIdx} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-2">
                                                            {/* Icônes cliquables */}
                                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                                <span className="text-[9px] text-violet-400 font-black uppercase tracking-widest mr-1">Succès :</span>
                                                                {selAchs.map((ach) => {
                                                                    const isOn = meta.ids.includes(ach.id);
                                                                    const iconUrl = `/game-data/achievements/${ach.challenge.slug || ach.challenge.name.toLowerCase().replace(/\s+/g, "-")}.png`;
                                                                    return (
                                                                        <button
                                                                            key={ach.id}
                                                                            type="button"
                                                                            title={ach.challenge.name}
                                                                            onClick={() => toggleAchInCombo(ach.id)}
                                                                            className={`relative w-9 h-9 rounded-lg border-2 transition-all duration-150 overflow-hidden ${isOn
                                                                                ? "border-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)] scale-110"
                                                                                : "border-white/10 opacity-40 hover:opacity-70 hover:border-white/30"
                                                                                }`}
                                                                        >
                                                                            <img
                                                                                src={iconUrl}
                                                                                alt={ach.challenge.name}
                                                                                className="w-full h-full object-contain p-0.5"
                                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                                            />
                                                                            {isOn && (
                                                                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-violet-500 rounded-full flex items-center justify-center">
                                                                                    <span className="text-[7px] text-white font-black">✓</span>
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* Label auto-généré + prix */}
                                                            <div className="flex gap-2 items-center">
                                                                <span className="text-xs text-violet-300 font-bold truncate flex-1 min-w-0">
                                                                    {selectedAchNames.length > 0 ? selectedAchNames.join(" + ") : <span className="text-zinc-600 italic">Aucun succès sélectionné</span>}
                                                                </span>
                                                                <Input
                                                                    value={comboTier.price}
                                                                    onChange={(e) => updatePriceTier(tierIdx, "price", e.target.value)}
                                                                    placeholder="Ex: 350k"
                                                                    className="bg-white/5 border-white/10 w-24 text-sm h-7"
                                                                    maxLength={50}
                                                                />
                                                                <button type="button" onClick={() => removePriceTier(tierIdx)} className="text-zinc-600 hover:text-rose-400 transition-colors shrink-0">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Mode manuel sans achievements */
                                    <div className="space-y-1.5">
                                        {priceTiers.length === 0 ? (
                                            <div className="space-y-1.5">
                                                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 100k / passage" className="bg-white/5 border-white/10" maxLength={100} />
                                                <p className="text-xs text-zinc-600">Sélectionne des succès pour générer les paliers auto, ou &quot;Ajouter&quot; pour des paliers libres.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {priceTiers.map((tier, i) => (
                                                    <div key={i} className="flex gap-2 items-center">
                                                        <Input value={tier.label} onChange={(e) => updatePriceTier(i, "label", e.target.value)} placeholder="Ex: Full succès" className="bg-white/5 border-white/10 flex-1 text-sm h-8" maxLength={100} />
                                                        <Input value={tier.price} onChange={(e) => updatePriceTier(i, "price", e.target.value)} placeholder="Ex: 200k" className="bg-white/5 border-white/10 w-28 text-sm h-8" maxLength={100} />
                                                        <button type="button" onClick={() => removePriceTier(i)} className="text-zinc-600 hover:text-rose-400 transition-colors"><X className="h-4 w-4" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Paliers libres pour QUETE */}
                    {category === "QUETE" && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Paliers de prix</Label>
                                {priceTiers.length < 6 && (
                                    <button type="button" onClick={addPriceTier} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                                        <Plus className="h-3 w-3" /> Ajouter
                                    </button>
                                )}
                            </div>
                            {priceTiers.length === 0 ? (
                                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 100k / passage" className="bg-white/5 border-white/10" maxLength={100} />
                            ) : (
                                <div className="space-y-2">
                                    {priceTiers.map((tier, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input value={tier.label} onChange={(e) => updatePriceTier(i, "label", e.target.value)} placeholder="Ex: Full succès" className="bg-white/5 border-white/10 flex-1 text-sm h-8" maxLength={100} />
                                            <Input value={tier.price} onChange={(e) => updatePriceTier(i, "price", e.target.value)} placeholder="Ex: 200k" className="bg-white/5 border-white/10 w-28 text-sm h-8" maxLength={100} />
                                            <button type="button" onClick={() => removePriceTier(i)} className="text-zinc-600 hover:text-rose-400 transition-colors"><X className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========== METIER ========== */}
                    {category === "METIER" && (
                        <div className="space-y-4">
                            {/* Mode */}
                            <div className="flex gap-2">
                                {(["craft", "pack"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setMetierMode(mode)}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${metierMode === mode
                                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                                            : "border-white/10 bg-white/3 text-zinc-500 hover:border-white/20"
                                            }`}
                                    >
                                        {mode === "craft" ? "🛠️ Craft sur commande" : "📦 Pack montée 1→200"}
                                    </button>
                                ))}
                            </div>

                            {/* Sélection du métier */}
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Métier</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {DOFUS_JOBS.map((job) => (
                                        <button
                                            key={job.id}
                                            type="button"
                                            onClick={() => setSelectedMetierJob(job.name === selectedMetierJob ? "" : job.name)}
                                            title={job.name}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[10px] font-medium ${selectedMetierJob === job.name
                                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                                                : "border-white/8 bg-white/3 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                                                }`}
                                        >
                                            <div className="relative h-8 w-8">
                                                <Image src={job.iconUrl} alt={job.name} fill className="object-contain"
                                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                                />
                                            </div>
                                            <span className="leading-tight text-center">{job.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pack auto 1→200 */}
                            {metierMode === "pack" && (
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                                    <p className="text-xs font-bold text-emerald-400">📦 Pack montée automatique</p>
                                    <p className="text-[11px] text-zinc-400">Définissez un tarif par palier de progression :</p>
                                    <div className="space-y-2">
                                        {[["1 → 50", ""], ["50 → 100", ""], ["100 → 150", ""], ["150 → 200", ""], ["1 → 200 (complet)", ""]].map(([label], i) => {
                                            const tier = priceTiers[i] ?? { label, price: "" };
                                            return (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <span className="text-xs text-zinc-400 w-28 shrink-0">{label}</span>
                                                    <Input
                                                        value={priceTiers[i]?.price ?? ""}
                                                        onChange={(e) => {
                                                            const next = [...priceTiers];
                                                            while (next.length <= i) next.push({ label: [["1 → 50", ""], ["50 → 100", ""], ["100 → 150", ""], ["150 → 200", ""], ["1 → 200 (complet)", ""]][next.length]?.[0] ?? "", price: "" });
                                                            next[i] = { label: tier.label, price: e.target.value };
                                                            setPriceTiers(next.filter(t => t.price));
                                                        }}
                                                        placeholder="Ex: 5M"
                                                        className="bg-white/5 border-white/10 h-8 text-sm"
                                                        maxLength={50}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Prix libre si craft */}
                            {metierMode === "craft" && (
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif <span className="text-zinc-600 font-normal">(kamas)</span></Label>
                                    <Input
                                        type="number" value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="Ex: 100000"
                                        className="bg-white/5 border-white/10"
                                        min={0} max={10000000}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Simple price for AUTRE (not FM, not OCRE, not METIER, not DJ/Quete) */}
                    {category === "AUTRE" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif</Label>
                            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 100k / heure" className="bg-white/5 border-white/10" maxLength={100} />
                        </div>
                    )}

                    {/* Ocre price (after pack radio) */}
                    {category === "OCRE" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif</Label>
                            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 50M kamas" className="bg-white/5 border-white/10" maxLength={100} />
                        </div>
                    )}

                    {/* Dispo — depuis le profil */}
                    <div className="space-y-2">
                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Disponibilité</Label>
                        <AvailabilityPreview guildId={guildId} />
                        <Input
                            value={availability}
                            onChange={(e) => setAvailability(e.target.value)}
                            placeholder="Précision optionnelle (ex: sauf mercredi)"
                            className="bg-white/5 border-white/10 text-xs"
                            maxLength={200}
                        />
                    </div>

                    {/* Contact préféré — checkboxes */}
                    <div className="space-y-2">
                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Contact préféré</Label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setContactDiscord(v => !v)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactDiscord
                                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                                    : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                    }`}
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Ping Discord
                            </button>
                            <button
                                type="button"
                                onClick={() => setContactIngame(v => !v)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactIngame
                                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                                    : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                    }`}
                            >
                                <Gamepad2 className="h-3.5 w-3.5" />
                                Ping en jeu
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-5 bg-slate-900/40 border-t border-white/5 flex gap-3 sticky bottom-0 z-10 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-12 transition-all">Annuler</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !title.trim()}
                        className={`flex-1 font-black h-12 text-white shadow-lg ${CATEGORY_ACCENT[category].includes("cyan") ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20" : CATEGORY_ACCENT[category].includes("amber") ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" : CATEGORY_ACCENT[category].includes("violet") ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/20" : CATEGORY_ACCENT[category].includes("yellow") ? "bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"}`}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
