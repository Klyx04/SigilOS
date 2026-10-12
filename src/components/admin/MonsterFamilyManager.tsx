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
    getMonsterFamilies,
    createMonsterFamily,
    updateMonsterFamily,
    deleteMonsterFamily,
    getAdminZones,
} from "@/server/actions/game-data-admin-actions";
import { 
    getIgnoredFamiliesAction,
    restoreIgnoredFamilyAction,
    clearAllIgnoredFamiliesAction
} from "@/server/actions/game-data-actions";
import { 
    Search, 
    Plus, 
    MoreHorizontal, 
    Edit2, 
    Trash2, 
    MapPin, 
    ImageIcon, 
    Loader2, 
    ChevronLeft, 
    ChevronRight,
    RotateCcw,
    ShieldAlert
} from "lucide-react";
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

const PAGE_SIZE = 16;

export default function MonsterFamilyManager() {
    const [families, setFamilies] = useState<MonsterFamily[]>([]);
    const [ignoredFamilies, setIgnoredFamilies] = useState<string[]>([]);
    const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedZone, setSelectedZone] = useState<string>("all");
    const [selectedLevel, setSelectedLevel] = useState<string>("all");
    const [viewMode, setViewMode] = useState<'active' | 'ignored'>('active');
    const [currentPage, setCurrentPage] = useState(1);
    const [restoringName, setRestoringName] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        level: undefined as number | undefined,
        description: "",
        imageUrl: "",
        zoneIds: [] as string[],
    });

    const loadIgnored = async () => {
        const res = await getIgnoredFamiliesAction();
        if (res.success && res.data) {
            setIgnoredFamilies(res.data);
        }
    };

    async function loadData() {
        const zonesRes = await getAdminZones();
        if (zonesRes.success && zonesRes.data) {
            setZones(zonesRes.data);
        }
        await loadIgnored();
    }

    useEffect(() => {
        loadData();
    }, []);

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
            const res = await getMonsterFamilies(filters);
            if (res.success && res.data) {
                setFamilies(res.data);
            }
        } catch {
            toast.error("Erreur de chargement des familles");
        } finally {
            setLoading(false);
            setCurrentPage(1);
        }
        await loadIgnored();
    }

    const resetForm = () => {
        setEditing(null);
        setFormData({
            name: "",
            level: undefined,
            description: "",
            imageUrl: "",
            zoneIds: [],
        });
    };

    const startEdit = (family: any) => {
        setEditing(family.id);
        setFormData({
            name: family.name,
            level: family.level || undefined,
            description: family.description || "",
            imageUrl: family.imageUrl || "",
            zoneIds: family.zones?.map((z: any) => z.id) || [],
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string, name?: string) => {
        if (!confirm(`Supprimer la famille "${name || id}" ? Elle sera ajoutée aux exclus.`)) return;
        try {
            const res = await deleteMonsterFamily(id);
            if (res.success) {
                toast.success(`Famille "${name || id}" supprimée et exclue des futures synchronisations.`);
                await loadFamilies();
            } else {
                toast.error(res.error || "Erreur lors de la suppression");
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

    const handleRestoreIgnored = async (name: string) => {
        setRestoringName(name);
        try {
            const res = await restoreIgnoredFamilyAction(name);
            if (res.success) {
                toast.success(`Famille "${name}" restaurée ! Vous pouvez relancer la sync pour la réimporter.`);
                await loadIgnored();
            } else {
                toast.error(res.error || "Erreur de restauration");
            }
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setRestoringName(null);
        }
    };

    const handleClearAllIgnored = async () => {
        if (!confirm("Voulez-vous vraiment réinitialiser toutes les exclusions de familles ?")) return;
        try {
            const res = await clearAllIgnoredFamiliesAction();
            if (res.success) {
                toast.success("Exclusions de familles réinitialisées.");
                await loadIgnored();
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = editing
                ? await updateMonsterFamily(editing, formData)
                : await createMonsterFamily(formData);
            
            if (res.success) {
                toast.success(editing ? "Famille modifiée avec succès" : "Famille créée avec succès");
                setIsDialogOpen(false);
                loadFamilies();
                resetForm();
            } else {
                toast.error(res.error || "Erreur lors de l'opération");
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

    const filteredFamilies = useMemo(() => {
        return families.filter(f => 
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [families, searchQuery]);

    const filteredIgnored = useMemo(() => {
        return ignoredFamilies.filter(name => 
            name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [ignoredFamilies, searchQuery]);

    const totalItems = viewMode === 'ignored' ? filteredIgnored.length : filteredFamilies.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const paginatedFamilies = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredFamilies.slice(start, start + PAGE_SIZE);
    }, [filteredFamilies, currentPage]);

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
                        placeholder="Rechercher une famille..."
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
                        Toutes ({families.length})
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
                        {ignoredFamilies.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-500 text-caption font-black">
                                {ignoredFamilies.length}
                            </span>
                        )}
                    </button>
                </div>

                {viewMode === 'active' && (
                    <>
                        {/* Zone Filter */}
                        <div className="w-full md:w-48">
                            <Select value={selectedZone} onValueChange={setSelectedZone}>
                                <SelectTrigger className="bg-elevated border-border text-foreground rounded-xl">
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
                        <div className="w-full md:w-36">
                            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                <SelectTrigger className="bg-elevated border-border text-foreground rounded-xl">
                                    <SelectValue placeholder="Niveau" />
                                </SelectTrigger>
                                <SelectContent className="bg-surface border-border">
                                    <SelectItem value="all">Tous niveaux</SelectItem>
                                    <SelectItem value="1-50">1 - 50</SelectItem>
                                    <SelectItem value="51-100">51 - 100</SelectItem>
                                    <SelectItem value="101-150">101 - 150</SelectItem>
                                    <SelectItem value="151-199">151 - 199</SelectItem>
                                    <SelectItem value="200">200</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={() => { resetForm(); setIsDialogOpen(true); }}
                            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle Famille
                        </Button>
                    </>
                )}
            </div>

            {/* View: Ignored / Excluded Families */}
            {viewMode === 'ignored' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                            <ShieldAlert size={16} />
                            <span>Ces familles ont été supprimées et sont ignorées lors des synchronisations DofusDB.</span>
                        </div>
                        {ignoredFamilies.length > 0 && (
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
                            <p className="font-bold">Aucune famille dans la liste d'exclusion</p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-elevated/60 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                                        <th className="text-left px-5 py-3">Nom de la famille</th>
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
                        <div className="p-16 text-center text-muted-foreground animate-pulse">Chargement des familles...</div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground bg-surface/50 rounded-2xl border border-dashed border-border">
                            Aucune famille trouvée
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginatedFamilies.map((family) => (
                                <div
                                    key={family.id}
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
                                                <DropdownMenuItem onClick={() => startEdit(family)} className="text-foreground focus:bg-elevated cursor-pointer">
                                                    <Edit2 className="w-4 h-4 mr-2 text-primary" /> Modifier
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(family.id, family.name)} className="text-danger focus:bg-danger/20 cursor-pointer">
                                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="p-4 flex gap-4">
                                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-elevated shrink-0 border border-border group-hover:border-primary/50 transition-colors">
                                            {family.imageUrl ? (
                                                <img
                                                    src={family.imageUrl}
                                                    alt={family.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                    <ImageIcon className="w-7 h-7" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors text-sm">
                                                    {family.name}
                                                </h3>
                                                {(family.level !== null && family.level !== undefined) ? (
                                                    <Badge variant="outline" className="ml-2 border-primary/30 text-primary font-bold bg-primary/5 text-caption">
                                                        Lvl {family.level}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="ml-2 border-border text-muted-foreground font-medium bg-elevated/50 text-caption">
                                                        Lvl ?
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-caption text-muted-foreground mt-0.5">
                                                {family._count?.monsters || 0} monstres
                                            </p>

                                            {family.zones && family.zones.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {family.zones.slice(0, 2).map(z => (
                                                        <div key={z.id} className="text-caption px-1.5 py-0.5 rounded-md bg-elevated border border-border text-muted-foreground flex items-center gap-1 max-w-full truncate">
                                                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                            <span className="truncate">{z.name}</span>
                                                        </div>
                                                    ))}
                                                    {family.zones.length > 2 && (
                                                        <div className="text-caption px-1.5 py-0.5 rounded-md bg-elevated border border-border text-muted-foreground">
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
                </>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground font-medium">
                        Page <span className="text-foreground font-bold">{currentPage}</span> sur <span className="text-foreground font-bold">{totalPages}</span> ({totalItems} familles au total)
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
                <DialogContent draggable className="w-[95vw] max-w-7xl max-h-[95vh] bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-8 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-4">
                                <Plus className="w-8 h-8 text-primary" />
                                {editing ? "Modifier la famille" : "Nouvelle famille"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-lg">
                                Gérez les familles de monstres, leurs descriptions et leurs zones de présence.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-7 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Nom de la famille *</label>
                                            <Input
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="ex: Bouftous"
                                                className="bg-elevated border-border text-foreground font-bold h-12 text-base rounded-xl"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Niveau Recommandé</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={1000}
                                                value={formData.level ?? ""}
                                                onChange={(e) => setFormData({ ...formData, level: e.target.value ? parseInt(e.target.value) : undefined })}
                                                placeholder="Optionnel"
                                                className="bg-elevated border-border text-foreground font-bold h-12 text-base rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Description Lore & Stratégie</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Histoire, faiblesses élémentaires ou caractéristiques notables..."
                                            className="w-full bg-elevated border border-border rounded-2xl p-4 text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[140px] resize-none"
                                        />
                                    </div>

                                    <div className="bg-surface/50 p-6 rounded-2xl border border-border shadow-inner">
                                        <h3 className="text-xs font-black text-primary uppercase tracking-widest border-b border-border pb-3 mb-4">Illustration</h3>
                                        <ImageDownloader
                                            type="monster"
                                            imageUrl={formData.imageUrl}
                                            identifier={formData.name}
                                            onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                <div className="lg:col-span-5 h-full">
                                    <div className="space-y-6 bg-surface/30 p-6 rounded-2xl border border-border/50 h-full flex flex-col">
                                        <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
                                            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Zones de Présence</h3>
                                            <span className="bg-primary/10 text-primary text-caption font-bold px-2.5 py-1 rounded-full uppercase border border-primary/20">
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
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-border shrink-0 sticky bottom-0 bg-background py-4">
                                <Button type="submit" className="flex-[3] bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-bold uppercase tracking-wider shadow-lg transition-all rounded-xl">
                                    {editing ? "💾 Enregistrer" : "➕ Créer la Famille"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-12 border-border hover:bg-surface text-foreground text-sm font-bold uppercase tracking-wider transition-all rounded-xl"
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
