"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    getMonsterFamilies,
    createMonsterFamily,
    updateMonsterFamily,
    deleteMonsterFamily,
    getAdminZones,
} from "@/server/actions/game-data-admin-actions";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ImageDownloader } from "./ImageDownloader";

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
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        imageUrl: "",
        zoneIds: [] as string[],
    });
    const [openCombobox, setOpenCombobox] = useState(false);

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

    // Helper to refresh only families list
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
            setFormData({ name: "", description: "", imageUrl: "", zoneIds: [] });
            setEditing(null);
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

    function startEdit(family: MonsterFamily) {
        setEditing(family.id);
        setFormData({
            name: family.name,
            description: family.description || "",
            imageUrl: family.imageUrl || "",
            zoneIds: family.zones?.map(z => z.id) || [],
        });
    }

    const toggleZone = (zoneId: string) => {
        setFormData(prev => {
            const current = prev.zoneIds;
            if (current.includes(zoneId)) {
                return { ...prev, zoneIds: current.filter(id => id !== zoneId) };
            } else {
                return { ...prev, zoneIds: [...current, zoneId] };
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-slate-800/30 p-6 rounded-lg border border-slate-700/30 space-y-4">
                <h3 className="text-lg font-semibold text-white">
                    {editing ? "✏️ Modifier la famille" : "➕ Nouvelle famille"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Nom <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: Blops"
                        />
                    </div>

                    <ImageDownloader
                        imageUrl={formData.imageUrl}
                        type="monster"
                        identifier={formData.name}
                        onImageDownloaded={(localPath) => setFormData({ ...formData, imageUrl: localPath })}
                    />
                </div>

                {/* Zone Multi-Select */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Zones associées
                    </label>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox}
                                className="w-full justify-between bg-slate-900/50 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                                {formData.zoneIds.length > 0
                                    ? `${formData.zoneIds.length} zone(s) sélectionnée(s)`
                                    : "Sélectionner des zones..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-slate-900 border-slate-700">
                            <Command>
                                <CommandInput placeholder="Rechercher une zone..." className="h-9" />
                                <CommandList>
                                    <CommandEmpty>Aucune zone trouvée.</CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-y-auto">
                                        {zones.map((zone) => (
                                            <CommandItem
                                                key={zone.id}
                                                value={zone.name}
                                                onSelect={() => toggleZone(zone.id)}
                                                className="cursor-pointer aria-selected:bg-slate-800"
                                            >
                                                <div className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    formData.zoneIds.includes(zone.id)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                {zone.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Selected Zones Badges */}
                    {formData.zoneIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {formData.zoneIds.map(id => {
                                const zone = zones.find(z => z.id === id);
                                return zone ? (
                                    <Badge key={id} variant="secondary" className="bg-slate-700 text-slate-200 hover:bg-slate-600">
                                        {zone.name}
                                        <button
                                            type="button"
                                            onClick={() => toggleZone(id)}
                                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        >
                                            <span className="sr-only">Retirer</span>
                                            <span aria-hidden>×</span>
                                        </button>
                                    </Badge>
                                ) : null;
                            })}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="Description de la famille de monstres..."
                    />
                </div>

                <div className="flex gap-3">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                        {editing ? "💾 Mettre à jour" : "➕ Créer"}
                    </Button>
                    {editing && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditing(null);
                                setFormData({ name: "", description: "", imageUrl: "", zoneIds: [] });
                            }}
                        >
                            ❌ Annuler
                        </Button>
                    )}
                </div>
            </form>

            {/* List */}
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/30">
                <div className="p-4 border-b border-slate-700/30">
                    <h3 className="text-lg font-semibold text-white">📋 Familles existantes</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400">Chargement...</div>
                ) : families.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Aucune famille créée</div>
                ) : (
                    <div className="divide-y divide-slate-700/30">
                        {families.map((family) => (
                            <div key={family.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            {family.imageUrl && (
                                                <img
                                                    src={family.imageUrl}
                                                    alt={family.name}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            )}
                                            <div>
                                                <h4 className="font-semibold text-white">{family.name}</h4>
                                                {family.description && (
                                                    <p className="text-sm text-slate-400 mt-1">{family.description}</p>
                                                )}
                                                {family._count && (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {family._count.monsters} monstres
                                                    </p>
                                                )}

                                                {family.zones && family.zones.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {family.zones.slice(0, 3).map(z => (
                                                            <span key={z.id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/30">
                                                                {z.name}
                                                            </span>
                                                        ))}
                                                        {family.zones.length > 3 && (
                                                            <span className="text-[10px] px-1.5 py-0.5 text-slate-500">
                                                                +{family.zones.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEdit(family)}
                                            className="hover:bg-indigo-600/20"
                                        >
                                            ✏️ Éditer
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDelete(family.id)}
                                            className="hover:bg-red-600/20 text-red-400"
                                        >
                                            🗑️
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}
