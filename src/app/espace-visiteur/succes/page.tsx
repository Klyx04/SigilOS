import { db } from "@/lib/prisma";
import { requirePublicAccount } from "@/server/public-account";
import { AchievementsChecklist } from "../_components/achievements-checklist";

export const metadata = {
    title: "Succès — espace visiteur | SigilOS",
    description: "Coche tes succès de donjon, boss par boss.",
};

/**
 * Liste **bornée** : 200 donjons au plus, succès de chacun triés par points.
 * La vue « qui a quoi entre visiteurs » est V2b — ici, on ne coche que pour soi.
 */
export default async function SuccesPage() {
    const { profile } = await requirePublicAccount();

    const [dungeons, checked] = await Promise.all([
        db.dungeon.findMany({
            where: { achievements: { some: {} } },
            select: {
                id: true,
                name: true,
                bossName: true,
                achievements: {
                    select: { id: true, challenge: { select: { name: true } } },
                    orderBy: { points: "desc" },
                },
            },
            orderBy: { name: "asc" },
            take: 200,
        }),
        db.publicDungeonAchievement.findMany({
            where: { publicProfileId: profile.id },
            select: { dungeonAchievementId: true },
            take: 2000,
        }),
    ]);

    const groups = dungeons.map((dungeon) => ({
        id: dungeon.id,
        name: dungeon.name,
        bossName: dungeon.bossName,
        achievements: dungeon.achievements.map((achievement) => ({
            id: achievement.id,
            label: achievement.challenge.name,
        })),
    }));

    return (
        <AchievementsChecklist
            dungeons={groups}
            checkedIds={checked.map((row) => row.dungeonAchievementId)}
        />
    );
}
