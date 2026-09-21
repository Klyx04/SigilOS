import { getUpcomingAlmanax, type AlmanaxItem } from "@/server/actions/resources-actions";
import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { Coins, Gift, ArrowRight } from "lucide-react";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 3600; // Cache ISR 1h

function parseDate(raw: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function formatDate(date: Date, locale: string): string {
    return date.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
        timeZone: "UTC",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ date: string }>;
}): Promise<Metadata> {
    const { date } = await params;
    const parsed = parseDate(date);
    if (!parsed) return {};

    const { t, locale } = await getServerI18n();
    const almanaxList = await getUpcomingAlmanax(locale);
    const item = almanaxList.find((a) => a.date.slice(0, 10) === date) as AlmanaxItem | undefined;
    const baseUrl = getAppBaseUrl();
    const label = formatDate(parsed, locale);

    const title = item
        ? `${t.almanaxPage.breadcrumbAlmanax} — ${label} : ${item.tribute.item.name} x${item.tribute.quantity} | SigilOS`
        : `${t.almanaxPage.breadcrumbAlmanax} — ${label} | SigilOS`;
    const description = item
        ? `${t.almanaxPage.offering} : ${item.tribute.item.name} x${item.tribute.quantity}. ${t.almanaxPage.bonusMeryde} : ${item.bonus.description}.`
        : `${t.almanaxPage.subtitle}`;

    return {
        // `absolute` : le titre porte déjà la marque (sinon le template du layout l'ajoute une 2ᵉ fois).
        title: { absolute: title },
        description,
        alternates: { canonical: `${baseUrl}/almanax/${date}` },
        openGraph: {
            title,
            description,
            url: `${baseUrl}/almanax/${date}`,
            type: "article",
        },
    };
}

export default async function AlmanaxDatePage({
    params,
}: {
    params: Promise<{ date: string }>;
}) {
    const { date } = await params;
    const parsed = parseDate(date);
    if (!parsed) notFound();

    const { t, locale } = await getServerI18n();
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    const almanaxList = await getUpcomingAlmanax(locale);
    const item = almanaxList.find((a) => a.date.slice(0, 10) === date) as AlmanaxItem | undefined;

    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";
    const baseUrl = getAppBaseUrl();

    const prevDate = addDays(parsed, -1);
    const nextDate = addDays(parsed, 1);
    const prevKey = prevDate.toISOString().slice(0, 10);
    const nextKey = nextDate.toISOString().slice(0, 10);
    const formattedDate = formatDate(parsed, locale);

    const jsonLd = item
        ? {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${t.almanaxPage.breadcrumbAlmanax} — ${formattedDate}`,
            description: item.bonus.description,
            datePublished: item.date.slice(0, 10),
            url: `${baseUrl}/almanax/${date}`,
            publisher: { "@type": "Organization", name: "SigilOS", url: baseUrl },
        }
        : null;

    return (
        <div className="registre relative min-h-screen landing-theme bg-background text-foreground selection:bg-success/30 font-sans flex flex-col">
            <PublicHeader user={session?.user} activePage="almanax" isMember={userContext.isMember} />

            {jsonLd && <JsonLd id={`json-ld-almanax-${date}`} nonce={nonce} data={[jsonLd]} />}

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    {/* Fil d'Ariane */}
                    <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Fil d'Ariane">
                        <Link href="/" className="reg-link-quiet">{t.almanaxPage.breadcrumbHome}</Link>
                        <span aria-hidden>›</span>
                        <Link href="/almanax" className="reg-link-quiet">{t.almanaxPage.breadcrumbAlmanax}</Link>
                        <span aria-hidden>›</span>
                        <span className="text-foreground capitalize">{formattedDate}</span>
                    </nav>

                    {/* En-tête */}
                    <header className="mt-8">
                        <p className="reg-eyebrow">{t.almanaxPage.breadcrumbAlmanax}</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground capitalize">
                            {t.almanaxPage.dayOff} — {formattedDate}
                        </h1>
                    </header>

                    {item ? (
                        <section className="reg-panel mt-6">
                            {/* Offrande requise */}
                            <div className="flex items-start gap-4 border-b border-border px-4 py-5 sm:px-6">
                                {item.tribute.item.image_urls?.icon ? (
                                    <Image
                                        src={item.tribute.item.image_urls.icon}
                                        alt={item.tribute.item.name}
                                        width={64}
                                        height={64}
                                        className="h-16 w-16 shrink-0 object-contain"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                                        <Gift className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">{t.almanaxPage.offering}</p>
                                    <p className="mt-0.5 text-lg font-semibold text-foreground">
                                        {item.tribute.item.name} <span className="reg-mono text-accent">x{item.tribute.quantity}</span>
                                    </p>
                                    {typeof item.reward_kamas === "number" && (
                                        <p className="reg-mono mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                                            {item.reward_kamas.toLocaleString(locale === "en" ? "en-US" : "fr-FR")} {locale === "en" ? "kamas reward" : "kamas offerts"}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Bonus du Méryde */}
                            <div className="border-t border-border px-4 py-5 sm:px-6">
                                <p className="text-xs text-muted-foreground">{t.almanaxPage.bonusMeryde}</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{item.bonus.description}</p>
                                {item.bonus.type?.name && (
                                    <p className="mt-1 text-xs text-muted-foreground">Type : {item.bonus.type.name}</p>
                                )}
                            </div>

                            {/* Navigation entre les jours */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
                                <Link
                                    href={`/almanax/${prevKey}`}
                                    className="reg-link-quiet inline-flex items-center gap-1.5 text-sm"
                                >
                                    <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" /> {t.almanaxPage.prevDay}
                                </Link>
                                <Link
                                    href={`/almanax/${nextKey}`}
                                    className="reg-link-quiet inline-flex items-center gap-1.5 text-sm"
                                >
                                    {t.almanaxPage.nextDay} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>
                        </section>
                    ) : (
                        <div className="reg-callout mt-6 border-warning/40">
                            <div>
                                <p>{t.almanaxPage.dataUnavailable}</p>
                                <p className="mt-3">
                                    <Link href="/almanax" className="reg-link inline-flex items-center gap-1.5 text-sm">
                                        {t.almanaxPage.backToCalendar} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </p>
                            </div>
                        </div>
                    )}

                    <p className="mt-8 max-w-[70ch] border-t border-border pt-5 text-xs text-muted-foreground leading-relaxed">
                        {locale === "en"
                            ? "Almanax data is provided by the official community API (dofusdu.de). Offerings reset daily at midnight (Paris time)."
                            : "Les données Almanax sont fournies par l'API communautaire (dofusdu.de). Les offrandes changent chaque jour à minuit (heure de Paris)."}
                    </p>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
