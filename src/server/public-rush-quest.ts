/**
 * Lecture **publique** d'une quête Rush par son slug (bloc B, 12/11/2026).
 *
 * 🎯 Une seule requête par slug, dédupliquée entre `generateMetadata` et la page
 * (`cache` de React). Aucune donnée privée : pas de progression, pas de compte,
 * pas de `guildId`. La page ne lit que ce que le guide public montre déjà.
 *
 * Fail-closed : une quête non publiée, sans slug, ou appartenant à un autre guide
 * renvoie `null` (la page répond 404). Le drapeau `isPublicUnderConstruction` est
 * remonté pour que la page et les métadonnées puissent poser `noindex`.
 */

import { cache } from "react";
import { db } from "@/lib/prisma";
import { parseRushQuestConstraints } from "@/lib/rush-constraints-schema";
import type { RushQuestConstraints } from "@/types/rush-constraints";

export type PublicRushQuestResource = { name: string; quantity: number };

export type PublicRushQuestDungeon = {
  id: string;
  name: string;
  bossName: string;
  level: number;
};

export type PublicRushQuestNeighbour = { slug: string; name: string };

export type PublicRushQuest = {
  id: string;
  slug: string;
  name: string;
  tips: string | null;
  note: string | null;
  chapterLabel: string;
  blockTitle: string;
  blockId: string;
  accentColor: string | null;
  alignReq: string | null;
  alignOrderCode: string | null;
  alignLevelReq: number | null;
  classReq: string | null;
  constraints: RushQuestConstraints | null;
  resources: PublicRushQuestResource[];
  dungeons: PublicRushQuestDungeon[];
  prev: PublicRushQuestNeighbour | null;
  next: PublicRushQuestNeighbour | null;
  guideUnderConstruction: boolean;
};

/** Les ressources sont des tags `item` (nom + quantité), jamais un dump brut. */
function resourcesOf(value: unknown): PublicRushQuestResource[] {
  if (!Array.isArray(value)) return [];
  const out: PublicRushQuestResource[] = [];
  for (const tag of value) {
    if (!tag || typeof tag !== "object") continue;
    const row = tag as { type?: unknown; name?: unknown; quantity?: unknown; count?: unknown };
    if (row.type !== "item") continue;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const raw =
      typeof row.quantity === "number"
        ? row.quantity
        : typeof row.count === "number"
          ? row.count
          : 1;
    out.push({ name, quantity: Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1 });
  }
  return out;
}

export const getPublicRushQuest = cache(async (slug: string): Promise<PublicRushQuest | null> => {
  if (!slug || slug.length > 100) return null;

  const sequence = await db.guideSequence.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      publicSlug: true,
      isPublished: true,
      subGuideName: true,
      tips: true,
      note: true,
      alignReq: true,
      alignOrderCode: true,
      alignLevelReq: true,
      classReq: true,
      constraints: true,
      activityTags: true,
      dungeonIds: true,
      milestoneId: true,
      milestone: {
        select: {
          id: true,
          title: true,
          chapterLabel: true,
          accentColor: true,
          guide: { select: { slug: true, isPublicUnderConstruction: true } },
        },
      },
    },
  });

  if (!sequence || !sequence.isPublished) return null;
  if (sequence.milestone.guide.slug !== "rush-sylvestre") return null;

  const siblings = await db.guideSequence.findMany({
    where: {
      milestoneId: sequence.milestoneId,
      isPublished: true,
      publicSlug: { not: null },
    },
    orderBy: { order: "asc" },
    select: { id: true, publicSlug: true, subGuideName: true },
  });
  const index = siblings.findIndex((row) => row.id === sequence.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  const dungeons =
    sequence.dungeonIds.length > 0
      ? await db.dungeon.findMany({
          where: { id: { in: sequence.dungeonIds } },
          select: { id: true, name: true, bossName: true, level: true },
        })
      : [];

  return {
    id: sequence.id,
    slug: sequence.publicSlug as string,
    name: sequence.subGuideName,
    tips: sequence.tips ?? null,
    note: sequence.note ?? null,
    chapterLabel: sequence.milestone.chapterLabel,
    blockTitle: sequence.milestone.title,
    blockId: sequence.milestone.id,
    accentColor: sequence.milestone.accentColor ?? null,
    alignReq: sequence.alignReq ?? null,
    alignOrderCode: sequence.alignOrderCode ?? null,
    alignLevelReq: sequence.alignLevelReq ?? null,
    classReq: sequence.classReq ?? null,
    constraints: parseRushQuestConstraints(sequence.constraints),
    resources: resourcesOf(sequence.activityTags),
    dungeons,
    prev: prev ? { slug: prev.publicSlug as string, name: prev.subGuideName } : null,
    next: next ? { slug: next.publicSlug as string, name: next.subGuideName } : null,
    guideUnderConstruction: sequence.milestone.guide.isPublicUnderConstruction,
  };
});
