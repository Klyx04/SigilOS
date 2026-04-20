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
    Globe, 
    Search, 
    X, 
    Megaphone, 
    Send, 
    Pencil,
    Mars,
    Venus
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

interface Skin {
    id: string;
    name: string;
    url: string;
    provider: string;
    thumbnailUrl: string | null;
    equipment?: any;
    colors?: any;
    metadata?: any;
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
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
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
                // Handle both numerical (Dofus IDs) and string class names
                const skinClass = skin.metadata?.class;
                if (!skinClass) return false;
                
                // Mapping is done by name for now as metadata.class stores names
                const targetClass = DOFUS_CLASSES.find((c: any) => {
                    const match = c.icon.match(/classes\/(\d+)\.png/);
                    return match && match[1] === selectedClass;
                });
                
                if (!targetClass) return false;
                
                const matchesId = skinClass === selectedClass;
                const matchesName = normalize(skinClass).includes(normalize(targetClass.name));
                
                if (!matchesId && !matchesName) return false;
            }

            // 3. Gender filter
            if (selectedGender) {
                const skinGender = skin.metadata?.gender; // Normalized to M/F by scraper now, but handle legacy
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
            const isSupported = newSkinUrl.includes("barbofus.com") || 
                              newSkinUrl.includes("dofusskinmanga.com");
            
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
        } catch (error) {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("Lien copié !");
    };

    const handleRefreshMetadata = async (skinId: string, url: string) => {
        setIsSubmitting(true);
        toast.info("Mise à jour des données...");
        try {
            const res = await addUserSkin({ guildId, url: url.trim(), existingSkinId: skinId });
            if (res.success && res.data) {
                setSkins(prev => prev.map(s => s.id === skinId ? res.data : s));
                toast.success("Données actualisées !");
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        } catch (error) {
            toast.error("Erreur serveur");
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
        } catch (error) {
            toast.error("Erreur serveur");
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
                // If URL changed, we use the full returned object in case metadata changed
                setSkins(prev => prev.map(s => s.id === skinToEdit.id ? res.data : s));
                toast.success("Skin mis à jour avec succès !");
                setIsEditOpen(false);
                setSkinToEdit(null);
            } else {
                toast.error(res.error || "Erreur lors de la modification");
            }
        } catch (error) {
            toast.error("Erreur serveur");
        } finally {
            setIsSubmitting(false);
        }
    };


    const getProviderIcon = (provider: string) => {
        switch (provider) {
            case "BARBOFUS": return "/assets/ui/icons/barbofus.png";
            case "DOFUSSKINMANGA": return "/assets/ui/icons/dofusskinmanga.png"; 
            default: return null;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-pink-500/10 rounded-2xl border border-pink-500/20">
                        <Sparkles className="w-6 h-6 text-pink-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-white">Ma Garde-Robe</h3>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 rounded-xl border-pink-500/30 bg-pink-500/5 text-pink-400 hover:bg-pink-500 hover:text-white transition-all gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-pink-500/10">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        Comment ça marche ?
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-zinc-950 border-white/10 p-0 rounded-[2rem] shadow-2xl overflow-hidden border-2 border-pink-500/20">
                                    <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 p-5 border-b border-white/5">
                                        <h4 className="font-black text-xs uppercase tracking-widest text-white flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-pink-400" />
                                            Guide Mode & Skins
                                        </h4>
                                    </div>
                                    <div className="p-6 space-y-8">
                                        <div className="space-y-4">
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">1. Choisir un site</p>
                                            <div className="grid grid-cols-1 gap-3">
                                                <a 
                                                    href="https://barbofus.com" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-4 bg-white/5 hover:bg-pink-500/10 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-inner overflow-hidden">
                                                            <img src="https://www.google.com/s2/favicons?domain=barbofus.com&sz=64" alt="Barbofus" className="w-6 h-6 object-contain" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white uppercase tracking-wider">Barbofus</span>
                                                            <span className="text-[9px] text-zinc-500">Le roi des skins</span>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-pink-400 transition-colors" />
                                                </a>
                                                <a 
                                                    href="https://dofusskinmanga.com" 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-4 bg-white/5 hover:bg-emerald-500/10 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner overflow-hidden">
                                                            <img src="https://www.google.com/s2/favicons?domain=dofusskinmanga.com&sz=64" alt="SkinManga" className="w-6 h-6 object-contain" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white uppercase tracking-wider">SkinManga</span>
                                                            <span className="text-[9px] text-zinc-500">Inspiration & Manga</span>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                                                </a>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">2. Méthode Express</p>
                                            <div className="space-y-5">
                                                {[
                                                    { step: 1, text: "Crée ton skin sur un site.", sub: "Personalise tout à fond !" },
                                                    { step: 2, text: "Copie l'URL de la page.", sub: "L'adresse dans ton navigateur." },
                                                    { step: 3, text: "Colle le lien sur SigilOS.", sub: "On récupère tout auto !" }
                                                ].map((s) => (
                                                    <div key={s.step} className="flex gap-4">
                                                        <div className="w-6 h-6 rounded-lg bg-pink-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20 uppercase">
                                                            {s.step}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <p className="text-[11px] text-zinc-200 font-bold leading-tight">{s.text}</p>
                                                            <p className="text-[9px] text-zinc-500 italic">{s.sub}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-4 border-t border-white/5 flex items-center justify-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest text-center">Magie SigilOS Activée</p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <p className="text-zinc-500 text-sm">Gérez et listez vos plus beaux skins communautaires.</p>
                    </div>
                </div>

                {!readOnly && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button variant="sigil" size="lg" className="rounded-2xl gap-2 shadow-lg shadow-pink-500/20">
                                <Plus className="w-5 h-5" />
                                Importer un Skin
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Ajouter un nouveau skin</DialogTitle>
                                <DialogDescription className="text-zinc-400">
                                    Collez un lien Barbofus ou DofusSkinManga.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="url">URL du Skin</Label>
                                    <Input
                                        id="url"
                                        placeholder="https://barbofus.com/skinator/view/..."
                                        value={newSkinUrl}
                                        onChange={(e) => setNewSkinUrl(e.target.value)}
                                        className="bg-zinc-900 border-white/10 focus:border-pink-500/50 transition-colors"
                                    />
                                </div>

                                {/* Preview Area */}
                                {(isPreviewLoading || previewData) && (
                                    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 animate-in fade-in zoom-in duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-black/40 rounded-xl relative flex items-center justify-center border border-white/10 overflow-hidden">
                                                {isPreviewLoading ? (
                                                    <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                                                ) : previewData?.thumbnailUrl ? (
                                                    <NextImage 
                                                        src={previewData.thumbnailUrl} 
                                                        alt="Preview" 
                                                        fill 
                                                        className="object-contain p-1" 
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <Sparkles className="w-6 h-6 text-zinc-700" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {isPreviewLoading ? (
                                                    <div className="space-y-2">
                                                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                                                        <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-bold text-white truncate">{previewData?.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-black text-pink-500 uppercase tracking-tighter">
                                                                {previewData?.provider}
                                                                {(previewData?.equipment?.length > 0 || Object.keys(previewData?.colors || {}).length > 0) && " + Détails détectés"}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-3 flex gap-3">
                                    <Info className="w-5 h-5 text-pink-400 shrink-0" />
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        Nous irons chercher automatiquement la miniature et les informations du skin pour vous.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setIsAddOpen(false)} 
                                    disabled={isSubmitting}
                                    className="rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all active:scale-95"
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    variant="sigil" 
                                    onClick={handleAddSkin} 
                                    disabled={isSubmitting}
                                    className="rounded-xl relative overflow-hidden group/btn active:scale-95 transition-all shadow-lg shadow-pink-500/20"
                                >
                                    {/* Shine Effect on Hover/Active */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
                                    
                                    <span className="relative z-10 flex items-center justify-center font-black uppercase tracking-widest text-[11px]">
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-white" /> 
                                                <span className="animate-pulse">Importation...</span>
                                            </>
                                        ) : "Importer le Skin"}
                                    </span>
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col xl:flex-row items-center gap-4 bg-zinc-950/60 p-4 rounded-2xl border border-white/5 shadow-inner">
                <div className="relative w-full xl:w-80 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-pink-400 transition-colors" />
                    <Input 
                        placeholder="Filtrer par nom, auteur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-black/40 border-white/5 pl-10 h-10 rounded-xl focus:border-pink-500/50 transition-all text-xs"
                    />
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <ClassFilter selectedClass={selectedClass} onSelectClass={(id) => setSelectedClass(id as string)} />
                    <GenderFilter selectedGender={selectedGender} onSelectGender={setSelectedGender} />
                    
                    {(searchQuery || selectedClass || selectedGender) && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setSearchQuery(""); setSelectedClass(null); setSelectedGender(null); }}
                            className="ml-auto xl:ml-0 h-10 px-4 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 gap-2 text-[10px] font-black uppercase tracking-widest"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reset
                        </Button>
                    )}
                </div>

                <div className="ml-auto hidden xl:flex items-center gap-2">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                        <span className="text-pink-500">{filteredSkins.length}</span> Skins trouvés
                    </p>
                </div>
            </div>

            {/* Empty State */}
            {skins.length === 0 && (
                <div className="flex flex-col items-center justify-center p-20 bg-zinc-900/20 rounded-[2.5rem] border-2 border-dashed border-white/5 group">
                    <div className="relative mb-6">
                        <div className="p-8 bg-zinc-900/50 rounded-full border border-white/5 transition-transform group-hover:scale-110 duration-500">
                            <LayoutGrid className="w-12 h-12 text-zinc-700" />
                        </div>
                        <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-pink-500/30 animate-pulse" />
                    </div>
                    <h4 className="text-white font-black uppercase tracking-widest text-lg mb-2">Ta Garde-Robe est vide</h4>
                    <p className="text-zinc-500 text-center max-w-sm text-sm mb-8 leading-relaxed">
                        Crée tes skins sur nos sites partenaires et importe-les ici pour les partager avec ta guilde.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <a 
                            href="https://barbofus.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-white/5 hover:bg-pink-500/20 rounded-2xl border border-white/5 hover:border-pink-500/40 text-xs font-black text-white uppercase tracking-widest transition-all flex items-center gap-3 group"
                        >
                            <img src="https://www.google.com/s2/favicons?domain=barbofus.com&sz=64" alt="Barbofus" className="w-5 h-5 object-contain opacity-50 group-hover:opacity-100 transition-opacity" />
                            Barbofus
                        </a>
                        <a 
                            href="https://dofusskinmanga.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-white/5 hover:bg-emerald-500/20 rounded-2xl border border-white/5 hover:border-emerald-500/40 text-xs font-black text-white uppercase tracking-widest transition-all flex items-center gap-3 group"
                        >
                            <img src="https://www.google.com/s2/favicons?domain=dofusskinmanga.com&sz=64" alt="SkinManga" className="w-5 h-5 object-contain opacity-50 group-hover:opacity-100 transition-opacity" />
                            SkinManga
                        </a>
                    </div>
                </div>
            )}

            {/* Skins Grid - Extended for Premium Pro View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredSkins.map((skin) => (
                    <div 
                        key={skin.id}
                        className="group relative bg-zinc-900/60 rounded-[2rem] border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:-translate-y-1"
                    >
                        {/* Thumbnail Container */}
                        <div className="aspect-[4/5] relative bg-black/40">
                            {skin.thumbnailUrl ? (
                                <NextImage 
                                    src={skin.thumbnailUrl} 
                                    alt={skin.name}
                                    fill
                                    className="object-contain p-4 transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-1"
                                    unoptimized // Often useful for external thumbnails
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                                    <Sparkles className="w-12 h-12" />
                                </div>
                            )}

                            {/* Class & Gender Badge - UX 2026 Perfected */}
                            <div className="absolute top-4 left-4 z-10 transition-transform duration-500 group-hover:translate-x-1 group-hover:translate-y-1">
                                {(() => {
                                    const skinClass = skin.metadata?.class;
                                    const skinGender = skin.metadata?.gender;
                                    const classData = DOFUS_CLASSES.find(c => {
                                        const match = c.icon.match(/classes\/(\d+)\.png/);
                                        return (match && match[1] === skinClass) || c.name === skinClass;
                                    });
                                    
                                    if (!classData && !skinGender) return null;
                                    
                                    const isMale = !skinGender || ["M", "Homme", "♂", "Mâle", "Male"].includes(skinGender);

                                    return (
                                        <div className="flex items-center gap-2.5 bg-zinc-950/80 backdrop-blur-2xl px-3 py-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden group/badge">
                                            <div className="w-5 h-5 relative shrink-0">
                                                <NextImage src={classData?.icon || "/assets/dofus/classes/1.png"} alt="Classe" fill className="object-contain" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-white tracking-widest uppercase truncate max-w-[80px]">
                                                    {classData?.name || "???"}
                                                </span>
                                                <div className={cn(
                                                    "w-4 h-4 rounded-lg flex items-center justify-center shrink-0",
                                                    isMale ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
                                                )}>
                                                    {isMale ? <Mars className="w-2.5 h-2.5" /> : <Venus className="w-2.5 h-2.5" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* UX 2026: PREMIUM OVERLAY */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-500 z-20 flex flex-col items-center justify-between p-4 pointer-events-none">
                                
                                {/* TOP ACTIONS: CORNER CONTROLS */}
                                <div className="w-full flex justify-end gap-2 pointer-events-auto transform translate-y-[-10px] group-hover:translate-y-0 transition-transform duration-500">
                                    <Button 
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleRefreshMetadata(skin.id, skin.url)}
                                        disabled={isSubmitting}
                                        className="w-9 h-9 bg-zinc-900/40 backdrop-blur-md border-white/5 hover:bg-sky-500/20 hover:border-sky-500/30 hover:text-sky-400 rounded-xl transition-all shadow-xl"
                                        title="Synchroniser"
                                    >
                                        <RefreshCw className={cn("w-4 h-4", isSubmitting && "animate-spin")} />
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            setSkinToEdit(skin);
                                            setEditedName(skin.name);
                                            setEditedUrl(skin.url);
                                            setIsEditOpen(true);
                                        }}
                                        className="w-10 h-10 bg-zinc-950/80 backdrop-blur-xl border border-white/10 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 rounded-xl transition-all shadow-2xl"
                                        title="Éditer"
                                    >
                                        <Pencil className="w-4 h-4" strokeWidth={2.5} />
                                    </Button>
                                    {!readOnly && (

                                        <Button 
                                            variant="outline" 
                                            size="icon"
                                            onClick={() => {
                                                setSkinToDelete(skin.id);
                                                setIsDeleteOpen(true);
                                            }}
                                            className="w-9 h-9 bg-zinc-900/40 backdrop-blur-md border-white/5 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 rounded-xl transition-all shadow-xl"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* CENTER ACTION: PRIMARY EYE */}
                                <div className="pointer-events-auto transform scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 delay-75">
                                    <Button 
                                        variant="secondary" 
                                        size="icon" 
                                        className="w-16 h-16 rounded-full bg-white/10 hover:bg-white text-white hover:text-black backdrop-blur-xl border border-white/20 hover:border-white transition-all shadow-2xl group/eye"
                                        onClick={() => setSelectedSkin(skin)}
                                    >
                                        <Eye className="w-7 h-7 group-hover/eye:scale-110 transition-transform" />
                                        <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Button>
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mt-3 text-center">Aperçu</p>
                                </div>

                                {/* BOTTOM ACTION BAR: FLOATING GLASS */}
                                <div className="w-full pointer-events-auto transform translate-y-[20px] group-hover:translate-y-0 transition-all duration-500 delay-100">
                                    <div className="flex items-center gap-1 bg-zinc-950/40 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
                                        <Button 
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                const res = await shareGalleryItemOnDiscord(guildId, skin.id, "SKIN", profileId);
                                                if (res.success) toast.success("Partagé sur Discord !");
                                                else toast.error(res.error || "Erreur lors du partage");
                                            }}
                                            className="flex-1 h-9 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all gap-2 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Megaphone className="w-4 h-4" />
                                        </Button>
                                        <div className="w-[1px] h-6 bg-white/10" />
                                        <Button 
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleCopyLink(skin.url)}
                                            className="w-9 h-9 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all"
                                            title="Copier le lien"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                        <a 
                                            href={skin.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-9 h-9 hover:bg-white/10 text-white/60 hover:text-white rounded-xl flex items-center justify-center transition-all"
                                            title="Voir la source"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer removed for Ultra-Clean UX 2026 */}
                    </div>
                ))}
            </div>

            {/* View Modal */}
            <Dialog open={!!selectedSkin} onOpenChange={(open) => !open && setSelectedSkin(null)}>
                <DialogContent className="bg-zinc-950/95 backdrop-blur-2xl border-white/10 text-white sm:max-w-xl w-[95vw] h-auto max-h-[90vh] p-0 rounded-[2rem] overflow-hidden shadow-2xl">
                    <DialogTitle className="sr-only">Détails du Skin</DialogTitle>
                    <DialogDescription className="sr-only">Aperçu et métadonnées du skin sélectionné.</DialogDescription>
                    {selectedSkin && (
                        <div className="flex flex-col h-full max-h-[90vh]">
                            {/* Visual Header - Fixed height */}
                            <div className="relative aspect-video bg-black/40 flex items-center justify-center shrink-0 border-b border-white/5">
                                {selectedSkin.thumbnailUrl ? (
                                    <NextImage 
                                        src={selectedSkin.thumbnailUrl} 
                                        alt={selectedSkin.name}
                                        fill
                                        className="object-contain p-6"
                                        unoptimized
                                    />
                                ) : (
                                    <Sparkles className="w-16 h-16 text-zinc-800" />
                                )}
                                
                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    <div className="bg-pink-500/20 backdrop-blur-xl px-3 py-1 rounded-full border border-pink-500/30 w-fit">
                                        <span className="text-[10px] font-black text-pink-400 tracking-widest uppercase">
                                            {selectedSkin.provider}
                                        </span>
                                    </div>
                                    {selectedSkin.metadata?.author && (
                                        <div className="bg-zinc-950/80 backdrop-blur-xl px-3 py-1 rounded-xl border border-white/10 w-fit shadow-2xl">
                                            <span className="text-[10px] font-black text-zinc-400 tracking-tighter uppercase">
                                                Créé par <span className="text-white">{selectedSkin.metadata.author}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
 
                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                                <div className="p-6 space-y-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">
                                            {selectedSkin.name}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-3 mt-4">
                                            {selectedSkin.metadata?.class && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-xl shadow-inner">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {(() => {
                                                            const classData = DOFUS_CLASSES.find(c => {
                                                                const match = c.icon.match(/\/(\d+)\.png$/);
                                                                return match && match[1] === String(selectedSkin.metadata.class);
                                                            });
                                                            return classData ? classData.name : selectedSkin.metadata.class;
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.gender && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl shadow-inner">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {selectedSkin.metadata.gender}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.head && (
                                                <div className="flex items-center gap-2 px-1 py-1 pr-3 bg-zinc-900/80 text-zinc-300 border border-white/5 rounded-xl shadow-inner group/head">
                                                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-black/40 border border-white/5">
                                                        {selectedSkin.metadata.head.startsWith('http') ? (
                                                            <NextImage src={selectedSkin.metadata.head} alt="Head" width={24} height={24} className="object-cover group-hover/head:scale-110 transition-transform" unoptimized />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-zinc-600">
                                                                #{selectedSkin.metadata.head}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                                                        Visage {selectedSkin.metadata.head.startsWith('http') ? "" : selectedSkin.metadata.head}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Colors Section */}
                                    {selectedSkin.colors && Object.keys(selectedSkin.colors).length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-pink-500" />
                                                Couleurs du Skin
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(selectedSkin.colors).map(([label, hex]) => (
                                                    <div key={label} className="bg-white/5 border border-white/5 rounded-xl p-2 flex items-center gap-3 hover:bg-white/10 transition-colors">
                                                        <div 
                                                            className="w-8 h-8 rounded-lg shadow-inner border border-white/10 shrink-0"
                                                            style={{ backgroundColor: hex as string }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-bold text-zinc-500 truncate uppercase tracking-tighter">{label}</p>
                                                            <p className="text-[11px] font-black text-white uppercase font-mono">{hex as string}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Equipment Section */}
                                    {selectedSkin.equipment && Array.isArray(selectedSkin.equipment) && selectedSkin.equipment.length > 0 && (
                                        <div className="space-y-4 pb-4">
                                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                Équipements
                                            </h3>
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedSkin.equipment.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-xl p-2.5 flex items-center justify-between group/item hover:bg-zinc-900/80 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center p-1 border border-white/5">
                                                                {item.icon ? (
                                                                    <NextImage src={item.icon} alt={item.name} width={32} height={32} unoptimized />
                                                                ) : (
                                                                    <Sparkles className="w-5 h-5 text-zinc-800" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-[12px] font-bold text-white group-hover/item:text-emerald-400 transition-colors leading-tight">{item.name}</p>
                                                                <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">{item.type}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sticky Footer Actions */}
                            <div className="p-4 bg-zinc-900/80 backdrop-blur-lg border-t border-white/5 grid grid-cols-2 gap-3 shrink-0">
                                <Button 
                                    asChild
                                    variant="outline" 
                                    className="rounded-xl border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 h-12 text-xs"
                                >
                                    <a href={selectedSkin.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                                        <ExternalLink className="w-4 h-4" />
                                        Voir plus
                                    </a>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl border-white/5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white h-12 text-xs"
                                    onClick={() => handleCopyLink(selectedSkin.url)}
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copier lien
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl border-indigo-500/30 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500 hover:text-white h-12 text-xs font-black uppercase tracking-widest"
                                    onClick={async () => {
                                        const res = await shareGalleryItemOnDiscord(guildId, selectedSkin.id, "SKIN", profileId);
                                        if (res.success) toast.success("Partagé sur Discord !");
                                        else toast.error(res.error || "Erreur lors du partage");
                                    }}
                                >
                                    <Megaphone className="w-4 h-4 mr-2" />
                                    Partager Discord
                                </Button>
                                <Button 
                                    variant="sigil" 
                                    className="rounded-xl h-12 text-xs font-black uppercase tracking-widest"
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
                <DialogContent className="bg-zinc-950/95 backdrop-blur-2xl border-2 border-red-500/20 text-white sm:max-w-md p-0 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]">
                    <DialogTitle className="sr-only">Confirmer la suppression</DialogTitle>
                    <DialogDescription className="sr-only">Cette action est irréversible.</DialogDescription>
                    
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/20 mb-6 group">
                            <Trash2 className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">Supprimer ce skin ?</h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Êtes-vous sûr de vouloir retirer ce chef-d'œuvre de votre bibliothèque ? Cette action est irréversible.
                        </p>
                    </div>

                    <div className="p-4 bg-red-500/5 border-t border-white/5 grid grid-cols-2 gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsDeleteOpen(false)}
                            className="rounded-2xl hover:bg-white/5 text-zinc-400 font-bold uppercase tracking-widest text-[10px]"
                        >
                            Annuler
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleDeleteSkin}
                            disabled={isSubmitting}
                            className="rounded-2xl bg-red-500 hover:bg-red-600 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Oui, Supprimer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Name Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Renommer votre skin</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Donnez un nom unique à votre création pour la galerie.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nom du Look</Label>
                            <Input
                                id="edit-name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="bg-zinc-900 border-white/10 focus:border-amber-500/50 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-url">Lien du Skin (Barbofus / Manga)</Label>
                            <Input
                                id="edit-url"
                                value={editedUrl}
                                onChange={(e) => setEditedUrl(e.target.value)}
                                className="bg-zinc-900 border-white/10 focus:border-amber-500/50 transition-colors"
                                placeholder="https://..."
                            />
                            {editedUrl !== skinToEdit?.url && (
                                <p className="text-[10px] text-amber-500/80 font-medium italic">
                                    Note : Changer le lien actualisera automatiquement la miniature et les détails.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsEditOpen(false)}
                            disabled={isSubmitting}
                            className="rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
                        >
                            Annuler
                        </Button>
                        <Button 
                            variant="sigil" 
                            onClick={handleUpdateSkin}
                            disabled={isSubmitting || !editedName.trim() || !editedUrl.trim() || (editedName === skinToEdit?.name && editedUrl === skinToEdit?.url)}
                            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all font-black uppercase tracking-widest text-[10px]"
                        >
                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

