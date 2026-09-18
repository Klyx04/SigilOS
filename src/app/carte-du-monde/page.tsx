import { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { JsonLd } from "@/components/shared/json-ld";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { WorldmapLandingPublicClient } from "./_components/WorldmapLandingPublicClient";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 86400; // Cache ISR 24h

const BASE_URL = `${getAppBaseUrl()}/carte-du-monde`;

export const metadata: Metadata = {
  title: "Carte du Monde Dofus Unity Interactive HD : Zaaps, Donjons, Archimonstres | SigilOS",
  description:
    "Explorez la carte du monde Dofus Unity en haute définition : tous les zaaps, donjons, archimonstres et ressources récoltables, map par map. Gratuit, sans compte, avec overlay détachable.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "Carte du Monde Dofus Unity Interactive HD — SigilOS",
    description:
      "Navigation HD par tuiles sur tous les mondes Dofus Unity : zaaps, donjons, archimonstres, récolte et passages secrets. 100% gratuit.",
    url: BASE_URL,
    images: [
      {
        url: `${getAppBaseUrl()}/assets/worldmap/astrub-apercu.webp`,
        width: 1200,
        height: 630,
        alt: "Carte du Monde Dofus Unity — Aperçu HD Astrub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Carte du Monde Dofus Unity Interactive HD — SigilOS",
    description:
      "Navigation HD sur tous les mondes Dofus Unity : zaaps, donjons, archimonstres et récolte. Gratuit et sans compte.",
  },
};

type Props = {
  searchParams: Promise<{ play?: string; x?: string; y?: string; zoom?: string; world?: string }>;
};

export default async function CarteduMondePage({ searchParams }: Props) {
  const { play, x, y, zoom, world } = await searchParams;

  const session = await auth();
  const user = session?.user ?? null;
  const { t, locale } = await getServerI18n();

  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  const isPlay = play === "1";
  const xNum = x ? parseFloat(x) : undefined;
  const yNum = y ? parseFloat(y) : undefined;
  const zoomNum = zoom ? parseInt(zoom) : undefined;
  const worldIdNum = world ? parseInt(world) : undefined;

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.almanaxPage.breadcrumbHome, item: getAppBaseUrl() },
        {
          "@type": "ListItem",
          position: 2,
          name: t.worldmapPage.breadcrumbWorldmap,
          item: BASE_URL,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: `${t.worldmapPage.title} — SigilOS`,
      description: t.worldmapPage.subtitle,
      url: BASE_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
    },
  ];

  return (
    <>
      <JsonLd id="json-ld-carte-du-monde" data={jsonLdData} nonce={nonce} />
      <div className="registre min-h-screen flex flex-col bg-background text-foreground">
        <PublicHeader
          activePage="carte-du-monde"
          user={user ? { name: user.name ?? undefined, image: user.image ?? undefined } : undefined}
        />
        <main className="flex-1">
          <WorldmapLandingPublicClient
            isPlay={isPlay}
            initialX={xNum}
            initialY={yNum}
            initialZoom={zoomNum}
            initialWorldId={worldIdNum}
          />
        </main>
        {!isPlay && <GalacticFooter />}
      </div>
    </>
  );
}
