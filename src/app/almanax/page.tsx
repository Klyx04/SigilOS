import { getUpcomingAlmanax, type AlmanaxItem } from "@/server/actions/resources-actions";
import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { ALMANAX_FAQ } from "@/lib/almanax-faq";
import { auth } from "@/auth";

/**
 * Page publique `/almanax` — registre.
 *
 * Ce qui a été retiré volontairement (fiche de reprise §1.3) :
 *  - le badge pilule « ✨ Almanax Dofus » (`rounded-full bg-success/10`) et le
 *    titre centré `text-3xl md:text-5xl font-black` ;
 *  - la carte d'accroche `rounded-3xl shadow-2xl backdrop-blur-xl` et son orbe
 *    `w-96 h-96 blur-3xl` collé dans le coin ;
 *  - les six libellés `font-black uppercase tracking-widest` ;
 *  - la grille de douze cartes `rounded-2xl` et leurs tuiles d'icônes
 *    (`rounded-2xl bg-elevated`, pastille pilule `+Nj`).
 * À la place : en-tête gauche-aligné, offrande du jour en panneau de données,
 * calendrier prévisionnel en tableau (`reg-table`), fiche Dolmanax en texte
 * courant (`reg-doc`). Aucun texte de fond modifié. Les deux Q/R du JSON-LD
 * `FAQPage` sont désormais **affichées** (section « Questions fréquentes »,
 * `.reg-faq`) depuis la source unique `lib/almanax-faq.ts` : du contenu balisé
 * mais invisible est une erreur de référencement.
 */

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
    const almanaxList = await getUpcomingAlmanax();
    const session = await auth();

    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";

    const todayAlmanax = almanaxList[0] as AlmanaxItem | undefined;
    const upcomingAlmanax = almanaxList.slice(1);

    const todayDateFormatted = todayAlmanax
        ? new Date(todayAlmanax.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "Aujourd'hui";

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
                            { "@type": "ListItem", position: 1, name: "Accueil", item: getAppBaseUrl() },
                            { "@type": "ListItem", position: 2, name: "Almanax Dofus", item: `${getAppBaseUrl()}/almanax` },
                        ],
                    },
                    {
                        // Balisage aligné sur la FAQ réellement affichée (source : lib/almanax-faq.ts).
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        mainEntity: ALMANAX_FAQ.map((item) => ({
                            "@type": "Question",
                            name: item.q,
                            acceptedAnswer: { "@type": "Answer", text: item.a },
                        })),
                    },
                ]}
            />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14 space-y-10">
                    {/* En-tête de page — gauche-aligné, sans badge ni titre centré */}
                    <header>
                        <p className="reg-eyebrow">Almanax Dofus</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                            Almanax du Jour & Calendrier
                        </h1>
                        <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                            Consultez l'offrande quotidienne du Sanctuaire de l'Almanax, découvrez les bonus en jeu et anticipez les prochains jours pour maximiser vos gains.
                        </p>
                    </header>

                    {/* Offrande du jour — panneau de données, sans halo ni ombre */}
                    {todayAlmanax && (
                        <section aria-labelledby="offrande-du-jour" className="reg-panel">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
                                <h2 id="offrande-du-jour" className="reg-eyebrow">Offrande du jour</h2>
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <time
                                        dateTime={todayAlmanax.date.slice(0, 10)}
                                        className="reg-mono text-xs text-muted-foreground capitalize"
                                    >
                                        {todayDateFormatted}
                                    </time>
                                    <span className="reg-tag reg-tag-accent">Aujourd&apos;hui</span>
                                </p>
                            </div>

                            <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
                                {/* Offrande + bonus du Méryde (données de jeu) */}
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
                                            <p className="text-xs text-muted-foreground">Offrande requise :</p>
                                            <p className="mt-0.5 text-lg font-semibold text-foreground">
                                                <span className="reg-mono text-accent">{todayAlmanax.tribute.quantity}x</span>{" "}
                                                {todayAlmanax.tribute.item.name}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="reg-callout border-warning/40">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                Bonus du Méryde : {todayAlmanax.bonus?.type?.name || "Effet spécial"}
                                            </p>
                                            <p>{todayAlmanax.bonus?.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Lieu de la quête — séparé par un filet, pas une seconde carte */}
                                <div className="lg:border-l lg:border-border lg:pl-6">
                                    <p className="text-xs text-muted-foreground">Lieu de la quête</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">Sanctuaire de l&apos;Almanax</p>
                                    <p className="reg-mono mt-1.5 text-xs text-muted-foreground">
                                        Position [-4,-24] (Zaap Plaine des Scarafeuilles)
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Calendrier prévisionnel — un jour par ligne, en tableau */}
                    <section aria-labelledby="prochains-jours" className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                            <h2 id="prochains-jours" className="reg-eyebrow">
                                Prochains Jours de l&apos;Almanax
                            </h2>
                            <span className="reg-count">{upcomingAlmanax.length} jours prévus</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="reg-table min-w-[34rem]">
                                <thead>
                                    <tr>
                                        <th scope="col" className="w-[9rem]">
                                            Jour
                                        </th>
                                        <th scope="col" className="w-[15rem]">
                                            Offrande
                                        </th>
                                        <th scope="col">Bonus du Méryde</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {upcomingAlmanax.slice(0, 12).map((item, idx) => {
                                        const dateFormatted = new Date(item.date).toLocaleDateString("fr-FR", {
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
                                                        +{idx + 1}j
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

                    {/* Fiche Dolmanax — texte courant, pas de carte mise en scène */}
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
                            Tout savoir sur la quête de l&apos;Almanax & le Dolmanax
                        </h2>
                        <div className="mt-5 grid gap-6 md:grid-cols-3">
                            <div>
                                <h3 className="mt-0">Le Dolmanax</h3>
                                <p className="mt-1">
                                    Accomplir 365 offrandes débloque le Dofus Dolmanax qui confère un bonus permanent de +50 dans les 4 éléments (Force, Intelligence, Chance, Agilité).
                                </p>
                            </div>
                            <div>
                                <h3 className="mt-0">Anticiper les Offrandes</h3>
                                <p className="mt-1">
                                    Acheter ou récolter les ressources plusieurs jours à l'avance permet d'éviter l'inflation des prix en hôtel de vente le jour même de l'offrande.
                                </p>
                            </div>
                            <div>
                                <h3 className="mt-0">Synchronisation de Guilde</h3>
                                <p className="mt-1">
                                    Sur SigilOS, le widget Almanax est directement intégré au tableau de bord pour rappeler l'offrande du jour à tous les membres de votre guilde.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* FAQ — mêmes Q/R que le JSON-LD `FAQPage` (source unique : lib/almanax-faq.ts) */}
                    <section aria-labelledby="faq-almanax" className="border-t border-border pt-6">
                        <h2 id="faq-almanax" className="mt-0 text-base sm:text-lg">
                            Questions fréquentes
                        </h2>
                        <div className="reg-faq mt-4">
                            {ALMANAX_FAQ.map((item) => (
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
