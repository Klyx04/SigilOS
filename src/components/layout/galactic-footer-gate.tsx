"use client";

import { useGameContext } from "@/components/providers/GameProvider";
import { GalacticFooter } from "@/components/layout/galactic-footer";

export function GalacticFooterGate() {
    const { isInGame } = useGameContext();

    // Hide footer while in immersive game view
    if (isInGame) return null;

    return <GalacticFooter variant="compact" isMember={true} />;
}