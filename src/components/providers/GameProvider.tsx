"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type GameContextValue = {
    /** True when the user is in a fullscreen/immersive game view (footer should be hidden). */
    isInGame: boolean;
    setInGame: (value: boolean) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
    const [isInGame, setIsInGame] = useState(false);
    const setInGame = useCallback((value: boolean) => setIsInGame(value), []);

    return (
        <GameContext.Provider value={{ isInGame, setInGame }}>
            {children}
        </GameContext.Provider>
    );
}

export function useGameContext(): GameContextValue {
    const ctx = useContext(GameContext);
    if (!ctx) {
        // Fail-closed: default to NOT in game (footer visible) when outside provider
        return { isInGame: false, setInGame: () => {} };
    }
    return ctx;
}