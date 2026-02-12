import { getGuildPresentation, getPublicGuildBasicInfo } from "@/server/actions/presentation-actions";
import { notFound } from "next/navigation";
import { GuildPublicView } from "./_components/guild-public-view";
import { PrivateGuildView } from "./_components/private-guild-view";

type Props = {
    params: Promise<{ guildId: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (guild) {
        return {
            title: `${guild.name} | SigilOS`,
            description: `Découvrez la guilde ${guild.name} sur SigilOS`,
        };
    }

    // Check basic info for metadata if private
    const basicInfo = await getPublicGuildBasicInfo(guildId);
    if (basicInfo) {
        return {
            title: `${basicInfo.name} (Privé) | SigilOS`,
            description: "Cette guilde est privée.",
        };
    }

    return { title: "Guilde non trouvée | SigilOS" };
}

export default async function GuildPresentationPage({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (!guild) {
        // Check if it exists but is private
        const basicInfo = await getPublicGuildBasicInfo(guildId);

        if (basicInfo && !basicInfo.presentationEnabled) {
            return <PrivateGuildView guild={basicInfo} />;
        }

        notFound();
    }

    const foundedYear = guild.foundedDate
        ? new Date(guild.foundedDate).getFullYear()
        : guild.createdAt.getFullYear();

    return <GuildPublicView guild={guild} foundedYear={foundedYear} />;
}
