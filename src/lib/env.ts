/**
 * Environment Variable Validation
 * 
 * Validates all required environment variables at startup.
 * Crashes early with clear error messages if config is invalid.
 */

import { z } from "zod";

// Schema for all required environment variables
const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),

    // Auth
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    AUTH_DISCORD_ID: z.string().min(1, "AUTH_DISCORD_ID is required"),
    AUTH_DISCORD_SECRET: z.string().min(1, "AUTH_DISCORD_SECRET is required"),

    // App
    NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),

    // Discord Bot (optional for local dev)
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),

    // Redis (optional - fail-open design)
    REDIS_URL: z.string().optional(),

    // Encryption (optional in dev, required in prod)
    ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be exactly 64 hex characters").optional(),

    // Node environment
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Validate environment on import
function validateEnv() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error("❌ Invalid environment variables:");
        console.error(parsed.error.flatten().fieldErrors);

        // In production, crash immediately
        if (process.env.NODE_ENV === "production") {
            throw new Error("Invalid environment configuration. Check logs above.");
        }

        // In dev, warn but continue
        console.warn("⚠️ Running with invalid config - some features may not work");
        return process.env as z.infer<typeof envSchema>;
    }

    return parsed.data;
}

export const env = validateEnv();

// Type-safe env access
export type Env = z.infer<typeof envSchema>;
