import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Swords, ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { RaidPlannerClient } from "./_components/RaidPlannerClient";

export const revalidate = 3600; // Cache ISR 1h

export async function generateMetadata(): Promise<Metadata> {
    const { getServerI18n } = await import("@/lib/i18n/server");
    const { t, locale } = await getServerI18n();

    const title = t.raidStudio.metaTitle;
    const description = t.raidStudio.metaDesc;

    return {
        title,
        description,
        alternates: {
            canonical: `${getAppBaseUrl()}/raids`,
        },
        openGraph: {
            title: locale === "en"
                ? "Dofus 3.6 Raid Studio — Public Planner & Puzzle Solvers (100% Free)"
                : "Raid Studio 3.6 Dofus — Planificateur Public & Solveurs de Raids (100% Gratuit)",
            description,
            url: `${getAppBaseUrl()}/raids`,
        },
    };
}

export default async function PublicRaidStudioPage() {
    const session = await auth();
    const [userContext, { t, locale }] = await Promise.all([getUserContext(), getServerI18n()]);

    const jsonLdData = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: getAppBaseUrl() },
                { "@type": "ListItem", position: 2, name: "Raid Studio 3.6", item: `${getAppBaseUrl()}/raids` },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "SigilOS Raid Studio 3.6",
            applicationCategory: "GameApplication",
            operatingSystem: "Web",
            description: t.raidStudio.metaDesc,
            url: `${getAppBaseUrl()}/raids`,
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
            },
        },
    ];

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="raids" isMember={userContext.isMember} />

            <JsonLd id="raid-studio-jsonld" data={jsonLdData} />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
                {/* Fil d'Ariane & Bouton retour */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t.bossPage.backHome}</span>
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-semibold">Raid Studio 3.6</span>
                </div>

                {/* Hero Header Anti-Slop Registre */}
                <header className="space-y-3 max-w-3xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-mono text-[11px] font-bold uppercase tracking-wider">
                        <Swords className="w-3.5 h-3.5" />
                        <span>{t.raidStudio.heroTag}</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground">
                        {t.raidStudio.heroTitle}
                    </h1>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {t.raidStudio.heroSubtitle}
                    </p>
                </header>

                {/* Application Client Interactive */}
                <RaidPlannerClient />
            </main>

            <GalacticFooter />
        </div>
    );
}
