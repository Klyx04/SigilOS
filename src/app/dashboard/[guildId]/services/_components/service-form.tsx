"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Loader2, Plus, X, Sword, ScrollText, Hammer, Crown, Wrench, MessageSquare, Gamepad2, ArrowLeft, GraduationCap } from "lucide-react";
import { createServiceListing } from "@/server/actions/service-actions";
import { ServiceCategory } from "@prisma/client";
import { toast } from "sonner";
import { DungeonPicker, type DungeonSelection } from "./dungeon-picker";
import { QuestPicker, type QuestSelection } from "./quest-picker";
import { DofusItemSearch } from "./dofus-item-search";
import { DOFUS_JOBS, type DofusItem } from "@/lib/dofusdude-client";
import { DOFUS_JOBS as _ALL_JOBS_MAP, JOB_CATEGORIES, DOFUS_CLASSES } from "@/lib/dofus-assets";
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
    { key: "OCRE", label: "Quête Ocre", icon: <Crown className="h-5 w-5" />, color: "from-yellow-500/20 to-transparent", accent: "border-yellow-500/60 bg-yellow-500/15 text-yellow-300" },
    { key: "TUTORAT", label: "Tutorat Classe", icon: <GraduationCap className="h-5 w-5" />, color: "from-pink-500/20 to-transparent", accent: "border-pink-500/60 bg-pink-500/15 text-pink-300" },
];

const CATEGORY_ACCENT: Record<ServiceCategory, string> = {
    PASSAGE_DONJON: "border-cyan-500/60 bg-cyan-500/10 text-cyan-300",
    FORGEMAGIE: "border-amber-500/60 bg-amber-500/10 text-amber-300",
    METIER: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
    QUETE: "border-violet-500/60 bg-violet-500/10 text-violet-300",
    OCRE: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300",
    AUTRE: "border-zinc-500/60 bg-zinc-500/10 text-zinc-300",
    TUTORAT: "border-pink-500/60 bg-pink-500/10 text-pink-300",
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export function ServiceForm({ open, onOpenChange, guildId }: ServiceFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

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
    const [ocrePrice, setOcrePrice] = useState("");

    // METIER
    const [metierMode, setMetierMode] = useState<"craft" | "pack">("craft");
    const [selectedMetierJob, setSelectedMetierJob] = useState<string>("");
    const [eleveurOptions, setEleveurOptions] = useState({
        emeraude: { active: false, price: "" },
        dragodinde: { active: false, price: "", gen: "all" as string | number },
        muldo: { active: false, price: "", gen: "all" as string | number },
        volkorne: { active: false, price: "", gen: "all" as string | number },
        pack100: { active: false, price: "" },
        pack1000: { active: false, price: "" },
    });

    // TUTORAT
    const [tutoratBases, setTutoratBases] = useState(false);
    const [tutoratBasesPrice, setTutoratBasesPrice] = useState("");
    const [tutoratAvance, setTutoratAvance] = useState(false);
    const [tutoratAvancePrice, setTutoratAvancePrice] = useState("");
    const [tutoratStuff, setTutoratStuff] = useState(false);
    const [tutoratStuffPrice, setTutoratStuffPrice] = useState("");
    const [tutoratClasses, setTutoratClasses] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            setStep(1);
        }
    }, [open]);

    useEffect(() => {
        if (category === "PASSAGE_DONJON") {
            if (!dungeonSelection) {
                setTitle("");
                return;
            }
            const dungeonName = dungeonSelection.dungeon.name;
            const selAchs = dungeonSelection.dungeon.achievements
                .filter(a => dungeonSelection.selectedAchievementIds.includes(a.id))
                .map(a => a.challenge.name);

            if (selAchs.length === 0) {
                setTitle(`${dungeonName} - Passage classique`);
            } else {
                setTitle(`${dungeonName} - ${selAchs.join(" + ")}`);
            }
        } else if (category === "FORGEMAGIE") {
            if (selectedJobs.length === 0) {
                setTitle("Forgemagie");
            } else {
                setTitle(`Forgemagie - ${selectedJobs.join(" & ")}`);
            }
        } else if (category === "METIER") {
            if (selectedMetierJob === "Éleveur") {
                const raceNames: string[] = [];
                if (eleveurOptions.emeraude.active) raceNames.push("Passage Émeraude");
                if (eleveurOptions.dragodinde.active) raceNames.push("Dragodinde");
                if (eleveurOptions.muldo.active) raceNames.push("Muldo");
                if (eleveurOptions.volkorne.active) raceNames.push("Volkorne");
                if (eleveurOptions.pack100.active) raceNames.push("Pack 100 naissances");
                if (eleveurOptions.pack1000.active) raceNames.push("Pack 1000 naissances");
                setTitle(raceNames.length > 0 ? "Éleveur — " + raceNames.join(" + ") : "Élevage de Montures");
            } else {
                const modeLabel = metierMode === "craft" ? "Craft sur commande" : "Pack 1→200";
                if (!selectedMetierJob) {
                    setTitle(`Artisanat - ${modeLabel}`);
                } else {
                    setTitle(`Artisanat - ${selectedMetierJob} (${modeLabel})`);
                }
            }
        } else if (category === "QUETE") {
            if (!questSelection) {
                setTitle("");
                return;
            }
            setTitle(`Quête - ${questSelection.questName}`);
        } else if (category === "OCRE") {
            const packLabel = OCRE_PACKS.find(p => p.value === ocrePack)?.label || "Quête Ocre";
            setTitle(`Quête Ocre - ${packLabel}`);
        } else if (category === "TUTORAT") {
            const classNames = tutoratClasses.map(id => DOFUS_CLASSES.find(c => c.id === id)?.name).filter(Boolean).join(" / ");
            const activeOpts = [];
            if (tutoratBases) activeOpts.push("Les bases");
            if (tutoratAvance) activeOpts.push("Avancé");
            if (tutoratStuff) activeOpts.push("Les Stuff");
            const prefix = classNames ? `Tutorat ${classNames}` : "Tutorat Classe";
            if (activeOpts.length === 0) {
                setTitle(prefix);
            } else {
                setTitle(`${prefix} - ${activeOpts.join(" & ")}`);
            }
        }
    }, [category, dungeonSelection, selectedJobs, metierMode, selectedMetierJob, questSelection, ocrePack, tutoratBases, tutoratAvance, tutoratStuff, tutoratClasses]);

    const resetForm = () => {
        setStep(1);
        setCategory("PASSAGE_DONJON");
        setTitle(""); setDescription(""); setPrice(""); setAvailability("");
        setContactDiscord(true); setContactIngame(false);
        setDungeonSelection(null); setPriceTiers([]);
        setQuestSelection(null);
        setSelectedJobs([]); setFmItem(""); setPassTrans(""); setCommandeExo(false); setFmLinkedItem(null);
        setOcrePack("boss"); setOcrePrice("");
        setMetierMode("craft"); setSelectedMetierJob("");
        setEleveurOptions({
            emeraude: { active: false, price: "" },
            dragodinde: { active: false, price: "", gen: "all" },
            muldo: { active: false, price: "", gen: "all" },
            volkorne: { active: false, price: "", gen: "all" },
            pack100: { active: false, price: "" },
            pack1000: { active: false, price: "" },
        });
        setTutoratBases(false); setTutoratBasesPrice("");
        setTutoratAvance(false); setTutoratAvancePrice("");
        setTutoratStuff(false); setTutoratStuffPrice("");
        setTutoratClasses([]);
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
        
        // Validation for Éleveur (Breeder)
        if (category === "METIER" && selectedMetierJob === "Éleveur") {
            const hasActive = Object.values(eleveurOptions).some(o => o.active);
            if (!hasActive) {
                toast.error("Veuillez activer au moins une prestation d'élevage.");
                return;
            }
            const activeOptions = Object.entries(eleveurOptions).filter(([_, o]) => o.active);
            const missingPrices = activeOptions.some(([_, o]) => !o.price.trim());
            if (missingPrices) {
                toast.error("Tarif requis pour chaque prestation d'élevage sélectionnée (Gratuit ou somme en kamas).");
                return;
            }
        }

        // Validation for Tutorat
        if (category === "TUTORAT") {
            if (!tutoratBases && !tutoratAvance && !tutoratStuff) {
                toast.error("Veuillez sélectionner au moins une option de tutorat.");
                return;
            }
            if (tutoratBases && !tutoratBasesPrice.trim()) {
                toast.error("Veuillez renseigner un tarif pour l'option 'Les bases'.");
                return;
            }
            if (tutoratAvance && !tutoratAvancePrice.trim()) {
                toast.error("Veuillez renseigner un tarif pour l'option 'Avancé'.");
                return;
            }
            if (tutoratStuff && !tutoratStuffPrice.trim()) {
                toast.error("Veuillez renseigner un tarif pour l'option 'Les Stuff'.");
                return;
            }
        }

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

            // Compile Price Tiers for Breeder
            let finalPriceTiers = validTiers;
            if (category === "METIER" && selectedMetierJob === "Éleveur") {
                const tiers: PriceTier[] = [];
                if (eleveurOptions.emeraude.active) {
                    tiers.push({ label: "Dofus Émeraude (accouplement/naissance)", price: eleveurOptions.emeraude.price.trim() });
                }
                if (eleveurOptions.dragodinde.active) {
                    const genLabel = eleveurOptions.dragodinde.gen === "all" ? "Pack full géné 1→10" : `Génération ${eleveurOptions.dragodinde.gen}`;
                    tiers.push({ label: `Pack Dragodinde (${genLabel})`, price: eleveurOptions.dragodinde.price.trim() });
                }
                if (eleveurOptions.muldo.active) {
                    const genLabel = eleveurOptions.muldo.gen === "all" ? "Pack full géné 1→10" : `Génération ${eleveurOptions.muldo.gen}`;
                    tiers.push({ label: `Pack Muldo (${genLabel})`, price: eleveurOptions.muldo.price.trim() });
                }
                if (eleveurOptions.volkorne.active) {
                    const genLabel = eleveurOptions.volkorne.gen === "all" ? "Pack full géné 1→10" : `Génération ${eleveurOptions.volkorne.gen}`;
                    tiers.push({ label: `Pack Volkorne (${genLabel})`, price: eleveurOptions.volkorne.price.trim() });
                }
                if (eleveurOptions.pack100.active) {
                    tiers.push({ label: "Pack naissance 100 montures", price: eleveurOptions.pack100.price.trim() });
                }
                if (eleveurOptions.pack1000.active) {
                    tiers.push({ label: "Pack naissance 1000 montures", price: eleveurOptions.pack1000.price.trim() });
                }
                finalPriceTiers = tiers;
            } else if (category === "TUTORAT") {
                const tiers: PriceTier[] = [];
                if (tutoratBases) {
                    tiers.push({ label: "Les bases", price: tutoratBasesPrice.trim() });
                }
                if (tutoratAvance) {
                    tiers.push({ label: "Avancé", price: tutoratAvancePrice.trim() });
                }
                if (tutoratStuff) {
                    tiers.push({ label: "Les Stuff", price: tutoratStuffPrice.trim() });
                }
                finalPriceTiers = tiers;
            }

            const result = await createServiceListing(guildId, {
                category,
                title: title.trim(),
                description: description.trim() || null,
                price: (category === "OCRE"
                    ? OCRE_PACKS.find(p => p.value === ocrePack)?.label
                    : (category === "METIER" && selectedMetierJob === "Éleveur")
                        ? "Prestations Élevage"
                        : category === "TUTORAT"
                            ? "Prestations Tutorat"
                            : price.trim()) || null,
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
                priceTiers: category === "OCRE" && ocrePrice.trim()
                    ? toJson([{ label: OCRE_PACKS.find(p => p.value === ocrePack)?.label ?? ocrePack, price: ocrePrice.trim() }]) as unknown as PriceTier[]
                    : finalPriceTiers.length ? toJson(finalPriceTiers) as unknown as PriceTier[] : null,
                craftMeta: category === "FORGEMAGIE"
                    ? toJson({ fmItems: undefined, passTrans: undefined, commandeExo: commandeExo ? "oui" : undefined }) as unknown as { fmItems?: string; passTrans?: string; commandeExo?: string }
                    : null,
                professions: category === "FORGEMAGIE"
                    ? (selectedJobs.length ? selectedJobs : null)
                    : category === "METIER" && selectedMetierJob ? [selectedMetierJob]
                    : category === "TUTORAT" && tutoratClasses.length ? tutoratClasses
                    : null,
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
                {step === 1 ? (
                    <div className="flex flex-col h-full">
                        {/* Gradient header */}
                        <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent px-6 pt-6 pb-5 border-b border-white/5">
                            <DialogTitle className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                🚀 Publier un service
                            </DialogTitle>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                                Sélectionnez la catégorie de service que vous souhaitez proposer à la guilde pour ouvrir son configurateur dédié.
                            </p>
                        </div>

                        <div className="space-y-3 px-6 py-5 overflow-y-auto max-h-[50vh]">
                            {VISIBLE_CATEGORIES.map((c) => {
                                const colors: Record<ServiceCategory, { border: string; text: string; bg: string; iconBorder: string; hoverShadow: string }> = {
                                    PASSAGE_DONJON: { 
                                        border: "hover:border-cyan-500/40", 
                                        text: "text-cyan-400", 
                                        bg: "bg-cyan-500/10", 
                                        iconBorder: "group-hover:border-cyan-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                    },
                                    FORGEMAGIE: { 
                                        border: "hover:border-amber-500/40", 
                                        text: "text-amber-400", 
                                        bg: "bg-amber-500/10", 
                                        iconBorder: "group-hover:border-amber-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                                    },
                                    METIER: { 
                                        border: "hover:border-emerald-500/40", 
                                        text: "text-emerald-400", 
                                        bg: "bg-emerald-500/10", 
                                        iconBorder: "group-hover:border-emerald-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                    },
                                    QUETE: { 
                                        border: "hover:border-violet-500/40", 
                                        text: "text-violet-400", 
                                        bg: "bg-violet-500/10", 
                                        iconBorder: "group-hover:border-violet-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                    },
                                    OCRE: { 
                                        border: "hover:border-yellow-500/40", 
                                        text: "text-yellow-400", 
                                        bg: "bg-yellow-500/10", 
                                        iconBorder: "group-hover:border-yellow-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                                    },
                                    AUTRE: { 
                                        border: "hover:border-white/20", 
                                        text: "text-white", 
                                        bg: "bg-white/10", 
                                        iconBorder: "group-hover:border-white/20",
                                        hoverShadow: "hover:shadow-none"
                                    },
                                    TUTORAT: { 
                                        border: "hover:border-pink-500/40", 
                                        text: "text-pink-400", 
                                        bg: "bg-pink-500/10", 
                                        iconBorder: "group-hover:border-pink-500/30",
                                        hoverShadow: "hover:shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                                    },
                                };
                                const colorInfo = colors[c.key];

                                const descs: Record<ServiceCategory, string> = {
                                    PASSAGE_DONJON: "Proposez des passages de boss avec gestion automatique des succès et tarifs flexibles.",
                                    FORGEMAGIE: "Proposez vos améliorations d'équipements, commandes d'exo ou over-max.",
                                    METIER: "Offrez vos services de fabrication d'objets ou de livraison de packs niveau 1 à 200.",
                                    QUETE: "Aidez d'autres membres de la guilde à valider leurs quêtes Dofus principales.",
                                    OCRE: "Proposez des packs spécifiques d'archimonstres ou d'étapes de l'Éternelle Moisson.",
                                    AUTRE: "Proposez d'autres services libres.",
                                    TUTORAT: "Partagez votre maîtrise d'une classe en accompagnant d'autres joueurs.",
                                };
                                const descText = descs[c.key];

                                return (
                                    <button
                                        key={c.key}
                                        onClick={() => {
                                            setCategory(c.key);
                                            setStep(2);
                                        }}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 group text-left min-h-[96px] md:h-[96px] ${colorInfo.border} ${colorInfo.hoverShadow}`}
                                    >
                                        <div className={`p-3 rounded-xl border border-white/10 transition-all duration-300 group-hover:scale-105 ${colorInfo.bg} ${colorInfo.text} ${colorInfo.iconBorder}`}>
                                            {c.icon}
                                        </div>
                                        <div className="flex-1 space-y-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">{c.label}</h4>
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${colorInfo.text} opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0`}>
                                                    Configurer →
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors leading-normal">{descText}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Gradient header */}
                        <div className={`bg-gradient-to-r ${cat?.color ?? ""} px-6 pt-5 pb-4 border-b border-white/5`}>
                            {/* Return Button */}
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-3"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" /> Changer de service
                            </button>

                            <DialogTitle className="text-lg font-black flex items-center gap-2.5">
                                <span className={`p-1.5 rounded-lg border shadow-inner ${cat?.accent ?? ""}`}>{cat?.icon}</span>
                                Configurer votre annonce
                            </DialogTitle>
                        </div>

                        <div className="space-y-4 px-6 py-5 overflow-y-auto max-h-[62vh]">
                            {/* PASSAGE_DONJON */}
                            {category === "PASSAGE_DONJON" && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Sélectionner le Donjon *</Label>
                                        <DungeonPicker guildId={guildId} onSelect={setDungeonSelection} value={dungeonSelection} />
                                    </div>

                                    {/* Dungeon Thumbnail / Miniature */}
                                    {dungeonSelection?.dungeon.imageUrl && (
                                        <div className="relative flex items-center gap-4 p-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 hover:border-cyan-500/30 transition-all duration-300 group">
                                            {/* Glow background */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />

                                            {/* Square contained image */}
                                            <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 flex-shrink-0">
                                                <Image
                                                    src={dungeonSelection.dungeon.imageUrl}
                                                    alt={dungeonSelection.dungeon.name}
                                                    fill
                                                    className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>

                                            {/* Text block */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest leading-none mb-1.5">Donjon sélectionné</span>
                                                <span className="text-sm font-black text-white leading-tight truncate">{dungeonSelection.dungeon.name}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tarifs par succès */}
                                    {(() => {
                                        const selAchs = dungeonSelection?.dungeon.achievements
                                            .filter(a => dungeonSelection.selectedAchievementIds.includes(a.id)) || [];
                                        const hasAchs = selAchs.length > 0;

                                        const soloLabels: string[] = hasAchs
                                            ? ["Simple (sans succès)", ...selAchs.map(a => a.challenge.name)]
                                            : [];
                                        const comboTiers = priceTiers.filter(t => {
                                            if (soloLabels.includes(t.label)) return false;
                                            try { const p = JSON.parse(t.label); return Array.isArray(p); }
                                            catch { return false; }
                                        });

                                        type ComboMeta = { ids: string[]; price: string };
                                        const comboMetas: ComboMeta[] = comboTiers.map((t) => {
                                            try { return { ids: JSON.parse(t.label), price: t.price }; }
                                            catch { return { ids: [], price: t.price }; }
                                        });

                                        const addComboTier = () => {
                                            if (priceTiers.length >= 8) return;
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

                                                        {comboTiers.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-white/8 space-y-3">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-violet-400">Combos multi-succès</p>
                                                                {comboMetas.map((meta, ci) => {
                                                                    const comboTier = comboTiers[ci];
                                                                    const tierIdx = priceTiers.indexOf(comboTier);
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
                                                    <div className="space-y-1.5">
                                                        {priceTiers.length === 0 ? (
                                                            <div className="space-y-1.5">
                                                                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex: 100k / passage" className="bg-white/5 border-white/10" maxLength={100} />
                                                                <p className="text-xs text-zinc-600">Sélectionnez des succès pour générer les paliers automatiques, ou &quot;Ajouter&quot; pour des paliers libres.</p>
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
                                </div>
                            )}

                            {/* FORGEMAGIE */}
                            {category === "FORGEMAGIE" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Métiers FM *</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {FM_JOBS.map((job) => (
                                                <button
                                                    key={job.id}
                                                    type="button"
                                                    onClick={() => toggleJob(job.name)}
                                                    title={job.name}
                                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-[10px] font-bold ${selectedJobs.includes(job.name)
                                                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                                                        : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                                                        }`}
                                                >
                                                    <div className="relative h-9 w-9">
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

                                    {/* Commande Exo — OUI/NON */}
                                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                                                ✨ Prendre commandes Exo / Over
                                            </p>
                                            <p className="text-[10px] text-zinc-500">Acceptez-vous les commandes exo ou over-stats ?</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCommandeExo(v => !v)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${commandeExo ? "bg-amber-500" : "bg-zinc-700"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${commandeExo ? "translate-x-6" : "translate-x-1"}`} />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif indicatif <span className="text-zinc-600 font-normal">(optionnel)</span></Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-4 h-4 object-contain" />
                                            </div>
                                            <Input
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="Ex: 500k / exo, gratuit pour xp, etc."
                                                className="bg-white/5 border-white/10 pl-9 font-semibold text-sm h-10"
                                                maxLength={100}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* METIER */}
                            {category === "METIER" && (
                                <div className="space-y-4">
                                    {selectedMetierJob !== "Éleveur" && (
                                        <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
                                            {(["craft", "pack"] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => {
                                                        setMetierMode(mode);
                                                        setPrice("");
                                                    }}
                                                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all duration-200 ${metierMode === mode
                                                        ? "bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-sm"
                                                        : "text-zinc-400 hover:text-zinc-200"
                                                        }`}
                                                >
                                                    {mode === "craft" ? "🛠️ Craft sur commande" : "📦 Pack montée 1 → 200"}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Sélectionner le métier *</Label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {DOFUS_JOBS.map((job) => (
                                                <button
                                                    key={job.id}
                                                    type="button"
                                                    onClick={() => setSelectedMetierJob(job.name === selectedMetierJob ? "" : job.name)}
                                                    title={job.name}
                                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-[10px] font-bold ${selectedMetierJob === job.name
                                                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                                                        : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                                                        }`}
                                                >
                                                    <div className="relative h-8 w-8">
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

                                    {selectedMetierJob === "Éleveur" ? (
                                        <div className="space-y-3 border-t border-white/5 pt-4">
                                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">Prestations de l'Éleveur</Label>

                                            {/* Passage Dofus Émeraude */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.emeraude.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/23002-64.png" alt="Dofus Émeraude" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Passage Dofus Émeraude</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Accouplement / Naissance</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            emeraude: { ...prev.emeraude, active: !prev.emeraude.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.emeraude.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                    >
                                                        {eleveurOptions.emeraude.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.emeraude.active && (
                                                    <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="relative flex-1">
                                                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                            </div>
                                                            <Input
                                                                value={eleveurOptions.emeraude.price}
                                                                onChange={(e) => setEleveurOptions(prev => ({
                                                                    ...prev,
                                                                    emeraude: { ...prev.emeraude, price: e.target.value }
                                                                }))}
                                                                placeholder="Ex: 500k ou Gratuit"
                                                                className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pack Dragodinde */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.dragodinde.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-slate-800/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/97016-64.png" alt="Dragodinde" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Pack Dragodinde</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Générations de 1 à 10</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            dragodinde: { ...prev.dragodinde, active: !prev.dragodinde.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.dragodinde.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                    >
                                                        {eleveurOptions.dragodinde.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.dragodinde.active && (
                                                    <div className="mt-3 pl-12 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="flex gap-2">
                                                            <div className="w-1/2 flex items-center gap-2">
                                                                <span className="text-[10px] text-zinc-400 font-bold shrink-0">Choix :</span>
                                                                <select
                                                                    value={eleveurOptions.dragodinde.gen}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        dragodinde: { ...prev.dragodinde, gen: e.target.value === "all" ? "all" : parseInt(e.target.value) }
                                                                    }))}
                                                                    className="bg-black/40 border border-white/10 rounded-lg text-xs h-8 px-2 flex-1 text-white font-bold outline-none focus:border-emerald-500/50"
                                                                >
                                                                    <option value="all" className="bg-zinc-950 text-white">Pack Complet 1→10</option>
                                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                                        <option key={i + 1} value={i + 1} className="bg-zinc-950 text-white">Géné {i + 1}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                    <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                                </div>
                                                                <Input
                                                                    value={eleveurOptions.dragodinde.price}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        dragodinde: { ...prev.dragodinde, price: e.target.value }
                                                                    }))}
                                                                    placeholder="Tarif (kamas)"
                                                                    className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pack Muldo */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.muldo.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-slate-800/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/97299-64.png" alt="Muldo" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Pack Muldo</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Générations de 1 à 10</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            muldo: { ...prev.muldo, active: !prev.muldo.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.muldo.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                     >
                                                        {eleveurOptions.muldo.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.muldo.active && (
                                                    <div className="mt-3 pl-12 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="flex gap-2">
                                                            <div className="w-1/2 flex items-center gap-2">
                                                                <span className="text-[10px] text-zinc-400 font-bold shrink-0">Choix :</span>
                                                                <select
                                                                    value={eleveurOptions.muldo.gen}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        muldo: { ...prev.muldo, gen: e.target.value === "all" ? "all" : parseInt(e.target.value) }
                                                                    }))}
                                                                    className="bg-black/40 border border-white/10 rounded-lg text-xs h-8 px-2 flex-1 text-white font-bold outline-none focus:border-emerald-500/50"
                                                                >
                                                                    <option value="all" className="bg-zinc-950 text-white">Pack Complet 1→10</option>
                                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                                        <option key={i + 1} value={i + 1} className="bg-zinc-950 text-white">Géné {i + 1}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                    <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                                </div>
                                                                <Input
                                                                    value={eleveurOptions.muldo.price}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        muldo: { ...prev.muldo, price: e.target.value }
                                                                    }))}
                                                                    placeholder="Tarif (kamas)"
                                                                    className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pack Volkorne */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.volkorne.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-slate-800/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/97261-64.png" alt="Volkorne" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Pack Volkorne</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Générations de 1 à 10</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            volkorne: { ...prev.volkorne, active: !prev.volkorne.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.volkorne.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                     >
                                                        {eleveurOptions.volkorne.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.volkorne.active && (
                                                    <div className="mt-3 pl-12 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="flex gap-2">
                                                            <div className="w-1/2 flex items-center gap-2">
                                                                <span className="text-[10px] text-zinc-400 font-bold shrink-0">Choix :</span>
                                                                <select
                                                                    value={eleveurOptions.volkorne.gen}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        volkorne: { ...prev.volkorne, gen: e.target.value === "all" ? "all" : parseInt(e.target.value) }
                                                                    }))}
                                                                    className="bg-black/40 border border-white/10 rounded-lg text-xs h-8 px-2 flex-1 text-white font-bold outline-none focus:border-emerald-500/50"
                                                                >
                                                                    <option value="all" className="bg-zinc-950 text-white">Pack Complet 1→10</option>
                                                                    {Array.from({ length: 10 }).map((_, i) => (
                                                                        <option key={i + 1} value={i + 1} className="bg-zinc-950 text-white">Géné {i + 1}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="relative flex-1">
                                                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                    <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                                </div>
                                                                <Input
                                                                    value={eleveurOptions.volkorne.price}
                                                                    onChange={(e) => setEleveurOptions(prev => ({
                                                                        ...prev,
                                                                        volkorne: { ...prev.volkorne, price: e.target.value }
                                                                    }))}
                                                                    placeholder="Tarif (kamas)"
                                                                    className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pack naissance 100 montures */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.pack100.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-slate-800/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/93104-64.png" alt="100 montures" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Pack naissance 100 montures</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Kit d'accouplements prêt à naître</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            pack100: { ...prev.pack100, active: !prev.pack100.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.pack100.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                    >
                                                        {eleveurOptions.pack100.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.pack100.active && (
                                                    <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="relative flex-1">
                                                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                            </div>
                                                            <Input
                                                                value={eleveurOptions.pack100.price}
                                                                onChange={(e) => setEleveurOptions(prev => ({
                                                                    ...prev,
                                                                    pack100: { ...prev.pack100, price: e.target.value }
                                                                }))}
                                                                placeholder="Ex: 2M ou 2 000 000"
                                                                className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pack naissance 1000 montures */}
                                            <div className={`p-3 rounded-2xl border transition-all duration-300 ${eleveurOptions.pack1000.active ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-9 h-9 shrink-0 bg-slate-800/40 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        <Image src="https://api.dofusdu.de/dofus3/v1/img/item/93293-64.png" alt="1000 montures" fill className="object-contain p-1" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-zinc-200 leading-tight">Pack naissance 1000 montures</p>
                                                        <p className="text-[9px] text-zinc-500 font-medium">Élevage industriel prêt à naître</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEleveurOptions(prev => ({
                                                            ...prev,
                                                            pack1000: { ...prev.pack1000, active: !prev.pack1000.active }
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${eleveurOptions.pack1000.active ? "bg-emerald-500 text-black font-black hover:bg-emerald-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                    >
                                                        {eleveurOptions.pack1000.active ? "Activé" : "Proposer"}
                                                    </button>
                                                </div>
                                                {eleveurOptions.pack1000.active && (
                                                    <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="relative flex-1">
                                                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                            </div>
                                                            <Input
                                                                value={eleveurOptions.pack1000.price}
                                                                onChange={(e) => setEleveurOptions(prev => ({
                                                                    ...prev,
                                                                    pack1000: { ...prev.pack1000, price: e.target.value }
                                                                }))}
                                                                placeholder="Ex: 15M ou 15 000 000"
                                                                className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                                {metierMode === "craft" ? "Tarif du Craft / Recette" : "Tarif du Pack Complet 1 → 200"}
                                            </Label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                                                    <img src="/assets/icons/kama.png" alt="kamas" className="w-4 h-4 object-contain" />
                                                </div>
                                                <Input
                                                    value={price}
                                                    onChange={(e) => setPrice(e.target.value)}
                                                    placeholder={metierMode === "craft" ? "Ex: 10k par craft, ou gratuit" : "Ex: 10M ou 10 000 000"}
                                                    className="bg-white/5 border-white/10 pl-9 font-semibold text-sm h-10"
                                                    maxLength={50}
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500 italic">
                                                {metierMode === "craft"
                                                    ? "Indiquez votre prix par craft ou coop."
                                                    : "Prix global pour fournir l'intégralité des ressources du niveau 1 à 200."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* QUETE */}
                            {category === "QUETE" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Sélectionner la quête *</Label>
                                        <QuestPicker onSelect={setQuestSelection} value={questSelection} showSubCategory />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif <span className="text-zinc-600 font-normal">(optionnel)</span></Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-4 h-4 object-contain" />
                                            </div>
                                            <Input
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="Ex: 500k ou Gratuit"
                                                className="bg-white/5 border-white/10 pl-9 font-semibold text-sm h-10"
                                                maxLength={50}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Remarque / Détails</Label>
                                        <Input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Ex: Dispo pour combats, étapes spécifiques, etc."
                                            className="bg-white/5 border-white/10 text-sm h-10"
                                            maxLength={300}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* OCRE */}
                            {category === "OCRE" && (
                                <div className="space-y-4">
                                    {/* Beautiful Dofus Card */}
                                    <div className="flex gap-4 items-center p-3.5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
                                        <div className="relative w-14 h-14 shrink-0 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
                                            <Image
                                                src="/assets/icons/ocre.png"
                                                alt="Dofus Ocre"
                                                width={48}
                                                height={48}
                                                className="object-contain animate-pulse"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] text-yellow-500 font-black uppercase tracking-widest leading-none">L'Éternelle Moisson</span>
                                            <h4 className="text-sm font-black text-white leading-tight">Dofus Ocre</h4>
                                            <p className="text-[10px] text-zinc-500 leading-normal">Configurez vos packs ou services liés à la quête Ocre.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Pack proposé *</Label>
                                        <div className="flex gap-2">
                                            {OCRE_PACKS.map((p) => (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setOcrePack(p.value)}
                                                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-black border transition-all duration-200 ${ocrePack === p.value
                                                        ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                                                        : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                                                        }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif <span className="text-zinc-600 font-normal">(kamas — optionnel)</span></Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                                                <img src="/assets/icons/kama.png" alt="kamas" className="w-4 h-4 object-contain" />
                                            </div>
                                            <Input
                                                value={ocrePrice}
                                                onChange={(e) => setOcrePrice(e.target.value)}
                                                placeholder="Ex: 50M ou 50 000 000"
                                                className="bg-white/5 border-white/10 pl-9 font-semibold text-sm h-10"
                                                maxLength={50}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TUTORAT */}
                            {category === "TUTORAT" && (
                                <div className="space-y-4">
                                    {/* Design Header Card for Tutorat */}
                                    <div className="flex gap-4 items-center p-3.5 rounded-2xl border border-pink-500/20 bg-pink-500/5 shadow-[0_0_20px_rgba(236,72,153,0.05)]">
                                        <div className="relative w-14 h-14 shrink-0 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20 shadow-[0_0_12px_rgba(236,72,153,0.15)] text-pink-400">
                                            <GraduationCap className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] text-pink-500 font-black uppercase tracking-widest leading-none">Académie SigilOS</span>
                                            <h4 className="text-sm font-black text-white leading-tight">Tutorat de Classe</h4>
                                            <p className="text-[10px] text-zinc-500 leading-normal">Partagez votre expertise ou proposez d'accompagner des membres sur leur classe.</p>
                                        </div>
                                    </div>

                                    {/* Class Picker */}
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                            Classes proposées <span className="text-zinc-600 font-normal">(optionnel)</span>
                                        </Label>
                                        <div className="grid grid-cols-5 gap-2 p-3 rounded-2xl border border-white/8 bg-white/[0.02]">
                                            {[...DOFUS_CLASSES].sort((a, b) => a.name.localeCompare(b.name)).map((cls) => {
                                                const isSelected = tutoratClasses.includes(cls.id);
                                                return (
                                                    <button
                                                        key={cls.id}
                                                        type="button"
                                                        title={cls.name}
                                                        onClick={() => setTutoratClasses(prev =>
                                                            prev.includes(cls.id)
                                                                ? prev.filter(id => id !== cls.id)
                                                                : [...prev, cls.id]
                                                        )}
                                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all duration-200 group ${
                                                            isSelected
                                                                ? "border-pink-500/70 bg-pink-500/15 shadow-[0_0_10px_rgba(236,72,153,0.2)]"
                                                                : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                                                        }`}
                                                    >
                                                        <div className="relative w-9 h-9 transition-transform duration-200 group-hover:scale-110">
                                                            <img
                                                                src={cls.icon}
                                                                alt={cls.name}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                        <span className={`text-[9px] font-bold leading-none text-center truncate w-full ${
                                                            isSelected ? "text-pink-300" : "text-zinc-500 group-hover:text-zinc-300"
                                                        }`}>{cls.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {tutoratClasses.length > 0 && (
                                            <p className="text-[10px] text-pink-400 font-bold">
                                                🎓 {tutoratClasses.length} classe{tutoratClasses.length > 1 ? "s" : ""} sélectionnée{tutoratClasses.length > 1 ? "s" : ""}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-3 border-t border-white/5 pt-4">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-1">Prestations de Tutorat</Label>

                                        {/* Les bases */}
                                        <div className={`p-3 rounded-2xl border transition-all duration-300 ${tutoratBases ? "border-pink-500/30 bg-pink-500/5 shadow-[0_0_15px_rgba(236,72,153,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 shrink-0 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20 shadow-inner text-pink-400">
                                                    <span className="text-xs font-black">1</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-zinc-200 leading-tight">Les bases</p>
                                                    <p className="text-[9px] text-zinc-500 font-medium">Sorts, caractéristiques, mécaniques élémentaires</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTutoratBases(!tutoratBases)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${tutoratBases ? "bg-pink-500 text-black font-black hover:bg-pink-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                >
                                                    {tutoratBases ? "Activé" : "Proposer"}
                                                </button>
                                            </div>
                                            {tutoratBases && (
                                                <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="relative flex-1">
                                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                            <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                        </div>
                                                        <Input
                                                            value={tutoratBasesPrice}
                                                            onChange={(e) => setTutoratBasesPrice(e.target.value)}
                                                            placeholder="Ex: 100k ou Gratuit"
                                                            className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Avancé */}
                                        <div className={`p-3 rounded-2xl border transition-all duration-300 ${tutoratAvance ? "border-pink-500/30 bg-pink-500/5 shadow-[0_0_15px_rgba(236,72,153,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 shrink-0 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20 shadow-inner text-pink-400">
                                                    <span className="text-xs font-black">2</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-zinc-200 leading-tight">Avancé</p>
                                                    <p className="text-[9px] text-zinc-500 font-medium">Combos complexes, modes de jeu, optimisation combat</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTutoratAvance(!tutoratAvance)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${tutoratAvance ? "bg-pink-500 text-black font-black hover:bg-pink-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                >
                                                    {tutoratAvance ? "Activé" : "Proposer"}
                                                </button>
                                            </div>
                                            {tutoratAvance && (
                                                <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="relative flex-1">
                                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                            <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                        </div>
                                                        <Input
                                                            value={tutoratAvancePrice}
                                                            onChange={(e) => setTutoratAvancePrice(e.target.value)}
                                                            placeholder="Ex: 200k ou Gratuit"
                                                            className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Les Stuff */}
                                        <div className={`p-3 rounded-2xl border transition-all duration-300 ${tutoratStuff ? "border-pink-500/30 bg-pink-500/5 shadow-[0_0_15px_rgba(236,72,153,0.05)]" : "border-white/5 bg-white/[0.01] opacity-75 hover:opacity-100"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 shrink-0 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20 shadow-inner text-pink-400">
                                                    <span className="text-xs font-black">3</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-zinc-200 leading-tight">Les Stuff</p>
                                                    <p className="text-[9px] text-zinc-500 font-medium">Théorie et proposition de builds d'équipements adaptés</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTutoratStuff(!tutoratStuff)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${tutoratStuff ? "bg-pink-500 text-black font-black hover:bg-pink-400" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                                                >
                                                    {tutoratStuff ? "Activé" : "Proposer"}
                                                </button>
                                            </div>
                                            {tutoratStuff && (
                                                <div className="mt-3 pl-12 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="relative flex-1">
                                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                                                            <img src="/assets/icons/kama.png" alt="kamas" className="w-3.5 h-3.5 object-contain" />
                                                        </div>
                                                        <Input
                                                            value={tutoratStuffPrice}
                                                            onChange={(e) => setTutoratStuffPrice(e.target.value)}
                                                            placeholder="Ex: Gratuit ou 150k"
                                                            className="bg-black/40 border-white/10 pl-8 text-xs h-8 font-semibold rounded-lg text-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Description for non-Quete categories */}
                            {category !== "QUETE" && (
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Remarque / Détails</Label>
                                    <Input
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Ex: dispo en soirée, contactez-moi avant, etc."
                                        className="bg-white/5 border-white/10 text-sm h-10"
                                        maxLength={300}
                                    />
                                </div>
                            )}

                            {/* Availability */}
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Disponibilité</Label>
                                <AvailabilityPreview guildId={guildId} />
                                <Input
                                    value={availability}
                                    onChange={(e) => setAvailability(e.target.value)}
                                    placeholder="Précision optionnelle (ex: sauf mercredi)"
                                    className="bg-white/5 border-white/10 text-xs h-9"
                                    maxLength={200}
                                />
                            </div>

                            {/* Contact Method */}
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Contact préféré</Label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setContactDiscord(v => !v)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${contactDiscord
                                            ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                                            : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                            }`}
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Ping Discord
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContactIngame(v => !v)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${contactIngame
                                            ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                                            : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                            }`}
                                    >
                                        <Gamepad2 className="h-3.5 w-3.5" />
                                        Ping en jeu
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-slate-900/40 border-t border-white/5 flex gap-3 sticky bottom-0 z-10 mt-auto">
                            <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-12 transition-all">Retour</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={loading || !title.trim()}
                                className={`flex-1 font-black h-12 text-white shadow-lg ${CATEGORY_ACCENT[category].includes("cyan") ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20" : CATEGORY_ACCENT[category].includes("amber") ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" : CATEGORY_ACCENT[category].includes("violet") ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/20" : CATEGORY_ACCENT[category].includes("yellow") ? "bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20" : CATEGORY_ACCENT[category].includes("pink") ? "bg-pink-600 hover:bg-pink-500 shadow-pink-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"}`}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
