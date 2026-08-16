"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
    getMonsterFamilies,
    createMonsterFamily,
    updateMonsterFamily,
    deleteMonsterFamily,
    getAdminZones,
} from "@/server/actions/game-data-admin-actions";
import { Search, Plus, MoreHorizontal, Edit2, Trash2, MapPin, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImageDownloader } from "./ImageDownloader";
import { MultiSelect } from "@/components/ui/multi-select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

interface MonsterFamily {
    id: string;
    name: string;
    level?: number | null;
    description?: string | null;
    imageUrl?: string | null;
    _count?: { monsters: number };
    zones?: { id: string; name: string }[];
}

export default function MonsterFamilyManager() {
    const [families, setFamilies] = useState<MonsterFamily[]>([]);
    const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedZone, setSelectedZone] = useState<string>("all");
    const [selectedLevel, setSelectedLevel] = useState<string>("all");

    const [formData, setFormData] = useState({
        name: "",
        level: undefined as number | undefined,
        description: "",
        imageUrl: "",
        zoneIds: [] as string[],
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        // loadData is now just for initial auxiliary data like zones
        const zonesRes = await getAdminZones();
        if (zonesRes.success && zonesRes.data) {
            setZones(zonesRes.data);
        }
    }

    useEffect(() => {
        loadFamilies();
    }, [selectedZone, selectedLevel]);

    async function loadFamilies() {
        setLoading(true);
        const filters: any = {};
        if (selectedZone !== "all") filters.zoneId = selectedZone;
        
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
        
        try {
            const result = await getMonsterFamilies(filters);
            if (result.success && result.data) {
                setFamilies(result.data);
                if (selectedLevel !== "all" || selectedZone !== "all") {
                   toast.info(`${result.data.length} familles trouvées avec ces filtres`);
                }
            } else {
                toast.error(result.error || "Erreur de filtrage");
            }
        } catch (e) {
            toast.error("Erreur réseau ou serveur");
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const result = editing
            ? await updateMonsterFamily(editing, formData)
            : await createMonsterFamily(formData);

        if (result.success) {
            toast.success(editing ? "Famille mise à jour" : "Famille créée");
            resetForm();
            setIsDialogOpen(false);
            loadFamilies();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Êtes-vous sûr de supprimer cette famille ?")) return;

        const result = await deleteMonsterFamily(id);
        if (result.success) {
            toast.success("Famille supprimée");
            loadFamilies();
        } else {
            toast.error(result.error || "Erreur de suppression");
        }
    }

    function resetForm() {
        setFormData({ name: "", level: undefined, description: "", imageUrl: "", zoneIds: [] });
        setEditing(null);
    }

    function startEdit(family: MonsterFamily) {
        setEditing(family.id);
        setFormData({
            name: family.name,
            level: family.level ?? undefined,
            description: family.description || "",
            imageUrl: family.imageUrl || "",
            zoneIds: family.zones?.map(z => z.id) || [],
        });
        setIsDialogOpen(true);
    }

    const zoneOptions = zones.map(z => ({
        label: z.name,
        value: z.id,
    }));

    const filteredFamilies = families.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-surface/50 p-4 rounded-lg border border-border/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une famille..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-elevated border-border text-foreground placeholder:text-muted-foreground focus:ring-ring/50"
                    />
                </div>

                {/* Zone Filter */}
                <div className="w-full md:w-64">
                    <Select value={selectedZone} onValueChange={setSelectedZone}>
                        <SelectTrigger className="bg-elevated border-border text-foreground">
                            <SelectValue placeholder="Filtrer par zone" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            <SelectItem value="all">Toutes les zones</SelectItem>
                            {zones.map(zone => (
                                <SelectItem key={zone.id} value={zone.id}>
                                    {zone.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                    Nouvelle Famille
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement des familles...</div>
            ) : filteredFamilies.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-surface/30 rounded-lg border border-dashed border-border">
                    Aucune famille trouvée
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFamilies.map((family) => (
                        <div
                            key={family.id}
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
                                        <DropdownMenuItem onClick={() => startEdit(family)} className="text-foreground focus:bg-elevated cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-info" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(family.id)} className="text-danger focus:bg-danger/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex gap-4">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-elevated shrink-0 border border-border group-hover:border-info/50 transition-colors">
                                    {family.imageUrl ? (
                                        <img
                                            src={family.imageUrl}
                                            alt={family.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-foreground truncate group-hover:text-info transition-colors">
                                            {family.name}
                                        </h3>
                                        {(family.level !== null && family.level !== undefined) ? (
                                            <Badge variant="outline" className="ml-2 border-info/30 text-info font-bold bg-info/5">
                                                Lvl {family.level}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="ml-2 border-border text-muted-foreground font-medium bg-elevated/50">
                                                Lvl ?
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {family._count?.monsters || 0} monstres
                                    </p>

                                    {family.zones && family.zones.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {family.zones.slice(0, 2).map(z => (
                                                <div key={z.id} className="text-caption px-1.5 py-0.5 rounded bg-elevated border border-border text-muted-foreground flex items-center gap-1 max-w-full truncate">
                                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{z.name}</span>
                                                </div>
                                            ))}
                                            {family.zones.length > 2 && (
                                                <div className="text-caption px-1.5 py-0.5 rounded bg-elevated border border-border text-muted-foreground">
                                                    +{family.zones.length - 2}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-7xl max-h-[95vh] bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header Draggable */}
                    <div className="p-8 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-4">
                                <Plus className="w-8 h-8 text-info" />
                                {editing ? "Modifier la famille" : "Nouvelle famille"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-lg">
                                Gérez les familles de monstres, leurs descriptions et leurs zones de présence.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-10 pb-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Column: Core Info */}
                                <div className="lg:col-span-7 space-y-10">
                                    <div className="space-y-8 bg-surface/30 p-8 rounded-3xl border border-border/50">
                                        <h3 className="text-sm font-black text-info uppercase tracking-[0.2em] border-b border-border pb-4 mb-2">Informations Principales</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="md:col-span-3 space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom de la Famille <span className="text-danger text-lg">*</span></label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    placeholder="Ex: Blops"
                                                    className="h-16 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lvl</label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={(formData.level === undefined || formData.level === null) ? "" : formData.level}
                                                        onChange={(e) => {
                                                            const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                                                            setFormData({ ...formData, level: val });
                                                        }}
                                                        placeholder="Niveau..."
                                                        className="h-16 pl-12 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                                    />
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">Lvl</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description</label>
                                            <textarea
                                                value={formData.description || ""}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                rows={4}
                                                className="w-full px-5 py-4 bg-background border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-info/50 resize-none text-lg transition-all"
                                                placeholder="Partagez l'histoire ou les caractéristiques de cette famille..."
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-background/50 p-8 rounded-3xl border border-border shadow-inner">
                                        <h3 className="text-sm font-black text-info uppercase tracking-[0.2em] border-b border-border pb-4 mb-6">Illustration</h3>
                                        <ImageDownloader
                                            type="monster"
                                            imageUrl={formData.imageUrl}
                                            identifier={formData.name}
                                            onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Zones */}
                                <div className="lg:col-span-5 h-full">
                                    <div className="space-y-8 bg-surface/30 p-8 rounded-3xl border border-border/50 h-full flex flex-col">
                                        <div className="flex items-center justify-between border-b border-border pb-4 mb-2">
                                            <h3 className="text-sm font-black text-info uppercase tracking-[0.2em]">Zones de Présence</h3>
                                            <span className="bg-info/10 text-info text-caption font-black px-3 py-1 rounded-full uppercase tracking-widest border border-info/20">
                                                {formData.zoneIds.length} sélectionnée(s)
                                            </span>
                                        </div>

                                        <div className="flex-1 overflow-visible">
                                            <MultiSelect
                                                options={zones.map(z => ({ label: z.name, value: z.id }))}
                                                selected={formData.zoneIds}
                                                onChange={(val) => setFormData({ ...formData, zoneIds: val })}
                                                placeholder="Sélectionner les zones..."
                                            />
                                            <p className="mt-4 text-caption text-muted-foreground leading-relaxed font-medium italic">
                                                ⚠️ Les monstres de cette famille apparaîtront automatiquement dans les zones sélectionnées.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-border shrink-0 sticky bottom-0 bg-background py-4">
                                <Button type="submit" className="flex-[3] bg-info hover:bg-info h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer la Famille"}
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

        </div>
    );
}
