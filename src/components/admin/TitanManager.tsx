"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AsyncCombobox, type ComboboxItem } from "@/components/ui/async-combobox";
import { searchZones } from "@/server/actions/game-data-actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ImageDownloader } from "./ImageDownloader";
import {
    getTitans,
    createTitan,
    updateTitan,
    deleteTitan,
    type TitanFormValues,
} from "@/server/actions/titan-admin-actions";
import { slugifyName } from "@/lib/titan-slug";
import { Search, Plus, Swords, MoreHorizontal, Edit2, Trash2, CalendarRange, Infinity, Calendar, MapPin, Layers, Users, Crown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

interface Titan {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    zone?: string | null;
    level?: number | null;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    dpnlUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    mapName?: string | null;
    dofusdbId?: number | null;
    questName?: string | null;
    questUrl?: string | null;
    scheduleConfig?: any;
    seasonBosses?: any;
    seasons: string[];
    currentSeason?: string | null;
    maxMembers?: number;
    isPermanent?: boolean;
}

interface SeasonBossRef {
    season: string;
    bossName: string;
    imageUrl?: string | null;
}

/** Config de disponibilité FLEXIBLE (jours/créneaux/maxVictoires) — non figée. */
interface ScheduleConfig {
    onlyWeekend?: boolean;
    daysOfWeek?: number[]; // 0 = dimanche … 6 = samedi
    startTime?: string; // "19:00"
    endTime?: string; // "08:00"
    maxWinsPerWeekend?: number;
}

type TitanFormState = {
    name: string;
    slug: string;
    description: string;
    zone: string;
    level: number | null;
    imageUrl: string;
    dofensiveUrl: string;
    dpnlUrl: string;
    dofuspourlesnoobsUrl: string;
    mapName: string;
    dofusdbId: number | null;
    questName: string;
    questUrl: string;
    seasons: string[];
    currentSeason: string;
    maxMembers: number;
    onlyWeekend: boolean;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    maxWinsPerWeekend: number;
    seasonBosses: SeasonBossRef[];
};

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const EMPTY_FORM: TitanFormState = {
    name: "",
    slug: "",
    description: "",
    zone: "",
    level: 200,
    imageUrl: "",
    dofensiveUrl: "",
    dpnlUrl: "",
    dofuspourlesnoobsUrl: "",
    mapName: "",
    dofusdbId: null,
    questName: "",
    questUrl: "",
    seasons: [],
    currentSeason: "",
    maxMembers: 4,
    onlyWeekend: true,
    daysOfWeek: [5, 6, 0],
    startTime: "19:00",
    endTime: "08:00",
    maxWinsPerWeekend: 5,
    seasonBosses: [],
};

function buildScheduleConfig(form: TitanFormState): ScheduleConfig {
    return {
        onlyWeekend: form.onlyWeekend,
        daysOfWeek: form.onlyWeekend && form.daysOfWeek.length === 0 ? [5, 6, 0] : form.daysOfWeek,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        maxWinsPerWeekend: form.maxWinsPerWeekend,
    };
}

export default function TitanManager() {
    const [titans, setTitans] = useState<Titan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Zones siphonnées (nom) pour le dropdown « Zone ».
    const zoneFetcher = useCallback(async (q: string): Promise<ComboboxItem[]> => {
        const res = await searchZones(q);
        if (!res.success || !res.data) return [];
        return (res.data as any[])
            .filter((z) => z?.name)
            .map((z) => ({ value: z.name, label: z.name, subLabel: z.level ? `Lvl ${z.level}` : undefined }));
    }, []);

    // Slug auto-généré depuis le nom tant que l'utilisateur n'a pas touché le champ slug.
    function handleNameChange(name: string) {
        setFormData({ ...formData, name, slug: formData.slug || slugifyName(name) });
    }

    async function load() {
        setLoading(true);
        const res = await getTitans();
        if (res.success && res.data) setTitans(res.data as Titan[]);
        else toast.error(res.error || "Erreur");
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    function resetForm() {
        setFormData(EMPTY_FORM);
        setEditing(null);
    }

    function fromScheduleConfig(schedule?: ScheduleConfig) {
        const s = schedule || {};
        setFormData((prev) => ({
            ...prev,
            onlyWeekend: s.onlyWeekend ?? true,
            daysOfWeek: s.daysOfWeek && s.daysOfWeek.length ? s.daysOfWeek : [5, 6, 0],
            startTime: s.startTime || "19:00",
            endTime: s.endTime || "08:00",
            maxWinsPerWeekend: s.maxWinsPerWeekend ?? 5,
        }));
    }

    function startEdit(t: Titan) {
        setEditing(t.id);
        setFormData({
            name: t.name,
            slug: t.slug,
            description: t.description || "",
            zone: t.zone || "",
            level: t.level ?? 200,
            imageUrl: t.imageUrl || "",
            dofensiveUrl: t.dofensiveUrl || "",
            dpnlUrl: t.dpnlUrl || "",
            dofuspourlesnoobsUrl: t.dofuspourlesnoobsUrl || "",
            mapName: t.mapName || "",
            dofusdbId: t.dofusdbId ?? null,
            questName: t.questName || "",
            questUrl: t.questUrl || "",
            seasons: Array.isArray(t.seasons) ? t.seasons : [],
            currentSeason: t.currentSeason || "",
            maxMembers: t.maxMembers ?? 4,
            onlyWeekend: true,
            daysOfWeek: [5, 6, 0],
            startTime: "19:00",
            endTime: "08:00",
            maxWinsPerWeekend: 5,
            seasonBosses: Array.isArray(t.seasonBosses) ? t.seasonBosses : [],
        });
        fromScheduleConfig(t.scheduleConfig);
        setIsDialogOpen(true);
    }

    const filtered = titans.filter((t) =>
        !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!formData.name) {
            toast.error("Nom requis");
            return;
        }
        const payload: TitanFormValues = {
            name: formData.name,
            slug: slugifyName(formData.slug || formData.name),
            description: formData.description,
            zone: formData.zone,
            level: formData.level,
            imageUrl: formData.imageUrl,
            dofensiveUrl: formData.dofensiveUrl,
            dpnlUrl: formData.dpnlUrl,
            dofuspourlesnoobsUrl: formData.dofuspourlesnoobsUrl,
            mapName: formData.mapName,
            dofusdbId: formData.dofusdbId,
            questName: formData.questName,
            questUrl: formData.questUrl,
            scheduleConfig: buildScheduleConfig(formData),
            seasonBosses: formData.seasonBosses,
            seasons: formData.seasons,
            currentSeason: formData.currentSeason,
            maxMembers: formData.maxMembers,
            isPermanent: true,
        };
        const result = editing ? await updateTitan(editing, payload) : await createTitan(payload);
        if (result.success) {
            toast.success(editing ? "Titan mis à jour" : "Titan créé");
            resetForm();
            setIsDialogOpen(false);
            load();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer ce titan ?")) return;
        const res = await deleteTitan(id);
        if (res.success) {
            toast.success("Titan supprimé");
            load();
        } else {
            toast.error(res.error || "Erreur");
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un titan…"
                        className="pl-9 bg-surface/50 border-border"
                    />
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-600 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Nouveau Titan
                </Button>
            </div>

            {loading ? (
                <div className="animate-pulse bg-surface h-20 rounded-2xl border border-border" />
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
                    <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Aucun titan. Ajoutez le premier (ex. Gargandyas).</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-border bg-surface/40 p-4 flex items-start gap-3">
                            <div className="w-14 h-14 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                {t.imageUrl ? (
                                    <img src={t.imageUrl} alt={t.name} className="w-full h-full object-contain" />
                                ) : (
                                    <Crown className="w-6 h-6 text-amber-500" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground truncate">{t.name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Niveau {t.level ?? "—"} · {t.zone || "Zone inconnue"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <Users className="w-3 h-3" /> {t.maxMembers ?? 4} max
                                            {t.currentSeason ? <> · <Calendar className="w-3 h-3" /> {t.currentSeason}</> : null}
                                        </p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 text-muted-foreground">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => startEdit(t)}><Edit2 className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
                                            <DropdownMenuItem className="text-danger" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={() => setIsDialogOpen(false)}>
                <DialogContent className="w-[95vw] max-w-3xl bg-background border border-border rounded-2xl text-foreground max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-2 border-b border-border">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0">
                                <Crown className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg text-foreground leading-none">{editing ? "Modifier le Titan" : "Nouveau Titan"}</span>
                                <span className="text-caption text-muted-foreground font-semibold mt-1">Événement Krosmique</span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-2">
                            Chaque Titan porte sa propre disponibilité (jours/créneaux/max de victoires) — non figée pour les futurs Titans.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom du Titan</label>
                                <Input value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Gargandyas" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Zone / Dimension</label>
                                <AsyncCombobox
                                    value={formData.zone}
                                    placeholder="Osavora"
                                    fetcher={zoneFetcher}
                                    onSelect={(value) => setFormData({ ...formData, zone: value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau</label>
                                <Input type="number" min={0} max={1000} value={formData.level ?? ""} onChange={(e) => setFormData({ ...formData, level: e.target.value ? Number(e.target.value) : null })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">ID DofusDB (optionnel)</label>
                                <Input type="number" min={0} value={formData.dofusdbId ?? ""} onChange={(e) => setFormData({ ...formData, dofusdbId: e.target.value ? Number(e.target.value) : null })} placeholder="8069" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Map isométrique (optionnel)</label>
                                <Input value={formData.mapName} onChange={(e) => setFormData({ ...formData, mapName: e.target.value })} placeholder="Auto via Dofensive" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground pl-1">💡 Le slug est auto-généré depuis le nom. L'ID DofusDB et la map isométrique servent à la synchro sorts/stats/carte — ils peuvent rester vides (résolus automatiquement via Dofensive/DofusDB).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien Dofensive</label>
                                <Input value={formData.dofensiveUrl} onChange={(e) => setFormData({ ...formData, dofensiveUrl: e.target.value })} placeholder="https://dofensive.com/fr/..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien DofusPourLesNoobs</label>
                                <Input value={formData.dofuspourlesnoobsUrl} onChange={(e) => setFormData({ ...formData, dofuspourlesnoobsUrl: e.target.value })} placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Quête associée</label>
                                <Input value={formData.questName} onChange={(e) => setFormData({ ...formData, questName: e.target.value })} placeholder="Destructeur de mondes" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien de la quête</label>
                                <Input value={formData.questUrl} onChange={(e) => setFormData({ ...formData, questUrl: e.target.value })} placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                        </div>

                        {/* Illustration */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Illustration</label>
                            <ImageDownloader
                                type="titan"
                                imageUrl={formData.imageUrl}
                                identifier={slugifyName(formData.name || "titan")}
                                onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                            />
                        </div>

                        {/* Disponibilité (flexible) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <CalendarRange className="w-4 h-4" /> Disponibilité (non figée)
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Infinity className="w-3.5 h-3.5" /> Week-end uniquement</span>
                                    <Switch checked={formData.onlyWeekend} onCheckedChange={(v) => setFormData({ ...formData, onlyWeekend: v })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface/40 border border-border rounded-xl p-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Jours ouvrés</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DAY_LABELS.map((label, idx) => {
                                            const active = formData.daysOfWeek.includes(idx);
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        daysOfWeek: active ? formData.daysOfWeek.filter((d) => d !== idx) : [...formData.daysOfWeek, idx],
                                                    })}
                                                    className={`h-8 w-9 rounded-lg text-[11px] font-bold border ${active ? "bg-amber-600 border-amber-600 text-white" : "bg-surface border-border text-muted-foreground"}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Créneau (début / fin)</label>
                                    <div className="flex items-center gap-2">
                                        <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
                                        <span className="text-muted-foreground">→</span>
                                        <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Saisons & composition */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Saisons (séparées par des virgules)</label>
                                <Input value={formData.seasons.join(", ")} onChange={(e) => setFormData({ ...formData, seasons: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Naissances, Chasse, Repos" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Saison en cours</label>
                                <Input value={formData.currentSeason} onChange={(e) => setFormData({ ...formData, currentSeason: e.target.value })} placeholder="Ex. Naissances" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Max joueurs</label>
                            <Input type="number" min={1} max={12} value={formData.maxMembers} onChange={(e) => setFormData({ ...formData, maxMembers: Number(e.target.value) })} />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description / mécaniques</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Conditions, phases, offrande, récompenses…"
                                rows={3}
                                className="w-full bg-surface/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/30"
                            />
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-border">
                            <Button type="submit" className="flex-[3] bg-amber-600 hover:bg-amber-600 h-14 text-lg font-black uppercase tracking-widest rounded-xl text-white">
                                {editing ? "💾 Enregistrer" : "➕ Créer le Titan"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-14">Fermer</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
