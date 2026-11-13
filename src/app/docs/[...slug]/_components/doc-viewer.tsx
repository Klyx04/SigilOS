"use client";

import { DocContent } from "@/components/doc/doc-content";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { DocBreadcrumbs } from "@/components/doc/doc-breadcrumbs";
import { DocPagination } from "@/components/doc/doc-pagination";
import { getModuleRoute } from "@/lib/docs-modules";
import { getDocMeta } from "@/lib/doc-meta";

export function DocViewer({
    content,
    title,
    lastUpdate,
    prev,
    next,
    breadcrumbs,
    guildId,
    slug,
    accessLevel
}: {
    content: string,
    title: string,
    lastUpdate: string,
    prev?: { title: string, slug: string } | null,
    next?: { title: string, slug: string } | null,
    breadcrumbs?: { label: string, href: string }[],
    guildId?: string | null,
    slug?: string,
    accessLevel?: string | null
}) {
    const [headings, setHeadings] = React.useState<{ id: string; text: string; level: number }[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);

    // Module route link
    const moduleRoute = slug ? getModuleRoute(slug) : null;
    const moduleHref = moduleRoute && guildId
        ? `/dashboard/${guildId}${moduleRoute.href}`
        : null;

    React.useEffect(() => {
        // Listen on the docs main scroll container, not window
        const scrollEl = document.getElementById("docs-main-scroll");
        if (!scrollEl) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { root: scrollEl, rootMargin: "-80px 0% -80% 0%" }
        );

        const headingElements = document.querySelectorAll("article h2, article h3");
        headingElements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [content]);

    React.useEffect(() => {
        const scrollEl = document.getElementById("docs-main-scroll");
        if (!scrollEl) return;
        const handleScroll = () => {
            const scrolled = (scrollEl.scrollTop / (scrollEl.scrollHeight - scrollEl.clientHeight)) * 100;
            setScrollProgress(scrolled);
        };
        scrollEl.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollEl.removeEventListener("scroll", handleScroll);
    }, []);

    React.useEffect(() => {
        const parser = new DOMParser();
        const docContent = parser.parseFromString(content, 'text/html');
        const headingElements = docContent.querySelectorAll('h2, h3');
        const extracted = Array.from(headingElements).map((el) => {
            const text = el.textContent || "";
            const id = el.id || text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return { id, text, level: parseInt(el.tagName[1]) };
        });
        setHeadings(extracted);
    }, [content]);

    return (
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-10 relative items-start w-full transition-all duration-300">
            {/* Progression de lecture : une barre, à l'accent du thème (pas de dégradé). */}
            <div className="fixed top-0 left-0 w-full h-0.5 z-[60] pointer-events-none" aria-hidden="true">
                <div
                    className="h-full bg-accent transition-[width] duration-150"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Article — min-w-0 empêche le débordement sous la TOC droite */}
            <article className="flex-1 min-w-0 overflow-hidden w-full">
                <header className="mb-8 border-b border-border pb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            {breadcrumbs && <DocBreadcrumbs items={breadcrumbs} />}
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent" aria-hidden="true">
                            {(() => {
                                const DocIcon = getDocMeta(slug ?? "").icon;
                                return <DocIcon className="h-5 w-5" />;
                            })()}
                        </div>
                        <div className="min-w-0">
                            <p className="reg-eyebrow">{breadcrumbs?.[0]?.label ?? "Documentation"}</p>
                            <h1 className="mt-1.5 text-2xl font-semibold leading-snug text-foreground">
                                {title}
                            </h1>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                        <span className="reg-mono">Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>
                        {accessLevel === "ADMIN" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                                Staff
                            </span>
                        )}
                        {accessLevel === "MEMBER" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Membres
                            </span>
                        )}
                    </div>
                </header>

                {/* Sommaire chips — visible sous xl (la TOC latérale prend le relais au-delà) */}
                {headings.length > 1 && (
                    <nav aria-label="Sommaire" className="mb-8 flex items-center gap-2 overflow-x-auto pb-1 xl:hidden">
                        {headings.map((heading, i) => (
                            <a
                                key={i}
                                href={`#${heading.id}`}
                                className={cn(
                                    "shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                                    activeId === heading.id
                                        ? "border-accent bg-surface text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-surface hover:text-foreground"
                                )}
                            >
                                {heading.text}
                            </a>
                        ))}
                    </nav>
                )}

                {(() => {
                    const EXTENDED_SEPARATOR = /<!--\s*(?:MORE|EXTENDED)\s*-->/i;
                    const renderedContent = content.match(EXTENDED_SEPARATOR)
                        ? content.replace(
                            EXTENDED_SEPARATOR,
                            `<div class="my-12 border-t border-border pt-4">
                                <p class="text-[11px] font-semibold text-muted-foreground">Approfondissements & données avancées</p>
                            </div>`
                        )
                        : content;

                    return <DocContent content={renderedContent} />;
                })()}

                <DocPagination prev={prev} next={next} />
            </article>

            {/* Table of Contents - Right Sticky */}
            {
                headings.length > 0 && (
                    <aside className="hidden xl:block w-64 shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/5">
                        <div className="space-y-3">
                            <h4 className="px-2 text-[11px] font-semibold text-muted-foreground">Sur cette page</h4>
                            <nav className="flex flex-col gap-0.5">
                                {headings.map((heading, i) => (
                                    <a
                                        key={i}
                                        href={`#${heading.id}`}
                                        className={cn(
                                            "border-l-2 py-1.5 pl-2.5 pr-2 text-[12px] transition-colors",
                                            activeId === heading.id
                                                ? "border-l-accent bg-surface font-semibold text-foreground"
                                                : "border-l-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
                                            heading.level === 3 && "ml-4"
                                        )}
                                    >
                                        {heading.text}
                                    </a>
                                ))}
                            </nav>

                            {/* Lien vers le module associé */}
                            {moduleHref && (
                                <div className="mt-6 border-t border-border pt-4">
                                    <p className="mb-2 px-2 text-[11px] font-semibold text-muted-foreground">Accéder au module</p>
                                    <Link
                                        href={moduleHref}
                                        className="group flex items-center gap-2.5 rounded-[4px] border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-elevated"
                                    >
                                        <ExternalLink className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-[13px] font-semibold text-foreground">{moduleRoute?.label}</span>
                                            <span className="mt-0.5 block text-[11px] text-muted-foreground">Ouvrir dans le tableau de bord</span>
                                        </span>
                                    </Link>
                                </div>
                            )}

                            <div className="mt-6 border-t border-border pt-4">
                                <p className="mb-2 px-2 text-[11px] font-semibold text-muted-foreground">Besoin d&apos;aide ?</p>
                                <a
                                    href="https://discord.gg/BMVvXpYHEt"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-[4px] border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-elevated"
                                >
                                    <span className="block text-[13px] font-semibold text-foreground">Rejoindre le Discord</span>
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">Posez vos questions à la communauté.</span>
                                </a>
                            </div>
                        </div>
                    </aside>
                )
            }
        </div >
    );
}
