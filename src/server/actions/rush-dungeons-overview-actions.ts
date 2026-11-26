"use server";

/**
 * **Bloc J — agrégat « qui a fait quel donjon »** (lecture seule).
 *
 * Deux surfaces, deux sources de vérité, aucun mélange :
 *  · **membre de guilde** : `PlayerGuideDungeonState` (coches par occurrence) et
 *    `PlayerGuideProgress.currentStep` (repère) des profils de **cette** guilde ;
 *  · **visiteur** : `PublicRushProgress` des seuls profils **consentants**
 *    (`showRushProgress`) du **même serveur** — ni `userId`, ni `publicProfileId`.
 *
 * Borné : trois requêtes plafonnées par surface, jamais une par donjon. Fail-closed :
 * une erreur rend `success: false`, jamais une liste vide qui ferait croire que
 * personne ne joue.
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getUserContext } from "./user-actions";
import { getPublicAccount } from "@/server/public-account";
import { COMMUNITY_MAX_MEMBERS } from "@/lib/rush-community-progress";
import { publicRushSlotSchema, PUBLIC_RUSH_GUIDE_ID } from "@/lib/public-rush-progress";
import type { RushOverviewMember } from "@/lib/rush-dungeons-overview";

const InternalSchema = z.object({
  guildId: z.string().trim().min(1).max(32),
  slug: z.string().trim().min(1).max(120),
  altPseudo: z.string().trim().max(60).optional(),
});

const PublicSchema = z.object({
  characterSlot: publicRushSlotSchema.optional(),
});

export type RushDungeonsCommunityResult =
  | {
      success: true;
      me: { doneKeys: string[]; flags: string[] };
      members: RushOverviewMember[];
    }
  | { success: false; error: string };

/** Clés « fait » d'un `dungeonChecks` Json (closed set, borné par le schéma). */
function doneKeysFromChecks(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "done") out.push(key.slice(0, 200));
    if (out.length >= 2_000) break;
  }
  return out;
}

/** Repères publiés : `bookmarks` est un objet `milestoneId → sequenceId`. */
function flagsFromBookmarks(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value) out.push(value.slice(0, 200));
    if (out.length >= 300) break;
  }
  return Array.from(new Set(out));
}

function memberName(name: string | null | undefined, fallback: string): string {
  const value = (name ?? "").trim();
  return value ? value.slice(0, 40) : fallback;
}

/**
 * Agrégat d'une guilde. `me` est le personnage actif du lecteur ; les `members`
 * incluent le lecteur (le compteur « n/N membres » est donc complet).
 */
export async function getRushDungeonsCommunity(
  guildId: string,
  slug: string,
  altPseudo?: string
): Promise<RushDungeonsCommunityResult> {
  const parsed = InternalSchema.safeParse({ guildId, slug, altPseudo });
  if (!parsed.success) return { success: false, error: "Paramètres invalides" };

  const ctx = await getUserContext(parsed.data.guildId);
  if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };

  const characterSlot =
    parsed.data.altPseudo && parsed.data.altPseudo !== "PRINCIPAL" ? parsed.data.altPseudo : "PRINCIPAL";

  try {
    const guide = await db.optimizedGuide.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (!guide) return { success: false, error: "Guide introuvable" };

    const [myStates, myProgress, otherStates, otherProgress] = await Promise.all([
      db.playerGuideDungeonState.findMany({
        where: { profileId: ctx.profileId, guideId: guide.id, characterSlot, state: "DONE" },
        select: { sequenceId: true, dungeonKey: true },
        take: 2_000,
      }),
      db.playerGuideProgress.findMany({
        where: {
          profileId: ctx.profileId,
          characterSlot,
          milestone: { guideId: guide.id },
          currentStep: { not: null },
        },
        select: { currentStep: true },
        take: 300,
      }),
      db.playerGuideDungeonState.findMany({
        where: {
          guideId: guide.id,
          state: "DONE",
          profileId: { not: ctx.profileId },
          profile: { guild: { discordGuildId: parsed.data.guildId } },
        },
        select: {
          sequenceId: true,
          dungeonKey: true,
          profileId: true,
          characterSlot: true,
          profile: { select: { pseudoDofus: true, user: { select: { name: true, image: true } } } },
        },
        take: 6_000,
      }),
      db.playerGuideProgress.findMany({
        where: {
          milestone: { guideId: guide.id },
          currentStep: { not: null },
          profile: { guild: { discordGuildId: parsed.data.guildId } },
        },
        select: {
          currentStep: true,
          profileId: true,
          characterSlot: true,
          profile: { select: { pseudoDofus: true, user: { select: { name: true, image: true } } } },
        },
        take: 3_000,
      }),
    ]);

    type MemberAcc = {
      key: string;
      name: string;
      avatar: string | null;
      slot: string;
      isMain: boolean;
      ownerName: string | null;
      done: Set<string>;
      flags: Set<string>;
    };
    const members = new Map<string, MemberAcc>();
    const ensure = (
      profileId: string,
      slot: string,
      name: string | null | undefined,
      pseudo: string | null | undefined,
      avatar: string | null | undefined
    ): MemberAcc => {
      const key = `${profileId}::${slot}`;
      const existing = members.get(key);
      if (existing) return existing;
      const owner = memberName(pseudo ?? name ?? null, "Membre");
      const member = {
        key,
        // Principal : pseudo du compte. Mule : le pseudo de l'emplacement (slot),
        // jamais le nom du compte — sinon les compteurs et la pile d'avatars
        // affichent trois fois le même nom.
        name: slot === "PRINCIPAL" ? owner : memberName(slot, "Membre"),
        avatar: avatar ?? null,
        slot,
        isMain: slot === "PRINCIPAL",
        ownerName: slot === "PRINCIPAL" ? null : owner,
        done: new Set<string>(),
        flags: new Set<string>(),
      };
      members.set(key, member);
      return member;
    };

    // Le lecteur est un membre comme les autres (même compteur).
    const me = ensure(ctx.profileId, characterSlot, ctx.name, ctx.pseudoDofus ?? null, ctx.image);
    for (const row of myStates) me.done.add(`${row.sequenceId}::${row.dungeonKey}`);
    for (const row of myProgress) if (row.currentStep) me.flags.add(row.currentStep.slice(0, 200));

    for (const row of otherStates) {
      const member = ensure(
        row.profileId,
        row.characterSlot,
        row.profile?.user?.name,
        row.profile?.pseudoDofus,
        row.profile?.user?.image
      );
      member.done.add(`${row.sequenceId}::${row.dungeonKey}`);
    }
    for (const row of otherProgress) {
      if (!row.currentStep) continue;
      const member = ensure(
        row.profileId,
        row.characterSlot,
        row.profile?.user?.name,
        row.profile?.pseudoDofus,
        row.profile?.user?.image
      );
      member.flags.add(row.currentStep.slice(0, 200));
    }

    const out: RushOverviewMember[] = [...members.values()]
      .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name, "fr"))
      .slice(0, COMMUNITY_MAX_MEMBERS)
      .map((member) => ({
        key: member.key,
        name: member.name,
        avatar: member.avatar,
        slot: member.slot,
        isMain: member.isMain,
        ownerName: member.ownerName,
        doneKeys: [...member.done],
        flags: [...member.flags],
      }));

    return {
      success: true,
      me: { doneKeys: [...me.done], flags: [...me.flags] },
      members: out,
    };
  } catch (error) {
    logger.error("[Bloc J] Agrégat des donjons illisible", { error });
    return { success: false, error: "Progression des donjons indisponible pour l'instant." };
  }
}

/**
 * Agrégat des **visiteurs consentants** du serveur du lecteur. Sans compte visiteur,
 * la vue reste personnelle : `success: false` n'est pas une erreur d'écran, le guide
 * n'appelle simplement pas cette action.
 */
export async function getPublicRushDungeonsCommunity(
  characterSlot?: string
): Promise<RushDungeonsCommunityResult> {
  const parsed = PublicSchema.safeParse({ characterSlot });
  if (!parsed.success) return { success: false, error: "Paramètres invalides" };

  const account = await getPublicAccount();
  if (!account) return { success: false, error: "Ta session a expiré. Reconnecte-toi pour continuer." };

  try {
    const rows = await db.publicRushProgress.findMany({
      where: {
        guideId: PUBLIC_RUSH_GUIDE_ID,
        profile: {
          dofusServerId: account.profile.dofusServerId,
          showRushProgress: true,
        },
      },
      select: {
        characterName: true,
        characterSlot: true,
        dungeonChecks: true,
        bookmarks: true,
        profile: { select: { pseudoDofus: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: COMMUNITY_MAX_MEMBERS,
    });

    const members: RushOverviewMember[] = rows.slice(0, COMMUNITY_MAX_MEMBERS).map((row) => ({
      // Aucun identifiant de profil : la clé n'est qu'un repère d'affichage.
      key: `${row.characterSlot}::${row.characterName ?? row.profile?.pseudoDofus ?? "visiteur"}`,
      name:
        row.characterSlot === "PRINCIPAL"
          ? memberName(row.profile?.pseudoDofus ?? row.characterName, "Visiteur")
          : memberName(row.characterName ?? row.characterSlot, "Visiteur"),
      avatar: null,
      slot: row.characterSlot,
      isMain: row.characterSlot === "PRINCIPAL",
      ownerName:
        row.characterSlot === "PRINCIPAL"
          ? null
          : memberName(row.profile?.pseudoDofus, "Visiteur"),
      doneKeys: doneKeysFromChecks(row.dungeonChecks),
      flags: flagsFromBookmarks(row.bookmarks),
    }));

    const mine = parsed.data.characterSlot
      ? rows.find((row) => row.characterSlot === parsed.data.characterSlot)
      : undefined;

    return {
      success: true,
      me: mine
        ? { doneKeys: doneKeysFromChecks(mine.dungeonChecks), flags: flagsFromBookmarks(mine.bookmarks) }
        : { doneKeys: [], flags: [] },
      members,
    };
  } catch (error) {
    logger.error("[Bloc J] Agrégat public des donjons illisible", { error });
    return { success: false, error: "Progression des donjons indisponible pour l'instant." };
  }
}

