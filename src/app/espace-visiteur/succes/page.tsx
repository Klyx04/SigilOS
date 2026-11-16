import { db } from "@/lib/prisma";
import { requirePublicAccount } from "@/server/public-account";
import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { SUCCES_DUNGEONS_TAKE } from "@/lib/succes-level-brackets";
import {
    parseSuccesCharacterParam,
    readSuccesCharacters,
    resolveSuccesCharacterSlot,
} from "@/lib/succes-characters";
import { AchievementsChecklist } from "../_components/achievements-checklist";

export const metadata = {
    title: "Succès — espace visiteur | SigilOS",
    description: "Coche tes succès de donjon et tes avis de recherche, personnage par personnage.",
};

/**
 * Liste **bornée** : `SUCCES_DUNGEONS_TAKE` donjons au plus, triés par **niveau** (même ordre
 * que la validation groupée, qui doit couvrir exactement ce que l'écran affiche), succès de
 * chacun triés par points.
 *
 * Le niveau, le slug et l'icône sont lus ici : la page visiteur ne peut pas importer l'action
 * interne (`guildId`) — le DTO porte donc la tranche affichable et le lien vers `/boss/<slug>`.
 * Depuis le 16/11/2026, les coches (succès **et** avis) sont **par personnage** : `?perso=`
 * choisit le principal ou une mule déclarée, et la page ne lit que ce slot.
 */
export default async function SuccesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ profile }, params] = await Promise.all([requirePublicAccount(), searchParams]);
    const characters = readSuccesCharacters(profile);
    const selectedSlot = resolveSuccesCharacterSlot(
        parseSuccesCharacterParam(params.perso),
        characters
    );

    const [dungeons, checked, bounties, checkedBounties] = await Promise.all([
        db.dungeon.findMany({
            where: { achievements: { some: {} } },
            select: {
                id: true,
                name: true,
                bossName: true,
                level: true,
                slug: true,
                imageUrl: true,
                isAnomalyBoss: true,
                isOcreQuest: true,
                achievements: {
                    select: {
                        id: true,
                        points: true,
                        imageUrl: true,
                        challenge: { select: { name: true, slug: true, iconUrl: true } },
                    },
                    orderBy: { points: "desc" },
                },
            },
            orderBy: [{ level: "asc" }, { name: "asc" }],
            take: SUCCES_DUNGEONS_TAKE,
        }),
        db.publicDungeonAchievement.findMany({
            where: { publicProfileId: profile.id, characterSlot: selectedSlot },
            select: { dungeonAchievementId: true },
            take: 2000,
        }),
        /*
         * Avis de recherche (96 siphonnés) : une fiche publique (`/boss/<slug|id>`) et un
         * niveau. Même borne et même tri que les donjons pour que la liste reste une seule
         * échelle de niveaux.
         */
        db.bounty.findMany({
            where: { isBountyMonster: true },
            select: { id: true, name: true, level: true, slug: true, imageUrl: true, zoneName: true },
            orderBy: [{ level: "asc" }, { name: "asc" }],
            take: SUCCES_DUNGEONS_TAKE,
        }),
        db.publicBountyCompletion.findMany({
            where: { publicProfileId: profile.id, characterSlot: selectedSlot },
            select: { bountyId: true },
            take: 2000,
        }),
    ]);

    const groups = dungeons.map((dungeon) => ({
        id: dungeon.id,
        name: dungeon.name,
        bossName: dungeon.bossName,
        level: dungeon.level,
        slug: dungeon.slug,
        imageUrl: dungeon.imageUrl,
        isAnomalyBoss: dungeon.isAnomalyBoss,
        isOcreQuest: dungeon.isOcreQuest,
        achievements: dungeon.achievements.map((achievement) => ({
            id: achievement.id,
            label: achievement.challenge.name,
            // Icône **résolue serveur** (proxy interne → asset local → repli) : le composant
            // client ne manipule jamais un chemin de travail, seulement une URL affichable.
            iconUrl: getDungeonAchievementIconUrl(achievement),
        })),
    }));

    return (
        <AchievementsChecklist
            dungeons={groups}
            checkedIds={checked.map((row) => row.dungeonAchievementId)}
            checkedBountyIds={checkedBounties.map((row) => row.bountyId)}
            characters={characters}
            selectedSlot={selectedSlot}
            bounties={bounties.map((bounty) => ({
                id: bounty.id,
                name: bounty.name,
                level: bounty.level,
                // `slug` est nullable en base : la fiche accepte aussi l'identifiant (308 vers le slug).
                slug: bounty.slug ?? bounty.id,
                imageUrl: bounty.imageUrl,
                zoneName: bounty.zoneName,
            }))}
        />
    );
}

