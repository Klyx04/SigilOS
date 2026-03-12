"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "../../lib/socket-utils";
import { GamePhase, PublicPlayer } from "../../types/socket-events";

// Global connection state so we don't spam reconnections across unmounts 
// in development mode thanks to React Strict Mode
let socketInstance: Socket | null = null;

export interface GarticGameState {
    id: string;
    phase: GamePhase;
    players: (PublicPlayer & { hasSubmitted?: boolean })[];
    currentRound: number;
    maxRounds: number;
    timer: number;
    maxTimer: number;
    hostId?: string;
    task?: {
        type: "text" | "drawing";
        content: string;
    } | null;
    albums?: any[]; // The final results
}

export function useGarticSocket() {
    const [socket, setSocket] = useState<Socket | null>(socketInstance);
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState<GarticGameState | null>(null);

    useEffect(() => {
        if (!socketInstance) {
            socketInstance = io(buildWsUrl(), {
                path: "/socket.io/",
            });
        }

        setSocket(socketInstance);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onStateUpdate = (state: GarticGameState) => {
             // For the sake of simplicity right now we just drop it into the global store
             setGameState(state);
        }

        socketInstance.on("connect", onConnect);
        socketInstance.on("disconnect", onDisconnect);
        socketInstance.on("gartic:state:update", onStateUpdate);
        socketInstance.on("gartic:reveal:ready", ({ albums }) => {
            setGameState(prev => prev ? { ...prev, albums } : null);
        });

        return () => {
             // Cleanup listeners when unmounting so we don't leak memory, 
             // but keep the connection open.
             if(socketInstance) {
                  socketInstance.off("connect", onConnect);
                  socketInstance.off("disconnect", onDisconnect);
                  socketInstance.off("gartic:state:update", onStateUpdate);
             }
        };
    }, []);

    // Helper functions for easy emittion
    const createRoom = (config: any) => socket?.emit("gartic:room:create", config);
    const joinRoom = (roomId: string, psuedo: string) => socket?.emit("gartic:room:join", { roomId, userName: psuedo });
    const startGame = () => socket?.emit("gartic:game:start");
    const leaveRoom = () => {
        socket?.emit("gartic:room:leave");
        setGameState(null);
    };
    const submitText = (text: string) => socket?.emit("gartic:text:submit", { text });
    const submitDraw = (dataUrl: string) => socket?.emit("gartic:draw:submit", { dataUrl });

    return {
        socket,
        isConnected,
        gameState,
        
        createRoom,
        joinRoom,
        startGame,
        leaveRoom,
        submitText,
        submitDraw
    };
}
