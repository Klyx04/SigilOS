import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { MemberDirectory } from "@/components/directory/member-directory";
import { DEMO_GUILD, DEMO_LEGENDARY_ITEMS, DEMO_MEMBERS, DEMO_STATS } from "@/lib/demo/source";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * `/demo` — démo publique : une guilde de démonstration **en lecture seule** (chantier `S`).
 *
 * Décisions appliquées (mesurées : `docs/plans/PLAN-DEMO-PUBLIQUE.md`) :
 *  - **D1** : les données viennent de `src/lib/demo/source.ts` (source statique) — **aucune base**,
 *    aucune guilde dans `GuildConfig`, donc aucun risque de synchronisation, de notification ou de purge ;
 *  - **D2** : `robots: { index: false }` au rodage — l'indexation s'ouvrira quand la page portera du
 *    contenu unique (leçon almanax : page faible = « Explorée, actuellement non indexée ») ;
 *  - **D3** : aucune action serveur importée ici. Le CTA principal est un **lien** vers `/login` et non un
 *    formulaire d'action : c'est ce qui rend la règle « aucune écriture atteignable » vérifiable en lisant
 *    simplement le dossier de la route.
 *
 * Aucun appel à `auth()`, `cookies()` ni `db` : la page ne coûte aucune requête (la prérendabilité
 * complète dépend du layout racine — lot `S-5`).
 *
 * L'annuaire est le **composant réel du produit** (`MemberDirectory`) utilisé en `readOnly` : pas de lien
 * vers `/dashboard/**`, donc aucun mur de connexion sur une page publique.
 */

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();
    const d = t.demoPage;
    return {
        title: d.metaTitle,
        description: d.metaDesc,
        alternates: { canonical: "/demo" },
        robots: { index: false, follow: true },
        openGraph: { title: d.metaTitle, description: d.metaDesc, type: "website", url: "/demo" },
    };
}

export default async function DemoPage() {
    const { t } = await getServerI18n();
    const d = t.demoPage;

    const stats = [
        { label: d.statsMembers, value: DEMO_STATS.memberCount },
        { label: d.statsJobs, value: DEMO_STATS.jobCount },
        { label: d.statsMules, value: DEMO_STATS.muleCount },
        { label: d.statsMages, value: DEMO_STATS.mageCount },
        { label: d.statsAllied, value: DEMO_STATS.alliedCount },
    ];

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col">
            <a className="reg-skip" href="#contenu">
                {t.nav.skipToContent}
            </a>

            {/* `isMember={false}` et aucun `user` : aucune session lue, donc aucune requête d'auth. */}
            <PublicHeader variant="hero" isMember={false} />

            <main id="contenu" className="flex-1 w-full">
                {/* Bandeau d'honnêteté — on ne doit jamais pouvoir croire à une vraie guilde. */}
                <div className="border-b border-border bg-surface">
                    <div className="reg-shell flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                        <span className="reg-mono text-xs font-semibold uppercase tracking-wider text-warning">
                            {d.bannerLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">{d.bannerDetail}</span>
                    </div>
                </div>

                <section className="reg-section-tight">
                    <div className="reg-shell pt-12">
                        <p className="reg-eyebrow">{d.eyebrow}</p>
                        <h1 className="mt-3 max-w-[22ch] text-[clamp(2rem,4.4vw,3.25rem)] font-bold leading-[1.05] tracking-tight text-foreground">
                            {d.title}
                        </h1>
                        <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-muted-foreground">
                            {d.subtitle}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                            <Link href="/login" className="reg-btn reg-btn-primary">
                                {t.landing.ctaConfigure}
                            </Link>
                            <Link href="/modules" className="reg-link text-sm">
                                {t.landing.ctaModules}
                            </Link>
                        </div>
                        <ul className="reg-mono mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                            {d.facts.map((fact) => (
                                <li key={fact}>{fact}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section aria-labelledby="demo-contenu-titre" className="reg-section bg-surface">
                    <div className="reg-shell">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                            <h2 id="demo-contenu-titre" className="reg-eyebrow">
                                {d.statsTitle}
                            </h2>
                            <p className="reg-mono text-xs text-muted-foreground">
                                {d.guildLabel} · {DEMO_GUILD.name} — {DEMO_GUILD.server}
                            </p>
                        </div>
                        <dl className="mt-6 grid grid-cols-2 border-t border-border-strong sm:grid-cols-5">
                            {stats.map((item) => (
                                <div key={item.label} className="border-b border-border py-4 pr-4">
                                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                                    <dd className="reg-metric mt-1 text-2xl font-bold tabular-nums text-foreground">
                                        {item.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>

                <section aria-labelledby="demo-annuaire-titre" className="reg-section">
                    <div className="reg-shell">
                        <p className="reg-eyebrow">{d.directoryEyebrow}</p>
                        <h2
                            id="demo-annuaire-titre"
                            className="mt-3 max-w-[30ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            {d.directoryTitle}
                        </h2>
                        <p className="mt-3 max-w-[64ch] text-base leading-relaxed text-muted-foreground">
                            {d.directoryDesc}
                        </p>

                        <div className="mt-8">
                            <MemberDirectory
                                initialMembers={DEMO_MEMBERS}
                                legendaryItems={[...DEMO_LEGENDARY_ITEMS]}
                                guildId={DEMO_GUILD.id}
                                readOnly
                            />
                        </div>
                    </div>
                </section>

                <section className="reg-section bg-surface">
                    <div className="reg-shell grid gap-10 lg:grid-cols-2 lg:gap-14">
                        <div>
                            <h2 className="reg-eyebrow">{d.realTitle}</h2>
                            <ul className="mt-4 border-t border-border-strong">
                                {d.realItems.map((item) => (
                                    <li key={item} className="border-b border-border py-3 text-sm text-muted-foreground">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h2 className="reg-eyebrow">{d.nextTitle}</h2>
                            <ol className="mt-4 border-t border-border-strong">
                                {d.nextItems.map((item, index) => (
                                    <li
                                        key={item}
                                        className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-border py-3"
                                    >
                                        <span className="reg-mono text-xs text-accent pt-0.5">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-sm text-muted-foreground">{item}</span>
                                    </li>
                                ))}
                            </ol>
                            <p className="mt-4 text-xs leading-relaxed text-subtle-foreground">{d.signoff}</p>
                        </div>
                    </div>
                </section>
            </main>

            <GalacticFooter isMember={false} />
        </div>
    );
}
