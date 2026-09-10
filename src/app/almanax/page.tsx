import { getUpcomingAlmanax, type AlmanaxItem } from "@/server/actions/resources-actions";
import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { Calendar, Sparkles, Coins, Gift, ShieldCheck } from "lucide-react";

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
        <div className="relative min-h-screen landing-theme bg-background text-foreground selection:bg-accent-teal/30 font-sans flex flex-col">
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
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        mainEntity: [
                            {
                                "@type": "Question",
                                name: "Qu'est-ce que l'Almanax dans Dofus ?",
                                acceptedAnswer: {
                                    "@type": "Answer",
                                    text: "L'Almanax est une quête journalière répétable située au Sanctuaire de l'Almanax [-4,-24]. Chaque jour, un Méryde offre un bonus unique en jeu et demande une offrande d'objets en échange d'expérience, de kamas et d'une page de calendrier pour le Dofus Dolmanax.",
                                },
                            },
                            {
                                "@type": "Question",
                                name: "Combien de jours faut-il pour obtenir le Dolmanax ?",
                                acceptedAnswer: {
                                    "@type": "Answer",
                                    text: "Il faut accomplir 365 quêtes journalières de l'Almanax (non consécutives) pour réunir les 365 pages de calendrier et valider la quête finale du Dolmanax.",
                                },
                            },
                        ],
                    },
                ]}
            />

            <main className="flex-1 w-auto relative z-10 pt-32 pb-24 px-6 md:px-8">
                <div className="max-w-6xl mx-auto space-y-12">
                    {/* Header */}
                    <div className="text-center space-y-4 max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-black uppercase tracking-widest text-success">
                            <Sparkles className="w-3.5 h-3.5" /> Almanax Dofus
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                            Almanax du Jour & Calendrier
                        </h1>
                        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                            Consultez l'offrande quotidienne du Sanctuaire de l'Almanax, découvrez les bonus en jeu et anticipez les prochains jours pour maximiser vos gains.
                        </p>
                    </div>

                    {/* Today's Focus Card */}
                    {todayAlmanax && (
                        <div className="relative overflow-hidden rounded-3xl border border-success/30 bg-surface/60 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-success/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                                {/* Date & Offering details */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        <Calendar className="w-4 h-4 text-success" />
                                        <span className="capitalize">{todayDateFormatted}</span>
                                        <span className="px-2 py-0.5 rounded-md bg-success/20 text-success text-[10px]">Aujourd'hui</span>
                                    </div>

                                    <div className="flex items-center gap-5">
                                        {todayAlmanax.tribute?.item?.image_urls?.sd && (
                                            <div className="w-20 h-20 rounded-2xl bg-elevated border border-border flex items-center justify-center p-2 relative shrink-0 shadow-inner">
                                                <Image
                                                    src={todayAlmanax.tribute.item.image_urls.sd}
                                                    alt={todayAlmanax.tribute.item.name}
                                                    width={64}
                                                    height={64}
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-xs text-muted-foreground font-semibold">Offrande requise :</div>
                                            <div className="text-2xl md:text-3xl font-black text-foreground">
                                                {todayAlmanax.tribute.quantity}x {todayAlmanax.tribute.item.name}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bonus */}
                                    <div className="rounded-2xl bg-elevated/70 border border-border p-4 md:p-5 space-y-2">
                                        <div className="text-xs font-black uppercase tracking-widest text-warning flex items-center gap-2">
                                            <Gift className="w-4 h-4" /> Bonus du Méryde : {todayAlmanax.bonus?.type?.name || "Effet spécial"}
                                        </div>
                                        <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                            {todayAlmanax.bonus?.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Location & Action Box */}
                                <div className="rounded-2xl border border-border bg-elevated p-6 space-y-4 text-center lg:text-left flex flex-col justify-between h-full">
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lieu de la quête</div>
                                        <div className="text-lg font-black text-foreground">Sanctuaire de l'Almanax</div>
                                        <div className="text-xs text-success font-mono font-bold bg-success/10 px-2.5 py-1 rounded-lg inline-block">
                                            Position [-4,-24] (Zaap Plaine des Scarafeuilles)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upcoming Days Calendar */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-success" /> Prochains Jours de l'Almanax
                            </h2>
                            <span className="text-xs text-muted-foreground font-semibold">
                                {upcomingAlmanax.length} jours prévus
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingAlmanax.slice(0, 12).map((item, idx) => {
                                const dateFormatted = new Date(item.date).toLocaleDateString("fr-FR", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                });

                                return (
                                    <Link
                                        key={item.date || idx}
                                        href={`/almanax/${item.date.slice(0, 10)}`}
                                        className="rounded-2xl border border-border bg-surface/40 hover:bg-surface/70 hover:border-success/30 p-5 space-y-3 transition-all flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground capitalize">
                                                    {dateFormatted}
                                                </span>
                                                <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                                                    +{idx + 1}j
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {item.tribute?.item?.image_urls?.sd && (
                                                    <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center p-1 shrink-0">
                                                        <Image
                                                            src={item.tribute.item.image_urls.sd}
                                                            alt={item.tribute.item.name}
                                                            width={36}
                                                            height={36}
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-xs text-muted-foreground">Offrande :</div>
                                                    <div className="text-sm font-black text-foreground line-clamp-1">
                                                        {item.tribute.quantity}x {item.tribute.item.name}
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                {item.bonus?.description}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Educational / SEO Section */}
                    <div className="rounded-3xl border border-border bg-surface/30 p-8 md:p-10 space-y-6">
                        <h3 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2.5">
                            <Image
                                src="/module-dofus/Dofus_Dolmanax.png"
                                alt="Dofus Dolmanax"
                                width={28}
                                height={28}
                                className="w-7 h-7 object-contain shrink-0"
                                unoptimized
                            />
                            Tout savoir sur la quête de l'Almanax & le Dolmanax
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs md:text-sm text-muted-foreground leading-relaxed">
                            <div className="space-y-2">
                                <strong className="text-foreground block text-sm">Le Dolmanax</strong>
                                <p>
                                    Accomplir 365 offrandes débloque le Dofus Dolmanax qui confère un bonus permanent de +50 dans les 4 éléments (Force, Intelligence, Chance, Agilité).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <strong className="text-foreground block text-sm">Anticiper les Offrandes</strong>
                                <p>
                                    Acheter ou récolter les ressources plusieurs jours à l'avance permet d'éviter l'inflation des prix en hôtel de vente le jour même de l'offrande.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <strong className="text-foreground block text-sm">Synchronisation de Guilde</strong>
                                <p>
                                    Sur SigilOS, le widget Almanax est directement intégré au tableau de bord pour rappeler l'offrande du jour à tous les membres de votre guilde.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
