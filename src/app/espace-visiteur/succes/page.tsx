import { db } from "@/lib/prisma";
import { requirePublicAccount } from "@/server/public-account";
import { getDungeonAchievementIconUrl } from "@/lib/achievement-icon";
import { SUCCES_DUNGEONS_TAKE } from "@/lib/succes-level-brackets";
import { AchievementsChecklist } from "../_components/achievements-checklist";

export const metadata = {
    title: "Succès — espace visiteur | SigilOS",
    description: "Coche tes succès de donjon, boss par boss.",
};

/**
 * Liste **bornée** : `SUCCES_DUNGEONS_TAKE` donjons au plus, triés par **niveau** (même ordre
 * que la validation groupée, qui doit couvrir exactement ce que l'écran affiche), succès de
 * chacun triés par points.
 *
 * Le niveau, le slug et l'icône sont lus ici : la page visiteur ne peut pas importer l'action
 * interne (`guildId`) — le DTO porte donc la tranche affichable et le lien vers `/boss/<slug>`.
 * La vue « qui a quoi entre visiteurs » est V2b — ici, on ne coche que pour soi.
 */
export default async function SuccesPage() {
    const { profile } = await requirePublicAccount();

    const [dungeons, checked, bounties] = await Promise.all([
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
            where: { publicProfileId: profile.id },
            select: { dungeonAchievementId: true },
            take: 2000,
        }),
        /*
         * Avis de recherche (96 siphonnés) : **ni donjon ni succès** — une fiche publique
         * (`/boss/<slug|id>`) et un niveau, rien à cocher. Même borne et même tri que les
         * donjons pour que la liste reste une seule échelle de niveaux.
         */
        db.bounty.findMany({
            where: { isBountyMonster: true },
            select: { id: true, name: true, level: true, slug: true, imageUrl: true, zoneName: true },
            orderBy: [{ level: "asc" }, { name: "asc" }],
            take: SUCCES_DUNGEONS_TAKE,
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
