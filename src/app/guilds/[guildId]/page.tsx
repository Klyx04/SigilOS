import { getGuildPresentation } from "@/server/actions/presentation-actions";
import { notFound } from "next/navigation";
import { GuildPublicView } from "./_components/guild-public-view";

type Props = {
    params: Promise<{ guildId: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (!guild) {
        return { title: "Guilde non trouvée | SigilOS" };
    }

    return {
        title: `${guild.name} | SigilOS`,
        description: `Découvrez la guilde ${guild.name} sur SigilOS`,
    };
}

export default async function GuildPresentationPage({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (!guild) {
        notFound();
    }

    const foundedYear = guild.createdAt.getFullYear();

    return <GuildPublicView guild={guild} foundedYear={foundedYear} />;
}
