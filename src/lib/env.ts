/**
 * Validation des variables d'environnement au démarrage.
 *
 * - production : refuse de démarrer si une variable critique manque ou si un
 *   interrupteur dangereux est actif (fail-closed) ;
 * - développement / test : avertit et continue ;
 * - build Next : ignore (les secrets de runtime ne sont pas disponibles au build).
 *
 * Aucun secret n'est journalisé : seuls les noms de champs et les raisons le sont.
 */

import { z } from "zod";
import { logger } from "./logger";

const hex64 = /^[0-9a-fA-F]{64}$/;
const godRoute = /^\/mng-.{5,}$/;

export const envSchema = z.object({
    DATABASE_URL: z.string().url("DATABASE_URL doit être une URL PostgreSQL valide"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
    AUTH_DISCORD_ID: z.string().min(1, "AUTH_DISCORD_ID est requis"),
    AUTH_DISCORD_SECRET: z.string().min(1, "AUTH_DISCORD_SECRET est requis"),
    NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL doit être une URL valide").optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Requises en production (voir requiredInProduction), optionnelles en dev.
    ENCRYPTION_KEY: z.string().regex(hex64, "ENCRYPTION_KEY doit faire exactement 64 caractères hexadécimaux").optional(),
    CRON_SECRET: z.string().min(16, "CRON_SECRET doit faire au moins 16 caractères").optional(),
    STORAGE_SIGNING_SECRET: z.string().min(32, "STORAGE_SIGNING_SECRET doit faire au moins 32 caractères").optional(),
    GOD_ROUTE: z.string().regex(godRoute, "GOD_ROUTE doit commencer par /mng- et faire au moins 5 caractères après le préfixe").optional(),

    // Interrupteurs : valeurs explicites, jamais un booléen implicite.
    CSP_ENFORCE: z.enum(["true", "false"]).optional(),
    WS_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
    DEV_SKIP_OCR: z.enum(["true", "false"]).optional(),
    DOFUSDB_OFFLINE: z.enum(["0", "1"]).optional(),

    // Optionnelles.
    REDIS_URL: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_APPLICATION_PUBLIC_KEY: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    METAMOB_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export type EnvValidationResult = {
    env: Env;
    errors: string[];
    warnings: string[];
};

export type ValidateEnvOptions = {
    nodeEnv?: string;
    phase?: string;
    log?: boolean;
};

const requiredInProduction = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_DISCORD_ID",
    "AUTH_DISCORD_SECRET",
    "ENCRYPTION_KEY",
    "CRON_SECRET",
    "STORAGE_SIGNING_SECRET",
    "GOD_ROUTE",
] as const;

/**
 * Valide l'environnement sans jamais journaliser les valeurs.
 *
 * @throws en production si une variable critique manque ou si un interrupteur dangereux est actif.
 */
export function validateEnv(
    source: NodeJS.ProcessEnv = process.env,
    options: ValidateEnvOptions = {},
): EnvValidationResult {
    const nodeEnv = options.nodeEnv ?? source.NODE_ENV ?? "development";
    const phase = options.phase ?? source.NEXT_PHASE ?? "";
    const isProduction = nodeEnv === "production";
    const isBuild = phase.includes("build");
    const log = options.log ?? true;

    if (isBuild) {
        // Au build, les secrets de runtime ne sont pas disponibles : on ne bloque pas.
        return { env: source as unknown as Env, errors: [], warnings: [] };
    }

    const parsed = envSchema.safeParse(source);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsed.success) {
        for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
            errors.push(`${field}: ${messages?.join(", ") ?? "valeur invalide"}`);
        }
    }

    if (isProduction) {
        for (const key of requiredInProduction) {
            if (!source[key] || source[key]?.trim() === "") {
                errors.push(`${key}: variable requise en production`);
            }
        }
        if (source.DEV_SKIP_OCR === "true") errors.push("DEV_SKIP_OCR=true est interdit en production");
        if (source.DOFUSDB_OFFLINE === "1") errors.push("DOFUSDB_OFFLINE=1 est interdit en production");
        if (source.WS_AUTH_ENABLED === "false") errors.push("WS_AUTH_ENABLED=false est interdit en production");
        if (source.CSP_ENFORCE !== "true") {
            warnings.push("CSP_ENFORCE n'est pas 'true' : CSP en Report-Only (durcissement = rang 7 de la roadmap)");
        }
    }

    if (errors.length > 0) {
        if (log) logger.error("❌ Configuration d'environnement invalide", { fields: errors, nodeEnv });
        if (isProduction) {
            throw new Error("Configuration d'environnement invalide — démarrage refusé.");
        }
    } else if (warnings.length > 0 && log) {
        logger.warn("⚠️ Configuration d'environnement à vérifier", { warnings, nodeEnv });
    }

    return {
        env: (parsed.success ? parsed.data : source) as Env,
        errors,
        warnings,
    };
}
