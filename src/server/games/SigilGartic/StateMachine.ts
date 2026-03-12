import { createMachine, assign } from "xstate";
import { GamePhase, GameMode, AlbumEntry, StrokeData, PublicPlayer } from "../../../types/socket-events";
import { getDofusPrompt } from "../../game/PromptBank";

export interface ChainEntry {
    type: "text" | "drawing";
    content: string;
    playerId: string; // The person who CREATED this entry
    timestamp: number;
}

export interface Player {
    id: string; // Socket ID
    userId?: string;
    username: string;
    userAvatar?: string;
    dofusClass: string;
    isReady: boolean;
    score: number;
    isSpectator?: boolean;
}

export interface GameContext {
    roomId: string;
    players: Map<string, Player>;
    currentRound: number; // Also used as 'step' in the chain
    maxRounds: number;
    timer: number;
    maxTimer: number; // For progress bar/camembert
    drawTime: number; // From config
    mode: GameMode;
    maxPlayers: number;
    hostId: string | null;
    
    // Gartic Phone Specific
    chains: Map<string, ChainEntry[]>; // chainId (original author) -> entries[]
    assignments: Map<string, string>; // playerId -> chainId (what they are working on NOW)
    submittedThisRound: Set<string>; // playerId
    
    // Results
    scores: Map<string, number>;
    revealIndex: number; // Current album being shown in the gallery
}

// ... existing helper (no change) ...
function computeAssignments(players: Player[], step: number): Map<string, string> {
    const activePlayers = players.filter(p => !p.isSpectator);
    const N = activePlayers.length;
    const assignments = new Map<string, string>();
    activePlayers.forEach((player, index) => {
        const chainIndex = (index + step) % N;
        const targetPlayer = activePlayers[chainIndex];
        assignments.set(player.id, targetPlayer.id);
    });
    return assignments;
}

export const garticMachine = createMachine({
    types: {} as {
        context: GameContext;
        input: Partial<GameContext> & { maxPlayers?: number };
        events: 
          | { type: "START_GAME" }
          | { type: "SUBMIT_TEXT"; playerId: string; text: string }
          | { type: "SUBMIT_DRAW"; playerId: string; dataUrl: string }
          | { type: "TICK"; remaining: number }
          | { type: "TIMER_END_STARTING" }
          | { type: "TIMER_END_WRITING" }
          | { type: "TIMER_END_DRAWING" }
          | { type: "TIMER_END_GUESSING" }
          | { type: "TIMER_END_INTERMISSION" }
          | { type: "PLAYER_JOIN"; player: Player }
          | { type: "PLAYER_LEAVE"; playerId: string }
          | { type: "NEXT_REVEAL" }
          | { type: "PLAY_AGAIN" };
    },
    id: "sigilGartic",
    initial: "LOBBY",
    context: ({ input }) => ({
        roomId: input.roomId ?? "",
        players: new Map(),
        currentRound: 0,
        maxRounds: input.maxRounds ?? 3,
        maxPlayers: input.maxPlayers ?? 14,
        timer: 0,
        maxTimer: 0,
        drawTime: input.drawTime ?? 60,
        mode: input.mode ?? "NORMAL",
        hostId: null,
        chains: new Map(),
        assignments: new Map(),
        submittedThisRound: new Set(),
        scores: new Map(),
        revealIndex: 0,
    }),
    states: {
        LOBBY: {
            on: {
                START_GAME: {
                    target: "STARTING",
                    actions: assign({ 
                        currentRound: 0,
                        maxRounds: ({ context }) => Array.from(context.players.values()).filter(p => !p.isSpectator).length,
                        assignments: ({ context }) => computeAssignments(Array.from(context.players.values()), 0),
                        submittedThisRound: new Set(),
                        chains: new Map(),
                        revealIndex: 0,
                    }),
                },
            },
        },
        STARTING: {
            entry: assign({ timer: 10, maxTimer: 10 }),
            on: {
                TIMER_END_STARTING: "WRITING",
            }
        },
        WRITING: {
            entry: assign({ 
                timer: 45, 
                maxTimer: 45 
            }),
            on: {
                SUBMIT_TEXT: {
                    actions: assign({
                        chains: ({ context, event }) => {
                            const newChains = new Map(context.chains);
                            newChains.set(event.playerId, [{
                                type: "text",
                                content: event.text || getDofusPrompt(),
                                playerId: event.playerId,
                                timestamp: Date.now()
                            }]);
                            return newChains;
                        },
                        submittedThisRound: ({ context, event }) => {
                            const newSet = new Set(context.submittedThisRound);
                            newSet.add(event.playerId);
                            return newSet;
                        }
                    })
                },
                TIMER_END_WRITING: "INTERMISSION",
            },
            always: {
                target: "INTERMISSION",
                guard: ({ context }) => {
                    // Only wait for players who are actually in the assignment pool for this game
                    const validParticipants = Array.from(context.players.values()).filter(p => !p.isSpectator);
                    const participantCount = validParticipants.length;
                    return participantCount > 0 && context.submittedThisRound.size >= participantCount;
                }
            }
        },
        INTERMISSION: {
            entry: assign({ timer: 10, maxTimer: 10 }),
            on: {
                TIMER_END_INTERMISSION: [
                    { target: "REVEAL", guard: ({ context }) => context.currentRound >= context.maxRounds - 1 },
                    { 
                        target: "PREPARE_NEXT",
                        guard: ({ context }) => context.currentRound < context.maxRounds - 1
                    }
                ]
            }
        },
        PREPARE_NEXT: {
            entry: assign({
                currentRound: ({ context }) => context.currentRound + 1,
                submittedThisRound: new Set(),
                assignments: ({ context }) => computeAssignments(Array.from(context.players.values()), context.currentRound)
            }),
            always: [
                { target: "DRAWING", guard: ({ context }) => context.currentRound % 2 !== 0 },
                { target: "GUESSING", guard: ({ context }) => context.currentRound % 2 === 0 }
            ]
        },
        DRAWING: {
            entry: assign({ 
                timer: 60, 
                maxTimer: 60 
            }),
            on: {
                SUBMIT_DRAW: {
                    actions: assign({
                        chains: ({ context, event }) => {
                            const newChains = new Map(context.chains);
                            const assignedChainId = context.assignments.get(event.playerId);
                            if (assignedChainId) {
                                const chain = [...(newChains.get(assignedChainId) || [])];
                                chain.push({
                                    type: "drawing",
                                    content: event.dataUrl,
                                    playerId: event.playerId,
                                    timestamp: Date.now()
                                });
                                newChains.set(assignedChainId, chain);
                            }
                            return newChains;
                        },
                        submittedThisRound: ({ context, event }) => {
                            const newSet = new Set(context.submittedThisRound);
                            newSet.add(event.playerId);
                            return newSet;
                        }
                    })
                },
                TIMER_END_DRAWING: "INTERMISSION",
            },
            always: {
                target: "INTERMISSION",
                guard: ({ context }) => {
                    // Only count players who were assigned a chain this round
                    const assignedPlayerCount = context.assignments.size;
                    return assignedPlayerCount > 0 && context.submittedThisRound.size >= assignedPlayerCount;
                }
            }
        },
        GUESSING: {
            entry: assign({ 
                timer: 45, 
                maxTimer: 45 
            }),
            on: {
                SUBMIT_TEXT: {
                    actions: assign({
                        chains: ({ context, event }) => {
                            const newChains = new Map(context.chains);
                            const assignedChainId = context.assignments.get(event.playerId);
                            if (assignedChainId) {
                                const chain = [...(newChains.get(assignedChainId) || [])];
                                chain.push({
                                    type: "text",
                                    content: event.text || "...",
                                    playerId: event.playerId,
                                    timestamp: Date.now()
                                });
                                newChains.set(assignedChainId, chain);
                            }
                            return newChains;
                        },
                        submittedThisRound: ({ context, event }) => {
                            const newSet = new Set(context.submittedThisRound);
                            newSet.add(event.playerId);
                            return newSet;
                        }
                    })
                },
                TIMER_END_GUESSING: "INTERMISSION",
            },
            always: {
                target: "INTERMISSION",
                guard: ({ context }) => {
                    const assignedPlayerCount = context.assignments.size;
                    return assignedPlayerCount > 0 && context.submittedThisRound.size >= assignedPlayerCount;
                }
            }
        },
        REVEAL: {
            entry: assign({ timer: 0, maxTimer: 0 }),
            on: {
                // Move to next album, or go to SCORES when all albums have been shown
                NEXT_REVEAL: [
                    { 
                        target: "REVEAL", 
                        guard: ({ context }) => context.revealIndex < context.chains.size - 1,
                        actions: assign({ revealIndex: ({ context }) => context.revealIndex + 1 })
                    },
                    { target: "SCORES" }
                ],
                PLAY_AGAIN: "LOBBY"
            }
        },
        SCORES: {
            on: {
                PLAY_AGAIN: {
                    target: "LOBBY",
                    actions: assign({
                        currentRound: 0,
                        revealIndex: 0,
                        submittedThisRound: new Set(),
                        chains: new Map(),
                        assignments: new Map()
                    })
                }
            }
        }
    },
    on: {
        PLAYER_JOIN: {
            actions: assign({
                players: ({ context, event }) => {
                    const newPlayers = new Map(context.players);
                    
                    // If player has a userId, check for existing session and remove old socket entry
                    if (event.player.userId) {
                        const existingEntry = Array.from(newPlayers.entries())
                            .find(([_, p]) => p.userId === event.player.userId);
                        
                        if (existingEntry) {
                            const [oldSocketId] = existingEntry;
                            if (oldSocketId !== event.player.id) {
                                newPlayers.delete(oldSocketId);
                            }
                        }
                    }

                    newPlayers.set(event.player.id, event.player);
                    return newPlayers;
                },
                hostId: ({ context, event }) => context.hostId || event.player.userId || event.player.id
            })
        },
        TICK: {
            actions: assign({
                timer: ({ event }) => event.remaining
            })
        },
        PLAYER_LEAVE: {
            actions: assign({
                players: ({ context, event }) => {
                    const newPlayers = new Map(context.players);
                    newPlayers.delete(event.playerId);
                    return newPlayers;
                },
                // Clean up assignments if a player leaves during a round to avoid getting stuck
                assignments: ({ context, event }) => {
                    const newAssignments = new Map(context.assignments);
                    newAssignments.delete(event.playerId);
                    return newAssignments;
                },
                hostId: ({ context, event }) => {
                    if (context.hostId === event.playerId) {
                         // Pick next player as host (not spectator)
                         const next = Array.from(context.players.values()).find(p => p.id !== event.playerId && !p.isSpectator);
                         return next ? (next.userId || next.id) : null;
                    }
                    return context.hostId;
                }
            })
        }
    }
});
