"use client";

import { useState, useEffect, useMemo } from "react";
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
import { 
    getMonsterFamilies, 
    getDungeons, 
    syncZonesFromDofusDb,
    getIgnoredZonesAction,
    restoreIgnoredZoneAction,
    clearAllIgnoredZonesAction
} from "@/server/actions/game-data-actions";
import { 
    MapPin, 
    Trash2, 
    Edit2, 
    Plus, 
    Search, 
    MoreHorizontal, 
    RefreshCw, 
    Loader2, 
    ChevronLeft, 
    ChevronRight,
    RotateCcw,
    ShieldAlert
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MultiSelect } from "@/components/ui/multi-select";
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

const PAGE_SIZE = 20;

export default function ZoneManager() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [ignoredZones, setIgnoredZones] = useState<string[]>([]);
    const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
    const [dungeons, setDungeons] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingZones, setSyncingZones] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLevel, setSelectedLevel] = useState<string>("all");
    const [viewMode, setViewMode] = useState<'active' | 'ignored'>('active');
    const [currentPage, setCurrentPage] = useState(1);
    const [restoringName, setRestoringName] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        level: 200,
        familyIds: [] as string[],
        dungeonIds: [] as string[],
    });

    const loadIgnored = async () => {
        const res = await getIgnoredZonesAction();
        if (res.success && res.data) {
            setIgnoredZones(res.data);
        }
    };

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
        }
        if (familiesRes.success && familiesRes.data) {
            setFamilies(familiesRes.data);
        }
        if (dungeonsRes.success && dungeonsRes.data) {
            setDungeons(dungeonsRes.data);
        }
        await loadIgnored();
        setLoading(false);
        setCurrentPage(1);
    }

    const handleSyncDofusDb = async () => {
        setSyncingZones(true);
        try {
            const res = await syncZonesFromDofusDb();
            if (res.success && res.data) {
                toast.success(`${res.data.synced} Zones & Sous-zones synchronisées depuis DofusDB !`);
                await loadData();
            } else {
                toast.error(res.error || "Erreur de synchronisation");
            }
        } catch {
            toast.error("Erreur de connexion DofusDB");
        } finally {
            setSyncingZones(false);
        }
    };

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

    async function handleDelete(id: string, name?: string) {
        if (!confirm(`Supprimer la zone "${name || id}" ? Elle sera exclue des futures synchronisations.`)) return;
        const result = await deleteZone(id);
        if (result.success) {
            toast.success(`Zone "${name || id}" supprimée et ajoutée aux exclus.`);
            loadData();
        }
    }

    const handleRestoreIgnored = async (name: string) => {
        setRestoringName(name);
        try {
            const res = await restoreIgnoredZoneAction(name);
            if (res.success) {
                toast.success(`Zone "${name}" restaurée ! Vous pouvez relancer la sync pour la réimporter.`);
                await loadIgnored();
            } else {
                toast.error(res.error || "Erreur lors de la restauration");
            }
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setRestoringName(null);
        }
    };

    const handleClearAllIgnored = async () => {
        if (!confirm("Voulez-vous vraiment réinitialiser toutes les exclusions de zones ?")) return;
        try {
            const res = await clearAllIgnoredZonesAction();
            if (res.success) {
                toast.success("Exclusions de zones réinitialisées.");
                await loadIgnored();
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

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

    const filteredZones = useMemo(() => {
        return zones.filter(z =>
            z.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [zones, searchQuery]);

    const filteredIgnored = useMemo(() => {
        return ignoredZones.filter(name =>
            name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [ignoredZones, searchQuery]);

    const totalItems = viewMode === 'ignored' ? filteredIgnored.length : filteredZones.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const paginatedZones = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredZones.slice(start, start + PAGE_SIZE);
    }, [filteredZones, currentPage]);

    const paginatedIgnored = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredIgnored.slice(start, start + PAGE_SIZE);
    }, [filteredIgnored, currentPage]);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-3 bg-surface/50 p-4 rounded-2xl border border-border backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une zone ou sous-zone..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="pl-9 bg-elevated border-border text-foreground placeholder:text-muted-foreground focus:ring-ring/50 rounded-xl"
                    />
                </div>

                {/* View Switch: Active vs Ignored */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => { setViewMode('active'); setCurrentPage(1); }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            viewMode === 'active'
                                ? 'bg-primary/20 border-primary/40 text-primary'
                                : 'bg-elevated border-border text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Toutes ({zones.length})
                    </button>
                    <button
                        onClick={() => { setViewMode('ignored'); setCurrentPage(1); }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            viewMode === 'ignored'
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                                : 'bg-elevated border-border text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Trash2 size={13} />
                        <span>Exclues</span>
                        {ignoredZones.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-500 text-caption font-black">
                                {ignoredZones.length}
                            </span>
                        )}
                    </button>
                </div>

                {viewMode === 'active' && (
                    <>
                        {/* Level Filter */}
                        <div className="w-full md:w-44">
                            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                <SelectTrigger className="bg-elevated border-border text-foreground rounded-xl">
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
                            onClick={handleSyncDofusDb}
                            disabled={syncingZones}
                            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm transition-all"
                        >
                            {syncingZones ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            <span>{syncingZones ? "Sync en cours…" : "Sync Zones (DofusDB)"}</span>
                        </Button>

                        <Button
                            onClick={() => { resetForm(); setIsDialogOpen(true); }}
                            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle Zone
                        </Button>
                    </>
                )}
            </div>

            {/* View: Ignored / Excluded Zones */}
            {viewMode === 'ignored' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                            <ShieldAlert size={16} />
                            <span>Ces zones et sous-zones ont été supprimées et sont ignorées lors des synchronisations DofusDB.</span>
                        </div>
                        {ignoredZones.length > 0 && (
                            <button
                                onClick={handleClearAllIgnored}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all"
                            >
                                ♻️ Tout restaurer
                            </button>
                        )}
                    </div>

                    {filteredIgnored.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl bg-surface/50">
                            <p className="font-bold">Aucune zone dans la liste d'exclusion</p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-elevated/60 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                                        <th className="text-left px-5 py-3">Nom de la zone</th>
                                        <th className="text-left px-5 py-3">Statut</th>
                                        <th className="text-right px-5 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {paginatedIgnored.map((name) => (
                                        <tr key={name} className="hover:bg-elevated/30 transition-colors">
                                            <td className="px-5 py-3 font-bold text-foreground capitalize">
                                                {name}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="px-2.5 py-0.5 rounded-full text-caption font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                                    Exclue des synchronisations
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleRestoreIgnored(name)}
                                                    disabled={restoringName === name}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface border border-border text-foreground hover:text-emerald-500 text-xs font-bold transition-all"
                                                >
                                                    {restoringName === name ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                                                    <span>Restaurer</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Grid List */
                <>
                    {loading ? (
                        <div className="p-16 text-center text-muted-foreground animate-pulse">Chargement des zones...</div>
                    ) : filteredZones.length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground bg-surface/50 rounded-2xl border border-dashed border-border">
                            Aucune zone trouvée
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {paginatedZones.map((zone) => (
                                <div
                                    key={zone.id}
                                    className="group relative bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200"
                                >
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 bg-surface/80 hover:bg-elevated text-muted-foreground rounded-lg">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-surface border-border">
                                                <DropdownMenuItem onClick={() => startEdit(zone)} className="text-foreground focus:bg-elevated cursor-pointer">
                                                    <Edit2 className="w-4 h-4 mr-2 text-primary" /> Modifier
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(zone.id, zone.name)} className="text-danger focus:bg-danger/20 cursor-pointer">
                                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="p-4 flex items-center gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500 shrink-0">
                                            <MapPin className="w-5 h-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors text-sm">
                                                {zone.name}
                                            </h3>
                                            <p className="text-caption text-muted-foreground mt-0.5 font-medium">
                                                Niveau {zone.level || "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground font-medium">
                        Page <span className="text-foreground font-bold">{currentPage}</span> sur <span className="text-foreground font-bold">{totalPages}</span> ({totalItems} zones au total)
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg bg-elevated border border-border text-foreground hover:bg-surface disabled:opacity-40 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 font-bold text-foreground">{currentPage}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg bg-elevated border border-border text-foreground hover:bg-surface disabled:opacity-40 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-6xl bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-3">
                                <Plus className="w-6 h-6 text-primary" />
                                {editing ? "Modifier la zone" : "Nouvelle zone"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-sm">
                                Configurez les détails géographiques de la zone et son niveau recommandé.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        Nom de la zone *
                                    </label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="ex: Forêt des Pins Perdus"
                                        className="bg-elevated border-border text-foreground rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        Niveau recommandé *
                                    </label>
                                    <Input
                                        required
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 200 })}
                                        className="bg-elevated border-border text-foreground rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        Familles de Monstres
                                    </label>
                                    <MultiSelect
                                        options={families.map(f => ({ label: f.name, value: f.id }))}
                                        selected={formData.familyIds}
                                        onChange={(val) => setFormData({ ...formData, familyIds: val })}
                                        placeholder="Associer des familles..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                                        Donjons de la Zone
                                    </label>
                                    <MultiSelect
                                        options={dungeons.map(d => ({ label: d.name, value: d.id }))}
                                        selected={formData.dungeonIds}
                                        onChange={(val) => setFormData({ ...formData, dungeonIds: val })}
                                        placeholder="Associer des donjons..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-border">
                                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl">
                                    {editing ? "💾 Enregistrer les modifications" : "➕ Créer la Zone"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="border-border hover:bg-surface text-foreground font-bold h-12 rounded-xl"
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
