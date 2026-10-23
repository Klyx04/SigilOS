"use client";

import { useState, useEffect, useMemo } from "react";
import { 
    Sparkles, 
    Plus, 
    Trash2, 
    ExternalLink, 
    Eye, 
    LayoutGrid, 
    Info, 
    Loader2, 
    Copy, 
    RefreshCw, 
    HelpCircle, 
    Search, 
    Pencil,
    Mars,
    Venus,
    ArrowUpRight
} from "lucide-react";
import { ClassFilter, GenderFilter } from "@/components/gallery/gallery-filters";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import NextImage from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addUserSkin, deleteUserSkin, getSkinPreview, type SkinData, updateUserSkin } from "@/server/actions/skin-actions";
import { shareGalleryItemOnDiscord } from "@/server/actions/gallery-actions";

interface SkinEquipment {
    name: string;
    type?: string;
    icon?: string;
}

interface SkinMetadata {
    class?: string;
    gender?: string;
    author?: string;
    head?: string;
}

interface Skin {
    id: string;
    name: string;
    url: string;
    provider: string;
    thumbnailUrl: string | null;
    equipment?: SkinEquipment[];
    colors?: Record<string, string>;
    metadata?: SkinMetadata;
    createdAt: Date | string;
}

interface SkinLibraryProps {
    initialSkins: Skin[];
    guildId: string;
    readOnly?: boolean;
    profileId: string;
}

export function SkinLibrary({ initialSkins, guildId, readOnly = false, profileId }: SkinLibraryProps) {
    const [skins, setSkins] = useState<Skin[]>(initialSkins);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSkinUrl, setNewSkinUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSkin, setSelectedSkin] = useState<Skin | null>(null);
    const [previewData, setPreviewData] = useState<SkinData | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [skinToEdit, setSkinToEdit] = useState<Skin | null>(null);
    const [editedName, setEditedName] = useState("");
    const [editedUrl, setEditedUrl] = useState("");

    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClass, setSelectedClass] = useState<string | number | null>(null);
    const [selectedGender, setSelectedGender] = useState<string | null>(null);

    // Client-side filtering logic
    const filteredSkins = useMemo(() => {
        const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

        return skins.filter(skin => {
            // 1. Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = skin.name.toLowerCase().includes(q);
                const matchesAuthor = skin.metadata?.author?.toLowerCase().includes(q);
                if (!matchesTitle && !matchesAuthor) return false;
            }

            // 2. Class filter
            if (selectedClass) {
                const skinClass = skin.metadata?.class;
                if (!skinClass) return false;
                
                const targetClass = DOFUS_CLASSES.find((c) => {
                    const match = c.icon.match(/classes\/(\d+)\.png/);
                    return match && match[1] === String(selectedClass);
                });
                if (!targetClass) return false;
                
                const matchesId = String(skinClass) === String(selectedClass);
                const matchesName = normalize(skinClass).includes(normalize(targetClass.name));
                
                if (!matchesId && !matchesName) return false;
            }

            // 3. Gender filter
            if (selectedGender) {
                const skinGender = skin.metadata?.gender;
                if (!skinGender) return false;
                
                const mValues = ["M", "Homme", "♂", "Mâle", "Male"];
                const fValues = ["F", "Femme", "♀", "Femelle"];
                const valuesToMatch = selectedGender === "M" ? mValues : fValues;
                
                const normalizedSearch = valuesToMatch.map(v => normalize(v));
                if (!normalizedSearch.includes(normalize(skinGender))) return false;
            }

            return true;
        });
    }, [skins, searchQuery, selectedClass, selectedGender]);

    // Live Preview Effect
    useEffect(() => {
        if (!newSkinUrl.trim() || newSkinUrl.length < 15) {
            setPreviewData(null);
            return;
        }

        const timer = setTimeout(async () => {
            const SUPPORTED_SKIN_HOSTS = ["barbofus.com", "dofusskinmanga.com"];
            const isSupported = (() => {
                try {
                    const hostname = new URL(newSkinUrl.trim()).hostname.toLowerCase();
                    return SUPPORTED_SKIN_HOSTS.some(
                        (h) => hostname === h || hostname.endsWith(`.${h}`)
                    );
                } catch {
                    return false;
                }
            })();
            
            if (!isSupported) return;

            setIsPreviewLoading(true);
            try {
                const res = await getSkinPreview(newSkinUrl.trim());
                if (res.success && res.data) {
                    setPreviewData(res.data);
                }
            } finally {
                setIsPreviewLoading(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [newSkinUrl]);

    const handleAddSkin = async () => {
        if (!newSkinUrl.trim()) {
            toast.error("Veuillez entrer une URL");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await addUserSkin({ guildId, url: newSkinUrl.trim() });
            if (res.success && res.data) {
                toast.success("Skin ajouté à votre bibliothèque !");
                setIsAddOpen(false);
                setNewSkinUrl("");
                setSkins(prev => [res.data, ...prev]);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch {
            toast.error("Erreur serveur lors de l'ajout du skin");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("Lien copié dans le presse-papiers");
    };

    const handleRefreshMetadata = async (skinId: string, url: string) => {
        setIsSubmitting(true);
        toast.info("Actualisation des données du skin...");
        try {
            const res = await addUserSkin({ guildId, url: url.trim(), existingSkinId: skinId });
            if (res.success && res.data) {
                setSkins(prev => prev.map(s => s.id === skinId ? res.data : s));
                toast.success("Données actualisées !");
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        } catch {
            toast.error("Erreur serveur lors de la synchronisation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [skinToDelete, setSkinToDelete] = useState<string | null>(null);

    const handleDeleteSkin = async () => {
        if (readOnly || !skinToDelete) return;
        
        setIsSubmitting(true);
        try {
            const res = await deleteUserSkin(guildId, skinToDelete);
            if (res.success) {
                setSkins(prev => prev.filter(s => s.id !== skinToDelete));
                toast.success("Skin supprimé avec succès");
                setIsDeleteOpen(false);
                setSkinToDelete(null);
            } else {
                toast.error(res.error || "Erreur lors de la suppression");
            }
        } catch {
            toast.error("Erreur serveur lors de la suppression");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateSkin = async () => {
        if (!skinToEdit || !editedName.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await updateUserSkin(guildId, skinToEdit.id, { 
                name: editedName.trim(),
                url: editedUrl.trim() 
            });
            if (res.success && res.data) {
                setSkins(prev => prev.map(s => s.id === skinToEdit.id ? res.data : s));
                toast.success("Skin mis à jour avec succès !");
                setIsEditOpen(false);
                setSkinToEdit(null);
            } else {
                toast.error(res.error || "Erreur lors de la modification");
            }
        } catch {
            toast.error("Erreur serveur lors de la modification");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/40 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-border">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-foreground">Garde-Robe & Skins</h3>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 px-2.5 rounded-lg border-border text-xs text-muted-foreground hover:text-foreground hover:bg-surface gap-1.5 font-medium transition-colors"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        Guide
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-background/95 backdrop-blur-xl border-border p-4 rounded-xl shadow-xl space-y-4">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                            <Sparkles className="w-3.5 h-3.5 text-accent" />
                                            Comment importer un skin ?
                                        </h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Composez votre apparat sur l&apos;un des sites partenaires et importez-le ici en collant simplement son URL.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sites compatibles</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <a 
                                                href="https://barbofus.com" 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-2.5 bg-surface/60 hover:bg-surface border border-border rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src="https://www.google.com/s2/favicons?domain=barbofus.com&sz=64" alt="Barbofus" className="w-4 h-4 object-contain rounded" />
                                                    <span className="text-xs font-semibold text-foreground">Barbofus</span>
                                                </div>
                                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                            </a>
                                            <a 
                                                href="https://dofusskinmanga.com" 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-2.5 bg-surface/60 hover:bg-surface border border-border rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src="https://www.google.com/s2/favicons?domain=dofusskinmanga.com&sz=64" alt="SkinManga" className="w-4 h-4 object-contain rounded" />
                                                    <span className="text-xs font-semibold text-foreground">SkinManga</span>
                                                </div>
                                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                            </a>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border space-y-1.5 text-xs text-muted-foreground">
                                        <p className="font-medium text-foreground">Étapes rapides :</p>
                                        <ol className="list-decimal list-inside space-y-1 pl-1">
                                            <li>Créez votre look sur le site partenaire.</li>
                                            <li>Copiez l&apos;URL de la page.</li>
                                            <li>Cliquez sur « Importer un Skin » et collez le lien.</li>
                                        </ol>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Gérez et partagez vos compositions d&apos;apparat avec la guilde.
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                className="rounded-xl gap-2 font-medium bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80 shadow-xs h-10 px-4 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Importer un Skin
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background border-border text-foreground sm:max-w-md rounded-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold">Importer un nouveau skin</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Collez l&apos;URL d&apos;un apparat Barbofus ou DofusSkinManga pour l&apos;ajouter à votre profil.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="skin-url" className="text-xs font-semibold">URL du Skin</Label>
                                    <Input
                                        id="skin-url"
                                        placeholder="https://barbofus.com/skinator/view/..."
                                        value={newSkinUrl}
                                        onChange={(e) => setNewSkinUrl(e.target.value)}
                                        className="bg-surface border-border text-xs h-10 rounded-xl focus:border-accent/50"
                                    />
                                </div>

                                {/* Preview Area */}
                                {(isPreviewLoading || previewData) && (
                                    <div className="bg-surface/50 border border-border rounded-xl p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-14 h-14 bg-black/40 rounded-lg relative flex items-center justify-center border border-border overflow-hidden shrink-0">
                                                {isPreviewLoading ? (
                                                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                                                ) : previewData?.thumbnailUrl ? (
                                                    <NextImage 
                                                        src={previewData.thumbnailUrl} 
                                                        alt="Preview" 
                                                        fill 
                                                        className="object-contain p-1" 
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {isPreviewLoading ? (
                                                    <div className="space-y-1.5">
                                                        <div className="h-3.5 bg-elevated rounded animate-pulse w-3/4" />
                                                        <div className="h-3 bg-elevated rounded animate-pulse w-1/2" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-xs font-bold text-foreground truncate">{previewData?.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                                                                {previewData?.provider}
                                                                {(previewData?.equipment?.length > 0 || Object.keys(previewData?.colors || {}).length > 0) && " · Détails détectés"}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-surface/40 border border-border rounded-xl p-3 flex gap-2.5 items-start">
                                    <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        SigilOS extrait automatiquement la miniature, les couleurs et les équipements associés.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setIsAddOpen(false)} 
                                    disabled={isSubmitting}
                                    className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    onClick={handleAddSkin} 
                                    disabled={isSubmitting || !newSkinUrl.trim()}
                                    className="rounded-xl text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> 
                                            Importation...
                                        </>
                                    ) : "Importer"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface/30 p-3 rounded-xl border border-border">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filtrer par nom, créateur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-surface/80 border-border pl-9 h-9 rounded-lg text-xs"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ClassFilter selectedClass={selectedClass} onSelectClass={(id) => setSelectedClass(id)} />
                    <GenderFilter selectedGender={selectedGender} onSelectGender={setSelectedGender} />
                    
                    {(searchQuery || selectedClass || selectedGender) && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setSearchQuery(""); setSelectedClass(null); setSelectedGender(null); }}
                            className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground text-xs gap-1.5"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Réinitialiser
                        </Button>
                    )}

                    <div className="hidden sm:block text-xs text-muted-foreground font-medium pl-2 border-l border-border">
                        <span className="font-bold text-foreground">{filteredSkins.length}</span> skin{filteredSkins.length > 1 ? "s" : ""}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {skins.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 sm:p-16 bg-surface/20 rounded-2xl border border-dashed border-border text-center">
                    <div className="p-4 bg-surface/60 rounded-2xl border border-border mb-3.5 text-muted-foreground">
                        <LayoutGrid className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground mb-1">Votre garde-robe est vide</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                        Créez vos compositions sur nos sites partenaires et importez-les ici pour les présenter à vos compagnons de guilde.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <a 
                            href="https://barbofus.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-surface hover:bg-surface/80 rounded-xl border border-border text-xs font-semibold text-foreground transition-all flex items-center gap-2"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://www.google.com/s2/favicons?domain=barbofus.com&sz=64" alt="Barbofus" className="w-4 h-4 object-contain" />
                            Créer sur Barbofus
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                        <a 
                            href="https://dofusskinmanga.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-surface hover:bg-surface/80 rounded-xl border border-border text-xs font-semibold text-foreground transition-all flex items-center gap-2"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://www.google.com/s2/favicons?domain=dofusskinmanga.com&sz=64" alt="SkinManga" className="w-4 h-4 object-contain" />
                            Créer sur SkinManga
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                    </div>
                </div>
            )}

            {/* Skins Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSkins.map((skin) => (
                    <div 
                        key={skin.id}
                        className="group relative bg-surface/40 hover:bg-surface/70 rounded-2xl border border-border hover:border-accent/40 overflow-hidden transition-all duration-300 shadow-xs flex flex-col"
                    >
                        {/* Thumbnail Container */}
                        <div className="aspect-[4/5] relative bg-black/30 flex items-center justify-center overflow-hidden">
                            {skin.thumbnailUrl ? (
                                <NextImage 
                                    src={skin.thumbnailUrl} 
                                    alt={skin.name}
                                    fill
                                    className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex items-center justify-center text-muted-foreground">
                                    <Sparkles className="w-10 h-10 opacity-40" />
                                </div>
                            )}

                            {/* Class & Gender Badge */}
                            <div className="absolute top-3 left-3 z-10">
                                {(() => {
                                    const skinClass = skin.metadata?.class;
                                    const skinGender = skin.metadata?.gender;
                                    const classData = DOFUS_CLASSES.find(c => {
                                        const match = c.icon.match(/classes\/(\d+)\.png/);
                                        return (match && match[1] === String(skinClass)) || c.name === skinClass;
                                    });
                                    
                                    if (!classData && !skinGender) return null;
                                    const isMale = !skinGender || ["M", "Homme", "♂", "Mâle", "Male"].includes(skinGender);

                                    return (
                                        <div className="flex items-center gap-2 bg-background/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-border shadow-xs">
                                            {classData && (
                                                <div className="w-4 h-4 relative shrink-0">
                                                    <NextImage src={classData.icon} alt={classData.name} fill sizes="16px" className="object-contain" />
                                                </div>
                                            )}
                                            <span className="text-[11px] font-semibold text-foreground truncate max-w-[80px]">
                                                {classData?.name || "???"}
                                            </span>
                                            {skinGender && (
                                                <div className={cn(
                                                    "w-3.5 h-3.5 rounded flex items-center justify-center shrink-0",
                                                    isMale ? "text-info" : "text-danger"
                                                )}>
                                                    {isMale ? <Mars className="w-3 h-3" /> : <Venus className="w-3 h-3" />}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Discord Share Button */}
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const res = await shareGalleryItemOnDiscord(guildId, skin.id, "SKIN", profileId);
                                    if (res.success) toast.success("Partagé sur Discord !");
                                    else toast.error(res.error || "Erreur lors du partage");
                                }}
                                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-[#5865F2]/15 hover:bg-[#5865F2]/25 border border-[#5865F2]/30 text-[#5865F2] flex items-center justify-center transition-colors shadow-xs"
                                title="Partager sur Discord"
                            >
                                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                </svg>
                            </button>

                            {/* Quick View Button on Hover */}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setSelectedSkin(skin)}
                                    className="bg-background/90 hover:bg-background text-foreground border border-border rounded-xl px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-1.5"
                                >
                                    <Eye className="w-4 h-4 text-accent" />
                                    Voir les détails
                                </Button>
                            </div>
                        </div>

                        {/* Card Footer Info & Actions */}
                        <div className="p-3.5 flex flex-col gap-2.5 bg-surface/20 border-t border-border">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-foreground truncate" title={skin.name}>
                                    {skin.name}
                                </p>
                                <a 
                                    href={skin.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                    title={`Voir sur ${skin.provider === 'BARBOFUS' ? 'Barbofus' : skin.provider === 'DOFUSSKINMANGA' ? 'SkinManga' : 'Source'}`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={`https://www.google.com/s2/favicons?domain=${skin.provider === 'BARBOFUS' ? 'barbofus.com' : skin.provider === 'DOFUSSKINMANGA' ? 'dofusskinmanga.com' : 'google.com'}&sz=32`}
                                        alt="" 
                                        className="w-3.5 h-3.5 object-contain rounded opacity-70 hover:opacity-100 transition-opacity"
                                    />
                                </a>
                            </div>

                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/60">
                                <div className="flex items-center gap-1">
                                    <Button 
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCopyLink(skin.url)}
                                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
                                        title="Copier le lien"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button 
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRefreshMetadata(skin.id, skin.url)}
                                        disabled={isSubmitting}
                                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
                                        title="Synchroniser les détails"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", isSubmitting && "animate-spin")} />
                                    </Button>
                                </div>

                                {!readOnly && (
                                    <div className="flex items-center gap-1">
                                        <Button 
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setSkinToEdit(skin);
                                                setEditedName(skin.name);
                                                setEditedUrl(skin.url);
                                                setIsEditOpen(true);
                                            }}
                                            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
                                            title="Renommer"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => {
                                                setSkinToDelete(skin.id);
                                                setIsDeleteOpen(true);
                                            }}
                                            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* View Modal */}
            <Dialog open={!!selectedSkin} onOpenChange={(open) => !open && setSelectedSkin(null)}>
                <DialogContent className="bg-background/95 backdrop-blur-2xl border-border text-foreground sm:max-w-xl w-[95vw] max-h-[90vh] p-0 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <DialogTitle className="sr-only">Détails du Skin</DialogTitle>
                    <DialogDescription className="sr-only">Aperçu et métadonnées du skin sélectionné.</DialogDescription>
                    {selectedSkin && (
                        <div className="flex flex-col h-full max-h-[90vh]">
                            {/* Visual Header */}
                            <div className="relative aspect-video bg-black/40 flex items-center justify-center shrink-0 border-b border-border">
                                {selectedSkin.thumbnailUrl ? (
                                    <NextImage 
                                        src={selectedSkin.thumbnailUrl} 
                                        alt={selectedSkin.name}
                                        fill
                                        className="object-contain p-6"
                                        unoptimized
                                    />
                                ) : (
                                    <Sparkles className="w-12 h-12 text-muted-foreground opacity-40" />
                                )}
                                
                                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                                    <div className="bg-background/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-border w-fit">
                                        <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                                            {selectedSkin.provider}
                                        </span>
                                    </div>
                                    {selectedSkin.metadata?.author && (
                                        <div className="bg-background/80 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-border w-fit">
                                            <span className="text-[10px] text-muted-foreground">
                                                Auteur : <span className="font-semibold text-foreground">{selectedSkin.metadata.author}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">
                                        {selectedSkin.name}
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {selectedSkin.metadata?.class && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-medium">
                                                <span>
                                                    {(() => {
                                                        const mClass = selectedSkin.metadata?.class;
                                                        const classData = DOFUS_CLASSES.find(c => {
                                                            const match = c.icon.match(/\/(\d+)\.png$/);
                                                            return match && match[1] === String(mClass);
                                                        });
                                                        return classData ? classData.name : mClass;
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                        {selectedSkin.metadata?.gender && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-muted-foreground">
                                                <span>{selectedSkin.metadata.gender}</span>
                                            </div>
                                        )}
                                        {selectedSkin.metadata?.head && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-muted-foreground">
                                                <span>Visage #{selectedSkin.metadata.head.replace(/^https?:\/\/.*\/(\d+)\.png$/, "$1")}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Colors Section */}
                                {selectedSkin.colors && Object.keys(selectedSkin.colors).length > 0 && (
                                    <div className="space-y-2.5">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Palette de couleurs
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(selectedSkin.colors).map(([label, hex]) => (
                                                <button 
                                                    key={label} 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(hex as string);
                                                        toast.success(`Couleur ${label} (${hex}) copiée !`);
                                                    }}
                                                    className="bg-surface/60 border border-border rounded-xl p-2.5 flex items-center justify-between gap-2 hover:bg-surface hover:border-accent/40 transition-all text-left group cursor-pointer"
                                                    title="Copier le code couleur"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div 
                                                            className="w-6 h-6 rounded-lg border border-border shrink-0 shadow-xs"
                                                            style={{ backgroundColor: hex as string }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-medium text-muted-foreground truncate">{label}</p>
                                                            <p className="text-xs font-mono font-bold text-foreground">{hex as string}</p>
                                                        </div>
                                                    </div>
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Equipment Section */}
                                {selectedSkin.equipment && Array.isArray(selectedSkin.equipment) && selectedSkin.equipment.length > 0 && (
                                    <div className="space-y-2.5">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Équipements du look
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {selectedSkin.equipment.map((item, idx: number) => (
                                                <div key={idx} className="bg-surface/50 border border-border rounded-xl p-2.5 flex items-center gap-2.5">
                                                    <div className="w-8 h-8 bg-black/40 rounded-lg flex items-center justify-center p-1 border border-border shrink-0">
                                                        {item.icon ? (
                                                            <NextImage src={item.icon} alt={item.name} width={28} height={28} unoptimized />
                                                        ) : (
                                                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.type}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 bg-surface/80 backdrop-blur-md border-t border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Button 
                                        asChild
                                        variant="outline" 
                                        size="sm"
                                        className="rounded-xl border-border text-xs gap-1.5"
                                    >
                                        <a href={selectedSkin.url} target="_blank" rel="noopener noreferrer">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img 
                                                src={`https://www.google.com/s2/favicons?domain=${selectedSkin.provider === 'BARBOFUS' ? 'barbofus.com' : selectedSkin.provider === 'DOFUSSKINMANGA' ? 'dofusskinmanga.com' : 'google.com'}&sz=32`}
                                                alt="" 
                                                className="w-3.5 h-3.5 object-contain rounded"
                                            />
                                            Voir sur le site
                                        </a>
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="rounded-xl border-border text-xs gap-1.5"
                                        onClick={() => handleCopyLink(selectedSkin.url)}
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        Copier lien
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="rounded-xl border-[#5865F2]/40 bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/20 text-xs gap-1.5"
                                        onClick={async () => {
                                            const res = await shareGalleryItemOnDiscord(guildId, selectedSkin.id, "SKIN", profileId);
                                            if (res.success) toast.success("Partagé sur Discord !");
                                            else toast.error(res.error || "Erreur lors du partage");
                                        }}
                                    >
                                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                        </svg>
                                        Discord
                                    </Button>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => setSelectedSkin(null)}
                                >
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="bg-background border-border text-foreground sm:max-w-md p-6 rounded-2xl">
                    <DialogHeader>
                        <div className="w-10 h-10 bg-danger/10 text-danger rounded-xl flex items-center justify-center border border-danger/20 mb-2">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-base font-bold">Supprimer ce skin ?</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Êtes-vous sûr de vouloir retirer ce skin de votre bibliothèque ? Cette action est irréversible.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsDeleteOpen(false)}
                            className="rounded-xl text-xs text-muted-foreground"
                        >
                            Annuler
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleDeleteSkin}
                            disabled={isSubmitting}
                            className="rounded-xl text-xs font-semibold"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Name Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="bg-background border-border text-foreground sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">Modifier votre skin</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Mettez à jour le titre ou le lien source de votre apparat.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-name" className="text-xs font-semibold">Nom du Look</Label>
                            <Input
                                id="edit-name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="bg-surface border-border text-xs h-10 rounded-xl focus:border-accent/50"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-url" className="text-xs font-semibold">Lien du Skin (Barbofus / Manga)</Label>
                            <Input
                                id="edit-url"
                                value={editedUrl}
                                onChange={(e) => setEditedUrl(e.target.value)}
                                className="bg-surface border-border text-xs h-10 rounded-xl focus:border-accent/50"
                                placeholder="https://..."
                            />
                            {editedUrl !== skinToEdit?.url && (
                                <p className="text-[11px] text-muted-foreground italic">
                                    Note : Changer le lien actualisera la miniature et les détails.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsEditOpen(false)}
                            disabled={isSubmitting}
                            className="rounded-xl text-xs text-muted-foreground"
                        >
                            Annuler
                        </Button>
                        <Button 
                            onClick={handleUpdateSkin}
                            disabled={isSubmitting || !editedName.trim() || !editedUrl.trim() || (editedName === skinToEdit?.name && editedUrl === skinToEdit?.url)}
                            className="rounded-xl text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80"
                        >
                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
