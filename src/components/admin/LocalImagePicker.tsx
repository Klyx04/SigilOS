"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LocalImage {
    filename: string;
    path: string;
    name: string;
}

interface LocalImagePickerProps {
    type: "monster" | "achievement" | "dungeon" | "item" | "legendary";
    selected?: string;
    onImageSelect: (path: string) => void;
    gridSize?: "small" | "medium" | "large";
    className?: string;
}

export function LocalImagePicker({ type, selected, onImageSelect, gridSize = "medium", className = "" }: LocalImagePickerProps) {
    const [images, setImages] = useState<LocalImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Map gridSize to grid columns
    const gridCols = gridSize === "small" ? "grid-cols-6" : gridSize === "large" ? "grid-cols-3" : "grid-cols-4";

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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                ⚠️ {error}
            </div>
        );
    }

    if (images.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 text-sm">
                Aucune image trouvée dans <code className="text-xs bg-slate-800 px-2 py-1 rounded">/game-data/{type}s/</code>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-400">
                {images.length} image{images.length > 1 ? "s" : ""} disponible{images.length > 1 ? "s" : ""}
            </p>
            <div className={cn(
                "grid gap-2 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent bg-slate-900/50 rounded-xl border border-slate-800 shadow-inner",
                gridCols,
                className
            )}>
                {images.map((img) => (
                    <button
                        key={img.path}
                        type="button"
                        onClick={() => onImageSelect(img.path)}
                        className={`
                            relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                            hover:scale-105 hover:shadow-lg group
                            ${selected === img.path
                                ? "border-indigo-500 ring-2 ring-indigo-500/50"
                                : "border-slate-700/50 hover:border-indigo-400"
                            }
                        `}
                    >
                        <Image
                            src={img.path}
                            alt={img.name}
                            fill
                            className="object-contain bg-slate-950/50 p-0.5"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-1">
                                <p className="text-[7px] text-white font-medium truncate leading-tight">
                                    {img.name}
                                </p>
                            </div>
                        </div>
                        {selected === img.path && (
                            <div className="absolute top-1 right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-lg">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
