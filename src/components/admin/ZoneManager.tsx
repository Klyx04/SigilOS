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
    getAdminZones,
    createZone,
    updateZone,
    deleteZone,
} from "@/server/actions/game-data-admin-actions";
import { MapPin, Trash2, Edit2, Plus, Search, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Zone {
    id: string;
    name: string;
    level: number;
}

export default function ZoneManager() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        level: 200,
    });

    useEffect(() => {
        loadZones();
    }, []);

    async function loadZones() {
        setLoading(true);
        const result = await getAdminZones();
        if (result.success && result.data) {
            setZones(result.data);
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
            setIsSheetOpen(false);
            loadZones();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cette zone ?")) return;
        const result = await deleteZone(id);
        if (result.success) {
            toast.success("Zone supprimée");
            loadZones();
        }
    }

    function resetForm() {
        setFormData({ name: "", level: 200 });
        setEditing(null);
    }

    function startEdit(zone: Zone) {
        setEditing(zone.id);
        setFormData({
            name: zone.name,
            level: zone.level,
        });
        setIsSheetOpen(true);
    }

    const filteredZones = zones.filter(z =>
        z.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher une zone..."
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
                    Nouvelle Zone
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement des zones...</div>
            ) : filteredZones.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                    Aucune zone trouvée
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredZones.map((zone) => (
                        <div
                            key={zone.id}
                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-950/50 hover:bg-slate-800 text-slate-400">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                        <DropdownMenuItem onClick={() => startEdit(zone)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-indigo-400" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(zone.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
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
                                    <h3 className="font-bold text-slate-200 truncate group-hover:text-green-300 transition-colors">
                                        {zone.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Niveau {zone.level}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-md bg-slate-950 border-l-slate-800 p-0">
                    <div className="p-6 h-full flex flex-col">
                        <SheetHeader className="mb-6">
                            <SheetTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                {editing ? "✏️ Modifier la zone" : "➕ Nouvelle zone"}
                            </SheetTitle>
                            <SheetDescription className="text-slate-400">
                                Ajoutez ou modifiez une zone géographique.
                            </SheetDescription>
                        </SheetHeader>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Nom de la zone <span className="text-red-400">*</span></label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Ex: Pandala"
                                        className="bg-slate-900 border-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Niveau de zone <span className="text-red-400">*</span></label>
                                    <Input
                                        type="number"
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                                        required
                                        min={1}
                                        max={200}
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
