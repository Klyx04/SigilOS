import { z } from "zod";

export const GarticDrawSchema = z.object({
    dataUrl: z.string().max(1024 * 1024), // 1MB limit check (redundant but good)
});

export const GarticTextSchema = z.object({
    text: z.string().min(1).max(100),
});

export const SkribblDrawSchema = z.object({
    stroke: z.any().optional(), // Can be more specific if we want
    color: z.string().optional(),
    size: z.number().optional(),
    type: z.enum(["draw", "clear", "undo"]).optional(),
});

export const SkribblGuessSchema = z.object({
    text: z.string().min(1).max(100),
});

export const GeoguesserGuessSchema = z.object({
    x: z.number(),
    y: z.number(),
    worldId: z.number().optional(),
    mapId: z.number().optional(),
});

export const SigilKingBidSchema = z.object({
    amount: z.number().int().min(0).max(10),
});

export const SigilKingPlaySchema = z.object({
    cardId: z.string().min(1).max(80),
    sramChoice: z.enum(["incarnation", "pandawa"]).optional(),
});
