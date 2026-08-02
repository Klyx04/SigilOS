import { getGuildPresentation, getPublicGuildBasicInfo } from "@/server/actions/presentation-actions";
import { notFound } from "next/navigation";
import { GuildPublicView } from "./_components/guild-public-view";
import { PrivateGuildView } from "./_components/private-guild-view";
import { getAppBaseUrl } from "@/lib/utils";
import { headers } from "next/headers";

type Props = {
    params: Promise<{ guildId: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (guild) {
        const baseUrl = getAppBaseUrl();
        return {
            title: `${guild.name} — Guilde Dofus ${guild.server || ''} | SigilOS`,
            description: `Profil de la guilde ${guild.name} sur le serveur ${guild.server || 'Dofus'}. ${guild.isRecruiting ? 'Recrutement ouvert ! ' : ''}Missions, membres, progression et événements. Plateforme SigilOS 2026.`,
            alternates: {
                canonical: `${baseUrl}/guilds/${guildId}`,
            },
            openGraph: {
                title: `${guild.name} — Guilde Dofus ${guild.server || ''}`,
                description: `Rejoignez ${guild.name} sur ${guild.server || 'Dofus'}. ${guild.isRecruiting ? 'Recrutement en cours.' : 'Guilde vérifiée SigilOS.'}`,
                images: guild.bannerUrl ? [guild.bannerUrl] : (guild.iconUrl ? [guild.iconUrl] : []),
            },
        };
    }

    // Check basic info for metadata if private
    const basicInfo = await getPublicGuildBasicInfo(guildId);
    if (basicInfo) {
        return {
            title: `${basicInfo.name} (Privé) | SigilOS`,
            description: "Cette guilde est privée.",
            robots: {
                index: false,
                follow: false,
            },
        };
    }

    return {
        title: "Guilde non trouvée | SigilOS",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function GuildPresentationPage({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    // Auth check for header
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    if (!guild) {
        // Check if it exists but is private
        const basicInfo = await getPublicGuildBasicInfo(guildId);

        if (basicInfo && !basicInfo.presentationEnabled) {
            return <PrivateGuildView guild={basicInfo} isMember={userContext.isMember} />;
        }

        notFound();
    }

    const foundedYear = guild.foundedDate
        ? new Date(guild.foundedDate).getFullYear()
        : new Date(guild.createdAt).getFullYear();

    const baseUrl = getAppBaseUrl();
    const jsonLd: any[] = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": guild.name,
            "url": `${baseUrl}/guilds/${guildId}`,
            "description": guild.history?.slice(0, 200) || `Guilde Dofus ${guild.server}`,
            ...(guild.iconUrl ? { "logo": guild.iconUrl } : {}),
            "sameAs": guild.discord ? [guild.discord] : [],
            "foundingDate": guild.foundedDate ?? undefined,
            "memberCount": guild.memberCount ?? undefined,
            "areaServed": guild.server ?? undefined,
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Accueil", "item": baseUrl },
                { "@type": "ListItem", "position": 2, "name": "Annuaire", "item": `${baseUrl}/guilds` },
                { "@type": "ListItem", "position": 3, "name": guild.name, "item": `${baseUrl}/guilds/${guildId}` },
            ],
        },
    ].filter((obj: any) => {
        // Remove undefined values to keep the JSON-LD clean/valid
        Object.keys(obj).forEach((key) => {
            if (obj[key] === undefined) delete obj[key];
            if (Array.isArray(obj[key]) && obj[key].length === 0) delete obj[key];
        });
        return Object.keys(obj).length > 0;
    });

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <>
            <script
                type="application/ld+json"
                nonce={nonce}
                // nosemgrep
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <GuildPublicView guild={guild} foundedYear={foundedYear} isMember={userContext.isMember} />
        </>
    );
}
