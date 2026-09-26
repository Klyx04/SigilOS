#!/usr/bin/env node
/**
 * Synchronise les pictos Dofus du catalogue en **emojis d'application** Discord.
 *
 * Pourquoi : un embed ne peut afficher une image que dans 4 emplacements ; partout
 * ailleurs (noms de fields, boutons), un picto ne peut être qu'un emoji custom
 * porté par l'application. Les ids étant propres à chaque application (bêta ≠ prod),
 * le code résout les emojis **par nom** (`src/server/discord-app-emojis.ts`), et ce
 * script crée simplement les manquants.
 *
 * Usage (depuis la racine du projet) :
 *   npx -y tsx scripts/sync-discord-app-emojis.ts                     # DRY RUN (défaut)
 *   npx -y tsx scripts/sync-discord-app-emojis.ts --apply             # crée les manquants
 *   npx -y tsx scripts/sync-discord-app-emojis.ts --env=.env.prod --apply   # autre environnement
 *
 * `--env=<fichier>` évite de manipuler un token à la main (chaque environnement a
 * son application Discord = son token) : le fichier reste sur le disque, rien à coller.
 *
 * Sécurité :
 *  · rien n'est jamais supprimé ni modifié — seuls des emojis MANQUANTS sont créés ;
 *  · les fichiers > 256 Kio et les noms non conformes sont refusés (planificateur
 *    pur `src/lib/discord-app-emoji-plan.ts`) : le reste du lot part quand même ;
 *  · idempotent : relancer ne recrée rien.
 *
 * Variables : `AUTH_DISCORD_ID` (ou `DISCORD_APPLICATION_ID` / `DISCORD_CLIENT_ID`)
 * et `DISCORD_BOT_TOKEN` — lues depuis `.env` si présent.
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

import { planAppEmojiSync } from "../src/lib/discord-app-emoji-plan";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
try {
    // Node ≥ 20.12 : charge le fichier d'env demandé (`.env` par défaut) sans dépendance.
    (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(envArg ? envArg.slice("--env=".length) : ".env");
} catch {
    /* déjà chargé, ou fichier absent : on lit l'environnement tel quel */
}

const apply = args.includes("--apply");

const API = "https://discord.com/api/v10";
const USER_AGENT = "DiscordBot (https://github.com/Klyx04/SigilOS, 1.0.0)";
const appId = (process.env.AUTH_DISCORD_ID || process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID || "").replace(/\D/g, "");
const token = process.env.DISCORD_BOT_TOKEN || "";

if (!appId || appId.length < 17) {
    console.error("❌ Id d'application introuvable (AUTH_DISCORD_ID / DISCORD_APPLICATION_ID / DISCORD_CLIENT_ID).");
    process.exit(1);
}
if (token.length < 20) {
    console.error("❌ DISCORD_BOT_TOKEN manquant.");
    process.exit(1);
}

const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json", "User-Agent": USER_AGENT };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function listExistingNames(): Promise<string[]> {
    const res = await fetch(`${API}/applications/${appId}/emojis`, { headers });
    if (!res.ok) throw new Error(`listing des emojis impossible (${res.status})`);
    const body = (await res.json()) as { items?: { name?: string | null }[] };
    return (body.items ?? []).map((i) => i.name).filter((n): n is string => !!n);
}

async function createEmoji(name: string, dataUri: string): Promise<{ ok: boolean; detail?: string }> {
    // Les routes emoji sont limitées par application : on retente une fois sur 429.
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`${API}/applications/${appId}/emojis`, {
            method: "POST",
            headers,
            body: JSON.stringify({ name, image: dataUri }),
        });
        if (res.ok) return { ok: true };
        if (res.status === 429 && attempt === 0) {
            const retryAfter = Number(res.headers.get("retry-after") ?? 2);
            console.warn(`   ⏳ limite atteinte, nouvelle tentative dans ${retryAfter}s`);
            await sleep(Math.max(1, retryAfter) * 1000);
            continue;
        }
        const detail = (await res.text()).slice(0, 200);
        return { ok: false, detail: `${res.status} ${detail}` };
    }
    return { ok: false, detail: "429 persistant" };
}

async function main() {
    const fileSize = (file: string): number | null => {
        const abs = path.join(process.cwd(), "public", file);
        if (!existsSync(abs)) return null;
        return statSync(abs).size;
    };

    console.log(`\n🧩 Synchro des emojis d'application (application ${appId})`);
    const existing = await listExistingNames();
    const plan = planAppEmojiSync(existing, fileSize);

    console.log(`   déjà présents : ${plan.alreadyThere.length}`);
    console.log(`   à créer       : ${plan.toCreate.length}`);
    if (plan.rejected.length > 0) {
        console.log(`   ⚠️  refusés    : ${plan.rejected.length}`);
        for (const r of plan.rejected) console.log(`      · ${r.entry.name} → ${r.reason}`);
    }

    if (!apply) {
        console.log("\nℹ️  Mode DRY RUN : rien n'a été envoyé. Relance avec --apply pour créer les manquants.\n");
        return;
    }

    let created = 0;
    let failed = 0;
    for (const entry of plan.toCreate) {
        const abs = path.join(process.cwd(), "public", entry.file);
        const dataUri = `data:image/png;base64,${readFileSync(abs).toString("base64")}`;
        const res = await createEmoji(entry.name, dataUri);
        if (res.ok) {
            created++;
            console.log(`   ✅ ${entry.name}`);
        } else {
            failed++;
            console.error(`   ❌ ${entry.name} → ${res.detail}`);
        }
        await sleep(300); // marge anti-429 sur les routes emoji
    }

    console.log(`\n📊 Terminé : ${created} créé(s), ${plan.alreadyThere.length} déjà présent(s), ${plan.rejected.length} refusé(s), ${failed} échec(s).`);
    console.log("   Les embeds utilisent les emojis dès le prochain envoi (cache mémoire 10 min).\n");
    if (failed > 0) process.exit(1);
}

main().catch((err) => {
    console.error("❌ Synchro interrompue :", err instanceof Error ? err.message : err);
    process.exit(1);
});
