"use client";

import { useState, useTransition, useRef } from "react";
import {
    Award,
    Plus,
    Trash2,
    Edit3,
    Sparkles,
    Search,
    Shield,
    Eye,
    EyeOff,
    Check,
    Users,
    Flame,
    Crown,
    Star,
    Layers,
    UploadCloud,
    Image as ImageIcon,
    HelpCircle,
    Download,
    Sparkle,
    Zap,
    Coffee,
    Egg,
    Swords,
    CheckCircle2,
    SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    upsertBadgeAction,
    deleteBadgeAction
} from "@/server/actions/badge-actions";
import { cn } from "@/lib/utils";

const RARITY_CONFIG = {
    COMMON: {
        label: "Commun",
        badgeBg: "bg-slate-500/10 text-slate-400 border-slate-500/30",
        border: "border-slate-500/30",
        glow: "shadow-slate-500/5",
        desc: "Accessible facilement (ex: première connexion, profil complété)"
    },
    RARE: {
        label: "Rare",
        badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
        border: "border-sky-500/40",
        glow: "shadow-sky-500/15",
        desc: "Nécessite un accomplissement moyen (ex: 10 donjons faits, niveau 200)"
    },
    EPIC: {
        label: "Épique",
        badgeBg: "bg-violet-500/10 text-violet-400 border-violet-500/30",
        border: "border-violet-500/40",
        glow: "shadow-violet-500/20",
        desc: "Accomplissement majeur (ex: Dofus Ocre terminé, Songes étage 300)"
    },
    LEGENDARY: {
        label: "Légendaire",
        badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        border: "border-amber-500/50",
        glow: "shadow-amber-500/25",
        desc: "Prestige élevé (ex: Donateur Ko-fi, Vainqueur de tournoi, 20k succès)"
    },
    MYTHIC: {
        label: "Mythique",
        badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        border: "border-rose-500/50",
        glow: "shadow-rose-500/30",
        desc: "Trophée ultime ou statut réservé (ex: Mécène Fondateur, Staff historique)"
    },
};

const CATEGORIES = [
    { id: "ALL", label: "Tous", desc: "Toutes les catégories" },
    { id: "COMMUNITY", label: "Communauté", desc: "Animation, entraide, donateurs & participation Discord" },
    { id: "GAMEPLAY", label: "Gameplay & Succès", desc: "Quêtes Dofus, donjons, songes & victoires en jeu" },
    { id: "EVENT", label: "Événements", desc: "Tournois de guilde, rushs temporaires & saisons" },
    { id: "STAFF", label: "Staff & Rôles", desc: "Officiers, modérateurs, animateurs & développeurs" },
    { id: "GUILD", label: "Guilde", desc: "Ancienneté de guilde, fidélité & contributions" },
];

const TRIGGER_RULES = [
    { id: "MANUAL", label: "👑 Manuel (Staff / GOD)", icon: Crown, desc: "Attribué uniquement à la main par le staff ou le SuperAdmin (Tournois, Rôles, etc.)." },
    { id: "KOFI_DONATION", label: "☕ Don Ko-fi", icon: Coffee, desc: "Attribution 100% automatique dès réception d'un don via le Webhook Ko-fi." },
    { id: "DEFI_COUNT", label: "⚔️ Nombre de Défis / Doubles Boss", icon: Swords, desc: "Débloqué quand le joueur coche X défis réussis dans l'onglet Défi." },
    { id: "DOFUS_COUNT", label: "🥚 Nombre de Dofus Obtenus", icon: Egg, desc: "Débloqué quand le joueur valide X Dofus terminés sur SigilOS." },
    { id: "DOFUS_SPECIFIC", label: "✨ Dofus Spécifique", icon: Sparkles, desc: "Débloqué dès que le joueur obtient un Dofus précis (ex: Ocre, Vulbis, Ivoire)." },
    { id: "MISSIONS_COUNT", label: "🎯 Missions de Guilde Validées", icon: CheckCircle2, desc: "Débloqué quand le joueur fait valider X missions par ses officiers." },
];

const DOFUS_CATALOG = [
    { slug: "dofus-ocre", name: "Dofus Ocre", icon: "https://api.iconify.design/lucide:egg.svg?color=%23f59e0b" },
    { slug: "dofus-vulbis", name: "Dofus Vulbis", icon: "https://api.iconify.design/lucide:egg.svg?color=%23ef4444" },
    { slug: "dofus-ivoire", name: "Dofus Ivoire", icon: "https://api.iconify.design/lucide:egg.svg?color=%23f8fafc" },
    { slug: "dofus-ebene", name: "Dofus Ébène", icon: "https://api.iconify.design/lucide:egg.svg?color=%23475569" },
    { slug: "dofus-pourpre", name: "Dofus Pourpre", icon: "https://api.iconify.design/lucide:egg.svg?color=%23dc2626" },
    { slug: "dofus-turquoise", name: "Dofus Turquoise", icon: "https://api.iconify.design/lucide:egg.svg?color=%2306b6d4" },
    { slug: "dofus-emeraude", name: "Dofus Émeraude", icon: "https://api.iconify.design/lucide:egg.svg?color=%2310b981" },
    { slug: "dofus-nebuleux", name: "Dofus Nébuleux", icon: "https://api.iconify.design/lucide:egg.svg?color=%238b5cf6" },
    { slug: "dofus-argente", name: "Dofus Argenté", icon: "https://api.iconify.design/lucide:egg.svg?color=%2394a3b8" },
    { slug: "dofus-sylvestre", name: "Dofus Sylvestre", icon: "https://api.iconify.design/lucide:egg.svg?color=%2315803d" },
    { slug: "dofus-cacao", name: "Dofus Cacao", icon: "https://api.iconify.design/lucide:egg.svg?color=%2378350f" },
    { slug: "dofus-cauchemar", name: "Dofus du Cauchemar", icon: "https://api.iconify.design/lucide:egg.svg?color=%23a855f7" },
    { slug: "dofus-abyssal", name: "Dofus Abyssal", icon: "https://api.iconify.design/lucide:egg.svg?color=%230284c7" },
    { slug: "dofus-forgelave", name: "Dofus Forgelave", icon: "https://api.iconify.design/lucide:egg.svg?color=%23ea580c" },
    { slug: "dofus-des-glaces", name: "Dofus des Glaces", icon: "https://api.iconify.design/lucide:egg.svg?color=%2338bdf8" },
    { slug: "domakuro", name: "Domakuro", icon: "https://api.iconify.design/lucide:egg.svg?color=%2364748b" },
    { slug: "dorigami", name: "Dorigami", icon: "https://api.iconify.design/lucide:egg.svg?color=%23f1f5f9" },
    { slug: "dofus-tache", name: "Dofus Taché", icon: "https://api.iconify.design/lucide:egg.svg?color=%23b45309" },
    { slug: "dofus-kaliptus", name: "Dofus Kaliptus", icon: "https://api.iconify.design/lucide:egg.svg?color=%2384cc16" },
    { slug: "cawotte", name: "Dofus Cawotte", icon: "https://api.iconify.design/lucide:egg.svg?color=%23f97316" },
    { slug: "dokoko", name: "Dokoko", icon: "https://api.iconify.design/lucide:egg.svg?color=%23a16207" },
];

const PRESET_ICONS = [
    { name: "Café Ko-fi", url: "https://storage.ko-fi.com/cdn/brandasset/kofi_s_logo_nolabel.png" },
    { name: "Trophée Or", url: "https://api.iconify.design/lucide:trophy.svg?color=%23f59e0b" },
    { name: "Couronne Royale", url: "https://api.iconify.design/lucide:crown.svg?color=%23eab308" },
    { name: "Flamme Légendaire", url: "https://api.iconify.design/lucide:flame.svg?color=%23f43f5e" },
    { name: "Épées Croisées", url: "https://api.iconify.design/lucide:swords.svg?color=%2338bdf8" },
    { name: "Bouclier Gardien", url: "https://api.iconify.design/lucide:shield-check.svg?color=%2310b981" },
    { name: "Étoile Étincelante", url: "https://api.iconify.design/lucide:sparkles.svg?color=%23a855f7" },
    { name: "Cœur Bienfaiteur", url: "https://api.iconify.design/lucide:heart.svg?color=%23ec4899" },
];

export function GodBadgesPanel({ initialBadges = [] }: { initialBadges: any[] }) {
    const [badges, setBadges] = useState<any[]>(initialBadges);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBadge, setEditingBadge] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    // Form state
    const [formName, setFormName] = useState("");
    const [formSlug, setFormSlug] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formImageUrl, setFormImageUrl] = useState("");
    const [formRarity, setFormRarity] = useState<"COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC">("COMMON");
    const [formCategory, setFormCategory] = useState<"COMMUNITY" | "GAMEPLAY" | "EVENT" | "STAFF" | "GUILD">("COMMUNITY");
    const [formIsSecret, setFormIsSecret] = useState(false);
    const [formIsGodOnly, setFormIsGodOnly] = useState(false);
    const [formSortOrder, setFormSortOrder] = useState(0);

    // Trigger state (#198.2 No-Code Rules Engine)
    const [formTriggerType, setFormTriggerType] = useState<string>("MANUAL");
    const [formTriggerValue, setFormTriggerValue] = useState<string>("");

    // Upload & image picker state
    const [imageTab, setImageTab] = useState<"upload" | "url" | "presets">("upload");
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openCreateDialog = () => {
        setEditingBadge(null);
        setFormName("");
        setFormSlug("");
        setFormDescription("");
        setFormImageUrl("");
        setFormRarity("COMMON");
        setFormCategory("COMMUNITY");
        setFormIsSecret(false);
        setFormIsGodOnly(false);
        setFormSortOrder(badges.length + 1);
        setFormTriggerType("MANUAL");
        setFormTriggerValue("");
        setImageTab("upload");
        setIsDialogOpen(true);
    };

    const openEditDialog = (b: any) => {
        setEditingBadge(b);
        setFormName(b.name);
        setFormSlug(b.slug);
        setFormDescription(b.description || "");
        setFormImageUrl(b.imageUrl);
        setFormRarity(b.rarity || "COMMON");
        setFormCategory(b.category || "COMMUNITY");
        setFormIsSecret(b.isSecret || false);
        setFormIsGodOnly(b.isGodOnly || false);
        setFormSortOrder(b.sortOrder || 0);
        setFormTriggerType(b.triggerType || "MANUAL");
        setFormTriggerValue(b.triggerValue || "");
        setImageTab("url");
        setIsDialogOpen(true);
    };

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Veuillez sélectionner un fichier image valide (PNG, JPG, WebP).");
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", "badge");

            const res = await fetch("/api/god/upload-image", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (data.success && data.url) {
                setFormImageUrl(data.url);
                toast.success("Image importée et optimisée en WebP avec succès !");
            } else {
                toast.error(data.error || "Échec de l'import de l'image.");
            }
        } catch (e) {
            toast.error("Erreur de connexion lors du téléversement.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = () => {
        if (!formName.trim()) {
            toast.error("Le nom du badge est obligatoire.");
            return;
        }

        const autoSlug = formSlug.trim() || formName.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (!formImageUrl.trim()) {
            toast.error("Veuillez choisir ou importer une image pour ce badge.");
            return;
        }

        startTransition(async () => {
            const res = await upsertBadgeAction({
                id: editingBadge?.id,
                name: formName.trim(),
                slug: autoSlug,
                description: formDescription.trim() || null,
                imageUrl: formImageUrl.trim(),
                rarity: formRarity,
                category: formCategory,
                isSecret: formIsSecret,
                isGodOnly: formIsGodOnly,
                sortOrder: Number(formSortOrder) || 0,
                triggerType: formTriggerType,
                triggerValue: formTriggerValue.trim() || null,
            });

            if (res.success && res.data) {
                toast.success(editingBadge ? "Badge mis à jour avec succès !" : "Nouveau badge créé !");
                setBadges((prev) => {
                    const idx = prev.findIndex((b) => b.id === res.data.id);
                    if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], ...res.data };
                        return copy;
                    }
                    return [...prev, { ...res.data, _count: { userBadges: 0 } }];
                });
                setIsDialogOpen(false);
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement du badge.");
            }
        });
    };

    const handleDelete = (badgeId: string, badgeName: string) => {
        if (!confirm(`Confirmer la suppression définitive du badge "${badgeName}" ?`)) return;

        startTransition(async () => {
            const res = await deleteBadgeAction(badgeId);
            if (res.success) {
                toast.success("Badge supprimé.");
                setBadges((prev) => prev.filter((b) => b.id !== badgeId));
            } else {
                toast.error(res.error || "Erreur lors de la suppression.");
            }
        });
    };

    const getTriggerBadgeLabel = (triggerType: string, triggerValue?: string | null) => {
        switch (triggerType) {
            case "KOFI_DONATION":
                return { text: "☕ Auto: Don Ko-fi", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
            case "DEFI_COUNT":
                return { text: `⚔️ Auto: ${triggerValue || "1"} Défi(s)`, color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
            case "DOFUS_COUNT":
                return { text: `🥚 Auto: ${triggerValue || "1"} Dofus`, color: "bg-sky-500/10 text-sky-400 border-sky-500/30" };
            case "DOFUS_SPECIFIC":
                return { text: `✨ Auto: ${triggerValue || "Dofus"}`, color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
            case "MISSIONS_COUNT":
                return { text: `🎯 Auto: ${triggerValue || "1"} Mission(s)`, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
            default:
                return { text: "👑 Manuel Staff", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
        }
    };

    const filteredBadges = badges.filter((b) => {
        const matchesSearch =
            !search.trim() ||
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            (b.description || "").toLowerCase().includes(search.toLowerCase()) ||
            b.slug.toLowerCase().includes(search.toLowerCase());

        const matchesCat = selectedCategory === "ALL" || b.category === selectedCategory;
        return matchesSearch && matchesCat;
    });

    const activeRarity = RARITY_CONFIG[formRarity] || RARITY_CONFIG.COMMON;
    const activeTriggerRule = TRIGGER_RULES.find((t) => t.id === formTriggerType) || TRIGGER_RULES[0];

    return (
        <div className="space-y-6">
            {/* Header explicatif */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface/40 border border-border rounded-3xl backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Award className="w-6 h-6 text-warning" />
                        <h2 className="text-xl font-black tracking-tight text-foreground">
                            Studio Badges & Succès No-Code (#198.2)
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Configurez vos badges de plateforme et leurs règles d'obtention automatiques (Don Ko-fi, Quêtes Dofus, Défis Boss, Missions).
                    </p>
                </div>

                <Button
                    onClick={openCreateDialog}
                    className="bg-warning hover:bg-warning/90 text-warning-foreground font-black px-5 rounded-2xl gap-2 shrink-0 shadow-lg shadow-warning/10"
                >
                    <Plus className="w-4 h-4" />
                    Créer un Nouveau Badge
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
                                selectedCategory === cat.id
                                    ? "bg-warning text-warning-foreground border-warning"
                                    : "bg-surface/60 border-border text-muted-foreground hover:text-foreground hover:bg-surface"
                            )}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un badge..."
                        className="pl-9 bg-surface/60 border-border rounded-xl text-xs h-9"
                    />
                </div>
            </div>

            {/* Grid of Badges */}
            {filteredBadges.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-surface/20 text-muted-foreground text-sm space-y-2">
                    <Award className="w-10 h-10 mx-auto text-muted-foreground/30" />
                    <p className="font-semibold text-foreground">Aucun badge dans cette catégorie</p>
                    <p className="text-xs">Cliquez sur « Créer un Nouveau Badge » ci-dessus pour lancer votre première distinction.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredBadges.map((badge) => {
                        const rarity = RARITY_CONFIG[badge.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.COMMON;
                        const triggerTag = getTriggerBadgeLabel(badge.triggerType, badge.triggerValue);
                        const unlockedCount = badge._count?.userBadges ?? 0;

                        return (
                            <div
                                key={badge.id}
                                className={cn(
                                    "p-5 rounded-3xl bg-surface/50 border transition-all flex flex-col justify-between gap-4 hover:border-warning/40 group relative overflow-hidden",
                                    rarity.border,
                                    rarity.glow
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
                                            <img
                                                src={badge.imageUrl}
                                                alt={badge.name}
                                                className="w-full h-full object-contain drop-shadow-md"
                                                onError={(e) => {
                                                    (e.target as any).src = "https://api.iconify.design/lucide:award.svg";
                                                }}
                                            />
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5", rarity.badgeBg)}>
                                                {rarity.label}
                                            </Badge>
                                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0.5 border", triggerTag.color)}>
                                                {triggerTag.text}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-foreground text-sm leading-tight flex items-center gap-1.5">
                                            {badge.name}
                                            {badge.isSecret && (
                                                <span title="Badge Secret (masqué tant qu'il n'est pas débloqué)">
                                                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
                                            {badge.description || "Aucune condition d'obtention renseignée."}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-warning" />
                                        {unlockedCount} membre(s)
                                    </span>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => openEditDialog(badge)}
                                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(badge.id, badge.name)}
                                            className="w-7 h-7 text-muted-foreground hover:text-danger"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Creation / Edition Modal avec Rules Engine & Upload */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] bg-background border-border text-foreground rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2 text-warning">
                            <Award className="w-5 h-5" />
                            {editingBadge ? `Modifier le Badge « ${editingBadge.name} »` : "Créer un Nouveau Badge"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Zone d'Aperçu en Direct (Live Card Preview) */}
                    <div className="p-4 rounded-2xl bg-surface/60 border border-border space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-warning" /> Aperçu Réel sur Profil Membre
                            </span>
                            <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className={cn("text-[9px] font-black uppercase", activeRarity.badgeBg)}>
                                    {activeRarity.label}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground border-border">
                                    {activeTriggerRule.label}
                                </Badge>
                            </div>
                        </div>

                        <div className={cn("p-4 rounded-2xl bg-surface border flex items-center gap-4 transition-all shadow-md", activeRarity.border, activeRarity.glow)}>
                            <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-inner">
                                {formImageUrl ? (
                                    <img
                                        src={formImageUrl}
                                        alt="Aperçu"
                                        className="w-full h-full object-contain drop-shadow"
                                        onError={(e) => {
                                            (e.target as any).src = "https://api.iconify.design/lucide:award.svg";
                                        }}
                                    />
                                ) : (
                                    <Award className="w-8 h-8 text-muted-foreground/40 animate-pulse" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-foreground truncate">
                                    {formName.trim() || "Nom de votre Badge"}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                    {formDescription.trim() || "Condition d'obtention ou description du trophée"}
                                </p>
                                <span className="text-[10px] font-medium text-muted-foreground/70 block mt-1">
                                    Obtenu le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Formulaire complet */}
                    <div className="space-y-4 text-xs">
                        {/* SECTION 1 : RÈGLE DE DÉBLOCAGE AUTOMATIQUE (TRIGGER ENGINE) */}
                        <div className="p-4 rounded-2xl bg-warning/5 border border-warning/20 space-y-3">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-warning" />
                                <Label className="text-xs font-black text-warning uppercase tracking-wider">
                                    Règle de Déblocage Automatique (#198.2 No-Code)
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-foreground">Mode d'attribution</Label>
                                <select
                                    value={formTriggerType}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setFormTriggerType(type);
                                        if (type === "DOFUS_SPECIFIC" && !formTriggerValue) {
                                            setFormTriggerValue("dofus-ocre");
                                        } else if (type === "DEFI_COUNT" && !formTriggerValue) {
                                            setFormTriggerValue("5");
                                        } else if (type === "DOFUS_COUNT" && !formTriggerValue) {
                                            setFormTriggerValue("6");
                                        }
                                    }}
                                    className="w-full h-9 px-3 rounded-xl bg-surface border border-border text-xs text-foreground font-semibold"
                                >
                                    {TRIGGER_RULES.map((rule) => (
                                        <option key={rule.id} value={rule.id}>
                                            {rule.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">{activeTriggerRule.desc}</p>
                            </div>

                            {/* Condition dynamique selon le type de déclencheur */}
                            {formTriggerType === "DOFUS_SPECIFIC" && (
                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-bold text-foreground">Choisir le Dofus Requis</Label>
                                    <select
                                        value={formTriggerValue || "dofus-ocre"}
                                        onChange={(e) => setFormTriggerValue(e.target.value)}
                                        className="w-full h-9 px-3 rounded-xl bg-surface border border-border text-xs text-foreground font-semibold"
                                    >
                                        {DOFUS_CATALOG.map((dof) => (
                                            <option key={dof.slug} value={dof.slug}>
                                                {dof.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-muted-foreground">Le badge se débloquera dès que le membre valide ce Dofus.</p>
                                </div>
                            )}

                            {(formTriggerType === "DOFUS_COUNT" || formTriggerType === "DEFI_COUNT" || formTriggerType === "MISSIONS_COUNT") && (
                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-bold text-foreground">
                                        Nombre requis (Objectif)
                                    </Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formTriggerValue}
                                        onChange={(e) => setFormTriggerValue(e.target.value)}
                                        placeholder="Ex: 5"
                                        className="bg-surface border-border text-xs h-9 font-bold w-32"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Se débloque dès que le compteur du joueur atteint ou dépasse ce seuil.
                                    </p>
                                </div>
                            )}

                            {formTriggerType === "KOFI_DONATION" && (
                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-bold text-foreground">Montant minimum du Don (Optionnel en €)</Label>
                                    <Input
                                        value={formTriggerValue}
                                        onChange={(e) => setFormTriggerValue(e.target.value)}
                                        placeholder="Ex: 5 (pour 5€ minimum) ou laisser vide"
                                        className="bg-surface border-border text-xs h-9 w-48"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Attribué automatiquement par le webhook Ko-fi dès réception du don.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* SECTION 2 : INFORMATIONS GÉNÉRALES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">Nom du Badge *</Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Tueur de Dragons, Mécène Ko-fi..."
                                    className="bg-surface border-border text-xs h-9"
                                />
                                <p className="text-[11px] text-muted-foreground">Le titre public affiché sur le profil.</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">Identifiant Unique (Slug)</Label>
                                <Input
                                    value={formSlug}
                                    onChange={(e) => setFormSlug(e.target.value)}
                                    placeholder="Auto-généré si vide (ex: tueur-de-dragons)"
                                    className="bg-surface border-border text-xs h-9 font-mono"
                                />
                                <p className="text-[11px] text-muted-foreground">Clé unique utilisée pour l'attribution par script.</p>
                            </div>
                        </div>

                        {/* Condition / Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground">Description & Condition d'obtention</Label>
                            <Input
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Ex: A terrassé le Dragon Cochon sans subir de dégâts"
                                className="bg-surface border-border text-xs h-9"
                            />
                            <p className="text-[11px] text-muted-foreground">Explique au joueur pourquoi ou comment ce badge a été mérité.</p>
                        </div>

                        {/* Image & Icône : Onglets Upload / URL / Presets */}
                        <div className="space-y-2 pt-1">
                            <Label className="text-xs font-bold text-foreground">Icône du Badge (WebP / PNG) *</Label>
                            <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as any)} className="w-full">
                                <TabsList className="grid grid-cols-3 bg-surface border border-border p-1 rounded-xl h-9">
                                    <TabsTrigger value="upload" className="text-xs font-bold gap-1.5">
                                        <UploadCloud className="w-3.5 h-3.5" /> Téléverser (Upload)
                                    </TabsTrigger>
                                    <TabsTrigger value="presets" className="text-xs font-bold gap-1.5">
                                        <Sparkle className="w-3.5 h-3.5" /> Icônes Prêtes
                                    </TabsTrigger>
                                    <TabsTrigger value="url" className="text-xs font-bold gap-1.5">
                                        <ImageIcon className="w-3.5 h-3.5" /> Lien Web / URL
                                    </TabsTrigger>
                                </TabsList>

                                {/* TAB 1: Upload de fichier direct */}
                                <TabsContent value="upload" className="mt-3">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-6 border-2 border-dashed border-border hover:border-warning/60 rounded-2xl bg-surface/30 hover:bg-surface/50 text-center cursor-pointer transition-all space-y-2"
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileUpload(file);
                                            }}
                                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                            className="hidden"
                                        />
                                        <UploadCloud className="w-8 h-8 mx-auto text-warning/70 animate-bounce" />
                                        <p className="font-bold text-foreground text-xs">
                                            {isUploading ? "Optimisation et téléversement en cours..." : "Cliquez pour choisir une image sur votre ordinateur"}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP ou SVG (converti et compressé automatiquement)</p>
                                    </div>
                                </TabsContent>

                                {/* TAB 2: Presets d'icônes */}
                                <TabsContent value="presets" className="mt-3">
                                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-surface/40 border border-border rounded-2xl">
                                        {PRESET_ICONS.map((icon, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setFormImageUrl(icon.url)}
                                                className={cn(
                                                    "p-2 rounded-xl bg-background border flex flex-col items-center justify-center gap-1 hover:border-warning transition-all",
                                                    formImageUrl === icon.url ? "border-warning ring-2 ring-warning/30 bg-warning/5" : "border-border"
                                                )}
                                                title={icon.name}
                                            >
                                                <img src={icon.url} alt={icon.name} className="w-7 h-7 object-contain" />
                                                <span className="text-[9px] font-semibold text-muted-foreground truncate w-full text-center">{icon.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </TabsContent>

                                {/* TAB 3: Saisie directe d'URL */}
                                <TabsContent value="url" className="mt-3">
                                    <Input
                                        value={formImageUrl}
                                        onChange={(e) => setFormImageUrl(e.target.value)}
                                        placeholder="https://storage.ko-fi.com/... ou /uploads/badges/..."
                                        className="bg-surface border-border text-xs h-9"
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Rareté & Catégorie */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">Rareté du Trophée</Label>
                                <select
                                    value={formRarity}
                                    onChange={(e) => setFormRarity(e.target.value as any)}
                                    className="w-full h-9 px-3 rounded-xl bg-surface border border-border text-xs text-foreground font-semibold"
                                >
                                    <option value="COMMON">Commun (Gris) — Accessible</option>
                                    <option value="RARE">Rare (Bleu) — Moyen</option>
                                    <option value="EPIC">Épique (Violet) — Difficile</option>
                                    <option value="LEGENDARY">Légendaire (Or) — Prestigieux</option>
                                    <option value="MYTHIC">Mythique (Rose) — Ultime</option>
                                </select>
                                <p className="text-[11px] text-muted-foreground">{activeRarity.desc}</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground">Catégorie de Classement</Label>
                                <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value as any)}
                                    className="w-full h-9 px-3 rounded-xl bg-surface border border-border text-xs text-foreground font-semibold"
                                >
                                    <option value="COMMUNITY">Communauté (Ko-fi, Discord, Entraide)</option>
                                    <option value="GAMEPLAY">Gameplay & Succès (Quêtes, Donjons)</option>
                                    <option value="EVENT">Événements (Tournois, Saisons)</option>
                                    <option value="STAFF">Staff & Rôles (Modération, Devs)</option>
                                    <option value="GUILD">Guilde (Ancienneté, Dons)</option>
                                </select>
                                <p className="text-[11px] text-muted-foreground">Sert pour le filtrage dans la vitrine du profil.</p>
                            </div>
                        </div>

                        {/* Options Avancées : Badge Secret & SuperAdmin Only */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-surface/50 border border-border cursor-pointer hover:border-warning/50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={formIsSecret}
                                    onChange={(e) => setFormIsSecret(e.target.checked)}
                                    className="rounded border-border text-warning focus:ring-warning mt-0.5"
                                />
                                <div>
                                    <span className="text-xs font-bold text-foreground block">Badge Secret</span>
                                    <span className="text-[10px] text-muted-foreground">Reste masqué avec un point d'interrogation tant que le joueur ne l'a pas débloqué.</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-surface/50 border border-border cursor-pointer hover:border-warning/50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={formIsGodOnly}
                                    onChange={(e) => setFormIsGodOnly(e.target.checked)}
                                    className="rounded border-border text-warning focus:ring-warning mt-0.5"
                                />
                                <div>
                                    <span className="text-xs font-bold text-foreground block">SuperAdmin Only</span>
                                    <span className="text-[10px] text-muted-foreground">Seul le compte GOD / plateforme peut attribuer ce badge (les admins de guilde ne peuvent pas).</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsDialogOpen(false)}
                            className="text-xs font-bold"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isPending || isUploading}
                            className="bg-warning hover:bg-warning/90 text-warning-foreground font-black text-xs px-6 rounded-xl shadow-md"
                        >
                            {isPending ? "Enregistrement..." : editingBadge ? "Mettre à jour le Badge" : "Créer le Badge"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
