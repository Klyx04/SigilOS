"use client";

import Link from "next/link";
import type { PublicGuildShowcase } from "@/server/actions/presentation-actions";
import { GuildEmblem } from "@/components/guild/guild-emblem";
import { useI18n } from "@/lib/i18n/client";

function formatCount(value: number, locale: string): string {
    return value.toLocaleString(locale === "en" ? "en-US" : "fr-FR");
}

export function LandingProof({ guilds = [] }: { guilds?: PublicGuildShowcase[] }) {
    const { t, locale } = useI18n();
    const ranked = [...guilds].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    const primary = ranked[0] ?? null;

    // Calculs 100% réels basés sur les données en BDD
    const totalMembers = ranked.reduce((sum, guild) => sum + (guild.memberCount || 0), 0);
    const activeServers = Array.from(
        new Set(guilds.map((g) => g.server).filter((s): s is string => Boolean(s)))
    );

    return (
        <section aria-labelledby="preuve-titre" className="reg-section bg-surface">
            <div className="reg-shell">
                <div>
                    <p className="reg-eyebrow">{t.landing.proofEyebrow}</p>
                    <h2
                        id="preuve-titre"
                        className="mt-3 max-w-[28ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                    >
                        {t.landing.proofTitle}
                    </h2>
                    <p className="mt-4 max-w-[64ch] text-base text-muted-foreground leading-relaxed">
                        {t.landing.proofSubtitle}
                    </p>

                    {primary && (
                        <div className="mt-8 rounded-xl border border-border-strong bg-background/60 p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-border">
                                <div>
                                    <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                                        {t.landing.proofActiveGuild}
                                    </span>
                                    <div className="mt-3 flex items-center gap-3">
                                         <GuildEmblem src={primary.iconUrl} name={primary.name} size={40} />
                                         <div className="min-w-0">
                                             <div className="text-base font-bold text-foreground truncate">
                                                 {primary.name}
                                             </div>
                                             {primary.server ? (
                                                 <div className="text-xs text-muted-foreground font-mono">
                                                     {locale === "en" ? "Server" : "Serveur"} {primary.server}
                                                 </div>
                                             ) : null}
                                         </div>
                                     </div>
                                 </div>

                                 <div className="sm:border-l sm:border-border sm:pl-6">
                                     <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                                         {t.landing.proofTotalMembers}
                                     </span>
                                     <div className="mt-3 flex items-baseline gap-2">
                                         <span className="text-3xl font-extrabold text-foreground tabular-nums">
                                             {formatCount(primary.memberCount || 0, locale)}
                                         </span>
                                         <span className="text-xs font-mono text-muted-foreground">
                                             {locale === "en" ? "active players" : "joueurs actifs"}
                                         </span>
                                     </div>
                                 </div>

                                 <div className="sm:border-l sm:border-border sm:pl-6">
                                     <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                                         {ranked.length > 1 ? (locale === "en" ? "Registered Guilds" : "Guildes enregistrées") : "Dofus Unity"}
                                     </span>
                                     <div className="mt-3 flex items-baseline gap-2">
                                         <span className="text-3xl font-extrabold text-accent tabular-nums">
                                             {ranked.length > 1 ? formatCount(ranked.length, locale) : "100%"}
                                         </span>
                                         <span className="text-xs font-mono text-muted-foreground">
                                             {ranked.length > 1 
                                                 ? `${locale === "en" ? "guilds" : "guildes"} (${formatCount(totalMembers, locale)} ${locale === "en" ? "members" : "membres"})` 
                                                 : (locale === "en" ? "live in-game" : "opérationnel en jeu")}
                                         </span>
                                     </div>
                                 </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground font-mono">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    <span>
                                        {activeServers.length > 0
                                            ? `${locale === "en" ? "Live on official Unity servers" : "Actif sur serveurs officiels Unity"} : ${activeServers.join(", ")}`
                                            : (locale === "en" ? "Live on official Dofus Unity servers" : "Actif sur serveurs officiels Dofus Unity")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Link
                                        href="/guilds"
                                        className="reg-link text-xs font-semibold text-foreground hover:text-accent"
                                    >
                                        {t.landing.proofBrowseDirectory}
                                    </Link>
                                    <Link href="/changelog" className="reg-link-quiet text-xs">
                                        {t.footer.changelog}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
