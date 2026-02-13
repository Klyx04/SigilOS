"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    getDungeonsWithAchievements,
    createDungeon,
    updateDungeon,
    deleteDungeon,
    getChallenges,
} from "@/server/actions/game-data-admin-actions";
import { ImageDownloader } from "./ImageDownloader";
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
    imageUrl?: string | null;
    isExpedition: boolean;
    expeditionModes?: string[] | null;
    expeditionMechanics?: string | null;
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
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        bossName: "",
        level: 100,
        dpnlUrl: "",
        imageUrl: "",
        isExpedition: false,
        expeditionModes: [] as string[],
        expeditionMechanics: "",
        challengeIds: [] as string[],
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [dungeonsRes, challengesRes] = await Promise.all([
            getDungeonsWithAchievements(),
            getChallenges()
        ]);

        if (dungeonsRes.success && dungeonsRes.data) {
            setDungeons(dungeonsRes.data);
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
            setIsSheetOpen(false);
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
        setFormData({
            name: "",
            bossName: "",
            level: 100,
            dpnlUrl: "",
            imageUrl: "",
            isExpedition: false,
            expeditionModes: [],
            expeditionMechanics: "",
            challengeIds: [],
        });
    }

    function startEdit(dungeon: Dungeon) {
        setEditing(dungeon.id);
        setFormData({
            name: dungeon.name,
            bossName: dungeon.bossName,
            level: dungeon.level,
            dpnlUrl: dungeon.dpnlUrl || "",
            imageUrl: dungeon.imageUrl || "",
            isExpedition: dungeon.isExpedition,
            expeditionModes: dungeon.expeditionModes || [],
            expeditionMechanics: dungeon.expeditionMechanics || "",
            challengeIds: dungeon.achievements.map(a => a.challengeId),
        });
        setIsSheetOpen(true);
    }

    // Helper options for MultiSelect
    const challengeOptions = challenges.map(c => ({
        label: c.name,
        value: c.id,
        icon: c.iconUrl
    }));

    const filteredDungeons = dungeons.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.bossName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un donjon ou un boss..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-indigo-500/50"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setIsSheetOpen(true); }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Donjon
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement des donjons...</div>
            ) : filteredDungeons.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                    Aucun donjon trouvé
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredDungeons.map((dungeon) => (
                        <div
                            key={dungeon.id}
                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-950/50 hover:bg-slate-800 text-slate-400">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                        <DropdownMenuItem onClick={() => startEdit(dungeon)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-indigo-400" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(dungeon.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex flex-col h-full gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700 group-hover:border-indigo-500/50 transition-colors">
                                        {dungeon.imageUrl ? (
                                            <img
                                                src={dungeon.imageUrl}
                                                alt={dungeon.bossName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <ImageIcon className="w-8 h-8" />
                                            </div>
                                        )}
                                        {dungeon.isExpedition && (
                                            <div className="absolute bottom-0 inset-x-0 bg-indigo-600/90 text-[9px] text-center text-white py-0.5 font-bold uppercase tracking-wider">
                                                Expé
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                                                {dungeon.name}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Skull className="w-3.5 h-3.5" />
                                            <span className="truncate">{dungeon.bossName}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge variant="outline" className="bg-slate-950/50 border-slate-700 text-slate-400 text-[10px] h-5">
                                                Lvl {dungeon.level}
                                            </Badge>
                                            {dungeon.achievements.length > 0 && (
                                                <Badge variant="outline" className="bg-yellow-950/20 border-yellow-900/30 text-yellow-500 text-[10px] h-5 gap-1">
                                                    <Trophy className="w-3 h-3" />
                                                    {dungeon.achievements.length}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expedition Modes */}
                                {dungeon.isExpedition && dungeon.expeditionModes && dungeon.expeditionModes.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800/50">
                                        {dungeon.expeditionModes.map(mode => (
                                            <span key={mode} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-950/30 text-indigo-400 border border-indigo-900/30">
                                                {mode}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Challenges Preview (Compact) */}
                                {dungeon.achievements.length > 0 && (
                                    <div className="flex gap-1 overflow-hidden pt-2 mt-auto border-t border-slate-800/50">
                                        {dungeon.achievements.slice(0, 5).map(({ challenge }) => (
                                            <div key={challenge.slug} className="w-6 h-6 rounded bg-slate-800/80 p-0.5 border border-slate-700" title={challenge.name}>
                                                {challenge.iconUrl && (
                                                    <img src={challenge.iconUrl} alt={challenge.name} className="w-full h-full object-contain" />
                                                )}
                                            </div>
                                        ))}
                                        {dungeon.achievements.length > 5 && (
                                            <div className="w-6 h-6 rounded bg-slate-800 text-[9px] flex items-center justify-center text-slate-500 border border-slate-700">
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

            {/* Form Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-slate-950 border-l-slate-800 p-0">
                    <div className="p-6">
                        <SheetHeader className="mb-6">
                            <SheetTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                {editing ? "✏️ Modifier le donjon" : "➕ Nouveau donjon"}
                            </SheetTitle>
                            <SheetDescription className="text-slate-400">
                                Configurez les détails du donjon, son boss et les succès associés.
                            </SheetDescription>
                        </SheetHeader>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">Informations Principales</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-medium text-slate-300">Nom du Donjon <span className="text-red-400">*</span></label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Ex: Antre du Kralamoure Géant"
                                            className="bg-slate-900 border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Nom du Boss <span className="text-red-400">*</span></label>
                                        <Input
                                            value={formData.bossName}
                                            onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                                            required
                                            placeholder="Ex: Kralamoure Géant"
                                            className="bg-slate-900 border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Niveau</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="200"
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                                            className="bg-slate-900 border-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">Visuel</h4>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Illustration</label>
                                    <ImageDownloader
                                        imageUrl={formData.imageUrl}
                                        type="dungeon"
                                        identifier={formData.bossName || formData.name}
                                        onImageDownloaded={(localPath) => setFormData({ ...formData, imageUrl: localPath })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Mode Expédition</h4>
                                    <Switch
                                        checked={formData.isExpedition}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isExpedition: checked })}
                                    />
                                </div>

                                {formData.isExpedition && (
                                    <div className="space-y-4 p-4 bg-indigo-950/20 rounded-lg border border-indigo-500/20 animate-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">Modes Disponibles</label>
                                            <MultiSelect
                                                options={EXPEDITION_MODES}
                                                selected={formData.expeditionModes}
                                                onChange={(selected) => setFormData({ ...formData, expeditionModes: selected })}
                                                placeholder="Choisir les modes..."
                                                className="bg-slate-900 border-slate-700"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">Mécaniques</label>
                                            <Input
                                                value={formData.expeditionMechanics}
                                                onChange={(e) => setFormData({ ...formData, expeditionMechanics: e.target.value })}
                                                placeholder="Détails spécifiques..."
                                                className="bg-slate-900 border-slate-700"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Succès & Challenges</h4>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Challenges associés</label>
                                    <MultiSelect
                                        options={challengeOptions}
                                        selected={formData.challengeIds}
                                        onChange={(selected) => setFormData({ ...formData, challengeIds: selected })}
                                        placeholder="Sélectionner les succès..."
                                        className="bg-slate-900 border-slate-700"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Ces challenges seront proposés comme succès à valider pour ce donjon.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 border-t border-slate-800 sticky bottom-0 bg-slate-950 pb-4">
                                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                    {editing ? "💾 Enregistrer les modifications" : "➕ Créer le donjon"}
                                </Button>
                                {editing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetForm}
                                        className="border-slate-700 hover:bg-slate-800"
                                    >
                                        Annuler
                                    </Button>
                                )}
                            </div>
                        </form>
                    </div>
                </SheetContent>
            </Sheet>
        </div >
    );
}
