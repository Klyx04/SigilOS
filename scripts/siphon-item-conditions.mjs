#!/usr/bin/env node
/**
 * Siphon des **conditions d'équipement structurées** (DofusDude) → `GameItem.conditions`.
 *
 * Pourquoi : le DSL DofusDB (`criterions` : `CP<12|CM<6`, `pk<2`) utilise des codes courts non
 * documentés. DofusDude expose le même contenu en **arbre** avec des noms FR (`PA`, `PM`,
 * `Sagesse`, `Bonus de panoplies`…) — c'est la source qui permet d'afficher et de **bloquer**
 * une variante sans table de codes écrite à la main (mesure du 25/10/2026 : 4 095 équipements,
 * 264 avec condition).
 *
 * Usage :
 *   node scripts/siphon-item-conditions.mjs           # dry-run (aucune écriture)
 *   node scripts/siphon-item-conditions.mjs --apply   # écrit `GameItem.conditions`
 *
 * Idempotent : ne réécrit que si l'arbre a changé (comparaison JSON).
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const API = "https://api.dofusdu.de/dofus3/v1/fr/items/equipment/all";
const PAGE_SIZE = 5000;
const APPLY = process.argv.includes("--apply");

// Prisma 7 exige un **driver adapter** (comme `src/lib/prisma.ts`), et un script Node ne
// charge pas `.env` tout seul : on lit `.env.local` puis `.env` explicitement.
for (const file of [".env.local", ".env"]) {
    try { process.loadEnvFile(file); } catch { /* fichier absent : on continue */ }
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("[conditions] DATABASE_URL absente");
    process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

async function fetchAll() {
    const items = [];
    for (let page = 1; page <= 20; page += 1) {
        const url = `${API}?page=${page}&page_size=${PAGE_SIZE}`;
        const response = await fetch(url, {
            headers: { "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)", Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`DofusDude ${response.status} sur ${url}`);
        const payload = await response.json();
        const batch = Array.isArray(payload.items) ? payload.items : [];
        if (batch.length === 0) break;
        items.push(...batch);
        if (!payload._links?.next) break;
    }
    return items;
}

/** Sérialisation **stable** (clés triées) : Postgres réordonne les clés JSONB. */
const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value ?? null);
};

const sameJson = (a, b) => stable(a) === stable(b);

async function main() {
    console.log(`[conditions] ${APPLY ? "APPLY" : "DRY-RUN"} — source ${API}`);
    const items = await fetchAll();
    const withConditions = items.filter((item) => item.conditions);
    console.log(`[conditions] ${items.length} équipements, ${withConditions.length} avec condition`);

    let updated = 0;
    let unchanged = 0;
    let missing = 0;

    for (const item of withConditions) {
        const ankamaId = Number(item.ankama_id);
        if (!Number.isInteger(ankamaId) || ankamaId <= 0) continue;

        const current = await prisma.gameItem.findUnique({
            where: { ankamaId },
            select: { id: true, conditions: true },
        });
        if (!current) {
            missing += 1;
            continue;
        }
        if (sameJson(current.conditions, item.conditions)) {
            unchanged += 1;
            continue;
        }
        updated += 1;
        if (APPLY) {
            await prisma.gameItem.update({
                where: { id: current.id },
                data: { conditions: item.conditions },
            });
        }
    }

    console.log(
        `[conditions] à écrire: ${updated} · inchangés: ${unchanged} · absents de la base: ${missing}` +
            (APPLY ? "" : " (dry-run : rien n'a été écrit)"),
    );
}

main()
    .catch((error) => {
        console.error("[conditions] échec :", error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
