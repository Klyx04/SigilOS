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
        setLoading(true);
        const filters: any = {};
        if (selectedZone !== "all") filters.zoneId = selectedZone;

        const [familiesRes, zonesRes] = await Promise.all([
            getMonsterFamilies(filters),
            getAdminZones()
        ]);

        if (familiesRes.success && familiesRes.data) {
            setFamilies(familiesRes.data);
        } else {
            toast.error(familiesRes.error || "Erreur chargement familles");
        }

        if (zonesRes.success && zonesRes.data) {
            setZones(zonesRes.data);
        }

        setLoading(false);
    }

    useEffect(() => {
        loadFamilies();
    }, [selectedZone]);

    async function loadFamilies() {
        const filters: any = {};
        if (selectedZone !== "all") filters.zoneId = selectedZone;
        const result = await getMonsterFamilies(filters);
        if (result.success && result.data) {
            setFamilies(result.data);
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
            level: family.level || undefined,
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
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher une famille..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-indigo-500/50"
                    />
                </div>

                {/* Zone Filter */}
                <div className="w-full md:w-64">
                    <Select value={selectedZone} onValueChange={setSelectedZone}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                            <SelectValue placeholder="Filtrer par zone" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                            <SelectItem value="all">Toutes les zones</SelectItem>
                            {zones.map(zone => (
                                <SelectItem key={zone.id} value={zone.id}>
                                    {zone.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle Famille
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement des familles...</div>
            ) : filteredFamilies.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                    Aucune famille trouvée
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFamilies.map((family) => (
                        <div
                            key={family.id}
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
                                        <DropdownMenuItem onClick={() => startEdit(family)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-indigo-400" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(family.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex gap-4">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700 group-hover:border-indigo-500/50 transition-colors">
                                    {family.imageUrl ? (
                                        <img
                                            src={family.imageUrl}
                                            alt={family.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                                            {family.name}
                                        </h3>
                                        {family.level && (
                                            <Badge variant="outline" className="ml-2 border-indigo-500/30 text-indigo-400 font-bold bg-indigo-500/5">
                                                Lvl {family.level}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {family._count?.monsters || 0} monstres
                                    </p>

                                    {family.zones && family.zones.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {family.zones.slice(0, 2).map(z => (
                                                <div key={z.id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 flex items-center gap-1 max-w-full truncate">
                                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{z.name}</span>
                                                </div>
                                            ))}
                                            {family.zones.length > 2 && (
                                                <div className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500">
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
                <DialogContent draggable className="w-[95vw] max-w-7xl max-h-[95vh] bg-slate-950 border-slate-800 p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header Draggable */}
                    <div className="p-8 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-white flex items-center gap-4">
                                <Plus className="w-8 h-8 text-indigo-500" />
                                {editing ? "Modifier la famille" : "Nouvelle famille"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-lg">
                                Gérez les familles de monstres, leurs descriptions et leurs zones de présence.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-10 pb-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Column: Core Info */}
                                <div className="lg:col-span-7 space-y-10">
                                    <div className="space-y-8 bg-slate-900/30 p-8 rounded-3xl border border-slate-800/50">
                                        <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-2">Informations Principales</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="md:col-span-3 space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nom de la Famille <span className="text-rose-500 text-lg">*</span></label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    placeholder="Ex: Blops"
                                                    className="h-16 bg-slate-950 border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-xl font-bold transition-all rounded-2xl"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Lvl Moyen</label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={formData.level || ""}
                                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
                                                        placeholder="200"
                                                        className="h-16 pl-12 bg-slate-950 border-slate-800 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-xl font-bold transition-all rounded-2xl"
                                                    />
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Lvl</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Description</label>
                                            <textarea
                                                value={formData.description || ""}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                rows={4}
                                                className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none text-lg transition-all"
                                                placeholder="Partagez l'histoire ou les caractéristiques de cette famille..."
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 shadow-inner">
                                        <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-6">Illustration</h3>
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
                                    <div className="space-y-8 bg-slate-900/30 p-8 rounded-3xl border border-slate-800/50 h-full flex flex-col">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-2">
                                            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">Zones de Présence</h3>
                                            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-500/20">
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
                                            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed font-medium italic">
                                                ⚠️ Les monstres de cette famille apparaîtront automatiquement dans les zones sélectionnées.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-slate-800 shrink-0 sticky bottom-0 bg-slate-950 py-4">
                                <Button type="submit" className="flex-[3] bg-indigo-600 hover:bg-indigo-500 h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer la Famille"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-14 border-white/10 hover:bg-white/5 text-slate-300 text-sm font-bold uppercase tracking-widest transition-all rounded-xl"
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
