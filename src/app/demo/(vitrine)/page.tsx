import Link from "next/link";
import { DEMO_GUILD, DEMO_STATS } from "@/lib/demo/source";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * `/demo` — **accueil** de la démo (lot S-2a) : ce qu'elle contient, puis les écrans
 * visitables via la coquille (`/demo/annuaire`, `/demo/songes`, …).
 *
 * Aucune base, aucune session : `DEMO_*` est statique (`src/lib/demo/source.ts`).
 */
export default async function DemoHome() {
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
        <>
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
                        <Link href="/demo/annuaire" className="reg-btn reg-btn-primary">
                            {d.navDirectory}
                        </Link>
                        <Link href="/demo/songes" className="reg-link text-sm">
                            {d.navSonges}
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

            <section className="reg-section">
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
        </>
    );
}
