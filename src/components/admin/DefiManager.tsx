"use client";

import { useEffect, useState, type FormEvent } from "react";
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
} from "@/server/actions/defi-admin-actions";
import { Search, Plus, MapPin, Swords, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}

const EMPTY_FORM = {
    name: "",
    slug: "",
    description: "",
    zone: "",
    level: 200 as number | null,
    imageUrl: "",
    dofensiveUrl: "",
    dpnlUrl: "",
    dofuspourlesnoobsUrl: "",
    bosses: [] as BossRef[],
};

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
        });
        setIsDialogOpen(true);
    }

    const filtered = defis.filter((d) =>
        !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!formData.name || !formData.slug) {
            toast.error("Nom et slug requis");
            return;
        }
        const result = editing ? await updateDefi(editing, formData as any) : await createDefi(formData as any);
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
    formData: typeof EMPTY_FORM;
    setFormData: (v: typeof EMPTY_FORM) => void;
    onSubmit: (e: FormEvent) => void;
}) {
    const { loading, filtered, searchQuery, setSearchQuery, onNew, onEdit, onDelete } = props;
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
                                    value={props.formData.name}
                                    onChange={(e) => props.setFormData({ ...props.formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: Défi du Xélor fou"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Slug <span className="text-danger text-lg">*</span></label>
                                <Input
                                    value={props.formData.slug}
                                    onChange={(e) => props.setFormData({ ...props.formData, slug: e.target.value })}
                                    required
                                    placeholder="Ex: defi-du-xelor-fou"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Zone</label>
                                <Input
                                    value={props.formData.zone}
                                    onChange={(e) => props.setFormData({ ...props.formData, zone: e.target.value })}
                                    placeholder="Ex: Amakna"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau</label>
                                <Input
                                    type="number"
                                    value={props.formData.level ?? ""}
                                    onChange={(e) => props.setFormData({ ...props.formData, level: e.target.value ? Number(e.target.value) : null })}
                                    placeholder="200"
                                />
                            </div>
                        </div>

                        {/* Boss (un ou plusieurs) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Boss du défi <span className="text-muted-foreground normal-case font-medium">(un ou plusieurs)</span></label>
                                <Button type="button" variant="outline" size="sm" onClick={() => props.setFormData({ ...props.formData, bosses: [...props.formData.bosses, { name: "" }] })}>
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Ajouter un boss
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {props.formData.bosses.map((b, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input
                                            value={b.name}
                                            onChange={(e) => {
                                                const bosses = [...props.formData.bosses];
                                                bosses[i] = { ...bosses[i], name: e.target.value };
                                                props.setFormData({ ...props.formData, bosses });
                                            }}
                                            placeholder={`Boss ${i + 1}`}
                                            className="flex-[2]"
                                        />
                                        <Input
                                            value={b.imageUrl || ""}
                                            onChange={(e) => {
                                                const bosses = [...props.formData.bosses];
                                                bosses[i] = { ...bosses[i], imageUrl: e.target.value };
                                                props.setFormData({ ...props.formData, bosses });
                                            }}
                                            placeholder="URL image (optionnel)"
                                            className="flex-[3]"
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => props.setFormData({ ...props.formData, bosses: props.formData.bosses.filter((_, x) => x !== i) })}>
                                            ×
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien Dofensive</label>
                                <Input value={props.formData.dofensiveUrl} onChange={(e) => props.setFormData({ ...props.formData, dofensiveUrl: e.target.value })} placeholder="https://dofensive.com/fr/..." />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Lien DofusPourLesNoobs</label>
                                <Input value={props.formData.dofuspourlesnoobsUrl} onChange={(e) => props.setFormData({ ...props.formData, dofuspourlesnoobsUrl: e.target.value })} placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description</label>
                            <textarea
                                value={props.formData.description}
                                onChange={(e) => props.setFormData({ ...props.formData, description: e.target.value })}
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
                                imageUrl={props.formData.imageUrl}
                                identifier={props.formData.name}
                                onImageDownloaded={(path) => props.setFormData({ ...props.formData, imageUrl: path })}
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
