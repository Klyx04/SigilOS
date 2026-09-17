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

/**
 * Page publique `/almanax/[date]` — registre.
 *
 * Retiré volontairement (fiche de reprise §1.3) : la carte `rounded-3xl
 * bg-surface/70`, les libellés `font-bold uppercase tracking-widest`, la tuile
 * d'icône `rounded-xl bg-warning/15` du bonus, les deux cartes imbriquées
 * `rounded-2xl bg-background` et la flèche verte de la note de source.
 * Remplacé par `reg-shell` + `reg-eyebrow`, un `reg-panel` à filets, un
 * `reg-callout` pour la donnée indisponible et des liens `reg-link-quiet`
 * pour les jours précédent/suivant. Données et textes inchangés.
 */

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
        <div className="registre relative min-h-screen landing-theme bg-background text-foreground selection:bg-success/30 font-sans flex flex-col">
            <PublicHeader user={session?.user} activePage="almanax" isMember={userContext.isMember} />

            {jsonLd && <JsonLd id={`json-ld-almanax-${date}`} nonce={nonce} data={[jsonLd]} />}

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    {/* Fil d'Ariane */}
                    <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Fil d'Ariane">
                        <Link href="/" className="reg-link-quiet">Accueil</Link>
                        <span aria-hidden>›</span>
                        <Link href="/almanax" className="reg-link-quiet">Almanax</Link>
                        <span aria-hidden>›</span>
                        <span className="text-foreground capitalize">{formatFr(parsed)}</span>
                    </nav>

                    {/* En-tête — gauche-aligné, sans libellé en capitales espacées */}
                    <header className="mt-8">
                        <p className="reg-eyebrow">Almanax Dofus</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground capitalize">
                            Offrande du {formatFr(parsed)}
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
                                    <p className="text-xs text-muted-foreground">Offrande requise</p>
                                    <p className="mt-0.5 text-lg font-semibold text-foreground">
                                        {item.tribute.item.name} <span className="reg-mono text-accent">x{item.tribute.quantity}</span>
                                    </p>
                                    {typeof item.reward_kamas === "number" && (
                                        <p className="reg-mono mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                                            {item.reward_kamas.toLocaleString("fr-FR")} kamas offerts
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Bonus du Méryde (donnée de jeu) */}
                            <div className="border-t border-border px-4 py-5 sm:px-6">
                                <p className="text-xs text-muted-foreground">Bonus du Meryde</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{item.bonus.description}</p>
                                {item.bonus.type?.name && (
                                    <p className="mt-1 text-xs text-muted-foreground">Type : {item.bonus.type.name}</p>
                                )}
                            </div>

                            {/* Navigation entre les jours — liens, pas de boutons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
                                <Link
                                    href={`/almanax/${prevKey}`}
                                    className="reg-link-quiet inline-flex items-center gap-1.5 text-sm"
                                >
                                    <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" /> Jour précédent
                                </Link>
                                <Link
                                    href={`/almanax/${nextKey}`}
                                    className="reg-link-quiet inline-flex items-center gap-1.5 text-sm"
                                >
                                    Jour suivant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>
                        </section>
                    ) : (
                        <div className="reg-callout mt-6 border-warning/40">
                            <div>
                                <p>
                                    La donnée Almanax pour cette date n'est pas encore disponible (prévision sur 30 jours).
                                </p>
                                <p className="mt-3">
                                    <Link href="/almanax" className="reg-link inline-flex items-center gap-1.5 text-sm">
                                        Voir l&apos;Almanax d&apos;aujourd&apos;hui <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </p>
                            </div>
                        </div>
                    )}

                    <p className="mt-8 max-w-[70ch] border-t border-border pt-5 text-xs text-muted-foreground leading-relaxed">
                        Les données Almanax sont fournies par l&apos;API communautaire DofusDB (dofusdu.de). Les offrandes
                        changent chaque jour à minuit (heure de Paris). En cas de doute, vérifiez dans le jeu via le Temple de l&apos;Almanax.
                    </p>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
