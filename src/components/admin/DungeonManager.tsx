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
import { motion } from "framer-motion";
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
import { Search, Plus, MapPin, Trophy, ShieldAlert, Swords, Skull, MoreHorizontal, Edit2, Trash2, ImageIcon } from "lucide-react";
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
        });
        setIsDialogOpen(true);
    }



    const filteredDungeons = dungeons.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.bossName.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                                            <div className="absolute bottom-0 inset-x-0 bg-info/90 text-caption text-center text-foreground py-0.5 font-bold uppercase tracking-wider">
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
                                                <Badge variant="outline" className="bg-yellow-950/20 border-yellow-900/30 text-yellow-500 text-caption h-5 gap-1 shrink-0" title="Donjon de la Quête Ocre">
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
                                            {dungeon.achievements.length > 0 && (
                                                <Badge variant="outline" className="bg-yellow-950/20 border-yellow-900/30 text-yellow-500 text-caption h-5 gap-1">
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
                <DialogContent draggable className="w-[95vw] max-w-7xl max-h-[95vh] bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header Draggable Handle */}
                    <div className="p-8 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-4">
                                <Plus className="w-8 h-8 text-info" />
                                {editing ? "Modifier le donjon" : "Nouveau donjon"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-lg">
                                Configurez les détails du donjon, son boss et les succès associés.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-10 pb-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Column: Core Info & Illustration */}
                                <div className="lg:col-span-7 space-y-10">
                                    <div className="space-y-8 bg-surface/30 p-8 rounded-3xl border border-border/50">
                                        <div className="flex items-center justify-between border-b border-border pb-4 mb-2">
                                            <h3 className="text-sm font-black text-info uppercase tracking-[0.2em]">Informations Principales</h3>
                                            <div className="flex items-center gap-4 bg-background px-4 py-2 rounded-xl border border-border">
                                                <span className="text-sm font-bold text-muted-foreground uppercase">Expédition</span>
                                                <Switch
                                                    checked={formData.isExpedition}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, isExpedition: checked })}
                                                    className="data-[state=checked]:bg-info"
                                                />
                                                <span className="text-sm font-bold text-muted-foreground uppercase">Quête Ocre</span>
                                                <Switch
                                                    checked={formData.isOcreQuest}
                                                    onCheckedChange={(checked) => setFormData({ ...formData, isOcreQuest: checked })}
                                                    className="data-[state=checked]:bg-warning"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="md:col-span-3 space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom du Donjon <span className="text-danger text-lg">*</span></label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    placeholder="Ex: Antre du Kralamoure"
                                                    className="h-16 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau <span className="text-danger text-lg">*</span></label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formData.level}
                                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                                                        required
                                                        min={1}
                                                        max={1000}
                                                        className="h-16 bg-background border-border focus:border-info/50 focus:ring-ring/20 pl-14 font-black italic text-info text-2xl transition-all rounded-2xl"
                                                    />
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold select-none text-sm">Lvl</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom du Boss <span className="text-danger text-lg">*</span></label>
                                            <Input
                                                value={formData.bossName}
                                                onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                                                required
                                                placeholder="Ex: Kralamoure Géant"
                                                className="h-16 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien DofusPourLesNoobs</label>
                                                <Input
                                                    value={formData.dofuspourlesnoobsUrl}
                                                    onChange={(e) => setFormData({ ...formData, dofuspourlesnoobsUrl: e.target.value })}
                                                    placeholder="https://www.dofuspourlesnoobs.com/..."
                                                    className="h-14 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-sm transition-all rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien Dofensive</label>
                                                <Input
                                                    value={formData.dofensiveUrl}
                                                    onChange={(e) => setFormData({ ...formData, dofensiveUrl: e.target.value })}
                                                    placeholder="https://dofensive.com/fr/monster/..."
                                                    className="h-14 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-sm transition-all rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        {/* Map ID — sélecteur cliquable pour placer l'icône Ocre sur la carte */}
                                        {formData.isOcreQuest && (
                                            <div className="p-5 rounded-2xl bg-warning/5 border border-warning/20 space-y-3">
                                                <p className="text-caption text-warning/90 pl-1">
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
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-8 p-8 bg-info/5 rounded-3xl border border-info/20 shadow-inner shadow-indigo-500/5"
                                        >
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modes Disponibles</label>
                                                <MultiSelect
                                                    options={EXPEDITION_MODES}
                                                    selected={formData.expeditionModes}
                                                    onChange={(selected) => setFormData({ ...formData, expeditionModes: selected })}
                                                    placeholder="Choisir les modes..."
                                                    className="bg-background border-border min-h-[50px] rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mécaniques</label>
                                                <textarea
                                                    value={formData.expeditionMechanics || ""}
                                                    onChange={(e) => setFormData({ ...formData, expeditionMechanics: e.target.value })}
                                                    placeholder="Détails spécifiques des mécaniques..."
                                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-info/50 resize-none min-h-[100px]"
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    <div className="bg-background/50 p-8 rounded-3xl border border-border shadow-inner">
                                        <h3 className="text-sm font-black text-info uppercase tracking-[0.2em] border-b border-border pb-4 mb-6">Illustration</h3>
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
                                <div className="lg:col-span-5 h-full">
                                    <div className="h-full space-y-4 bg-surface/30 p-8 rounded-3xl border border-border/50 flex flex-col">
                                         <div className="border-b border-border pb-4">
                                            <h3 className="text-sm font-black text-info uppercase tracking-[0.2em]">Succès du Boss</h3>
                                            <p className="text-xs text-muted-foreground mt-2 font-medium">
                                                Assurez-vous qu'ils correspondent aux mécaniques du donjon.
                                            </p>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-[500px]">
                                            <div className="space-y-4 mb-4">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">
                                                        Succès Associés
                                                    </label>
                                                    <Badge variant="outline" className="bg-info/10 border-info/20 text-info">
                                                        {formData.challengeIds.length} sélectionné(s)
                                                    </Badge>
                                                </div>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Filtrer les succès..."
                                                        value={challengeSearch}
                                                        onChange={e => setChallengeSearch(e.target.value)}
                                                        className="h-10 pl-9 bg-background border-border text-xs text-foreground placeholder:text-muted-foreground"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[500px]">
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
                                                                relative aspect-square rounded-xl p-2 border-2 transition-all group flex flex-col items-center justify-center gap-1
                                                                ${isSelected
                                                                    ? "border-info bg-info/10 "
                                                                    : "border-border bg-surface/50 hover:border-border hover:bg-elevated"
                                                                }
                                                            `}
                                                            title={challenge.name}
                                                        >
                                                            {challenge.iconUrl ? (
                                                                <img
                                                                    src={challenge.iconUrl}
                                                                    alt={challenge.name}
                                                                    className={`w-8 h-8 object-contain transition-transform ${isSelected ? "scale-110" : "group-"}`}
                                                                />
                                                            ) : (
                                                                <Trophy className={`w-6 h-6 ${isSelected ? "text-info" : "text-muted-foreground"}`} />
                                                            )}
                                                            <span className="text-caption font-bold text-muted-foreground text-center leading-tight line-clamp-2 w-full mt-1">
                                                                {challenge.name}
                                                            </span>

                                                            {isSelected && (
                                                                <div className="absolute -top-1.5 -right-1.5 bg-info text-info-foreground rounded-full p-0.5 shadow-lg">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-border sticky bottom-0 bg-background py-4 shrink-0">
                                <Button type="submit" className="flex-[3] bg-info hover:bg-info h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer le Donjon"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-14 border-border hover:bg-surface text-foreground text-sm font-bold uppercase tracking-widest transition-all rounded-xl"
                                >
                                    Fermer
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
