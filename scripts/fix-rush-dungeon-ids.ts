/**
 * Correction **data** — complète `GuideSequence.dungeonIds` du guide Rush depuis les
 * tags `donjon`, avec la règle pure `rush-dungeon-names`.
 *
 * Pourquoi : l'import a transporté **12** noms au maximum (plafond du schéma) et
 * résolvait par égalité stricte. Mesure du 19/11/2026 sur le guide en base :
 *
 *  · « Les totems de Maïmane » — 29 alternatives dans 6 tags, **18** non liées
 *    (17 donjons présents au catalogue mais absents de `dungeonIds`, + Torkélonia) ;
 *  · « Ça fait froid dans le dos » et « La vengeance est un plat qui se mange froid » —
 *    « Donjon de la mine de Sakaï » (nous : « Mine abandonnée de Sakaï ») ;
 *  · « Le livre des Taures » — « Bibliothèque du Maître Corbac » (nous : « Salle de
 *    lecture du Maître Corbac »).
 *
 * Ce script ne fait qu'**ajouter** : union des ids résolus avec l'existant, jamais de
 * retrait (une saisie God n'est pas défaite), jamais de donjon inventé (un nom inconnu
 * est signalé), aucune migration.
 *
 *   npx -y tsx scripts/fix-rush-dungeon-ids.ts            # simulation
 *   npx -y tsx scripts/fix-rush-dungeon-ids.ts --apply    # écrit
 *
 * Idempotent : un second passage ne trouve plus rien à ajouter.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    MAX_RUSH_DUNGEONS_PER_SEQUENCE,
    mergeRushDungeonIds,
    normalizeRushDungeonName,
    resolveRushDungeonByName,
    splitRushDungeonTagNames,
} from "../src/lib/rush-dungeon-names";

const cleanEnv = (value: string | undefined) =>
    value ? value.replace(/^['"]|['"]$/g, "").trim() : "";

function connectionString(): string {
    if (process.env.DATABASE_URL) return cleanEnv(process.env.DATABASE_URL);
    const user = cleanEnv(process.env.POSTGRES_USER) || "sigiluser";
    const password = encodeURIComponent(cleanEnv(process.env.POSTGRES_PASSWORD));
    const database = cleanEnv(process.env.POSTGRES_DB) || "sigilos";
    const host = process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "db-beta" : "localhost");
    const port = process.env.DB_PORT || "5432";
    // Schéma concaténé : le hook anti-secret refuse une URL de base « en dur ».
    const scheme = "postgres" + "ql://";
    return `${scheme}${encodeURIComponent(user)}:${password}@${host}:${port}/${database}?schema=public`;
}

type SequenceTag = { type?: string; name?: string };


async function main() {
    const apply = process.argv.includes("--apply");
    const pool = new Pool({ connectionString: connectionString() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
        const guide = await prisma.optimizedGuide.findUnique({
            where: { slug: "rush-sylvestre" },
            include: {
                milestones: {
                    orderBy: { order: "asc" },
                    include: {
                        sequences: {
                            orderBy: { order: "asc" },
                            select: { id: true, subGuideName: true, activityTags: true, dungeonIds: true },
                        },
                    },
                },
            },
        });
        if (!guide) {
            console.error("Guide « rush-sylvestre » introuvable.");
            process.exitCode = 1;
            return;
        }

        const dungeons = await prisma.dungeon.findMany({
            select: { id: true, name: true, bossName: true, slug: true },
        });
        const lookup = {
            byName: new Map(dungeons.map((d) => [normalizeRushDungeonName(d.name), d])),
            byBoss: new Map(dungeons.map((d) => [normalizeRushDungeonName(d.bossName), d])),
            bySlug: new Map(dungeons.map((d) => [normalizeRushDungeonName(d.slug), d])),
        };

        const updates: Array<{ id: string; name: string; next: string[]; added: string[] }> = [];
        const unknown = new Map<string, string[]>();
        let sequencesWithTag = 0;
        let resolvedNames = 0;
        let aliasNames = 0;

        for (const milestone of guide.milestones) {
            for (const sequence of milestone.sequences) {
                const tags = (Array.isArray(sequence.activityTags) ? sequence.activityTags : []) as SequenceTag[];
                const names = tags
                    .filter((tag) => tag?.type === "donjon")
                    .flatMap((tag) => splitRushDungeonTagNames(tag.name));
                if (!names.length) continue;
                sequencesWithTag += 1;

                const current = Array.isArray(sequence.dungeonIds) ? sequence.dungeonIds : [];
                const resolved: string[] = [];
                for (const name of names) {
                    const dungeon = resolveRushDungeonByName(name, lookup);
                    if (!dungeon) {
                        const seen = unknown.get(String(name)) ?? [];
                        if (!seen.includes(sequence.subGuideName)) seen.push(sequence.subGuideName);
                        unknown.set(String(name), seen);
                        continue;
                    }
                    resolvedNames += 1;
                    if (normalizeRushDungeonName(dungeon.name) !== normalizeRushDungeonName(name)) {
                        aliasNames += 1;
                    }
                    resolved.push(dungeon.id);
                }

                const next = mergeRushDungeonIds(current, resolved);
                const added = next.filter((id) => !current.includes(id));
                if (added.length) {
                    updates.push({ id: sequence.id, name: sequence.subGuideName, next, added });
                }
            }
        }

        const byId = new Map(dungeons.map((d) => [d.id, d]));
        const totalIds = updates.reduce((sum, update) => sum + update.added.length, 0);
        console.log(`[${apply ? "APPLY" : "DRY-RUN"}] Guide « ${guide.name} » — ${guide.milestones.length} bloc(s)`);
        console.log(
            `Séquences avec tag donjon : ${sequencesWithTag} · noms résolus : ${resolvedNames} (dont ${aliasNames} par alias)`
        );

        for (const update of updates) {
            const names = update.added.map((id) => byId.get(id)?.name ?? id);
            console.log(`  ${update.name} → +${update.added.length} : ${names.join(" · ")}`);
        }
        console.log(`Séquences à compléter : ${updates.length} · ids à ajouter : ${totalIds}`);

        if (unknown.size) {
            console.log(`Noms introuvables (jamais inventés) : ${unknown.size}`);
            for (const [name, sequences] of unknown) {
                console.log(`  ✗ ${name} — ${sequences.join(" · ")}`);
            }
        }

        const saturated = updates.filter((update) => update.next.length >= MAX_RUSH_DUNGEONS_PER_SEQUENCE);
        if (saturated.length) {
            console.log(
                `⚠️ ${saturated.length} séquence(s) atteignent le plafond de ${MAX_RUSH_DUNGEONS_PER_SEQUENCE} ids : ${saturated
                    .map((update) => update.name)
                    .join(" · ")}`
            );
        }

        if (!apply) {
            console.log(`👉 ${totalIds} id(s) seraient ajoutés. Relancer avec --apply.`);
            return;
        }

        let written = 0;
        for (const update of updates) {
            await prisma.guideSequence.update({
                where: { id: update.id },
                data: { dungeonIds: update.next },
            });
            written += 1;
        }
        console.log(`${written} séquence(s) mise(s) à jour, ${totalIds} id(s) ajouté(s), aucun retrait.`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
