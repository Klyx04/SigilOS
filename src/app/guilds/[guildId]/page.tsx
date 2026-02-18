import { getGuildPresentation, getPublicGuildBasicInfo } from "@/server/actions/presentation-actions";
import { notFound } from "next/navigation";
import { GuildPublicView } from "./_components/guild-public-view";
import { PrivateGuildView } from "./_components/private-guild-view";
import { getAppBaseUrl } from "@/lib/utils";

type Props = {
    params: Promise<{ guildId: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (guild) {
        return {
            title: `${guild.name} | SigilOS`,
            description: `Découvrez la guilde ${guild.name} sur le serveur ${guild.server || 'Dofus'}. ${guild.isRecruiting ? 'Recrutement ouvert !' : ''}`,
            openGraph: {
                title: `${guild.name} - Guilde Dofus`,
                description: `Rejoignez ${guild.name} sur ${guild.server || 'Dofus'}.`,
                images: guild.bannerUrl ? [guild.bannerUrl] : (guild.iconUrl ? [guild.iconUrl] : []),
            }
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
        : new Date(guild.createdAt).getFullYear();

    const baseUrl = getAppBaseUrl();
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": guild.name,
        "url": `${baseUrl}/guilds/${guild.id}`,
        "logo": guild.iconUrl || `${baseUrl}/assets/ui/logo-v2.png`,
        "foundingDate": guild.foundedDate ? new Date(guild.foundedDate).toISOString().split('T')[0] : null,
        "founder": guild.founder ? {
            "@type": "Person",
            "name": guild.founder
        } : undefined,
        "description": `Guilde Dofus sur le serveur ${guild.server || 'Inconnu'}. ${guild.isRecruiting ? 'Nous recrutons !' : ''}`,
        "sameAs": guild.discord ? [guild.discord] : []
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <GuildPublicView guild={guild} foundedYear={foundedYear} />
        </>
    );
}
