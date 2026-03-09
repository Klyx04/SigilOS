import { createMachine, assign } from "xstate";
import { GamePhase, GameMode, AlbumEntry, StrokeData, PublicPlayer } from "../../../types/socket-events";

// Mock dofus word type
export interface DofusWord {
    label: string;
    category: string;
}

export interface Player {
    id: string;
    username: string;
    dofusClass: string;
    isReady: boolean;
    score: number;
}

export interface Submission {
    type: "text" | "drawing";
    content: string;
    timestamp: number;
    timeRemainingRatio: number;
}

export interface GameContext {
    roomId: string;
    players: Map<string, Player>;
    currentRound: number;
    maxRounds: number;
    currentDrawerIndex: number;
    currentWord: DofusWord | null;
    submissions: Map<string, Submission>; // playerId → { drawing | text }
    scores: Map<string, number>;
    timer: number;
    mode: GameMode;
    album: AlbumEntry[][];  // [joueur][round] = { type, content, authorId }
}

export const garticMachine = createMachine({
    types: {} as {
        context: GameContext;
        input: Partial<GameContext>;
        events: any;
    },
    id: "sigilGartic",
    initial: "LOBBY",
    context: ({ input }) => ({
        roomId: input.roomId ?? "",
        players: new Map(),
        currentRound: 0,
        maxRounds: input.maxRounds ?? 3,
        currentDrawerIndex: 0,
        currentWord: null,
        submissions: new Map(),
        scores: new Map(),
        timer: 0,
        mode: input.mode ?? "NORMAL",
        album: [],
    }),
    states: {
        LOBBY: {
            on: {
                START_GAME: {
                    target: "BRIEFING",
                    // guard: ({ context }) => context.players.size >= 2,
                    actions: assign({ currentRound: 0 }),
                },
            },
        },
        BRIEFING: {
            entry: assign(({ context }) => ({
                currentWord: { label: "Test", category: "Test" }, // To be replaced with pickWord
                submissions: new Map(),
                timer: 3,
            })),
            after: { 3000: "DRAWING" },
        },
        DRAWING: {
            entry: assign(({ context }) => ({
                timer: context.mode === "NORMAL" ? 60 : 120,
            })),
            on: {
                DRAWING_DONE: {
                    target: "GUESSING",
                    // guard: ({ context, event }) => event.playerId === getCurrentDrawer(context),
                },
                TIMER_END: "GUESSING",
            },
            after: {
                60000: "GUESSING"
            },
        },
        GUESSING: {
            entry: assign({ timer: 45 }),
            on: {
                SUBMIT_GUESS: {
                    actions: assign({
                        submissions: ({ context, event }) => {
                            const newSubmap = new Map(context.submissions);
                            newSubmap.set(event.playerId, {
                                type: "text",
                                content: event.guess,
                                timestamp: Date.now(),
                                timeRemainingRatio: 1
                            });
                            return newSubmap;
                        }
                    }),
                },
                ALL_SUBMITTED: "INTERMISSION",
                TIMER_END: "INTERMISSION",
            },
        },
        INTERMISSION: {
            entry: assign(({ context }) => ({
                // scores: computeScores(context),
                // album: updateAlbum(context),
            })),
            after: {
                5000: [
                    {
                        target: "BRIEFING",
                        guard: ({ context }) =>
                            context.currentRound < context.maxRounds - 1,
                        actions: assign({
                            currentRound: ({ context }) => context.currentRound + 1,
                            currentDrawerIndex: ({ context }) =>
                                (context.currentDrawerIndex + 1) % context.players.size,
                        }),
                    },
                    { target: "REVEAL" },
                ],
            },
        },
        REVEAL: {
            on: {
                NEXT_PLAYER_ALBUM: {
                    // Navigation dans les albums
                },
                END_REVEAL: "SCORES",
            },
        },
        SCORES: {
            after: { 10000: "LOBBY" },
            on: { PLAY_AGAIN: "LOBBY" },
        },
    },
});
