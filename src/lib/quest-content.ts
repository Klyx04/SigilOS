/**
 * 📜 **Contenu canonique d'une quête** — le résumé qui permet de dire « *ce qui* a changé »
 * dans une quête (étape, objectif, récompense), sans stocker le payload DofusDB brut.
 *
 * ⚠️ **Pourquoi un résumé et pas le payload** (mesuré le 24/09/2026 sur `/quests/18`) : une quête
 * pèse ≈ **10 Ko** en JSON **multilingue** (5 langues par texte) ⇒ les 1976 quêtes feraient ≈ 20 Mo.
 * Le résumé ne garde que le **français**, tronqué à `QUEST_TEXT_MAX_CHARS`, et 3 nombres pour les
 * récompenses ⇒ ≈ 1-3 Mo au total (demande user : « faut pas remplir le VPS à l'infini »).
 *
 * Module **PUR** (aucun IO) : testable sans réseau, et utilisable par le comparateur comme par le
 * siphon (`syncQuestDeltasCore`).
 */

import { createHash } from "node:crypto";

/** Texte d'objectif conservé au maximum (les dialogues DofusDB font parfois 1 000+ caractères). */
export const QUEST_TEXT_MAX_CHARS = 400;
/** Version de FORME du résumé : un changement de forme ne doit pas passer pour un changement de jeu. */
export const QUEST_CONTENT_VERSION = 1;

export interface QuestContentObjective {
    id: number;
    /** `className` DofusDB (« QuestObjectiveFightMonsterData ») — lisible et stable. */
    type: string;
    text: string;
    mapId: number;
}

export interface QuestContentStep {
    id: number;
    name: string;
    objectives: QuestContentObjective[];
    /** Récompenses : seulement ce qui est comparable (les listes d'objets sont des id). */
    rewards: { kamasRatio: number; experienceRatio: number; itemIds: number[] };
}

export interface QuestContentDigest {
    version: number;
    steps: QuestContentStep[];
}

/** Localise en français (DofusDB : `{ fr, en, de, es, pt }`) — repli sur la 1ʳᵉ langue dispo. */
function frText(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const raw = obj.fr ?? obj.en ?? Object.values(obj)[0];
        return typeof raw === "string" ? raw.trim() : "";
    }
    return "";
}

function bound(text: string): string {
    return text.length > QUEST_TEXT_MAX_CHARS ? `${text.slice(0, QUEST_TEXT_MAX_CHARS)}…` : text;
}

/** 🧮 Résumé canonique d'une quête DofusDB (`/quests/{id}`) — **FR**, borné, déterministe. */
export function buildQuestContentDigest(remote: unknown): QuestContentDigest {
    const quest = (remote ?? {}) as Record<string, unknown>;
    const rawSteps = Array.isArray(quest.steps) ? (quest.steps as Record<string, unknown>[]) : [];

    const steps: QuestContentStep[] = rawSteps.map((step) => {
        const objectives = (Array.isArray(step.objectives) ? (step.objectives as Record<string, unknown>[]) : [])
            .map((objective) => ({
                id: Number(objective.id ?? 0),
                type: String(objective.className ?? "QuestObjectiveData"),
                text: bound(frText(objective.text)),
                mapId: Number(objective.mapId ?? 0),
            }))
            .filter((objective) => Number.isFinite(objective.id))
            .sort((a, b) => a.id - b.id);

        const rewards = (Array.isArray(step.rewards) ? (step.rewards as Record<string, unknown>[]) : [])[0] ?? {};
        const itemIds = (Array.isArray(rewards.itemsRewardIds) ? (rewards.itemsRewardIds as unknown[]) : [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
            .sort((a, b) => a - b);

        return {
            id: Number(step.id ?? 0),
            name: bound(frText(step.name)),
            objectives,
            rewards: {
                kamasRatio: Number(rewards.kamasRatio ?? 0),
                experienceRatio: Number(rewards.experienceRatio ?? 0),
                itemIds,
            },
        };
    });

    steps.sort((a, b) => a.id - b.id);
    return { version: QUEST_CONTENT_VERSION, steps };
}

/** Empreinte du résumé — comparaison bon marché (`contentHash` en base) et journal lisible. */
export function questContentHash(digest: QuestContentDigest): string {
    return createHash("md5").update(JSON.stringify(digest)).digest("hex");
}

/** Nombre total d'objectifs (affichage honnête : « 3 étapes · 7 objectifs »). */
export function countQuestObjectives(digest: QuestContentDigest | null | undefined): number {
    if (!digest) return 0;
    return digest.steps.reduce((total, step) => total + step.objectives.length, 0);
}

/** Lit un résumé stocké (`Json` Prisma) sans jamais lever : `null` si absent/illisible/ancien. */
export function readQuestContentDigest(value: unknown): QuestContentDigest | null {
    if (!value || typeof value !== "object") return null;
    const digest = value as Partial<QuestContentDigest>;
    if (digest.version !== QUEST_CONTENT_VERSION || !Array.isArray(digest.steps)) return null;
    return digest as QuestContentDigest;
}
