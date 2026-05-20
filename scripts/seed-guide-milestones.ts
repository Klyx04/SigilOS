/**
 * Seed — Guide Optimisé : Arbre de Progression
 * Peupler les milestones (Dofus, Zones, Alignement...)
 * et leurs séquences ordonnées pour atteindre chaque objectif.
 *
 * Usage : npx ts-node --project tsconfig.seed.json scripts/seed-guide-milestones.ts
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import type { GuideMilestoneType } from "@prisma/client";

const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const getConnectionString = () => {
    if (process.env.DATABASE_URL) {
        return cleanEnv(process.env.DATABASE_URL);
    }
    const user = cleanEnv(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = cleanEnv(process.env.POSTGRES_PASSWORD);
    const db_name = cleanEnv(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || 'localhost';
    const protocol = 'postgresql';
    return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`;
};

const connectionString = getConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const db = new PrismaClient({ adapter } as any);

const GUIDE_SLUG = "progression-complete";

async function main() {
    console.log("🌱 Seeding Guide Optimisé — Arbre de Progression...");

    // 1. Récupérer ou créer le guide parent
    const guide = await db.optimizedGuide.upsert({
        where: { slug: GUIDE_SLUG },
        create: {
            slug: GUIDE_SLUG,
            name: "Guide de Progression Complet",
            description: "L'ordre optimal pour progresser dans le jeu du début à la fin.",
            isActive: true,
        },
        update: {
            isActive: true,
        },
    });

    console.log(`✅ Guide: ${guide.name} (${guide.id})`);

    // 2. Supprimer les milestones existants pour reseed propre
    await db.guideMilestone.deleteMany({ where: { guideId: guide.id } });
    console.log("🧹 Milestones existants supprimés");

    // 3. Définition des milestones
    const milestones: Array<{
        type: GuideMilestoneType;
        title: string;
        subtitle?: string;
        description?: string;
        chapter: number;
        chapterLabel: string;
        imageUrl?: string;
        accentColor: string;
        posX: number;
        posY: number;
        isOptional: boolean;
        order: number;
        sequences: Array<{
            order: number;
            subGuideRef: string;
            subGuideName: string;
            stepFrom?: number;
            stepTo?: number;
            isPartial: boolean;
            isOptional: boolean;
            isResume: boolean;
            note?: string;
            dungeonDbIds: number[];
            questDbIds: number[];
            mapPositions: Array<{ x: number; y: number; label: string }>;
        }>;
    }> = [
        // ─── CHAPITRE 1 : Premiers Pas ────────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Argenté",
            subtitle: "Compléter Incarnam & Astrub",
            description:
                "Premier Dofus obtenu en complétant la progression d'Incarnam et Astrub. Nécessite des allers-retours entre plusieurs zones.",
            chapter: 1,
            chapterLabel: "Chapitre 1 — Premiers Pas",
            imageUrl: "https://api.dofusdb.fr/img/items/23025.png",
            accentColor: "#C0C0C0",
            posX: 400,
            posY: 100,
            isOptional: false,
            order: 10,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP1",
                    subGuideName: "Incarnam & Astrub",
                    stepFrom: 1,
                    stepTo: 25,
                    isPartial: true,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [90], // Crypte de Kardorim
                    questDbIds: [],
                    mapPositions: [{ x: 4, y: -3, label: "Portail vers Astrub" }],
                },
                {
                    order: 2,
                    subGuideRef: "GP2",
                    subGuideName: "Krosmoz",
                    stepFrom: 1,
                    stepTo: 8,
                    isPartial: true,
                    isOptional: false,
                    isResume: false,
                    note: "À faire quand tu as le Zaap Plaine des Porkass",
                    dungeonDbIds: [],
                    questDbIds: [953], // L'Almanax du Mage Ax
                    mapPositions: [{ x: -5, y: -23, label: "Zaap Plaine des Porkass" }],
                },
                {
                    order: 3,
                    subGuideRef: "GP1",
                    subGuideName: "Incarnam & Astrub",
                    stepFrom: 25,
                    stepTo: 58,
                    isPartial: true,
                    isOptional: false,
                    isResume: true,
                    note: "⚠️ NE PAS cliquer sur le Portail vers Astrub à l'étape 25 !",
                    dungeonDbIds: [47], // Donjon des Squelettes
                    questDbIds: [],
                    mapPositions: [{ x: 10, y: 15, label: "Donjon des Squelettes" }],
                },
                {
                    order: 4,
                    subGuideRef: "GP59",
                    subGuideName: "La Fratrie des Oubliés",
                    stepFrom: 4,
                    stepTo: 6,
                    isPartial: true,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
                {
                    order: 5,
                    subGuideRef: "GP1",
                    subGuideName: "Incarnam & Astrub",
                    stepFrom: 58,
                    stepTo: 232,
                    isPartial: false,
                    isOptional: false,
                    isResume: true,
                    note: "Sprint final — lancer la quête Aventure miniature à l'étape 232",
                    dungeonDbIds: [19, 48, 45], // Château Ensablé, Donjon des Tofus, Scarafeuilles
                    questDbIds: [1607], // Aventure miniature
                    mapPositions: [],
                },
            ],
        },

        // ─── Prérequis Dofus ──────────────────────────────────────────────────
        {
            type: "PREREQUIS",
            title: "Prérequis des Dofus",
            subtitle: "Débloquer Pandala & Île des Wabbits",
            description:
                "Série de quêtes préparatoire aux Dofus Primordiaux. Donne accès à Pandala et l'Île des Wabbits.",
            chapter: 1,
            chapterLabel: "Chapitre 1 — Premiers Pas",
            imageUrl: undefined,
            accentColor: "#6B7280",
            posX: 600,
            posY: 100,
            isOptional: false,
            order: 20,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP4",
                    subGuideName: "Mais où sont les Dofus ?",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    note: "Si le combat contre le Feu prophétique (étape 13) est trop difficile, revenir plus tard.",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 2 : Le Monde s'Ouvre ───────────────────────────────────
        {
            type: "ALIGNEMENT",
            title: "Alignement",
            subtitle: "Choisir Bonta ou Brâkmar",
            description:
                "Choisir sa cité d'alignement et commencer la série de 105 quêtes qui prépare le Dofus Ivoire.",
            chapter: 2,
            chapterLabel: "Chapitre 2 — Le Monde s'Ouvre",
            imageUrl: undefined,
            accentColor: "#3B82F6",
            posX: 200,
            posY: 280,
            isOptional: false,
            order: 30,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP9-BONTA",
                    subGuideName: "Alignement Bontarien",
                    stepFrom: 1,
                    stepTo: 6,
                    isPartial: true,
                    isOptional: false,
                    isResume: false,
                    note: "Choisir Bonta OU Brâkmar — pas de vraie différence. Suivre le guide correspondant.",
                    dungeonDbIds: [47, 48, 34, 21], // Squelettes, Tofus, Maison Fantôme, Forgerons
                    questDbIds: [82, 83, 153], // Le maître des clefs, Les sbires, etc.
                    mapPositions: [{ x: -6, y: -37, label: "Maître des Clefs" }],
                },
            ],
        },

        {
            type: "DOFUS",
            title: "Dofus Émeraude",
            subtitle: "Sufokia, Tour du Monde et Alignement",
            description:
                "Dofus nécessitant un métier niveau 50 (Paysan ou Alchimiste). À commencer en parallèle de l'alignement.",
            chapter: 2,
            chapterLabel: "Chapitre 2 — Le Monde s'Ouvre",
            imageUrl: "https://api.dofusdb.fr/img/items/23015.png",
            accentColor: "#10B981",
            posX: 400,
            posY: 280,
            isOptional: false,
            order: 40,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP5",
                    subGuideName: "Sufokia",
                    stepFrom: 1,
                    stepTo: 23,
                    isPartial: true,
                    isOptional: true,
                    isResume: false,
                    dungeonDbIds: [45, 138, 21], // Scarafeuilles, Gobs, Forgerons
                    questDbIds: [],
                    mapPositions: [],
                },
                {
                    order: 2,
                    subGuideRef: "GP19",
                    subGuideName: "Dofus Émeraude",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    note: "Nécessite un métier niveau 50 — anticiper dès le chapitre 1",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 3 : L'Ocre ─────────────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Ocre",
            subtitle: "Donjons, captures et Tour du Monde",
            description:
                "Dofus emblématique obtenu en capturant les bosses de nombreux donjons. Mécanisme de capture d'âme.",
            chapter: 3,
            chapterLabel: "Chapitre 3 — L'Ocre",
            imageUrl: "https://api.dofusdb.fr/img/items/23012.png",
            accentColor: "#F59E0B",
            posX: 400,
            posY: 460,
            isOptional: false,
            order: 50,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP7",
                    subGuideName: "Ocre d'Ambre",
                    stepFrom: 1,
                    stepTo: 6,
                    isPartial: true,
                    isOptional: false,
                    isResume: false,
                    note: "Lire l'astuce à l'étape 6 pour l'ordre des dialogues",
                    dungeonDbIds: [138, 13, 33, 21, 32, 45, 48, 47], // Gobs, Bworks, Larves, etc.
                    questDbIds: [153, 439], // Le maître des clefs, L'éternelle moisson
                    mapPositions: [{ x: 5, y: 0, label: "Pat Akess" }],
                },
                {
                    order: 2,
                    subGuideRef: "GP8",
                    subGuideName: "Dofus Ocre",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    note: "100 captures de bosses requises. Sort Capture d'Âme indispensable.",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 4 : Les Îles ────────────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Cawotte",
            subtitle: "Île de Moon & Wabbits",
            chapter: 4,
            chapterLabel: "Chapitre 4 — Les Îles",
            imageUrl: "https://api.dofusdb.fr/img/items/23016.png",
            accentColor: "#EC4899",
            posX: 200,
            posY: 640,
            isOptional: false,
            order: 60,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP13",
                    subGuideName: "Île de Moon & Wabbits",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        {
            type: "DOFUS",
            title: "Dofus Turquoise",
            subtitle: "Pandala",
            chapter: 4,
            chapterLabel: "Chapitre 4 — Les Îles",
            imageUrl: "https://api.dofusdb.fr/img/items/23020.png",
            accentColor: "#06B6D4",
            posX: 600,
            posY: 640,
            isOptional: false,
            order: 70,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP20",
                    subGuideName: "Dofus Turquoise",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 5 : Les Primordiaux ────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Ébène",
            chapter: 5,
            chapterLabel: "Chapitre 5 — Les Primordiaux",
            imageUrl: "https://api.dofusdb.fr/img/items/23022.png",
            accentColor: "#1F2937",
            posX: 200,
            posY: 820,
            isOptional: false,
            order: 80,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP35",
                    subGuideName: "Dofus Ébène",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        {
            type: "DOFUS",
            title: "Dofus Pourpre",
            chapter: 5,
            chapterLabel: "Chapitre 5 — Les Primordiaux",
            imageUrl: "https://api.dofusdb.fr/img/items/23021.png",
            accentColor: "#7C3AED",
            posX: 600,
            posY: 820,
            isOptional: false,
            order: 90,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP40",
                    subGuideName: "Dofus Pourpre",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 6 : Endgame ─────────────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Ivoire",
            subtitle: "105 quêtes d'alignement complétées",
            chapter: 6,
            chapterLabel: "Chapitre 6 — Endgame",
            imageUrl: "https://api.dofusdb.fr/img/items/23011.png",
            accentColor: "#F8FAFC",
            posX: 200,
            posY: 1000,
            isOptional: false,
            order: 100,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP9",
                    subGuideName: "Alignement Bontarien / Brâkmarien",
                    isPartial: false,
                    isOptional: false,
                    isResume: true,
                    note: "Finaliser les 105 quêtes d'alignement commencées au chapitre 2",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        {
            type: "DOFUS",
            title: "Dofus Abyssal",
            subtitle: "Nécessite un métier niveau 200",
            chapter: 6,
            chapterLabel: "Chapitre 6 — Endgame",
            imageUrl: "https://api.dofusdb.fr/img/items/23024.png",
            accentColor: "#1D4ED8",
            posX: 500,
            posY: 1000,
            isOptional: false,
            order: 110,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP54",
                    subGuideName: "Enutrosor 3",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    note: "Métier niveau 200 requis",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
                {
                    order: 2,
                    subGuideRef: "GP56",
                    subGuideName: "Dofus Abyssal",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        // ─── CHAPITRE 7 : Perfection ──────────────────────────────────────────
        {
            type: "DOFUS",
            title: "Dofus Vulbis",
            subtitle: "Paysan ou Alchimiste niveau 200",
            chapter: 7,
            chapterLabel: "Chapitre 7 — Perfection",
            imageUrl: "https://api.dofusdb.fr/img/items/23023.png",
            accentColor: "#FBBF24",
            posX: 400,
            posY: 1180,
            isOptional: false,
            order: 120,
            sequences: [
                {
                    order: 1,
                    subGuideRef: "GP67",
                    subGuideName: "Dofus Vulbis",
                    isPartial: false,
                    isOptional: false,
                    isResume: false,
                    note: "Requiert Paysan ou Alchimiste niveau 200",
                    dungeonDbIds: [],
                    questDbIds: [],
                    mapPositions: [],
                },
            ],
        },

        {
            type: "QUETE_SERIE",
            title: "100% Donjons",
            subtitle: "Succès de toutes les zones",
            chapter: 7,
            chapterLabel: "Chapitre 7 — Perfection",
            accentColor: "#059669",
            posX: 600,
            posY: 1180,
            isOptional: true,
            order: 130,
            sequences: [],
        },
    ];

    // 4. Insérer les milestones et leurs séquences
    for (const ms of milestones) {
        const { sequences, ...milestoneData } = ms;

        const milestone = await db.guideMilestone.create({
            data: {
                ...milestoneData,
                guideId: guide.id,
            },
        });

        // Insérer les séquences
        for (const seq of sequences) {
            const { mapPositions, ...seqData } = seq;
            await db.guideSequence.create({
                data: {
                    ...seqData,
                    milestoneId: milestone.id,
                    mapPositions: mapPositions as any,
                },
            });
        }

        console.log(
            `  ✅ Ch.${milestone.chapter} — ${milestone.title} (${sequences.length} séquences)`
        );
    }

    console.log(`\n🎉 ${milestones.length} milestones seedés avec succès !`);
}

main()
    .catch((e) => {
        console.error("❌ Erreur seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
