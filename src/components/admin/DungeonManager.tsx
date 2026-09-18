"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    getDungeonsWithAchievements,
    createDungeon,
    updateDungeon,
    deleteDungeon,
    getChallenges,
} from "@/server/actions/game-data-admin-actions";
import { ImageDownloader } from "./ImageDownloader";
import { DungeonMapPicker } from "./DungeonMapPicker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Search, Plus, MapPin, Trophy, ShieldAlert, Swords, Skull, MoreHorizontal, Edit2, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { siphonAnomalyBossesNow } from "@/server/actions/anomaly-boss-admin-actions";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    dpnlUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    dofensiveUrl?: string | null;
    imageUrl?: string | null;
    isExpedition: boolean;
    expeditionModes?: string[] | null;
    expeditionMechanics?: string | null;
    isOcreQuest?: boolean;
    mapId?: number | null;
    /* Chantier double boss — dissociation affichage / résolution Dofensive. */
    dofensiveMonsterName?: string | null;
    dofensiveDungeonName?: string | null;
    /* Chantier donjon sans succès. */
    isNoAchievement?: boolean;
    /* Chantier « boss d'anomalie » — contenu SIPHONNÉ (jamais saisi à la main : préférer le bouton Siphonner). */
    isAnomalyBoss?: boolean | null;
    anomalyMapId?: number | null;
    anomalyFamily?: string | null;
    achievements: { challengeId: string; challenge: { name: string; slug: string; iconUrl?: string | null } }[];
}

interface Challenge {
    id: string;
    name: string;
    slug: string;
    iconUrl?: string | null;
}

const EXPEDITION_MODES = [
    { label: "Bravoure", value: "BRAVOURE", color: 0xeab308 }, // Yellow
    { label: "Audace", value: "AUDACE", color: 0xef4444 },   // Red
    { label: "Normal", value: "NORMAL", color: 0x3b82f6 },   // Blue
];

export default function DungeonManager() {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [challengeSearch, setChallengeSearch] = useState("");
    const [selectedLevel, setSelectedLevel] = useState<string>("all");
    // Filtre « type » du catalogue (chantier boss d'anomalie) : all | anomaly | classic.
    const [selectedKind, setSelectedKind] = useState<string>("all");
    const [siphoning, setSiphoning] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        bossName: "",
        level: 100,
        dpnlUrl: "",
        dofuspourlesnoobsUrl: "",
        dofensiveUrl: "",
        imageUrl: "",
        isExpedition: false,
        expeditionModes: [] as string[],
        expeditionMechanics: "",
        isOcreQuest: false,
        mapId: null as number | null,
        challengeIds: [] as string[],
        /* Chantier double boss / donjon sans succès. */
        dofensiveMonsterName: "",
        dofensiveDungeonName: "",
        isNoAchievement: false,
        isAnomalyBoss: false,
    });

    useEffect(() => {
        loadData();
    }, [selectedLevel]);

    async function loadData() {
        setLoading(true);
        
        const filters: any = {};
        if (selectedLevel !== "all") {
            if (selectedLevel === "200") {
                filters.minLevel = 200;
                filters.maxLevel = 1000;
            } else {
                const [min, max] = selectedLevel.split("-").map(Number);
                if (!isNaN(min)) filters.minLevel = min;
                if (!isNaN(max)) filters.maxLevel = max;
            }
        }

        const [dungeonsRes, challengesRes] = await Promise.all([
            getDungeonsWithAchievements(filters),
            getChallenges()
        ]);

        if (dungeonsRes.success && dungeonsRes.data) {
            setDungeons(dungeonsRes.data);
            if (selectedLevel !== "all") {
                toast.info(`${dungeonsRes.data.length} donjons trouvés`);
            }
        } else {
            toast.error(dungeonsRes.error || "Erreur chargement donjons");
        }

        if (challengesRes.success && challengesRes.data) {
            setChallenges(challengesRes.data);
        }

        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validation simple
        if (!formData.name || !formData.bossName) {
            toast.error("Nom et Boss requis");
            return;
        }

        const payload = {
            ...formData,
            // Ensure expedition modes is undefined if not expedition
            expeditionModes: formData.isExpedition ? formData.expeditionModes : undefined,
            expeditionMechanics: formData.isExpedition ? formData.expeditionMechanics : undefined,
        } as any; // Type cast to avoid excessive TS strictness with the exact Enum types on client side

        const result = editing
            ? await updateDungeon(editing, payload)
            : await createDungeon(payload);

        if (result.success) {
            toast.success(editing ? "Donjon mis à jour" : "Donjon créé");
            resetForm();
            setIsDialogOpen(false);
            loadData();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Êtes-vous sûr de supprimer ce donjon ?")) return;

        const result = await deleteDungeon(id);
        if (result.success) {
            toast.success("Donjon supprimé");
            loadData();
        } else {
            toast.error(result.error || "Erreur de suppression");
        }
    }

    function resetForm() {
        setEditing(null);
        setChallengeSearch("");
        setFormData({
            name: "",
            bossName: "",
            level: 100,
            dpnlUrl: "",
            dofuspourlesnoobsUrl: "",
            dofensiveUrl: "",
            imageUrl: "",
            isExpedition: false,
            expeditionModes: [],
            expeditionMechanics: "",
            isOcreQuest: false,
            mapId: null,
            challengeIds: [],
            dofensiveMonsterName: "",
            dofensiveDungeonName: "",
            isNoAchievement: false,
            isAnomalyBoss: false,
        });
    }

    function startEdit(dungeon: Dungeon) {
        setEditing(dungeon.id);
        setChallengeSearch("");
        setFormData({
            name: dungeon.name,
            bossName: dungeon.bossName,
            level: dungeon.level,
            dpnlUrl: dungeon.dpnlUrl || "",
            dofuspourlesnoobsUrl: dungeon.dofuspourlesnoobsUrl || "",
            dofensiveUrl: dungeon.dofensiveUrl || "",
            imageUrl: dungeon.imageUrl || "",
            isExpedition: dungeon.isExpedition,
            expeditionModes: dungeon.expeditionModes || [],
            expeditionMechanics: dungeon.expeditionMechanics || "",
            isOcreQuest: dungeon.isOcreQuest ?? false,
            mapId: dungeon.mapId ?? null,
            challengeIds: dungeon.achievements.map(a => a.challengeId),
            dofensiveMonsterName: dungeon.dofensiveMonsterName || "",
            dofensiveDungeonName: dungeon.dofensiveDungeonName || "",
            isNoAchievement: dungeon.isNoAchievement ?? false,
            isAnomalyBoss: dungeon.isAnomalyBoss ?? false,
        });
        setIsDialogOpen(true);
    }



    const filteredDungeons = dungeons.filter((d) => {
        const matchSearch =
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.bossName.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;
        // Filtre « type » : boss d'anomalie (siphonné) vs donjons classiques.
        if (selectedKind === "anomaly") return !!d.isAnomalyBoss;
        if (selectedKind === "classic") return !d.isAnomalyBoss;
        return true;
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-surface/50 p-4 rounded-lg border border-border/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un donjon ou un boss..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-elevated border-border text-foreground placeholder:text-muted-foreground focus:ring-ring/50"
                    />
                </div>

                {/* Level Filter */}
                <div className="w-full md:w-48">
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                        <SelectTrigger className="bg-elevated border-border text-foreground">
                            <SelectValue placeholder="Filtrer par niveau" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            <SelectItem value="all">Tous les niveaux</SelectItem>
                            <SelectItem value="1-50">Niveau 1 - 50</SelectItem>
                            <SelectItem value="51-100">Niveau 51 - 100</SelectItem>
                            <SelectItem value="101-150">Niveau 101 - 150</SelectItem>
                            <SelectItem value="151-199">Niveau 151 - 199</SelectItem>
                            <SelectItem value="200">Niveau 200</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Type Filter (chantier boss d'anomalie) */}
                <div className="w-full md:w-52">
                    <Select value={selectedKind} onValueChange={setSelectedKind}>
                        <SelectTrigger className="bg-elevated border-border text-foreground">
                            <SelectValue placeholder="Filtrer par type" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            <SelectItem value="all">Tous les types</SelectItem>
                            <SelectItem value="classic">Donjons classiques</SelectItem>
                            <SelectItem value="anomaly">🌀 Fiches Anomalies</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Siphon du contenu d'anomalie (liste DofusDB race 191 + cartes/sorts/icônes Dofensive) */}
                <Button
                    variant="outline"
                    disabled={siphoning}
                    onClick={async () => {
                        setSiphoning(true);
                        try {
                            const res = await siphonAnomalyBossesNow();
                            if (res.success && res.data) {
                                const bosses = res.data.guardians.filter((g) => g.isBoss).length;
                                const defaults = res.data.guardians.filter((g) => g.isDefaultMap).length;
                                const companions = res.data.companions.length;
                                const unvalidated = res.data.companions.filter((c) => !c.validated).length;
                                toast.success(
                                    `${bosses} boss d'anomalie en fiche (${res.data.guardians.length} gardiens, ${defaults} en map par défaut) · ` +
                                    `${companions} monstre(s) de l'anomalie${unvalidated ? ` (${unvalidated} non validé(s) — famille Dofensive non lue)` : ""}` +
                                    (res.data.errors.length ? ` — ${res.data.errors.length} erreur(s)` : "")
                                );
                                loadData();
                            } else {
                                toast.error(res.error || "Siphon impossible");
                            }
                        } catch {
                            toast.error("Siphon impossible");
                        } finally {
                            setSiphoning(false);
                        }
                    }}
                    className="w-full md:w-auto border-info/40 text-info hover:bg-info/10"
                    title="Siphonne les Gardiens des anomalies (DofusDB race 191 + Dofensive) : cartes, sorts, icônes"
                >
                    {siphoning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <img src="/assets/missions/ano1.png" alt="" aria-hidden className="w-4 h-4 mr-2 object-contain" />}
                    Siphonner les boss d'anomalie
                </Button>
                <Button
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    className="w-full md:w-auto bg-info hover:bg-info shadow-lg shadow-indigo-900/20 transition-all font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Donjon
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement des donjons...</div>
            ) : filteredDungeons.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-surface/30 rounded-lg border border-dashed border-border">
                    Aucun donjon trouvé
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredDungeons.map((dungeon) => (
                        <div
                            key={dungeon.id}
                            className="group relative bg-surface/40 border border-border rounded-xl overflow-hidden hover:border-info/30 hover:shadow-xl hover:shadow-indigo-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 hover:bg-elevated text-muted-foreground">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-surface border-border">
                                        <DropdownMenuItem onClick={() => startEdit(dungeon)} className="text-foreground focus:bg-elevated cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-info" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(dungeon.id)} className="text-danger focus:bg-danger/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex flex-col h-full gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-elevated shrink-0 border border-border group-hover:border-info/50 transition-colors">
                                        {dungeon.imageUrl ? (
                                            <img
                                                src={dungeon.imageUrl}
                                                alt={dungeon.bossName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <ImageIcon className="w-8 h-8" />
                                            </div>
                                        )}
                                        {dungeon.isExpedition && (
                                            <div className="absolute bottom-0 inset-x-0 bg-info/90 text-caption text-center text-info-foreground py-0.5 font-bold uppercase tracking-wider">
                                                Expé
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-foreground truncate group-hover:text-info transition-colors">
                                                {dungeon.name}
                                            </h3>
                                            {dungeon.isOcreQuest && (
                                                <Badge variant="outline" className="bg-warning/20 border-warning/30 text-warning text-caption h-5 gap-1 shrink-0" title="Donjon de la Quête Ocre">
                                                    <img src="/module-dofus/Dofus_Ocre.png" alt="" className="w-3 h-3 object-contain" />
                                                    Quête Ocre
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Skull className="w-3.5 h-3.5" />
                                            <span className="truncate">{dungeon.bossName}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge variant="outline" className="bg-background/50 border-border text-muted-foreground text-caption h-5">
                                                Lvl {dungeon.level}
                                            </Badge>
                                            {/* Chantier « boss d'anomalie » : contenu siphonné (carte de combat + famille). */}
                                            {dungeon.isAnomalyBoss && (
                                                <Badge variant="outline" className="bg-info/20 border-info/30 text-info text-caption h-5 gap-1" title={dungeon.anomalyFamily || "Gardiens des anomalies"}>
                                                    <img src="/assets/missions/ano1.png" alt="" aria-hidden className="w-3 h-3 object-contain" />
                                                    Anomalie
                                                </Badge>
                                            )}
                                            {dungeon.achievements.length > 0 && (
                                                <Badge variant="outline" className="bg-warning/20 border-warning/30 text-warning text-caption h-5 gap-1">
                                                    <Trophy className="w-3 h-3" />
                                                    {dungeon.achievements.length}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expedition Modes */}
                                {dungeon.isExpedition && dungeon.expeditionModes && dungeon.expeditionModes.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t border-border/50">
                                        {dungeon.expeditionModes.map(mode => (
                                            <span key={mode} className="text-caption uppercase font-bold px-1.5 py-0.5 rounded bg-info/30 text-info border border-info/30">
                                                {mode}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Challenges Preview (Compact) */}
                                {dungeon.achievements.length > 0 && (
                                    <div className="flex gap-1 overflow-hidden pt-2 mt-auto border-t border-border/50">
                                        {dungeon.achievements.slice(0, 5).map(({ challenge }) => (
                                            <div key={challenge.slug} className="w-6 h-6 rounded bg-elevated/80 p-0.5 border border-border" title={challenge.name}>
                                                {challenge.iconUrl && (
                                                    <img src={challenge.iconUrl} alt={challenge.name} className="w-full h-full object-contain" />
                                                )}
                                            </div>
                                        ))}
                                        {dungeon.achievements.length > 5 && (
                                            <div className="w-6 h-6 rounded bg-elevated text-caption flex items-center justify-center text-muted-foreground border border-border">
                                                +{dungeon.achievements.length - 5}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-5xl max-h-[90vh] bg-surface border-border p-0 overflow-hidden flex flex-col rounded-xl">
                    {/* Header Draggable Handle */}
                    <div className="px-5 py-4 bg-surface border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                                <Plus className="w-5 h-5 text-muted-foreground" />
                                {editing ? "Modifier le donjon" : "Nouveau donjon"}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                Détails du donjon, boss et succès associés.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="px-5 py-6 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6 pb-2">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column: Core Info & Illustration */}
                                <div className="space-y-6">
                                    <div className="space-y-5 rounded-xl border border-border p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                                            <h3 className="text-xs font-medium text-muted-foreground">Informations principales</h3>
                                            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                                                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground cursor-pointer">
                                                    Expédition
                                                    <Switch
                                                        checked={formData.isExpedition}
                                                        onCheckedChange={(checked) => setFormData({ ...formData, isExpedition: checked })}
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground cursor-pointer">
                                                    Quête Ocre
                                                    <Switch
                                                        checked={formData.isOcreQuest}
                                                        onCheckedChange={(checked) => setFormData({ ...formData, isOcreQuest: checked })}
                                                    />
                                                </label>
                                                {/* Chantier « donjon sans succès » : le succès est d'être validé. */}
                                                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground cursor-pointer">
                                                    Donjon sans succès
                                                    <Switch
                                                        checked={formData.isNoAchievement}
                                                        onCheckedChange={(checked) => setFormData({ ...formData, isNoAchievement: checked })}
                                                    />
                                                </label>
                                                {/* Chantier « boss d'anomalie » : contenu siphonné (Gardiens des anomalies). */}
                                                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground cursor-pointer">
                                                    <span className="flex items-center gap-1.5">
                                                        <img src="/assets/missions/ano1.png" alt="" aria-hidden className="w-4 h-4 object-contain" />
                                                        Fiches Anomalies
                                                    </span>
                                                    <Switch
                                                        checked={formData.isAnomalyBoss}
                                                        onCheckedChange={(checked) => setFormData({ ...formData, isAnomalyBoss: checked })}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                            <div className="sm:col-span-3 space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground pl-1">Nom du donjon <span className="text-danger">*</span></label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    placeholder="Ex: Antre du Kralamoure"
                                                    className="h-12 bg-elevated border-border text-sm font-medium rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                />
                                                <p className="text-[11px] text-muted-foreground pl-1 leading-relaxed">
                                                    Correspond à l'emplacement du donjon. Plusieurs entrées du même emplacement possibles avec des boss différents (ex. Comte Harebourg + Frizz, + Sylargh, + Klime…).
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground pl-1">Niveau <span className="text-danger">*</span></label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formData.level}
                                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                                                        required
                                                        min={1}
                                                        max={1000}
                                                        className="h-12 bg-elevated border-border pl-12 text-sm font-semibold rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                    />
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs select-none">Lvl</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground pl-1">Nom du boss <span className="text-danger">*</span></label>
                                            <Input
                                                value={formData.bossName}
                                                onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                                                required
                                                placeholder="Ex: Kralamoure Géant"
                                                className="h-12 bg-elevated border-border text-sm font-medium rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                            />
                                            <p className="text-[11px] text-muted-foreground pl-1 leading-relaxed">
                                                Le boss ou la variante (solo, +Frizz, +Sylargh…). Unique par emplacement : c'est lui qui différencie chaque entrée.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground pl-1">Lien DofusPourLesNoobs</label>
                                                <Input
                                                    value={formData.dofuspourlesnoobsUrl}
                                                    onChange={(e) => setFormData({ ...formData, dofuspourlesnoobsUrl: e.target.value })}
                                                    placeholder="https://www.dofuspourlesnoobs.com/..."
                                                    className="h-11 bg-elevated border-border text-xs rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground pl-1">Lien Dofensive</label>
                                                <Input
                                                    value={formData.dofensiveUrl}
                                                    onChange={(e) => setFormData({ ...formData, dofensiveUrl: e.target.value })}
                                                    placeholder="https://dofensive.com/fr/monster/..."
                                                    className="h-11 bg-elevated border-border text-xs rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                />
                                            </div>
                                        </div>

                                        {/* Chantier double boss — dissociation affichage / résolution Dofensive.
                                            Permet de pointer la « Balcon de … » du bon monstre même quand le nom affiché
                                            est composé (ex. « Comte et Sylargh ») et qu'un donjon solo homonyme existe. */}
                                        <div className="p-4 rounded-xl border border-border space-y-3">
                                            <p className="text-xs font-medium text-muted-foreground pl-1">Résolution Dofensive (doubles boss)</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground pl-1">Nom du monstre (Dofensive)</label>
                                                    <Input
                                                        value={formData.dofensiveMonsterName || ""}
                                                        onChange={(e) => setFormData({ ...formData, dofensiveMonsterName: e.target.value })}
                                                        placeholder="Ex: Sylargh"
                                                        className="h-11 bg-elevated border-border text-xs rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground pl-1 leading-relaxed">Nom exact du monstre Dofensive (celui de la fiche). Sert à retrouver la carte correspondante.</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium text-muted-foreground pl-1">Nom du donjon (Dofensive)</label>
                                                    <Input
                                                        value={formData.dofensiveDungeonName || ""}
                                                        onChange={(e) => setFormData({ ...formData, dofensiveDungeonName: e.target.value })}
                                                        placeholder="Ex: Donjon du Comte Harebourg"
                                                        className="h-11 bg-elevated border-border text-xs rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground pl-1 leading-relaxed">Nom exact du donjon Dofensive, pour lever l'ambiguïté avec un donjon solo homonyme. Vide pour un donjon classique.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Map ID — sélecteur cliquable pour placer l'icône Ocre sur la carte */}
                                        {formData.isOcreQuest && (
                                            <div className="p-4 rounded-xl border border-border space-y-3">
                                                <p className="text-xs text-muted-foreground pl-1">
                                                    Sélectionne le donjon correspondant sur la carte du monde pour y afficher l'icône Ocre.
                                                </p>
                                                <DungeonMapPicker
                                                    value={formData.mapId}
                                                    onSelect={(mapId, name) => {
                                                        setFormData({ ...formData, mapId });
                                                        toast.success(`Donjon lié : ${name}`);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Expedition Settings */}
                                    {formData.isExpedition && (
                                        <div
                                            className="space-y-5 p-5 rounded-xl border border-border"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Modes disponibles</label>
                                                <MultiSelect
                                                    options={EXPEDITION_MODES}
                                                    selected={formData.expeditionModes}
                                                    onChange={(selected) => setFormData({ ...formData, expeditionModes: selected })}
                                                    placeholder="Choisir les modes..."
                                                    className="bg-elevated border-border min-h-[44px] rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Mécaniques</label>
                                                <textarea
                                                    value={formData.expeditionMechanics || ""}
                                                    onChange={(e) => setFormData({ ...formData, expeditionMechanics: e.target.value })}
                                                    placeholder="Détails spécifiques des mécaniques..."
                                                    className="w-full px-4 py-3 bg-elevated border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong resize-none min-h-[100px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-border p-5">
                                        <h3 className="text-xs font-medium text-muted-foreground border-b border-border pb-3 mb-4">Illustration</h3>
                                        <ImageDownloader
                                            type="dungeon"
                                            imageUrl={formData.imageUrl}
                                            identifier={formData.name}
                                            onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Success & Challenges */}
                                <div className="h-full">
                                    <div className="h-full space-y-4 rounded-xl border border-border p-5 flex flex-col">
                                         <div className="border-b border-border pb-3">
                                            <h3 className="text-xs font-medium text-muted-foreground">Succès du boss</h3>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Vérifie qu'ils correspondent aux mécaniques du donjon.
                                            </p>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-[300px]">
                                            <div className="space-y-3 mb-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-medium text-muted-foreground pl-1">
                                                        Succès associés
                                                    </label>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {formData.challengeIds.length} sélectionné(s)
                                                    </span>
                                                </div>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Filtrer les succès..."
                                                        value={challengeSearch}
                                                        onChange={e => setChallengeSearch(e.target.value)}
                                                        className="h-10 pl-9 bg-elevated border-border text-xs text-foreground placeholder:text-muted-foreground rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[420px]">
                                                {challenges
                                                    .filter(c => c.name.toLowerCase().includes(challengeSearch.toLowerCase()))
                                                    .map((challenge) => {
                                                    const isSelected = formData.challengeIds.includes(challenge.id);
                                                    return (
                                                        <button
                                                            key={challenge.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    challengeIds: isSelected
                                                                        ? prev.challengeIds.filter((id) => id !== challenge.id)
                                                                        : [...prev.challengeIds, challenge.id],
                                                                }));
                                                            }}
                                                            className={`
                                                                relative aspect-square rounded-lg p-2 border transition-colors group flex flex-col items-center justify-center gap-1
                                                                ${isSelected
                                                                    ? "border-success bg-success/5"
                                                                    : "border-border hover:border-border-strong"
                                                                }
                                                            `}
                                                            title={challenge.name}
                                                        >
                                                            {challenge.iconUrl ? (
                                                                <img
                                                                    src={challenge.iconUrl}
                                                                    alt={challenge.name}
                                                                    loading="lazy"
                                                                    className="w-8 h-8 object-contain"
                                                                />
                                                            ) : (
                                                                <Trophy className={`w-6 h-6 ${isSelected ? "text-success" : "text-muted-foreground"}`} />
                                                            )}
                                                            <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight line-clamp-2 w-full mt-1">
                                                                {challenge.name}
                                                            </span>

                                                            {isSelected && (
                                                                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                                                                    <svg className="w-2.5 h-2.5 text-success-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border sticky bottom-0 bg-surface py-4 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="sm:flex-1 h-12 border-border text-sm rounded-lg"
                                >
                                    Fermer
                                </Button>
                                <Button type="submit" className="sm:flex-[3] h-12 text-sm font-semibold rounded-lg">
                                    {editing ? "Enregistrer" : "Créer le donjon"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
