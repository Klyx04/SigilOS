"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";

const STORAGE_KEY = "sigil:sidebar:width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 240;
const MAX_WIDTH = 420;

type Props = React.ComponentProps<typeof AppSidebar>;

/**
 * Chantier Inter-Guilde (19/08) — barre latérale redimensionnable.
 * Poignée sur le bord droit → largeur persistée en localStorage
 * (« élargir la navbar vers la droite », les onglets coupés sont évités).
 * Mise en page flexbox pure : l'<aside> est un élément flex (style width),
 * le contenu (flex-1) prend le reste naturellement — aucun CSS var.
 */
export function ResizableSidebar({ className, ...props }: Props) {
    const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

    // Restaure la largeur sauvegardée au montage.
    useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(STORAGE_KEY));
            if (saved && saved >= MIN_WIDTH && saved <= MAX_WIDTH) setWidth(saved);
        } catch { /* localStorage indisponible → largeur par défaut */ }
    }, []);

    // Persiste la largeur.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, String(width));
        } catch { /* non bloquant */ }
    }, [width]);

    const onPointerMove = (e: PointerEvent) => {
        if (!dragRef.current) return;
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + (e.clientX - dragRef.current.startX)));
        setWidth(next);
    };

    const onPointerUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startWidth: width };
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    return (
        <aside
            data-tour="sidebar-root"
            className={cn(
                "dashboard-sidebar hidden lg:flex flex-col h-full shrink-0 relative z-50",
                className
            )}
            style={{ width }}
        >
            <AppSidebar {...props} className="h-full" />

            {/* Poignée de redimensionnement (bord droit) */}
            <div
                onPointerDown={onPointerDown}
                title="Élargir / rétrécir la barre latérale"
                aria-label="Redimensionner la barre latérale"
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize touch-none hover:bg-emerald-500/50 active:bg-emerald-500/70 transition-colors z-20"
            />
        </aside>
    );
}

