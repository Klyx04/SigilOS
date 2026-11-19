"use client";

import React, { useEffect, useRef, useState } from "react";
import { DoorOpen, X } from "lucide-react";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type {
    DungeonAchievementDungeon,
    DungeonAchievementPanelLoader,
    DungeonAchievementPanelMode,
    DungeonAchievementToggler,
} from "@/lib/rush-dungeon-achievements";
import type { RushDungeonState } from "@/lib/rush-dungeons";
import { DungeonAchievementsPanel } from "@/components/dofus-quests/rush/DungeonAchievementsPanel";

/**
 * Mini-modale des succès d'un donjon — **fenêtre de jeu (PiP)**.
 *
 * Même panneau que la modale pleine, coquille compacte : pas d'animation (une
 * ouverture animée peut rester bloquée à `opacity: 0` dans un document PiP), portail
 * dans le document du nœud (`ownerDocument`), largeur `min(340px, 100vw - 1rem)`.
 * Le mode `guest` reste en lecture seule : aucune écriture serveur sans profil.
 */
export function RushOverlayDungeonAchievementsModal({
    dungeon,
    dungeonKey,
    dungeonState,
    onSetDungeon,
    loadPanel,
    toggle,
    guestPseudo = null,
    characterSlot,
    mode,
    onClose,
}: {
    dungeon: DungeonAchievementDungeon;
    dungeonKey: string;
    dungeonState: RushDungeonState | null;
    onSetDungeon?: (state: RushDungeonState | null) => void;
    loadPanel: DungeonAchievementPanelLoader;
    toggle?: DungeonAchievementToggler;
    guestPseudo?: string | null;
    characterSlot?: string;
    mode: DungeonAchievementPanelMode;
    onClose: () => void;
}) {
    const daScope = daScopeProps(useDaTheme());
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const [broken, setBroken] = useState(false);

    // Échap ferme la fenêtre : le document est celui de la PiP, jamais le global.
    useEffect(() => {
        const win =
            dialogRef.current?.ownerDocument.defaultView ??
            (typeof window !== "undefined" ? window : null);
        if (!win) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        win.addEventListener("keydown", onKey);
        return () => win.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        closeRef.current?.focus();
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2">
            <button
                type="button"
                aria-label="Fermer"
                onClick={onClose}
                className="fixed inset-0 bg-black/70"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="rush-dungeon-achievements-title"
                ref={dialogRef}
                {...daScope}
                data-quality="low"
                className="da-modal da-portal relative z-10 flex max-h-[80dvh] w-[min(21.25rem,calc(100vw-1rem))] flex-col"
            >
                <header className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-border bg-surface">
                        {dungeon.imageUrl && !broken ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={dungeon.imageUrl}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                onError={() => setBroken(true)}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <DoorOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p
                            id="rush-dungeon-achievements-title"
                            className="truncate text-[12px] font-semibold text-foreground"
                        >
                            {dungeon.name}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                            {dungeon.bossName ? `Boss : ${dungeon.bossName}` : "Succès du donjon"}
                        </p>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer les succès du donjon"
                        title="Fermer"
                        className="shrink-0 rounded-[3px] p-0.5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </header>
                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
                    <DungeonAchievementsPanel
                        mode={mode}
                        dungeon={dungeon}
                        dungeonKey={dungeonKey}
                        dungeonState={dungeonState}
                        onSetDungeon={onSetDungeon}
                        loadPanel={loadPanel}
                        toggle={toggle}
                        guestPseudo={guestPseudo}
                        characterSlot={characterSlot}
                        variant="overlay"
                    />
                </div>
            </div>
        </div>
    );
}
