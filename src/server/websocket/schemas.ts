import { z } from "zod";

export const GarticDrawSchema = z.object({
    dataUrl: z.string().max(1024 * 1024), // 1MB limit check (redundant but good)
});

export const GarticTextSchema = z.object({
    text: z.string().min(1).max(100),
});

export const SkribblDrawSchema = z.union([
    z.object({
        type: z.string().optional(),
        x0: z.number().optional(),
        y0: z.number().optional(),
        x1: z.number().optional(),
        y1: z.number().optional(),
        normX: z.number().optional(),
        normY: z.number().optional(),
        color: z.string().optional(),
        lineWidth: z.number().optional(),
        pathId: z.string().optional(),
    }),
    z.array(z.object({
        type: z.string().optional(),
        x0: z.number().optional(),
        y0: z.number().optional(),
        x1: z.number().optional(),
        y1: z.number().optional(),
        normX: z.number().optional(),
        normY: z.number().optional(),
        color: z.string().optional(),
        lineWidth: z.number().optional(),
        pathId: z.string().optional(),
    }))
]);

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
