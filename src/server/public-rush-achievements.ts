import { z } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    readSuccesCharacters,
    resolveSuccesCharacterSlotOrNull,
    SUCCES_SLOT_MAX,
} from "@/lib/succes-characters";
import {
    listableDungeonAchievements,
    resolveVisitorAchievementSlot,
    type DungeonAchievementPanelData,
} from "@/lib/rush-dungeon-achievements";
import { loadDungeonAchievementCatalogue } from "@/server/dungeon-achievements";
import { getPublicAccount } from "@/server/public-account";

/**
 * Panneau des succès d'un donjon — **visiteur connecté** (guide public).
 *
 * Le catalogue est public ; les coches sont celles du **profil visiteur** courant,
 * par personnage. Le pseudo du personnage déclaré dans le guide ne sert qu'à choisir
 * le slot : s'il n'est pas déclaré dans le profil, le panneau reste en lecture seule
 * et le sélecteur des personnages déclarés prend le relais.
 *
 * Aucun consentement `showRushProgress` n'est requis ici : on ne lit que **ses propres**
 * lignes. Ce consentement reste la porte de l'agrégat « qui a fait quoi » (Bloc J).
 */
const PanelSchema = z.object({
    dungeonId: z.string().min(1).max(64),
    characterSlot: z.string().max(SUCCES_SLOT_MAX).optional(),
    guestPseudo: z.string().max(SUCCES_SLOT_MAX).optional(),
});

export async function getPublicRushDungeonAchievementPanel(
    raw: unknown
): Promise<{ success: boolean; error?: string; data?: DungeonAchievementPanelData }> {
    const parsed = PanelSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const account = await getPublicAccount();
    if (!account) return { success: false, error: "Session expirée" };

    const characters = readSuccesCharacters(account.profile);
    const providedSlot = parsed.data.characterSlot
        ? resolveSuccesCharacterSlotOrNull(parsed.data.characterSlot, characters)
        : null;
    if (parsed.data.characterSlot && !providedSlot) {
        return { success: false, error: "Personnage inconnu." };
    }

    const slot = providedSlot ?? resolveVisitorAchievementSlot(parsed.data.guestPseudo, characters);

    try {
        const dungeon = await db.dungeon.findUnique({
            where: { id: parsed.data.dungeonId },
            select: {
                id: true,
                name: true,
                bossName: true,
                slug: true,
                imageUrl: true,
                level: true,
                isNoAchievement: true,
            },
        });
        if (!dungeon) return { success: false, error: "Donjon introuvable" };

        const [catalogue, doneRows] = await Promise.all([
            loadDungeonAchievementCatalogue(dungeon.id),
            slot
                ? db.publicDungeonAchievement.findMany({
                      where: {
                          publicProfileId: account.profile.id,
                          characterSlot: slot,
                          dungeonAchievement: { dungeonId: dungeon.id },
                      },
                      select: { dungeonAchievementId: true },
                      take: 100,
                  })
                : Promise.resolve([] as Array<{ dungeonAchievementId: string }>),
        ]);

        const character = characters.find((row) => row.slot === slot);
        return {
            success: true,
            data: {
                dungeon,
                achievements: listableDungeonAchievements(catalogue),
                doneIds: doneRows.map((row) => row.dungeonAchievementId),
                slot,
                characterName: character?.name ?? null,
                characters: characters.map((row) => ({
                    slot: row.slot,
                    name: row.name,
                    isMain: row.isMain,
                })),
                canEdit: !!slot,
            },
        };
    } catch (error) {
        logger.error("[getPublicRushDungeonAchievementPanel] Erreur", { error });
        return { success: false, error: "Impossible de charger les succès du donjon" };
    }
}
