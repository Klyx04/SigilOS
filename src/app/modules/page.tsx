import { Metadata } from "next";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { ModulesExplorer } from "./_components/modules-explorer";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 86400; // 24h ISR — contenu stable et rapide

const baseUrl = getAppBaseUrl();

export async function generateMetadata(): Promise<Metadata> {
    const { getServerI18n } = await import("@/lib/i18n/server");
    const { t, locale } = await getServerI18n();

    return {
        title: t.modulesPage.metaTitle,
        description: t.modulesPage.metaDesc,
        alternates: {
            canonical: `${baseUrl}/modules`,
        },
        openGraph: {
            title: locale === "en" ? "Guild Modules · SigilOS" : "Modules de Guilde · SigilOS",
            description: locale === "en"
                ? "All activatable modules for your Dofus Unity guild: dungeons, Dreams, Ochre, professions, calendar and Discord bot."
                : "Tous les modules activables pour ta guilde Dofus Unity : donjons, Songes, Ocre, artisanat, calendrier et bot Discord.",
            url: `${baseUrl}/modules`,
            siteName: "SigilOS",
            locale: locale === "en" ? "en_US" : "fr_FR",
            type: "website",
        },
    };
}

export default async function ModulesPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const [userContext] = await Promise.all([getUserContext(), getServerI18n()]);

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col">
            <PublicHeader user={session?.user} isMember={userContext.isMember} activePage="modules" />

            <main className="flex-1 w-full">
                <ModulesExplorer />
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
