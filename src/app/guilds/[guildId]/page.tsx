import { getGuildPresentation, getPublicGuildBasicInfo } from "@/server/actions/presentation-actions";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuildPublicView } from "./_components/guild-public-view";
import { PrivateGuildView } from "./_components/private-guild-view";
import { getAppBaseUrl } from "@/lib/utils";
import { getGuildSlug } from "@/lib/presentation-constants";
import { headers } from "next/headers";
import { JsonLd } from "@/components/shared/json-ld";

type Props = {
    params: Promise<{ guildId: string }>;
};

export async function generateMetadata({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    if (guild) {
        const baseUrl = getAppBaseUrl();
        const slug = getGuildSlug(guild);
        return {
            title: { absolute: `${guild.name} — Guilde Dofus ${guild.server || ''} | SigilOS` },
            description: `Profil de la guilde ${guild.name} sur le serveur ${guild.server || 'Dofus'}. ${guild.isRecruiting ? 'Recrutement ouvert ! ' : ''}Missions, membres, progression et événements. Plateforme SigilOS 2026.`,
            alternates: {
                canonical: `${baseUrl}/guilds/${slug || guildId}`,
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
            title: { absolute: `${basicInfo.name} (Privé) | SigilOS` },
            description: "Cette guilde est privée.",
            robots: {
                index: false,
                follow: false,
            },
        };
    }

    return {
        title: { absolute: "Guilde non trouvée | SigilOS" },
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function GuildPresentationPage({ params }: Props) {
    const { guildId } = await params;
    const guild = await getGuildPresentation(guildId);

    // Si non trouvé public, vérifier si la guilde existe en mode privé
    const basicInfo = !guild ? await getPublicGuildBasicInfo(guildId) : null;
    const targetGuildId = guild?.discordGuildId || basicInfo?.id || guildId;

    // Auth check for header — #59 : membership scoped à CETTE guilde (pas la guilde par défaut).
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext(targetGuildId);

    // #142 — session pour le header public : masque le bouton « Connexion » si déjà connecté au Dashboard.
    const session = await auth();

    if (!guild) {
        if (basicInfo && !basicInfo.presentationEnabled) {
            return <PrivateGuildView guild={basicInfo} isMember={userContext.isMember} user={session?.user} />;
        }

        notFound();
    }

    const slug = getGuildSlug(guild);
    if (slug && guildId !== slug && (guildId === guild.discordGuildId || guildId === guild.id)) {
        redirect(`/guilds/${slug}`);
    }

    const foundedYear = guild.foundedDate
        ? new Date(guild.foundedDate).getFullYear()
        : new Date(guild.createdAt).getFullYear();

    const baseUrl = getAppBaseUrl();
    const publicUrl = `${baseUrl}/guilds/${slug || guildId}`;
    const jsonLd: any[] = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": guild.name,
            "url": publicUrl,
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
                { "@type": "ListItem", "position": 3, "name": guild.name, "item": publicUrl },
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
            <JsonLd id="json-ld-guild" nonce={nonce} data={jsonLd} />
            <GuildPublicView guild={guild} foundedYear={foundedYear} isMember={userContext.isMember} user={session?.user} />
        </>
    );
}
