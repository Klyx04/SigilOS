import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { ElevageStudioClient } from "./_components/ElevageStudioClient";

export const revalidate = 3600; // Cache ISR 1h

export async function generateMetadata(): Promise<Metadata> {
    const { getServerI18n } = await import("@/lib/i18n/server");
    const { t, locale } = await getServerI18n();

    const title = t.elevageStudio.metaTitle;
    const description = t.elevageStudio.metaDesc;

    return {
        title,
        description,
        alternates: {
            canonical: `${getAppBaseUrl()}/elevage`,
        },
        openGraph: {
            title: locale === "en"
                ? "Dofus Unity 3.7 Breeding Studio — Cross Calculator, Serenity & XP (100% Free)"
                : "Studio Élevage 3.7 Dofus Unity — Simulateur de Croisements, Sérénité & XP (100% Gratuit)",
            description,
            url: `${getAppBaseUrl()}/elevage`,
            images: [
                {
                    url: `${getAppBaseUrl()}/api/og?title=${encodeURIComponent("Studio Élevage Dofus Unity 3.7")}&subtitle=Simulateur%20Croisements%2C%20S%C3%A9r%C3%A9nit%C3%A9%20%26%20XP`,
                    width: 1200,
                    height: 630,
                    alt: "Studio Élevage Dofus Unity 3.7",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}

export default async function PublicElevagePage() {
    const session = await auth();
    const [userContext, { t, locale }] = await Promise.all([getUserContext(), getServerI18n()]);

    const jsonLdData = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: getAppBaseUrl() },
                { "@type": "ListItem", position: 2, name: "Élevage Studio 3.7", item: `${getAppBaseUrl()}/elevage` },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "SigilOS Studio Élevage 3.7",
            applicationCategory: "GameApplication",
            operatingSystem: "Web",
            description: t.elevageStudio.metaDesc,
            url: `${getAppBaseUrl()}/elevage`,
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
            },
        },
    ];

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="elevage" isMember={userContext.isMember} />

            <JsonLd id="elevage-studio-jsonld" data={jsonLdData} />

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
                    <span className="text-foreground font-semibold">Élevage Studio 3.7</span>
                </div>

                {/* Composant interactif */}
                <ElevageStudioClient />
            </main>

            <GalacticFooter />
        </div>
    );
}
