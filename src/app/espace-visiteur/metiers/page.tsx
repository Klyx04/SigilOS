import { db } from "@/lib/prisma";
import { requirePublicAccount } from "@/server/public-account";
import { ProfessionsForm } from "../_components/professions-form";

export const metadata = {
    title: "Métiers — espace visiteur | SigilOS",
    description: "Tes métiers et leurs niveaux, pour le filtre de l'annuaire du serveur.",
};

export default async function MetiersPage() {
    const { profile } = await requirePublicAccount();

    const rows = await db.publicProfession.findMany({
        where: { publicProfileId: profile.id },
        select: { metierId: true, level: true },
        orderBy: { metierId: "asc" },
        take: 50,
    });

    return <ProfessionsForm professions={rows.map((row) => ({ id: row.metierId, level: row.level }))} />;
}
