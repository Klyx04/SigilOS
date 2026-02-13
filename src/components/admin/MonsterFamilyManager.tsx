"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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

interface MonsterFamily {
    id: string;
    name: string;
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
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        imageUrl: "",
        zoneIds: [] as string[],
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [familiesRes, zonesRes] = await Promise.all([
            getMonsterFamilies(),
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

    async function loadFamilies() {
        const result = await getMonsterFamilies();
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
            setIsSheetOpen(false);
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
        setFormData({ name: "", description: "", imageUrl: "", zoneIds: [] });
        setEditing(null);
    }

    function startEdit(family: MonsterFamily) {
        setEditing(family.id);
        setFormData({
            name: family.name,
            description: family.description || "",
            imageUrl: family.imageUrl || "",
            zoneIds: family.zones?.map(z => z.id) || [],
        });
        setIsSheetOpen(true);
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
                <Button
                    onClick={() => { resetForm(); setIsSheetOpen(true); }}
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
                                    <h3 className="font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                                        {family.name}
                                    </h3>
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

            {/* Form Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg bg-slate-950 border-l-slate-800 p-0">
                    <div className="p-6 h-full flex flex-col">
                        <SheetHeader className="mb-6">
                            <SheetTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                {editing ? "✏️ Modifier la famille" : "➕ Nouvelle famille"}
                            </SheetTitle>
                            <SheetDescription className="text-slate-400">
                                Gérez les familles de monstres et leurs zones d'apparition.
                            </SheetDescription>
                        </SheetHeader>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Nom <span className="text-red-400">*</span></label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Ex: Blops"
                                        className="bg-slate-900 border-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                                        placeholder="Description de la famille de monstres..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Illustration</label>
                                    <ImageDownloader
                                        imageUrl={formData.imageUrl}
                                        type="monster"
                                        identifier={formData.name}
                                        onImageDownloaded={(localPath) => setFormData({ ...formData, imageUrl: localPath })}
                                    />
                                </div>

                                <div className="space-y-2 pt-4 border-t border-slate-800">
                                    <label className="text-sm font-medium text-slate-300">Zones associées</label>
                                    <MultiSelect
                                        options={zoneOptions}
                                        selected={formData.zoneIds}
                                        onChange={(selected) => setFormData({ ...formData, zoneIds: selected })}
                                        placeholder="Sélectionner les zones..."
                                        className="bg-slate-900 border-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 mt-auto border-t border-slate-800">
                                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                    {editing ? "💾 Enregistrer" : "➕ Créer"}
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
        </div>
    );
}
