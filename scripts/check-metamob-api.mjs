#!/usr/bin/env node
/**
 * Contrôle mensuel de l'API Metamob — **GET seulement**, 60 requêtes/minute maximum.
 *
 * Usage :
 *   $env:METAMOB_API_KEY = "..."   # PowerShell (obligatoire : l'API exige une clé partout)
 *   node scripts/check-metamob-api.mjs
 *
 * Sans clé, le script s'arrête avec un message clair : aucune route n'est devinée.
 * Le script ne journalise jamais la clé (elle ne vit que dans l'en-tête Authorization).
 * Pas de hook : un contrôle mensuel suffit (voir `docs/reference/METAMOB-API.md` §6).
 */

const BASE = "https://www.metamob.fr/api";
const KEY = (process.env.METAMOB_API_KEY || "").trim();
const TIMEOUT_MS = 15_000;
const DELAY_MS = 1_100; // 60 requêtes/minute

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path, { auth = true } = {}) {
    const headers = { Accept: "application/json" };
    if (auth && KEY) headers.Authorization = `Bearer ${KEY}`;
    const response = await fetch(`${BASE}${path}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`réponse non JSON (HTTP ${response.status})`);
    }
    if (!response.ok) {
        const message = json?.messages?.error || `HTTP ${response.status}`;
        throw new Error(`${response.status} — ${message}`);
    }
    return json;
}

function record(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`${ok ? "✓" : "⚠"} ${name} — ${detail}`);
}

async function check(name, fn) {
    try {
        record(name, true, await fn());
    } catch (error) {
        record(name, false, error instanceof Error ? error.message : String(error));
    }
    await sleep(DELAY_MS);
}

async function main() {
    console.log(`Metamob API — contrôle du ${new Date().toISOString().slice(0, 10)}`);
    if (!KEY) {
        console.error(
            "⚠ METAMOB_API_KEY absente : l'API Metamob exige une clé sur toutes les routes."
        );
        process.exitCode = 1;
        return;
    }
    console.log("Clé fournie : contrôle complet.");

    await check("/v1/quest-types", async () => {
        const json = await get("/v1/quest-types");
        if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
        return `${json.data.length} types`;
    });

    await check("/v1/monster-types", async () => {
        const json = await get("/v1/monster-types");
        if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
        return `${json.data.length} types`;
    });

    await check("/v1/servers", async () => {
        const json = await get("/v1/servers");
        if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
        return `${json.data.length} serveurs`;
    });

    let me = null;
    await check("/v1/me", async () => {
        const json = await get("/v1/me", { auth: true });
        if (typeof json.data?.username !== "string") throw new Error("username absent");
        me = json.data.username;
        return "compte identifié";
    });

    let quests = [];
    await check("/v1/quests", async () => {
        const json = await get("/v1/quests", { auth: true });
        if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
        quests = json.data;
        return `${quests.length} quêtes`;
    });

    const ocre = quests.find(
        (quest) =>
            quest.quest_template?.quest_type?.slug === "ocre" ||
            (quest.quest_template?.monster_count ?? 0) > 200
    );
    if (!ocre) {
        console.log("• aucune quête Ocre détectée : contrôle des matches ignoré.");
    } else {
        await check(`/v1/quests/{slug}/matches (${ocre.slug})`, async () => {
            const json = await get(
                `/v1/quests/${encodeURIComponent(ocre.slug)}/matches?limit=1`,
                { auth: true }
            );
            if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
            if (!json.pagination || typeof json.pagination.total !== "number") {
                throw new Error("pagination.total absent");
            }
            const first = json.data[0];
            if (first) {
                if (typeof first.user?.username !== "string") {
                    throw new Error("user.username absent");
                }
                if (
                    !first.matches ||
                    !Array.isArray(first.matches.they_have_you_want) ||
                    !Array.isArray(first.matches.you_have_they_want)
                ) {
                    throw new Error("matches.they_have_you_want / you_have_they_want absents");
                }
                if (typeof first.match_score !== "number") {
                    throw new Error("match_score absent");
                }
            }
            return `${json.pagination.total} partenaires (${json.data.length} lus)`;
        });
    }

    if (me) {
        await check(`/v1/users/{username}/quests (${me})`, async () => {
            const json = await get(`/v1/users/${encodeURIComponent(me)}/quests`);
            if (!Array.isArray(json.data)) throw new Error("data n'est pas un tableau");
            return `${json.data.length} quêtes publiques`;
        });
    }
}

main()
    .catch((error) => {
        console.error(
            "⚠ Contrôle interrompu :",
            error instanceof Error ? error.message : String(error)
        );
        process.exitCode = 1;
    })
    .finally(() => {
        const failed = results.filter((result) => !result.ok);
        console.log(`\n${results.length - failed.length}/${results.length} contrôles OK.`);
        if (failed.length > 0) process.exitCode = 1;
    });
