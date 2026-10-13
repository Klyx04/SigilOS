import type { Metadata } from "next";
import { getUserContext } from "@/server/actions/user-actions";
import { getChangelogEntries } from "@/server/actions/changelog-actions";
import { getServerLocale } from "@/lib/i18n/server";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ChangelogContent } from "@/components/changelog/changelog-content";
import { changelogCategoryLabel } from "@/lib/changelog-meta";
import { History } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

export const metadata: Metadata = {
    title: "Mises à jour — SigilOS",
    description: "Journal des versions SigilOS : nouveautés, corrections et sécurité.",
};

type Entry = Awaited<ReturnType<typeof getChangelogEntries>>[number];

function monthKey(iso: string, locale: string): string {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
        month: "long",
        year: "numeric",
    });
}

export default async function GuildChangelogPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) {
        return <AccessDenied />;
    }

    const locale = await getServerLocale();
    const dateLocale = locale === "en" ? enUS : fr;
    // Seules les entrées publiques (isInternal = false) : même journal pour toutes les guildes.
    const entries = await getChangelogEntries(undefined, true, locale);

    const months = new Map<string, Entry[]>();
    for (const entry of entries) {
        const key = monthKey(entry.publishedAt, locale);
        const list = months.get(key);
        if (list) list.push(entry);
        else months.set(key, [entry]);
    }

    return (
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Mises à jour"
                description="Le journal des versions SigilOS : ce qui a changé, corrigé ou été sécurisé."
                icon={History}
                iconColor="#f59e0b"
                backHref={`/dashboard/${guildId}`}
            />

            {entries.length === 0 ? (
                <section className="reg-panel p-6">
                    <p className="text-[15px] font-semibold text-foreground">Aucune mise à jour pour le moment</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                        Les nouveautés SigilOS apparaîtront ici dès leur publication.
                    </p>
                </section>
            ) : (
                <div className="mx-auto w-full max-w-3xl space-y-10">
                    {[...months.entries()].map(([month, monthEntries]) => (
                        <section key={month} aria-label={month}>
                            <div className="mb-4 flex items-center gap-4">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    {month}
                                </span>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            <div className="space-y-4">
                                {monthEntries.map((entry) => (
                                    <article key={entry.id} className="reg-panel p-5 sm:p-6">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                            <span className="reg-mono text-[12px] font-bold text-accent">
                                                {entry.version}
                                            </span>
                                            <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                {changelogCategoryLabel(entry.category)}
                                            </span>
                                            <time
                                                dateTime={entry.publishedAt}
                                                className="ml-auto text-[12px] text-muted-foreground"
                                            >
                                                {format(new Date(entry.publishedAt), "d MMMM yyyy", { locale: dateLocale })}
                                            </time>
                                        </div>
                                        <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground">
                                            {entry.title}
                                        </h2>
                                        {entry.summary && (
                                            <div className="mt-2">
                                                <ChangelogContent content={entry.summary} />
                                            </div>
                                        )}
                                        <div className="mt-4 border-t border-border pt-4">
                                            <ChangelogContent content={entry.content} />
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
