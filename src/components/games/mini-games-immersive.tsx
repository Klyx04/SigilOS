"use client";

import { useEffect, ReactNode } from "react";
import { useGameContext } from "@/components/providers/GameProvider";

export function MiniGamesImmersive({ children }: { children: ReactNode }) {
    const { setInGame } = useGameContext();

    useEffect(() => {
        // Hide footer while in the mini-games (immersive) view
        setInGame(true);
        return () => setInGame(false);
    }, [setInGame]);

    return <>{children}</>;
}