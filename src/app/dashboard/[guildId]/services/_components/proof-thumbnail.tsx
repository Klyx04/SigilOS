"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ProofThumbnailProps {
    src: string | null | undefined;
    alt?: string;
    size?: "sm" | "md" | "card";
}

export function ProofThumbnail({ src, alt = "Preuve", size = "sm" }: ProofThumbnailProps) {
    const [open, setOpen] = useState(false);

    if (!src) return null;

    const sizeClasses =
        size === "card" ? "h-28 w-full" :
            size === "md" ? "h-16 w-16" :
                "h-10 w-10";

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`${sizeClasses} relative rounded-lg overflow-hidden border border-border hover:border-info/50 transition-all cursor-pointer group shrink-0`}
            >
                <img
                    src={src}
                    alt={alt}
                    className="absolute inset-0 w-full h-full object-cover group- transition-transform"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="text-foreground opacity-0 group-hover:opacity-100 text-caption font-bold">🔍</span>
                </div>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl bg-background border-border p-2">
                    <div className="relative w-full aspect-video">
                        <img
                            src={src}
                            alt={alt}
                            className="absolute inset-0 w-full h-full object-contain rounded-lg"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
