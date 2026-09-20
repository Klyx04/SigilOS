import { z } from "zod";

const MissionSchema = z.object({
    category: z.enum(["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"]),
    tier: z.number().min(1).max(4),
    xpReward: z.number().min(0).default(0),
    guildatonsReward: z.number().min(0).default(0),
    title: z.string().optional(),
    payload: z.record(z.any()),
});

const CreateWeekSchema = z.object({
    guildId: z.string(),
    weekNumber: z.number().min(1).max(53),
    year: z.number().min(2025),
    missions: z.array(MissionSchema).min(1).max(20),
});

const testData = {
    guildId: "123",
    weekNumber: 2,
    year: 2026,
    missions: [
        {
            category: "EXPEDITION", // Ensure this passes
            tier: 1,
            xpReward: 10,
            payload: { zone: "Frigost" }
        }
    ]
};

try {
    const result = CreateWeekSchema.parse(testData);
    console.log("Validation Success");
} catch (e) {
    console.error("Validation Failed:", e);
    process.exit(1);
}
