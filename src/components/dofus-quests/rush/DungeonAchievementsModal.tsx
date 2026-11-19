"use client";

import React, { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import type {
    DungeonAchievementDungeon,
    DungeonAchievementPanelLoader,
    DungeonAchievementPanelMode,
    DungeonAchievementToggler,
} from "@/lib/rush-dungeon-achievements";
import type { RushDungeonState } from "@/lib/rush-dungeons";
import { DungeonAchievementsPanel } from "./DungeonAchievementsPanel";

/**
 * Modale **pleine** des succès d'un donjon — guide navigateur (dashboard et guide
 * public connecté). Le panneau est partagé avec la mini-modale de l'overlay ; seule
 * la coquille change (Radix Dialog ici, portail PiP compact là-bas).
 */
export function DungeonAchievementsModal({
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
    const [broken, setBroken] = useState(false);

    return (
        <Dialog open onOpenChange={(value) => !value && onClose()}>
            <DialogContent
                {...daScope}
                overlayClassName="da-modal-scrim"
                className="da-modal da-portal w-[min(42rem,calc(100vw-2rem))] max-h-[85dvh] gap-0 p-0"
                data-quality="high"
            >
                <div className="da-modal-head">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-border bg-surface">
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
                                <DoorOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                            )}
                        </span>
                        <div className="min-w-0">
                            <DialogTitle className="da-modal-title">{dungeon.name}</DialogTitle>
                            <p className="da-modal-sub mt-0.5 truncate">
                                {dungeon.bossName ? `Boss : ${dungeon.bossName}` : "Succès du donjon"}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="da-modal-body custom-scrollbar">
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
                        variant="page"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
