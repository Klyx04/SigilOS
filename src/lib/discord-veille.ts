import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { createSystemAuditLog } from "@/lib/dofensive-sync";

/**
 * #223 D — VEILLE Discord automatique (mensuelle via le cron BullMQ `discord-watch`).
 *
 * Personne (humain ou IA) ne doit se souvenir de surveiller Discord : la machine le fait.
 * Chaque mois, `runDiscordVeille()` :
 *   1. ping l'API v10 (`GET /api/v10/gateway`) → Discord répond-il encore en v10 ?
 *   2. compare une empreinte SHA-256 de `docs.discord.com/llms.txt` → la doc a changé ?
 *   3. scanne le changelog officiel pour des mots-clés inquiétants (Breaking Change, v11,
 *      Obfuscation, jour J...) ;
 *   4. gère la fenêtre « jour J 16/11/2026 » (rappel unique + checklist §10.5 du plan maître).
 *
 * Rien à signaler → audit God OK. Anomalie → alerte God (`notifyGod`, ping).
 * La procédure manuelle complète reste documentée dans `sigilos-discord-resilience.md` §12.
 */

// ─── URL publiques (littérales — aucune donnée utilisateur → pas de SSRF) ─────
export const DISCORD_GATEWAY_URL = "https://discord.com/api/v10/gateway";
export const DISCORD_LLMS_URL = "https://docs.discord.com/llms.txt";
export const DISCORD_CHANGELOG_URL = "https://discord.com/developers/docs/change-log";
export const DISCORD_WATCH_UA = "DiscordBot (https://github.com/Klyx04/SigilOS, 1.0.0)";

// ─── Point dur officiel (HTTP enforcement obfuscation) ────────────────────────
export const DISCORD_DAY_J = "2026-11-16";
export const DISCORD_DAY_J_WINDOW_START = "2026-11-01";

export const DISCORD_WATCH_KEYWORDS = [
    "Breaking Change",
    "API v11",
    "v11",
    "Obfuscation",
    "obfuscation",
    "16 November",
    "November 16",
    "Webhook Events",
];

const LLMS_HASH_KEY = "discord:veille:llms-hash";
const DAY_J_REMINDED_KEY = "discord:veille:day-j-reminded";
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_MAX_CHARS = 150_000;

export type DiscordVeilleReport = {
    gatewayOk: boolean;
    docsChanged: boolean;
    docsHash: string | null;
    keywordsFound: string[];
    dayJStatus: "before-window" | "remind" | "day" | "passed";
    anomalies: string[];
    ranAt: string;
};

async function fetchText(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": DISCORD_WATCH_UA, Accept: "text/plain,text/html;q=0.9,*/*;q=0.8" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const text = await res.text();
        return text.length > FETCH_MAX_CHARS ? text.slice(0, FETCH_MAX_CHARS) : text;
    } catch (error) {
        logger.warn("[DiscordVeille] fetch échoué:", { url, error: String(error) });
        return null;
    }
}

async function checkGateway(): Promise<boolean> {
    const body = await fetchText(DISCORD_GATEWAY_URL);
    if (body === null) return false;
    try {
        const parsed = JSON.parse(body) as { url?: unknown };
        return typeof parsed.url === "string" && parsed.url.startsWith("wss://");
    } catch {
        return false;
    }
}

async function fetchDocsHash(): Promise<{ hash: string | null; changed: boolean }> {
    const previous = await redis.get(LLMS_HASH_KEY).catch(() => null);
    const content = await fetchText(DISCORD_LLMS_URL);
    if (content === null) {
        // Doc injoignable : on ne marque PAS "changé" (évite les faux positifs réseau).
        return { hash: previous, changed: false };
    }
    const hash = createHash("sha256").update(content).digest("hex");
    if (previous && previous !== hash) return { hash, changed: true };
    return { hash, changed: false };
}

async function scanChangelog(): Promise<string[]> {
    const content = await fetchText(DISCORD_CHANGELOG_URL);
    if (content === null) return [];
    return DISCORD_WATCH_KEYWORDS.filter((kw) => content.includes(kw));
}

function dayJStatus(): DiscordVeilleReport["dayJStatus"] {
    const now = Date.now();
    const dayJ = new Date(`${DISCORD_DAY_J}T00:00:00.000Z`).getTime();
    const windowStart = new Date(`${DISCORD_DAY_J_WINDOW_START}T00:00:00.000Z`).getTime();
    if (now >= dayJ + 24 * 3600 * 1000) return "passed";
    if (now >= dayJ) return "day";
    if (now >= windowStart) return "remind";
    return "before-window";
}

export async function runDiscordVeille(): Promise<DiscordVeilleReport> {
    const ranAt = new Date().toISOString();

    const gatewayOk = await checkGateway();
    const { hash, changed } = await fetchDocsHash();
    const keywordsFound = await scanChangelog();
    const dayJ = dayJStatus();

    const anomalies: string[] = [];

    if (!gatewayOk) anomalies.push("L'API Discord v10 ne répond pas (GET /api/v10/gateway) — vérifier.");
    if (changed) anomalies.push("docs.discord.com/llms.txt a changé depuis la dernière veille — relire le snapshot §2-6.");
    if (keywordsFound.length > 0) {
        anomalies.push(`Changelog Discord : mots-clés détectés — ${keywordsFound.join(", ")}.`);
    }

    // Persiste la nouvelle empreinte (après calcul réussi uniquement).
    if (hash) await redis.set(LLMS_HASH_KEY, hash).catch(() => {});

    // Rappel UNIQUE dans la fenêtre avant le jour J.
    if (dayJ === "remind") {
        const reminded = await redis.get(DAY_J_REMINDED_KEY).catch(() => null);
        if (!reminded) {
            anomalies.push("Le point dur HTTP Discord (16/11/2026) approche — préparer la checklist jour J (plan maître §10.5).");
            await redis.set(DAY_J_REMINDED_KEY, "1", "EX", 60 * 60 * 24 * 60).catch(() => {});
        }
    }
    if (dayJ === "day" || dayJ === "passed") {
        anomalies.push("Jour J 16/11/2026 atteint — vérifier bot connecté + notifications + salons privés (checklist §10.5).");
    }

    const report: DiscordVeilleReport = {
        gatewayOk,
        docsChanged: changed,
        docsHash: hash,
        keywordsFound,
        dayJStatus: dayJ,
        anomalies,
        ranAt,
    };

    if (anomalies.length > 0) {
        logger.warn("[DiscordVeille] Anomalies détectées:", { anomalies });
        try {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            await notifyGod({
                title: "🔭 Veille Discord : anomalies",
                message: anomalies.join("\n"),
                type: "SYSTEM",
                success: false,
                ping: true,
                metadata: { gatewayOk, docsChanged: changed, keywords: keywordsFound.join(","), dayJStatus: dayJ },
            });
        } catch (error) {
            logger.warn("[DiscordVeille] notifyGod échoué:", { error: String(error) });
        }
    } else {
        logger.info("[DiscordVeille] Veille mensuelle OK — rien à signaler.");
    }

    try {
        await createSystemAuditLog({
            action: "DISCORD_WATCH",
            targetType: "SYSTEM_GOD",
            targetId: "discord-watch",
            gatewayOk,
            docsChanged: changed,
            keywordsFound: keywordsFound.join(", "),
            dayJStatus: dayJ,
            anomaliesCount: anomalies.length,
        });
    } catch (error) {
        logger.warn("[DiscordVeille] createSystemAuditLog échoué:", { error: String(error) });
    }

    return report;
}

