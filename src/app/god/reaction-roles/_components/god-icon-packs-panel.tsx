"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import {
    Plus,
    Package,
    Trash2,
    Edit3,
    Sparkles,
    UploadCloud,
    X,
    Loader2,
    Zap,
    Tag,
    Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    saveGodIconPackAction,
    deleteGodIconPackAction,
    uploadIconPackImagesAction
} from "@/server/actions/reaction-role-actions";

type IconItem = {
    name: string;
    emoji?: string;
    url?: string;
};

const PRESET_PACKS = [
    {
        name: "19 Classes Dofus 3.0",
        category: "classes",
        icons: [
            { name: "Iop", emoji: "⚔️", url: "/module-dofus/classes/iop.png" },
            { name: "Cra", emoji: "🏹", url: "/module-dofus/classes/cra.png" },
            { name: "Eniripsa", emoji: "💉", url: "/module-dofus/classes/eniripsa.png" },
            { name: "Feca", emoji: "🛡️", url: "/module-dofus/classes/feca.png" },
            { name: "Sacrieur", emoji: "🩸", url: "/module-dofus/classes/sacrieur.png" },
            { name: "Sadida", emoji: "🌿", url: "/module-dofus/classes/sadida.png" },
            { name: "Osamodas", emoji: "🐉", url: "/module-dofus/classes/osamodas.png" },
            { name: "Enutrof", emoji: "⛏️", url: "/module-dofus/classes/enutrof.png" },
            { name: "Sram", emoji: "💀", url: "/module-dofus/classes/sram.png" },
            { name: "Xelor", emoji: "⏳", url: "/module-dofus/classes/xelor.png" },
            { name: "Pandawa", emoji: "🍺", url: "/module-dofus/classes/pandawa.png" },
            { name: "Roublard", emoji: "💣", url: "/module-dofus/classes/roublard.png" },
            { name: "Zobal", emoji: "🎭", url: "/module-dofus/classes/zobal.png" },
            { name: "Steamer", emoji: "⚓", url: "/module-dofus/classes/steamer.png" },
            { name: "Eliotrope", emoji: "🌀", url: "/module-dofus/classes/eliotrope.png" },
            { name: "Huppermage", emoji: "✨", url: "/module-dofus/classes/huppermage.png" },
            { name: "Ouginak", emoji: "🐺", url: "/module-dofus/classes/ouginak.png" },
            { name: "Forgelance", emoji: "🔱", url: "/module-dofus/classes/forgelance.png" },
        ]
    },
    {
        name: "Métiers Dofus",
        category: "metiers",
        icons: [
            { name: "Alchimiste", emoji: "🧪" },
            { name: "Paysan", emoji: "🌾" },
            { name: "Boulanger", emoji: "🥖" },
            { name: "Mineur", emoji: "⛏️" },
            { name: "Bûcheron", emoji: "🪓" },
            { name: "Pêcheur", emoji: "🎣" },
            { name: "Chasseur", emoji: "🥩" },
            { name: "Tailleur", emoji: "🧵" },
            { name: "Bijoutier", emoji: "💍" },
            { name: "Cordonnier", emoji: "👞" },
            { name: "Forgeron", emoji: "🔨" },
            { name: "Sculpteur", emoji: "🪵" },
            { name: "Façonneur", emoji: "🛡️" },
            { name: "Bricoleur", emoji: "⚙️" },
        ]
    },
    {
        name: "Éléments & Rôles Combat",
        category: "elements",
        icons: [
            { name: "Feu", emoji: "🔥" },
            { name: "Eau", emoji: "💧" },
            { name: "Terre", emoji: "🪨" },
            { name: "Air", emoji: "🌪️" },
            { name: "Multi-Éléments", emoji: "🌈" },
            { name: "Tank / Tacle", emoji: "🛡️" },
            { name: "Soigneur / Support", emoji: "💚" },
            { name: "DPS / Dégâts", emoji: "💥" },
            { name: "Entrave / Retrait", emoji: "⛓️" },
            { name: "Placement", emoji: "🎯" },
        ]
    }
];

export function GodIconPacksPanel({ initialPacks }: { initialPacks: any[] }) {
    const [packs, setPacks] = useState<any[]>(initialPacks);
    const [isOpen, setIsOpen] = useState(false);
    const [editingPack, setEditingPack] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    const [formName, setFormName] = useState("");
    const [formCategory, setFormCategory] = useState("dofus");
    const [formIsGodOnly, setFormIsGodOnly] = useState(false);
    const [formGuildId, setFormGuildId] = useState("");
    const [iconsList, setIconsList] = useState<IconItem[]>([]);

    // Quick single icon form
    const [singleName, setSingleName] = useState("");
    const [singleEmoji, setSingleEmoji] = useState("");

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openCreate = () => {
        setEditingPack(null);
        setFormName("Pack Personnalisé");
        setFormCategory("general");
        setFormIsGodOnly(false);
        setFormGuildId("");
        setIconsList([]);
        setIsOpen(true);
    };

    const openEdit = (pack: any) => {
        setEditingPack(pack);
        setFormName(pack.name);
        setFormCategory(pack.category);
        setFormIsGodOnly(pack.isGodOnly);
        setFormGuildId(pack.guildId || "");
        setIconsList(Array.isArray(pack.icons) ? pack.icons : []);
        setIsOpen(true);
    };

    const loadPreset = (preset: typeof PRESET_PACKS[0]) => {
        setFormName(preset.name);
        setFormCategory(preset.category);
        setIconsList(preset.icons);
        toast.success(`Pack « ${preset.name} » chargé (${preset.icons.length} icônes)`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(files).forEach(file => formData.append("files", file));

        try {
            const res = await uploadIconPackImagesAction(formData);
            if (res.success && res.data) {
                setIconsList(prev => [...prev, ...res.data!]);
                toast.success(`${res.data.length} image(s) importée(s) avec succès !`);
            } else {
                toast.error(res.error || "Erreur lors du téléchargement des images");
            }
        } catch (err: any) {
            toast.error("Erreur d'import : " + err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const addSingleEmojiIcon = () => {
        if (!singleName.trim()) {
            toast.error("Veuillez indiquer un nom d'icône");
            return;
        }
        setIconsList(prev => [...prev, { name: singleName.trim(), emoji: singleEmoji.trim() || "⭐" }]);
        setSingleName("");
        setSingleEmoji("");
    };

    const removeIcon = (idx: number) => {
        setIconsList(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (!formName.trim()) {
            toast.error("Le nom du pack est requis");
            return;
        }

        if (iconsList.length === 0) {
            toast.error("Veuillez ajouter au moins une icône dans ce pack");
            return;
        }

        startTransition(async () => {
            const res = await saveGodIconPackAction({
                id: editingPack?.id,
                name: formName,
                category: formCategory,
                icons: iconsList,
                isGodOnly: formIsGodOnly,
                guildId: formGuildId || null,
            });

            if (res.success && res.data) {
                toast.success(editingPack ? "Pack mis à jour !" : "Pack créé avec succès !");
                setIsOpen(false);
                if (editingPack) {
                    setPacks(prev => prev.map(p => p.id === editingPack.id ? res.data : p));
                } else {
                    setPacks(prev => [res.data, ...prev]);
                }
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement");
            }
        });
    };

    const handleDelete = (packId: string) => {
        if (!confirm("Voulez-vous supprimer ce pack ?")) return;
        startTransition(async () => {
            const res = await deleteGodIconPackAction(packId);
            if (res.success) {
                toast.success("Pack supprimé");
                setPacks(prev => prev.filter(p => p.id !== packId));
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-surface/50 border border-border rounded-2xl gap-4">
                <div>
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        <Package className="w-5 h-5 text-warning" />
                        Packs d'Icônes Globaux ({packs.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Ces packs sont mis à disposition des administrateurs de toutes les guildes dans leur éditeur de rôles par réaction.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2 bg-warning hover:bg-warning/90 text-warning-foreground font-bold shrink-0">
                    <Plus className="w-4 h-4" />
                    Créer un Pack d'Icônes
                </Button>
            </div>

            {/* List of registered packs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packs.map((pack) => (
                    <div key={pack.id} className="bg-surface/40 border border-border rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-warning/40 transition-colors">
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-warning" />
                                        {pack.name}
                                    </h4>
                                    <span className="text-caption text-muted-foreground font-medium">
                                        Catégorie : <span className="text-foreground">{pack.category}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(pack)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                        <Edit3 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pack.id)} className="h-8 w-8 text-muted-foreground hover:text-danger">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Visual Icons Preview */}
                            <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-xl border border-border/50 max-h-28 overflow-y-auto">
                                {(pack.icons as IconItem[])?.map((icon, i) => (
                                    <div
                                        key={i}
                                        title={icon.name}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border text-caption font-medium"
                                    >
                                        {icon.url ? (
                                            <div className="relative w-4 h-4 rounded overflow-hidden">
                                                <Image src={icon.url} alt={icon.name} fill className="object-contain" />
                                            </div>
                                        ) : (
                                            <span>{icon.emoji}</span>
                                        )}
                                        <span className="truncate max-w-[80px]">{icon.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between text-caption text-muted-foreground">
                            <span>{(pack.icons as any[])?.length || 0} icônes disponibles</span>
                            {pack.isGodOnly ? (
                                <Badge variant="outline" className="text-[10px] bg-danger/10 text-danger border-danger/30">GOD Only</Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Public (Toutes Guildes)</Badge>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Visual Create / Edit Modal (0 Code, 100% Visual Drag & Drop) */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl bg-background border-border max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-warning" />
                            {editingPack ? "Modifier le Pack d'Icônes" : "Nouveau Pack d'Icônes"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2 text-xs">
                        {/* Quick Presets (1-click generation) */}
                        <div className="p-3.5 bg-surface/60 border border-border rounded-xl space-y-2">
                            <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                                <Zap className="w-3.5 h-3.5 text-warning" />
                                Modèles Rapides Pré-configurés (1-Clic)
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_PACKS.map((preset, idx) => (
                                    <Button
                                        key={idx}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadPreset(preset)}
                                        className="h-7 text-caption gap-1.5 bg-surface hover:bg-elevated border-border"
                                    >
                                        <Sparkles className="w-3 h-3 text-warning" />
                                        {preset.name}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* General Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Nom du Pack</Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Classes Dofus 3.0"
                                    className="h-9 text-xs bg-surface border-border"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Catégorie</Label>
                                <Input
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value)}
                                    placeholder="Ex: classes, métiers, pings"
                                    className="h-9 text-xs bg-surface border-border"
                                />
                            </div>
                        </div>

                        {/* Drag & Drop Visual Upload Zone */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <UploadCloud className="w-4 h-4 text-indigo-400" />
                                    Importer des Images / Icônes (Fichiers PNG, JPG, WebP, SVG)
                                </span>
                                <span className="text-caption text-muted-foreground">Sélection multiple supportée</span>
                            </Label>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-border hover:border-warning/60 bg-surface/30 hover:bg-surface/50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-8 h-8 text-warning animate-spin" />
                                        <p className="text-xs font-semibold text-foreground">Importation et optimisation des images en cours...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                                            <UploadCloud className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">
                                                Cliquez pour parcourir ou glissez vos images ici
                                            </p>
                                            <p className="text-caption text-muted-foreground mt-0.5">
                                                Le nom du fichier sera automatiquement utilisé pour nommer chaque icône.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Quick Manual Emoji Addition */}
                        <div className="p-3 bg-surface/40 border border-border rounded-xl space-y-2">
                            <Label className="text-caption font-bold text-muted-foreground">Ou ajouter une icône / emoji manuellement</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={singleName}
                                    onChange={(e) => setSingleName(e.target.value)}
                                    placeholder="Nom (ex: Soigneur)"
                                    className="h-8 text-xs bg-surface border-border flex-1"
                                />
                                <Input
                                    value={singleEmoji}
                                    onChange={(e) => setSingleEmoji(e.target.value)}
                                    placeholder="Emoji (ex: 💉)"
                                    className="h-8 text-xs bg-surface border-border w-24 text-center"
                                />
                                <Button
                                    type="button"
                                    onClick={addSingleEmojiIcon}
                                    size="sm"
                                    className="h-8 text-xs bg-surface hover:bg-elevated border border-border"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Ajouter
                                </Button>
                            </div>
                        </div>

                        {/* Visual Gallery of Current Pack Icons */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold flex items-center gap-1.5">
                                    <ImageIcon className="w-4 h-4 text-warning" />
                                    Icônes dans ce Pack ({iconsList.length})
                                </Label>
                                {iconsList.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIconsList([])}
                                        className="h-6 text-caption text-danger hover:bg-danger/10 px-2"
                                    >
                                        Tout effacer
                                    </Button>
                                )}
                            </div>

                            {iconsList.length === 0 ? (
                                <div className="p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground text-caption">
                                    Aucune icône dans ce pack. Importez des images ou chargez un modèle ci-dessus.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                                    {iconsList.map((icon, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-surface border border-border text-xs"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {icon.url ? (
                                                    <div className="relative w-6 h-6 rounded overflow-hidden shrink-0 bg-black/20">
                                                        <Image src={icon.url} alt={icon.name} fill className="object-contain" />
                                                    </div>
                                                ) : (
                                                    <span className="text-base shrink-0">{icon.emoji}</span>
                                                )}
                                                <span className="font-semibold text-foreground truncate">{icon.name}</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeIcon(idx)}
                                                className="h-6 w-6 text-muted-foreground hover:text-danger shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>Annuler</Button>
                        <Button onClick={handleSave} disabled={isPending} className="bg-warning hover:bg-warning/90 text-warning-foreground font-bold">
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Enregistrer le Pack
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
