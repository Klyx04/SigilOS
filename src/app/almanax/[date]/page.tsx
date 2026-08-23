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
import { Calendar, Sparkles, Coins, Gift, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";

export const revalidate = 3600; // Cache ISR 1h

// #101 — SEO : route publique par date d'Almanax (/almanax/YYYY-MM-DD),
// indexable, avec canonical + OpenGraph + breadcrumb JSON-LD.

function parseDate(raw: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function formatFr(date: Date): string {
    return date.toLocaleDateString("fr-FR", {
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

    const almanaxList = await getUpcomingAlmanax();
    const item = almanaxList.find((a) => a.date.slice(0, 10) === date) as AlmanaxItem | undefined;
    const baseUrl = getAppBaseUrl();
    const label = formatFr(parsed);

    const title = item
        ? `Almanax Dofus du ${label} : ${item.tribute.item.name} x${item.tribute.quantity} | SigilOS`
        : `Almanax Dofus du ${label} | SigilOS`;
    const description = item
        ? `Offrande du jour : ${item.tribute.item.name} x${item.tribute.quantity}. Bonus du Meryde : ${item.bonus.description}. Prenez une longueur d'avance sur l'Almanax Dofus.`
        : `Retrouvez l'offrande et le bonus de l'Almanax Dofus du ${label}.`;

    return {
        title,
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

    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    const almanaxList = await getUpcomingAlmanax();
    const item = almanaxList.find((a) => a.date.slice(0, 10) === date) as AlmanaxItem | undefined;

    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";
    const baseUrl = getAppBaseUrl();

    const prevDate = addDays(parsed, -1);
    const nextDate = addDays(parsed, 1);
    const prevKey = prevDate.toISOString().slice(0, 10);
    const nextKey = nextDate.toISOString().slice(0, 10);

    const jsonLd = item
        ? {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `Almanax Dofus du ${formatFr(parsed)}`,
            description: item.bonus.description,
            datePublished: item.date.slice(0, 10),
            url: `${baseUrl}/almanax/${date}`,
            publisher: { "@type": "Organization", name: "SigilOS", url: baseUrl },
        }
        : null;

    return (
        <div className="relative min-h-screen landing-theme bg-background text-foreground selection:bg-accent-teal/30 font-sans flex flex-col">
            <PublicHeader user={session?.user} activePage="almanax" isMember={userContext.isMember} />

            {jsonLd && <JsonLd id={`json-ld-almanax-${date}`} nonce={nonce} data={[jsonLd]} />}

            <main className="flex-1 w-full relative z-10">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
                    {/* Fil d'Ariane */}
                    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap" aria-label="Fil d'Ariane">
                        <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
                        <span aria-hidden>›</span>
                        <Link href="/almanax" className="hover:text-foreground transition-colors">Almanax</Link>
                        <span aria-hidden>›</span>
                        <span className="text-foreground capitalize">{formatFr(parsed)}</span>
                    </nav>

                    <div className="rounded-3xl border border-border bg-surface/70 p-6 sm:p-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Almanax Dofus
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-2 capitalize">
                            Offrande du {formatFr(parsed)}
                        </h1>

                        {item ? (
                            <div className="mt-6 space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-background border border-border">
                                    {item.tribute.item.image_urls?.icon ? (
                                        <Image
                                            src={item.tribute.item.image_urls.icon}
                                            alt={item.tribute.item.name}
                                            width={72}
                                            height={72}
                                            className="w-16 h-16 sm:w-18 sm:h-18 object-contain shrink-0"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0">
                                            <Gift className="w-7 h-7 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Offrande requise</p>
                                        <p className="text-lg font-black text-foreground mt-1">
                                            {item.tribute.item.name} <span className="text-accent">x{item.tribute.quantity}</span>
                                        </p>
                                        {typeof item.reward_kamas === "number" && (
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                                <Coins className="w-3.5 h-3.5" /> {item.reward_kamas.toLocaleString("fr-FR")} kamas offerts
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-background border border-border">
                                    <div className="w-12 h-12 rounded-xl bg-warning/15 border border-warning/30 text-warning flex items-center justify-center shrink-0">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                            Bonus du Meryde
                                        </p>
                                        <p className="text-base font-bold text-foreground mt-1">{item.bonus.description}</p>
                                        {item.bonus.type?.name && (
                                            <p className="text-xs text-muted-foreground mt-0.5">Type : {item.bonus.type.name}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                    <Link
                                        href={`/almanax/${prevKey}`}
                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ArrowRight className="w-4 h-4 rotate-180" /> Jour précédent
                                    </Link>
                                    <Link
                                        href={`/almanax/${nextKey}`}
                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Jour suivant <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 p-5 rounded-2xl bg-background border border-border">
                                <p className="text-sm text-foreground">
                                    La donnée Almanax pour cette date n'est pas encore disponible (prévision sur 30 jours).
                                </p>
                                <Link
                                    href="/almanax"
                                    className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-accent hover:underline"
                                >
                                    Voir l&apos;Almanax d&apos;aujourd&apos;hui <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}

                        <div className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground border-t border-border pt-5">
                            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-success" />
                            <p>
                                Les données Almanax sont fournies par l&apos;API communautaire DofusDB (dofusdu.de). Les offrandes
                                changent chaque jour à minuit (heure de Paris). En cas de doute, vérifiez dans le jeu via le Temple de l&apos;Almanax.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
