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
import {
    getAdminZones,
    createZone,
    updateZone,
    deleteZone,
} from "@/server/actions/game-data-admin-actions";
import { getMonsterFamilies, getDungeons } from "@/server/actions/game-data-actions";
import { MapPin, Trash2, Edit2, Plus, Search, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MultiSelect } from "@/components/ui/multi-select";
import { motion } from "framer-motion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

interface Zone {
    id: string;
    name: string;
    level: number;
    families?: { id: string; name: string }[];
    dungeons?: { id: string; name: string }[];
}

export default function ZoneManager() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
    const [dungeons, setDungeons] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLevel, setSelectedLevel] = useState<string>("all");

    const [formData, setFormData] = useState({
        name: "",
        level: 200,
        familyIds: [] as string[],
        dungeonIds: [] as string[],
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

        const [zonesRes, familiesRes, dungeonsRes] = await Promise.all([
            getAdminZones(filters),
            getMonsterFamilies(),
            getDungeons()
        ]);

        if (zonesRes.success && zonesRes.data) {
            setZones(zonesRes.data);
            if (selectedLevel !== "all") {
                toast.info(`${zonesRes.data.length} zones trouvées`);
            }
        }
        if (familiesRes.success && familiesRes.data) {
            setFamilies(familiesRes.data);
        }
        if (dungeonsRes.success && dungeonsRes.data) {
            setDungeons(dungeonsRes.data);
        }
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const result = editing
            ? await updateZone(editing, formData)
            : await createZone(formData);

        if (result.success) {
            toast.success(editing ? "Zone mise à jour" : "Zone créée");
            resetForm();
            setIsDialogOpen(false);
            loadData();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cette zone ?")) return;
        const result = await deleteZone(id);
        if (result.success) {
            toast.success("Zone supprimée");
            loadData();
        }
    }

    function resetForm() {
        setFormData({ name: "", level: 200, familyIds: [], dungeonIds: [] });
        setEditing(null);
    }

    function startEdit(zone: Zone) {
        setEditing(zone.id);
        setFormData({
            name: zone.name,
            level: zone.level,
            familyIds: zone.families?.map(f => f.id) || [],
            dungeonIds: zone.dungeons?.map(d => d.id) || [],
        });
        setIsDialogOpen(true);
    }

    const filteredZones = zones.filter(z =>
        z.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-surface/50 p-4 rounded-lg border border-border/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une zone..."
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
                    Nouvelle Zone
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement des zones...</div>
            ) : filteredZones.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-surface/30 rounded-lg border border-dashed border-border">
                    Aucune zone trouvée
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredZones.map((zone) => (
                        <div
                            key={zone.id}
                            className="group relative bg-surface/40 border border-border rounded-xl overflow-hidden hover:border-info/30 hover:shadow-lg hover:shadow-indigo-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 hover:bg-elevated text-muted-foreground">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-surface border-border">
                                        <DropdownMenuItem onClick={() => startEdit(zone)} className="text-foreground focus:bg-elevated cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-info" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(zone.id)} className="text-danger focus:bg-danger/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-green-900/20 flex items-center justify-center border border-green-500/20 text-green-400 shrink-0">
                                    <MapPin className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-foreground truncate group-hover:text-green-300 transition-colors">
                                        {zone.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Niveau {zone.level}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-6xl bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header Draggable */}
                    <div className="p-8 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-4">
                                <Plus className="w-8 h-8 text-info" />
                                {editing ? "Modifier la zone" : "Nouvelle zone"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-lg">
                                Configurez les détails géographiques de la zone et son niveau recommandé.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-10 pb-6">
                            <div className="space-y-8 bg-surface/30 p-8 rounded-3xl border border-border/50">
                                <h3 className="text-sm font-black text-info uppercase tracking-[0.2em] border-b border-border pb-4 mb-2">Informations de Zone</h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                    <div className="md:col-span-3 space-y-3">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom de la Zone <span className="text-danger text-lg">*</span></label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Ex: Pandala, Frigost, Saharach..."
                                            className="h-16 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau Max</label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={formData.level || ""}
                                                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
                                                placeholder="200"
                                                className="h-16 pl-12 bg-background border-border focus:border-info/50 focus:ring-ring/20 text-xl font-bold transition-all rounded-2xl"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">Lvl</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Familles Associées</label>
                                        <div className="flex-1 overflow-visible">
                                            <MultiSelect
                                                options={families.map(f => ({ label: f.name, value: f.id }))}
                                                selected={formData.familyIds}
                                                onChange={(val) => setFormData({ ...formData, familyIds: val })}
                                                placeholder="Sélectionner les familles..."
                                            />
                                            <p className="mt-3 text-caption text-muted-foreground leading-relaxed font-medium italic">
                                                Optionnel: lier des familles de monstres à cette zone.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Donjons Associés</label>
                                        <div className="flex-1 overflow-visible">
                                            <MultiSelect
                                                options={dungeons.map(d => ({ label: d.name, value: d.id }))}
                                                selected={formData.dungeonIds}
                                                onChange={(val) => setFormData({ ...formData, dungeonIds: val })}
                                                placeholder="Sélectionner les donjons..."
                                            />
                                            <p className="mt-3 text-caption text-muted-foreground leading-relaxed font-medium italic">
                                                Optionnel: lier des boss de donjon à cette zone.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-border shrink-0 sticky bottom-0 bg-background py-4">
                                <Button type="submit" className="flex-[3] bg-info hover:bg-info h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer la Zone"}
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
