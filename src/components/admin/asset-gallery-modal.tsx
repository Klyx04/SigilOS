"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Search, 
    ImageIcon, 
    Map as MapIcon, 
    Loader2, 
    X, 
    Check,
    Image as ImageIconLucide
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBountyAssets, type AssetInfo, type AssetType } from "@/server/actions/game-assets-actions";

interface AssetGalleryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (url: string) => void;
    initialType?: AssetType;
    title?: string;
}

export function AssetGalleryModal({
    open,
    onOpenChange,
    onSelect,
    initialType = "portraits",
    title = "Galerie d'Assets"
}: AssetGalleryModalProps) {
    const [type, setType] = useState<AssetType>(initialType);
    const [assets, setAssets] = useState<AssetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchAssets(type);
        }
    }, [open, type]);

    const fetchAssets = async (assetType: AssetType) => {
        setLoading(true);
        try {
            const res = await getBountyAssets(assetType);
            if (res.success && res.data) {
                setAssets(res.data);
            }
        } catch (error) {
            console.error("Gallery Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    }, [assets, search]);

    const handleConfirm = () => {
        if (selectedUrl) {
            onSelect(selectedUrl);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-4xl bg-background border-border p-0 overflow-hidden flex flex-col h-[80vh] shadow-2xl">
                <DialogHeader className="p-4 sm:p-6 border-b border-border bg-black/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground uppercase italic tracking-tighter flex items-center gap-3">
                                {type === "portraits" ? <ImageIconLucide className="text-warning" /> : <MapIcon className="text-warning" />}
                                {title}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground text-caption sm:text-caption font-black uppercase tracking-widest mt-1">
                                {assets.length} fichiers détectés dans /assets/avis/{type}
                            </DialogDescription>
                        </div>
                        
                        <div className="flex bg-surface p-1 rounded-xl border border-border self-start sm:self-auto">
                            <button
                                onClick={() => setType("portraits")}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-caption sm:text-caption font-black uppercase italic transition-all flex items-center gap-2",
                                    type === "portraits" ? "bg-warning text-warning-foreground shadow-lg" : "text-muted-foreground hover:text-warning-foreground"
                                )}
                            >
                                <ImageIconLucide size={14} />
                                Portraits
                            </button>
                            <button
                                onClick={() => setType("maps")}
                                className={cn(
                                    "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-caption sm:text-caption font-black uppercase italic transition-all flex items-center gap-2",
                                    type === "maps" ? "bg-warning text-warning-foreground shadow-lg" : "text-muted-foreground hover:text-warning-foreground"
                                )}
                            >
                                <MapIcon size={14} />
                                Maps
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-warning transition-colors" size={18} />
                        <Input
                            placeholder="Rechercher un fichier..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 bg-surface/50 border-border text-foreground font-bold h-12 rounded-xl focus-visible:ring-warning/50"
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col p-6 bg-background">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-warning" size={40} />
                            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Indexation des fichiers...</span>
                        </div>
                    ) : filteredAssets.length > 0 ? (
                        <ScrollArea className="h-full pr-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                                {filteredAssets.map((asset) => (
                                    <button
                                        key={asset.url}
                                        onClick={() => setSelectedUrl(asset.url)}
                                        onDoubleClick={() => {
                                            onSelect(asset.url);
                                            onOpenChange(false);
                                        }}
                                        className={cn(
                                            "group relative aspect-square rounded-2xl border-2 overflow-hidden transition-all duration-300",
                                            selectedUrl === asset.url
                                                ? "border-warning bg-warning/10 "
                                                : "border-border bg-surface hover:border-border-strong"
                                        )}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center p-2">
                                            <img
                                                src={asset.url}
                                                alt={asset.name}
                                                className={cn(
                                                    "w-full h-full transition-transform duration-300",
                                                    type === "portraits" ? "object-contain" : "object-cover",
                                                    selectedUrl === asset.url ? "scale-110" : "group-"
                                                )}
                                            />
                                        </div>
                                        
                                        <div className={cn(
                                            "absolute inset-x-0 bottom-0 p-2 bg-black/80 backdrop-blur-sm border-t border-border translate-y-full group-hover:translate-y-0 transition-transform duration-300",
                                            selectedUrl === asset.url && "translate-y-0"
                                        )}>
                                            <p className="text-caption font-bold text-foreground truncate text-center">
                                                {asset.name}
                                            </p>
                                        </div>

                                        {selectedUrl === asset.url && (
                                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-warning flex items-center justify-center shadow-lg animate-in zoom-in">
                                                <Check size={14} className="text-foreground font-bold" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <ImageIconLucide size={64} className="opacity-20" />
                            <p className="text-sm font-bold italic">Aucun asset trouvé</p>
                        </div>
                    )}
                </div>

                <div className="p-4 sm:p-6 border-t border-border bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-caption sm:text-caption font-bold text-muted-foreground text-center sm:text-left">
                        Double-cliquez pour sélectionner instantanément
                    </p>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 sm:flex-none text-muted-foreground hover:text-foreground text-caption sm:text-sm"
                        >
                            Annuler
                        </Button>
                        <Button
                            disabled={!selectedUrl}
                            onClick={handleConfirm}
                            className="flex-1 sm:flex-none bg-warning hover:bg-warning text-warning-foreground font-black uppercase italic px-4 sm:px-8 text-caption sm:text-sm"
                        >
                            Confirmer
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
