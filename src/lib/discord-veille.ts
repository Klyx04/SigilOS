import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { createSystemAuditLog } from "@/lib/dofensive-sync";
import {
    parseDiscordChangelog,
    isBreakingEntry,
    matchChangelogKeywords,
    entrySearchText,
    entrySignature,
    type DiscordChangelogEntry,
} from "@/lib/discord-changelog";

/**
 * #223 D — VEILLE Discord automatique (mensuelle via le cron BullMQ `discord-watch`).
 *
 * Personne (humain ou IA) ne doit se souvenir de surveiller Discord : la machine le fait.
 * Chaque mois, `runDiscordVeille()` :
 *   1. ping l'API v10 (`GET /api/v10/gateway`) → Discord répond-il encore en v10 ?
 *   2. compare une empreinte SHA-256 de `docs.discord.com/llms.txt` → la doc a changé ?
 *   3. lit le changelog officiel en **markdown** (`change-log.md`) et détecte :
 *      · les entrées **`Breaking Change`** (détection **structurelle**, par tag) ;
 *      · les **mots-clés** sensibles (v11, obfuscation, webhook events) — bornés, casse-insensible ;
 *   4. gère la fenêtre « jour J 16/11/2026 » (rappel unique + checklist §10.5 du plan maître).
 *
 * **Sévérité** : une anomalie **critique** (passerelle KO, breaking change, jour J) pinge le
 * rôle God ; une simple **information** (doc modifiée, mots-clés non cassants) est *consignée*
 * en bleu **sans ping** — fin de l'alerte rouge mensuelle systématique pour la moindre
 * évolution de doc. Rien à signaler → audit God OK.
 *
 * La procédure manuelle complète reste documentée dans `sigilos-discord-resilience.md` §12.
 */

// ─── URL publiques (littérales — aucune donnée utilisateur → pas de SSRF) ─────
export const DISCORD_GATEWAY_URL = "https://discord.com/api/v10/gateway";
export const DISCORD_LLMS_URL = "https://docs.discord.com/llms.txt";
/** Changelog en **markdown** (~300 Ko, structuré) — bien préférable à la page HTML (~3 Mo). */
export const DISCORD_CHANGELOG_URL = "https://docs.discord.com/developers/change-log.md";
export const DISCORD_WATCH_UA = "DiscordBot (https://github.com/Klyx04/SigilOS, 1.0.0)";

// ─── Point dur officiel (HTTP enforcement obfuscation) ────────────────────────
export const DISCORD_DAY_J = "2026-11-16";
export const DISCORD_DAY_J_WINDOW_START = "2026-11-01";

export const DISCORD_WATCH_KEYWORDS = [
    "Breaking Change",
    "API v11",
    "Obfuscation",
    "Webhook Events",
] as const;

const LLMS_HASH_KEY = "discord:veille:llms-hash";
const LAST_KEYWORDS_KEY = "discord:veille:last-keywords";
const BREAKING_KEY = "discord:veille:breaking";
const DAY_J_REMINDED_KEY = "discord:veille:day-j-reminded";
const FETCH_TIMEOUT_MS = 15_000;
/** Le markdown du changelog fait ~300 Ko et grossit : plafond large (≈ 1,5 Mo). */
const FETCH_MAX_CHARS = 1_500_000;

export type DiscordVeilleSeverity = "critical" | "notice" | "ok";

export type DiscordVeilleReport = {
    gatewayOk: boolean;
    changelogOk: boolean;
    docsChanged: boolean;
    docsHash: string | null;
    keywordsFound: string[];
    breakingCount: number;
    newBreakingCount: number;
    dayJStatus: "before-window" | "remind" | "day" | "passed";
    /** Tout ce qui mérite une alerte (critique **puis** information) — `critical + notices`. */
    anomalies: string[];
    critical: string[];
    notices: string[];
    severity: DiscordVeilleSeverity;
    ranAt: string;
};

async function fetchText(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": DISCORD_WATCH_UA, Accept: "text/plain,text/markdown;q=0.9,text/html;q=0.8,*/*;q=0.7" },
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
        // Doc injoignable : on ne marque PAS "changé" (pas de faux positif réseau).
        return { hash: previous, changed: false };
    }
    const hash = createHash("sha256").update(content).digest("hex");
    return { hash, changed: previous !== null && previous !== hash };
}

/** Lit un tableau JSON stocké dans Redis ; `null` si absent ou illisible. */
async function readJsonArray(key: string): Promise<string[] | null> {
    const raw = await redis.get(key).catch(() => null);
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch {
        return null;
    }
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

function dayJLabel(status: DiscordVeilleReport["dayJStatus"]): string {
    switch (status) {
        case "before-window": return "avant fenêtre";
        case "remind": return "fenêtre ouverte";
        case "day": return "jour J";
        case "passed": return "passé";
    }
}

export async function runDiscordVeille(): Promise<DiscordVeilleReport> {
    const ranAt = new Date().toISOString();

    const gatewayOk = await checkGateway();
    const { hash, changed } = await fetchDocsHash();

    // ─── Changelog : on lit la source MARKDOWN structurée (~300 Ko, jamais tronquée à 150 Ko).
    const changelogMd = await fetchText(DISCORD_CHANGELOG_URL);
    const changelogOk = changelogMd !== null;
    const entries: DiscordChangelogEntry[] = changelogOk ? parseDiscordChangelog(changelogMd) : [];

    // ─── Breaking changes : détection STRUCTURELLE (tag « Breaking Change »), dédupliquée.
    const breakingEntries = entries.filter(isBreakingEntry);
    const breakingSigs = breakingEntries.map(entrySignature);
    const prevBreaking = await readJsonArray(BREAKING_KEY);
    const newBreaking = (prevBreaking === null
        ? breakingEntries
        : breakingEntries.filter((e) => !prevBreaking.includes(entrySignature(e)))
    ).slice(0, 3);

    // ─── Mots-clés (garde-fou complémentaire) : bornés, casse-insensible, dédupliqués.
    const matchedKeywords = Array.from(
        new Set(entries.flatMap((e) => matchChangelogKeywords(entrySearchText(e), DISCORD_WATCH_KEYWORDS))),
    );
    const prevKeywords = await readJsonArray(LAST_KEYWORDS_KEY);
    const newKeywords = prevKeywords === null
        ? matchedKeywords
        : matchedKeywords.filter((kw) => !prevKeywords.includes(kw));

    const dayJ = dayJStatus();

    // ─── Anomalies (critiques → ping) vs informations (bleu, sans ping) ──────────
    const critical: string[] = [];
    const notices: string[] = [];

    if (!gatewayOk) {
        critical.push("L'API Discord v10 ne répond pas (GET /api/v10/gateway) — à vérifier.");
    }
    if (newBreaking.length > 0) {
        const list = newBreaking.map((e) => `${e.iso ?? e.label} · ${e.title}`).join(" ; ");
        critical.push(`Breaking change(s) annoncée(s) par Discord — ${list}.`);
    }
    if (!changelogOk) {
        notices.push("Changelog Discord illisible (source indisponible) — veille partielle, à relire.");
    }
    if (changed) {
        notices.push("docs.discord.com/llms.txt a changé depuis la dernière veille — relire le snapshot §2-6.");
    }
    if (newKeywords.length > 0) {
        notices.push(`Changelog Discord : ${prevKeywords === null ? "mots-clés détectés" : "nouveaux mots-clés"} — ${newKeywords.join(", ")}.`);
    }

    // Rappel UNIQUE dans la fenêtre avant le jour J.
    if (dayJ === "remind") {
        const reminded = await redis.get(DAY_J_REMINDED_KEY).catch(() => null);
        if (!reminded) {
            critical.push("Le point dur HTTP Discord (16/11/2026) approche — préparer la checklist jour J (plan maître §10.5).");
            await redis.set(DAY_J_REMINDED_KEY, "1", "EX", 60 * 60 * 24 * 60).catch(() => {});
        }
    }
    if (dayJ === "day" || dayJ === "passed") {
        critical.push("Jour J 16/11/2026 atteint — vérifier bot connecté + notifications + salons privés (checklist §10.5).");
    }

    // Persistance des baselines (après calcul réussi uniquement).
    if (changelogOk) await redis.set(BREAKING_KEY, JSON.stringify(breakingSigs)).catch(() => {});
    await redis.set(LAST_KEYWORDS_KEY, JSON.stringify(matchedKeywords)).catch(() => {});
    if (hash) await redis.set(LLMS_HASH_KEY, hash).catch(() => {});

    const anomalies = [...critical, ...notices];
    const severity: DiscordVeilleSeverity =
        critical.length > 0 ? "critical" : notices.length > 0 ? "notice" : "ok";

    const report: DiscordVeilleReport = {
        gatewayOk,
        changelogOk,
        docsChanged: changed,
        docsHash: hash,
        keywordsFound: matchedKeywords,
        breakingCount: breakingEntries.length,
        newBreakingCount: newBreaking.length,
        dayJStatus: dayJ,
        anomalies,
        critical,
        notices,
        severity,
        ranAt,
    };

    if (severity !== "ok") {
        const isCritical = severity === "critical";
        if (isCritical) {
            logger.warn("[DiscordVeille] Anomalies critiques détectées:", { anomalies: critical });
        } else {
            logger.info("[DiscordVeille] Informations de veille:", { notices });
        }
        try {
            const { notifyGod } = await import("@/server/actions/god-notif-actions");
            await notifyGod({
                title: isCritical ? "🔭 Veille Discord : anomalies" : "🔭 Veille Discord : mises à jour",
                message: anomalies.join("\n"),
                type: "SYSTEM",
                success: !isCritical, // bleu pour une info, rouge pour une anomalie
                ping: isCritical, // on ne pingue QUE le critique — fin du bruit mensuel
                metadata: {
                    gatewayOk,
                    changelogOk,
                    docsChanged: changed,
                    breaking: breakingEntries.length,
                    newBreaking: newBreaking.length,
                    keywords: newKeywords.join(","),
                    dayJStatus: dayJ,
                },
                fields: [
                    { name: "Passerelle API v10", value: gatewayOk ? "OK" : "KO", inline: true },
                    { name: "Changelog lu", value: changelogOk ? "oui" : "non", inline: true },
                    { name: "Breaking (nouveaux)", value: newBreaking.length > 0 ? String(newBreaking.length) : "—", inline: true },
                    { name: "Doc (llms.txt)", value: changed ? "modifiée" : "inchangée", inline: true },
                    { name: "Jour J 16/11", value: dayJLabel(dayJ), inline: true },
                    { name: "Mots-clés (nouveaux)", value: newKeywords.length > 0 ? newKeywords.join(", ") : "—", inline: false },
                ],
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
            changelogOk,
            docsChanged: changed,
            breakingCount: breakingEntries.length,
            newBreakingCount: newBreaking.length,
            keywordsFound: matchedKeywords.join(", "),
            dayJStatus: dayJ,
            severity,
            anomaliesCount: anomalies.length,
        });
    } catch (error) {
        logger.warn("[DiscordVeille] createSystemAuditLog échoué:", { error: String(error) });
    }

    return report;
}
