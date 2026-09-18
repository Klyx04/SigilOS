import { getUpcomingAlmanax, type AlmanaxItem } from "@/server/actions/resources-actions";
import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { getAlmanaxFaq } from "@/lib/almanax-faq";
import { auth } from "@/auth";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 3600; // Cache ISR 1h

export const metadata: Metadata = {
    title: "Almanax Dofus du Jour : Offrande, Bonus et Calendrier | SigilOS",
    description:
        "Consultez l'Almanax Dofus du jour : offrande requise, bonus du Méryde, récompenses en kamas et calendrier des prochains jours pour préparer vos offrandes.",
    alternates: {
        canonical: `${getAppBaseUrl()}/almanax`,
    },
    openGraph: {
        title: "Almanax Dofus du Jour — Offrande & Bonus | SigilOS",
        description: "Offrande du jour, bonus du Méryde et calendrier prévisionnel de l'Almanax Dofus.",
        url: `${getAppBaseUrl()}/almanax`,
    },
};

export default async function AlmanaxPublicPage() {
    const { t, locale } = await getServerI18n();
    const almanaxList = await getUpcomingAlmanax(locale);
    const session = await auth();

    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";

    const todayAlmanax = almanaxList[0] as AlmanaxItem | undefined;
    const upcomingAlmanax = almanaxList.slice(1);

    const dateLocale = locale === "en" ? "en-US" : "fr-FR";

    const todayDateFormatted = todayAlmanax
        ? new Date(todayAlmanax.date).toLocaleDateString(dateLocale, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : t.almanaxPage.today;

    const faqItems = getAlmanaxFaq(locale);

    return (
        <div className="registre relative min-h-screen landing-theme bg-background text-foreground selection:bg-success/30 font-sans flex flex-col">
            <PublicHeader user={session?.user} activePage="almanax" isMember={userContext.isMember} />

            <JsonLd
                id="json-ld-almanax"
                nonce={nonce}
                data={[
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            { "@type": "ListItem", position: 1, name: t.almanaxPage.breadcrumbHome, item: getAppBaseUrl() },
                            { "@type": "ListItem", position: 2, name: t.almanaxPage.breadcrumbAlmanax, item: `${getAppBaseUrl()}/almanax` },
                        ],
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        mainEntity: faqItems.map((item) => ({
                            "@type": "Question",
                            name: item.q,
                            acceptedAnswer: { "@type": "Answer", text: item.a },
                        })),
                    },
                ]}
            />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14 space-y-10">
                    {/* En-tête de page */}
                    <header>
                        <p className="reg-eyebrow">{t.almanaxPage.breadcrumbAlmanax}</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                            {t.almanaxPage.title}
                        </h1>
                        <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                            {t.almanaxPage.subtitle}
                        </p>
                    </header>

                    {/* Offrande du jour */}
                    {todayAlmanax && (
                        <section aria-labelledby="offrande-du-jour" className="reg-panel">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
                                <h2 id="offrande-du-jour" className="reg-eyebrow">{t.almanaxPage.dayOff}</h2>
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <time
                                        dateTime={todayAlmanax.date.slice(0, 10)}
                                        className="reg-mono text-xs text-muted-foreground capitalize"
                                    >
                                        {todayDateFormatted}
                                    </time>
                                    <span className="reg-tag reg-tag-accent">{t.almanaxPage.today}</span>
                                </p>
                            </div>

                            <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
                                {/* Offrande + bonus du Méryde */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-4">
                                        {todayAlmanax.tribute?.item?.image_urls?.sd && (
                                            <Image
                                                src={todayAlmanax.tribute.item.image_urls.sd}
                                                alt={todayAlmanax.tribute.item.name}
                                                width={56}
                                                height={56}
                                                className="h-14 w-14 shrink-0 object-contain"
                                                unoptimized
                                            />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs text-muted-foreground">{t.almanaxPage.offering} :</p>
                                            <p className="mt-0.5 text-lg font-semibold text-foreground">
                                                <span className="reg-mono text-accent">{todayAlmanax.tribute.quantity}x</span>{" "}
                                                {todayAlmanax.tribute.item.name}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="reg-callout border-warning/40">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                {t.almanaxPage.bonusMeryde} : {todayAlmanax.bonus?.type?.name || "Effet spécial"}
                                            </p>
                                            <p>{todayAlmanax.bonus?.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Lieu de la quête */}
                                <div className="lg:border-l lg:border-border lg:pl-6">
                                    <p className="text-xs text-muted-foreground">
                                        {locale === "en" ? "Quest Location" : "Lieu de la quête"}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                        {locale === "en" ? "Almanax Sanctuary" : "Sanctuaire de l'Almanax"}
                                    </p>
                                    <p className="reg-mono mt-1.5 text-xs text-muted-foreground">
                                        Position [-4,-24] ({locale === "en" ? "Scarafly Plain Zaap" : "Zaap Plaine des Scarafeuilles"})
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Calendrier prévisionnel */}
                    <section aria-labelledby="prochains-jours" className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                            <h2 id="prochains-jours" className="reg-eyebrow">
                                {t.almanaxPage.upcomingTitle}
                            </h2>
                            <span className="reg-count">
                                {upcomingAlmanax.length} {locale === "en" ? "days scheduled" : "jours prévus"}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="reg-table min-w-[34rem]">
                                <thead>
                                    <tr>
                                        <th scope="col" className="w-[9rem]">
                                            {t.almanaxPage.dateCol}
                                        </th>
                                        <th scope="col" className="w-[15rem]">
                                            {t.almanaxPage.tributeCol}
                                        </th>
                                        <th scope="col">{t.almanaxPage.bonusCol}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upcomingAlmanax.slice(0, 12).map((item, idx) => {
                                        const dateFormatted = new Date(item.date).toLocaleDateString(dateLocale, {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                        });

                                        return (
                                            <tr key={item.date || idx}>
                                                <th
                                                    scope="row"
                                                    className="py-[0.85rem] pr-4 text-left align-top text-sm font-semibold normal-case tracking-normal text-foreground border-b border-border whitespace-nowrap"
                                                >
                                                    <Link
                                                        href={`/almanax/${item.date.slice(0, 10)}`}
                                                        className="reg-link"
                                                    >
                                                        <time dateTime={item.date.slice(0, 10)} className="reg-mono capitalize">
                                                            {dateFormatted}
                                                        </time>
                                                    </Link>
                                                    <span className="reg-mono ml-2 text-xs font-normal text-muted-foreground">
                                                        +{idx + 1}d
                                                    </span>
                                                </th>
                                                <td>
                                                    <span className="flex items-center gap-2.5">
                                                        {item.tribute?.item?.image_urls?.sd && (
                                                            <Image
                                                                src={item.tribute.item.image_urls.sd}
                                                                alt={item.tribute.item.name}
                                                                width={32}
                                                                height={32}
                                                                className="h-8 w-8 shrink-0 object-contain"
                                                                unoptimized
                                                            />
                                                        )}
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {item.tribute.quantity}x {item.tribute.item.name}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="text-sm text-muted-foreground">
                                                    {item.bonus?.description}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Fiche Dolmanax */}
                    <section aria-labelledby="dolmanax" className="reg-doc border-t border-border pt-6">
                        <h2 id="dolmanax" className="mt-0 flex items-center gap-2.5 text-base sm:text-lg">
                            <Image
                                src="/module-dofus/Dofus_Dolmanax.png"
                                alt="Dofus Dolmanax"
                                width={24}
                                height={24}
                                className="h-6 w-6 object-contain shrink-0"
                                unoptimized
                            />
                            {t.almanaxPage.dolmanaxTitle}
                        </h2>
                        <div className="mt-5 grid gap-6 md:grid-cols-3">
                            <div>
                                <h3 className="mt-0">{locale === "en" ? "The Dolmanax" : "Le Dolmanax"}</h3>
                                <p className="mt-1">
                                    {locale === "en"
                                        ? "Completing 365 daily offerings unlocks the Dolmanax Dofus, granting a permanent bonus of +50 in all 4 main elements (Strength, Intelligence, Chance, Agility)."
                                        : "Accomplir 365 offrandes débloque le Dofus Dolmanax qui confère un bonus permanent de +50 dans les 4 éléments (Force, Intelligence, Chance, Agilité)."}
                                </p>
                            </div>
                            <div>
                                <h3 className="mt-0">{locale === "en" ? "Anticipating Offerings" : "Anticiper les Offrandes"}</h3>
                                <p className="mt-1">
                                    {locale === "en"
                                        ? "Purchasing or gathering resources days in advance prevents price inflation in marketplace hubs on the day of the tribute."
                                        : "Acheter ou récolter les ressources plusieurs jours à l'avance permet d'éviter l'inflation des prix en hôtel de vente le jour même de l'offrande."}
                                </p>
                            </div>
                            <div>
                                <h3 className="mt-0">{locale === "en" ? "Guild Synchronization" : "Synchronisation de Guilde"}</h3>
                                <p className="mt-1">
                                    {locale === "en"
                                        ? "On SigilOS, the Almanax widget is embedded directly into the guild dashboard to remind all members of the daily tribute."
                                        : "Sur SigilOS, le widget Almanax est directement intégré au tableau de bord pour rappeler l'offrande du jour à tous les membres de votre guilde."}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section aria-labelledby="faq-almanax" className="border-t border-border pt-6">
                        <h2 id="faq-almanax" className="mt-0 text-base sm:text-lg">
                            {t.almanaxPage.faqTitle}
                        </h2>
                        <div className="reg-faq mt-4">
                            {faqItems.map((item) => (
                                <details key={item.q}>
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
