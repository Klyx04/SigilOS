"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
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
import { ImageDownloader } from "./ImageDownloader";
import {
    getDefis,
    createDefi,
    updateDefi,
    deleteDefi,
    searchMonstersForDefi,
    type DefiFormValues,
} from "@/server/actions/defi-admin-actions";
import { slugifyName } from "@/lib/defi-slug";
import { searchZones } from "@/server/actions/game-data-actions";
import { Search, Plus, MapPin, Swords, MoreHorizontal, Edit2, Trash2, CalendarRange, Infinity, Calendar, X } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AsyncCombobox, type ComboboxItem } from "@/components/ui/async-combobox";
import { Switch } from "@/components/ui/switch";

interface BossRef {
    name: string;
    dofusdbId?: number | null;
    imageUrl?: string | null;
}

interface Defi {
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
    bossNames: BossRef[] | null;
    isPermanent?: boolean;
    startDate?: string | null;
    endDate?: string | null;
}

/** Valeurs de formulaire (miroir du schéma serveur) — slug auto-généré + dates d'événement. */
type DefiFormState = {
    name: string;
    slug: string;
    description: string;
    zone: string;
    level: number | null;
    imageUrl: string;
    dofensiveUrl: string;
    dpnlUrl: string;
    dofuspourlesnoobsUrl: string;
    bosses: BossRef[];
    isPermanent: boolean;
    startDate: string;
    endDate: string;
};

const EMPTY_FORM: DefiFormState = {
    name: "",
    slug: "",
    description: "",
    zone: "",
    level: 200,
    imageUrl: "",
    dofensiveUrl: "",
    dpnlUrl: "",
    dofuspourlesnoobsUrl: "",
    bosses: [],
    isPermanent: true,
    startDate: "",
    endDate: "",
};

/** Convertit une valeur Date|null (ISO) en valeur `<input type="datetime-local">`. */
function toDateTimeLocal(v: string | null | undefined): string {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    // datetime-local attend "YYYY-MM-DDTHH:mm" (fuseau local).
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DefiManager() {
    const [defis, setDefis] = useState<Defi[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [formData, setFormData] = useState(EMPTY_FORM);

    async function load() {
        setLoading(true);
        const res = await getDefis();
        if (res.success && res.data) setDefis(res.data as Defi[]);
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

    function startEdit(d: Defi) {
        setEditing(d.id);
        setFormData({
            name: d.name,
            slug: d.slug,
            description: d.description || "",
            zone: d.zone || "",
            level: d.level ?? 200,
            imageUrl: d.imageUrl || "",
            dofensiveUrl: d.dofensiveUrl || "",
            dpnlUrl: d.dpnlUrl || "",
            dofuspourlesnoobsUrl: d.dofuspourlesnoobsUrl || "",
            bosses: Array.isArray(d.bossNames) ? d.bossNames : [],
            isPermanent: d.isPermanent ?? true,
            startDate: toDateTimeLocal(d.startDate),
            endDate: toDateTimeLocal(d.endDate),
        });
        setIsDialogOpen(true);
    }

    const filtered = defis.filter((d) =>
        !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!formData.name) {
            toast.error("Nom requis");
            return;
        }
        if (!formData.isPermanent && (!formData.startDate || !formData.endDate)) {
            toast.error("Renseigne les dates de début et de fin (ou passe le défi en permanent)");
            return;
        }
        const payload: DefiFormValues = {
            name: formData.name,
            slug: slugifyName(formData.slug || formData.name),
            description: formData.description,
            zone: formData.zone,
            level: formData.level,
            imageUrl: formData.imageUrl,
            dofensiveUrl: formData.dofensiveUrl,
            dpnlUrl: formData.dpnlUrl,
            dofuspourlesnoobsUrl: formData.dofuspourlesnoobsUrl,
            bosses: formData.bosses,
            isPermanent: formData.isPermanent,
            startDate: formData.isPermanent ? null : formData.startDate ? new Date(formData.startDate) : null,
            endDate: formData.isPermanent ? null : formData.endDate ? new Date(formData.endDate) : null,
        };
        const result = editing ? await updateDefi(editing, payload) : await createDefi(payload);
        if (result.success) {
            toast.success(editing ? "Défi mis à jour" : "Défi créé");
            resetForm();
            setIsDialogOpen(false);
            load();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer ce défi ?")) return;
        const res = await deleteDefi(id);
        if (res.success) {
            toast.success("Défi supprimé");
            load();
        } else {
            toast.error(res.error || "Erreur");
        }
    }

    return <DefiManagerView
        loading={loading}
        filtered={filtered}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNew={() => { resetForm(); setIsDialogOpen(true); }}
        onEdit={startEdit}
        onDelete={handleDelete}
        isDialogOpen={isDialogOpen}
        onDialogOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}
        editing={editing}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
    />;
}

// MARKER_DEFI_VIEW
function DefiManagerView(props: {
    loading: boolean;
    filtered: Defi[];
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    onNew: () => void;
    onEdit: (d: Defi) => void;
    onDelete: (id: string) => void;
    isDialogOpen: boolean;
    onDialogOpenChange: (o: boolean) => void;
    editing: string | null;
    formData: DefiFormState;
    setFormData: (v: DefiFormState) => void;
    onSubmit: (e: FormEvent) => void;
}) {
    const { loading, filtered, searchQuery, setSearchQuery, onNew, onEdit, onDelete, formData, setFormData } = props;

    // Zones siphonnées (nom) pour le dropdown « Zone ».
    const zoneFetcher = useCallback(async (q: string): Promise<ComboboxItem[]> => {
        const res = await searchZones(q);
        if (!res.success || !res.data) return [];
        return (res.data as any[])
            .filter((z) => z?.name)
            .map((z) => ({ value: z.name, label: z.name, subLabel: z.level ? `Lvl ${z.level}` : undefined }));
    }, []);

    // Monstres Dofensive siphonnés pour le dropdown « Boss du défi ».
    const bossFetcher = useCallback(async (q: string): Promise<ComboboxItem[]> => {
        const res = await searchMonstersForDefi(q);
        if (!res.success || !res.data) return [];
        return (res.data as any[]).map((m) => ({ value: m.value, label: m.label, subLabel: m.subLabel }));
    }, []);

    // Génère le slug à partir du nom tant que l'utilisateur n'a pas touché le champ slug.
    function handleNameChange(name: string) {
        setFormData({ ...formData, name, slug: formData.slug || slugifyName(name) });
    }
    function handleSlugChange(slug: string) {
        setFormData({ ...formData, slug: slugifyName(slug) });
    }
    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un défi..."
                        className="pl-10 bg-background border-border rounded-xl"
                    />
                </div>
                <Button onClick={onNew} className="bg-info hover:bg-info">
                    <Plus className="w-4 h-4 mr-2" /> Nouveau Défi
                </Button>
            </div>

            {/* Grid List */}
            {loading ? (
                <p className="text-muted-foreground text-sm">Chargement des défis…</p>
            ) : filtered.length === 0 ? (
                <div className="text-center py-24 bg-surface/30 rounded-3xl border border-border border-dashed">
                    <Swords className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground text-sm">Aucun défi trouvé.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((d) => (
                        <div key={d.id} className="bg-surface/60 border border-border rounded-2xl p-4 flex flex-col gap-3 group hover:border-border-strong transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-background border border-border shrink-0">
                                    {d.imageUrl ? (
                                        <img src={d.imageUrl} alt={d.name} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Swords className="w-6 h-6" /></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-foreground truncate">{d.name}</p>
                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                        {d.zone ? <><MapPin className="w-3 h-3" /> {d.zone} · </> : null}
                                        {d.level ? <>Lvl {d.level}</> : "Niveau variable"}
                                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                        {(d.isPermanent ?? true)
                                            ? <><Infinity className="w-3 h-3" /> Dispo en perpétuel</>
                                            : <><Calendar className="w-3 h-3" /> {d.startDate ? new Date(d.startDate).toLocaleDateString("fr-FR") : "?"} → {d.endDate ? new Date(d.endDate).toLocaleDateString("fr-FR") : "?"}</>}
                                    </p>
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(d)}>
                                            <Edit2 className="w-4 h-4 mr-2 text-info" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(d.id)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(d.bossNames ?? []).map((b, i) => (
                                    <span key={i} className="text-[11px] font-bold bg-surface border border-border px-2 py-0.5 rounded-md text-muted-foreground">{b.name}</span>
                                ))}
                                {(d.bossNames ?? []).length === 0 && <span className="text-[11px] text-muted-foreground">Aucun boss renseigné</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Dialog open={props.isDialogOpen} onOpenChange={props.onDialogOpenChange}>
                <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-8 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-4">
                                <Swords className="w-8 h-8 text-warning" />
                                {props.editing ? "Modifier le défi" : "Nouveau défi"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-lg">
                                Un défi est un combat one-shot (ex. Défi du Xélor fou). Configure son nom, ses boss, sa zone.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <form onSubmit={props.onSubmit} className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-7">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom du Défi <span className="text-danger text-lg">*</span></label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    required
                                    placeholder="Ex: Défi du Xélor fou"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Slug <span className="normal-case font-medium text-muted-foreground">(auto)</span></label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={formData.slug}
                                        onChange={(e) => handleSlugChange(e.target.value)}
                                        placeholder="Automatique"
                                        className="flex-1"
                                    />
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" title="Régénérer depuis le nom" onClick={() => handleSlugChange(slugifyName(formData.name))}>
                                        <Infinity className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-1">Généré depuis le nom — tu n'as rien à saisir. Ex. <code>defi-du-xelor-fou</code>.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Zone <span className="normal-case font-medium text-muted-foreground">(siphonnée)</span></label>
                                <AsyncCombobox
                                    value={formData.zone || ""}
                                    onSelect={(v) => setFormData({ ...formData, zone: v })}
                                    fetcher={zoneFetcher}
                                    placeholder="Choisir une zone..."
                                    searchPlaceholder="Rechercher une zone..."
                                    emptyText="Aucune zone trouvée (zones siphonnées)."
                                    initialLabel={formData.zone || undefined}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau</label>
                                <Input
                                    type="number"
                                    value={formData.level ?? ""}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value ? Number(e.target.value) : null })}
                                    placeholder="200"
                                />
                            </div>
                        </div>

                        {/* Boss (un ou plusieurs) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Boss du défi <span className="text-muted-foreground normal-case font-medium">(un ou plusieurs)</span></label>
                                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, bosses: [...formData.bosses, { name: "" }] })}>
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Ajouter un boss
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {formData.bosses.map((b, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="flex-[2]">
                                            <AsyncCombobox
                                                value={b.name}
                                                onSelect={(v) => {
                                                    const bosses = [...formData.bosses];
                                                    bosses[i] = { ...bosses[i], name: v };
                                                    setFormData({ ...formData, bosses });
                                                }}
                                                fetcher={bossFetcher}
                                                placeholder={`Boss ${i + 1}`}
                                                searchPlaceholder="Nom du boss (monstres siphonnés)..."
                                                emptyText="Aucun monstre trouvé."
                                                initialLabel={b.name || undefined}
                                            />
                                        </div>
                                        <Input
                                            value={b.imageUrl || ""}
                                            onChange={(e) => {
                                                const bosses = [...formData.bosses];
                                                bosses[i] = { ...bosses[i], imageUrl: e.target.value };
                                                setFormData({ ...formData, bosses });
                                            }}
                                            placeholder="URL image (optionnel)"
                                            className="flex-[3]"
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setFormData({ ...formData, bosses: formData.bosses.filter((_, x) => x !== i) })}>
                                            ×
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien Dofensive</label>
                                <Input value={formData.dofensiveUrl} onChange={(e) => setFormData({ ...formData, dofensiveUrl: e.target.value })} placeholder="https://dofensive.com/fr/..." />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien DofusPourLesNoobs</label>
                                <Input value={formData.dofuspourlesnoobsUrl} onChange={(e) => setFormData({ ...formData, dofuspourlesnoobsUrl: e.target.value })} placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                        </div>

                        {/* Fenêtre d'événement : permanent (par défaut) ou bornée [début -> fin] */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <CalendarRange className="w-4 h-4" /> Fenêtre d'événement
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Infinity className="w-3.5 h-3.5" /> Dispo en perpétuel
                                    </span>
                                    <Switch
                                        checked={formData.isPermanent}
                                        onCheckedChange={(v) => setFormData({ ...formData, isPermanent: v })}
                                    />
                                </div>
                            </div>

                            {!formData.isPermanent && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface/40 border border-border rounded-xl p-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" /> Début de l'événement
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" /> Fin de l'événement
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {!formData.isPermanent && (
                                <p className="text-[11px] text-muted-foreground pl-1">
                                    L'événement a lieu entre <strong>{formData.startDate ? new Date(formData.startDate).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—"}</strong> et <strong>{formData.endDate ? new Date(formData.endDate).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—"}</strong>.
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Conditions du défi, récompenses…"
                                rows={3}
                                className="w-full bg-surface/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/30"
                            />
                        </div>

                        {/* Illustration */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Illustration</label>
                            <ImageDownloader
                                type="defi"
                                imageUrl={formData.imageUrl}
                                identifier={formData.name}
                                onImageDownloaded={(path) => setFormData({ ...formData, imageUrl: path })}
                            />
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-border">
                            <Button type="submit" className="flex-[3] bg-info hover:bg-info h-14 text-lg font-black uppercase tracking-widest rounded-xl">
                                {props.editing ? "💾 Enregistrer" : "➕ Créer le Défi"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => props.onDialogOpenChange(false)} className="flex-1 h-14">Fermer</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
