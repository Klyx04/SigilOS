"use client";

import { useState, useEffect } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LocalImage {
    filename: string;
    path: string;
    name: string;
}

interface LocalImagePickerProps {
    type: "monster" | "achievement" | "dungeon" | "item" | "legendary" | "defi" | "titan";
    selected?: string;
    onImageSelect: (path: string) => void;
    gridSize?: "small" | "medium" | "large";
    className?: string;
}

export function LocalImagePicker({ type, selected, onImageSelect, gridSize = "medium", className = "" }: LocalImagePickerProps) {
    const [images, setImages] = useState<LocalImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [deleting, setDeleting] = useState<string | null>(null);

    // Map gridSize to grid columns
    const gridCols = gridSize === "small" ? "grid-cols-6" : gridSize === "large" ? "grid-cols-3" : "grid-cols-4";

    // Filtre de recherche côté client (nom, sans extension).
    const filteredImages = images.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        loadImages();
    }, [type]);

    async function loadImages() {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/god/list-local-images?type=${type}`);
            const data = await res.json();

            if (data.success) {
                setImages(data.images || []);
            } else {
                setError(data.error || "Erreur de chargement");
            }
        } catch (err: any) {
            setError(err.message || "Erreur réseau");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(filename: string) {
        setDeleting(filename);
        try {
            const res = await fetch(`/api/god/list-local-images?type=${type}&filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setImages(prev => prev.filter(i => i.filename !== filename));
                toast.success(`Image supprimée : ${filename}`, { id: "local-image-delete" });
            } else {
                toast.error(data.error || "Erreur lors de la suppression", { id: "local-image-delete" });
            }
        } catch (err: any) {
            toast.error(err.message || "Erreur réseau", { id: "local-image-delete" });
        } finally {
            setDeleting(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-info" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-danger/20 border border-danger/30 rounded-lg text-danger text-sm">
                ⚠️ {error}
            </div>
        );
    }

    if (images.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground text-sm">
                Aucune image trouvée dans <code className="text-xs bg-elevated px-2 py-1 rounded">/game-data/{type}s/</code>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Rechercher parmi ${images.length} image${images.length > 1 ? "s" : ""}...`}
                    className="w-full pl-9 pr-3 h-10 rounded-xl bg-elevated border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-info/50"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {filteredImages.length} / {images.length} image{images.length > 1 ? "s" : ""} • cliquez pour sélectionner, 🗑 pour supprimer
            </p>
            <div className={cn(
                "grid gap-2 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent bg-surface/50 rounded-xl border border-border shadow-inner",
                gridCols,
                className
            )}>
                {filteredImages.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                        {images.length === 0 ? "Aucune image dans ce dossier." : "Aucune image ne correspond à la recherche."}
                    </div>
                )}
                {filteredImages.map((img) => (
                    <button
                        key={img.path}
                        type="button"
                        onClick={() => onImageSelect(img.path)}
                        className={`
                            relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                             hover:shadow-lg group
                            ${selected === img.path
                                ? "border-info ring-2 ring-ring/50"
                                : "border-border/50 hover:border-info"
                            }
                        `}
                    >
                        <Image
                            src={img.path}
                            alt={img.name}
                            fill
                            className="object-contain bg-background/50 p-0.5"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-1">
                                <p className="text-caption text-foreground font-medium truncate leading-tight">
                                    {img.name}
                                </p>
                            </div>
                        </div>
                        {selected === img.path && (
                            <div className="absolute top-1 right-1 bg-info text-info-foreground rounded-full p-0.5 shadow-lg">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); handleDelete(img.filename); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); handleDelete(img.filename); } }}
                            className={`absolute top-1 left-1 z-10 p-1 rounded-md bg-danger/80 hover:bg-danger text-danger-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer ${deleting === img.filename ? "pointer-events-none opacity-50" : ""}`}
                            title="Supprimer cette image"
                            aria-label={`Supprimer ${img.name}`}
                        >
                            {deleting === img.filename
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
