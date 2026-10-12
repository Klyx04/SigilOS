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

// Map slug → route Dashboard correspondante
const MODULE_ROUTES: Record<string, { label: string; href: string }> = {
    // 🌟 Guides Membres
    "introduction":                    { label: "Accueil Dashboard",           href: "/home" },
    "missions":                        { label: "Missions de Guilde",          href: "/missions" },
    "quete-ocre":                      { label: "Quête Ocre",                  href: "/quete-ocre" },
    "ladder":                          { label: "Ladder de Guilde",            href: "/ladder" },
    "succes":                          { label: "Succès & Donjons",            href: "/succes" },
    "quetes-dofus":                    { label: "Les Quêtes Dofus",            href: "/quetes-dofus" },
    "donjons-et-quetes":               { label: "Donjons & Quêtes (LFG)",      href: "/donjons-et-quetes" },
    "songes":                          { label: "Songes Infinis",              href: "/songes" },
    "galerie-stuff":                   { label: "Galerie de Stuff",            href: "/galerie-stuff" },
    "services":                        { label: "Services de Guilde",          href: "/services" },
    "planning":                        { label: "Planning & Disponibilités",   href: "/planning" },
    "members":                         { label: "Annuaire de Guilde",          href: "/members" },
    "calendar":                        { label: "Calendrier des Sorties",      href: "/calendar" },
    "sondages":                        { label: "Sondages Communautaires",     href: "/sondages" },
    "worldmap":                        { label: "Carte du Monde HD",           href: "/worldmap" },
    "mini-jeux":                       { label: "Mini-Jeux Dofus",             href: "/mini-jeux" },
    "ressources":                      { label: "Ressources Dofus",            href: "/ressources" },

    // 🛡️ Administration & Staff
    "admin-getting-started":           { label: "Centre de Contrôle Admin",   href: "/admin" },
    "admin-settings":                  { label: "Paramètres Généraux",         href: "/admin/settings" },
    "admin-permissions":               { label: "Rôles & Permissions",         href: "/admin/permissions" },
    "admin-modules":                   { label: "Gestion des Modules",         href: "/admin/modules" },
    "admin-reaction-roles":            { label: "Reaction Roles Discord",      href: "/admin/reaction-roles" },
    "admin-tickets":                   { label: "Bot Tickets & Support",       href: "/admin/tickets" },
    "admin-presentation":              { label: "Identité & Vitrine Publique", href: "/admin/presentation" },
    "admin-missions":                  { label: "Gestion des Missions",        href: "/missions/manage" },
    "admin-validation":                { label: "File de Validation OCR",      href: "/admin/validation" },
    "admin-members":                   { label: "Audit Roster Discord",        href: "/admin/members" },
    "module-recrutement-cycle-de-vie": { label: "Recrutement & Cycle de Vie", href: "/admin/members" },
    "admin-points":                    { label: "Points & Économie Guilde",    href: "/admin/points" },
    "admin-logs":                      { label: "Logs d'Audit Staff",          href: "/admin/logs" },
    "admin-api-keys":                  { label: "Clés d'API Rest",             href: "/admin/api-keys" },
};

export function DocViewer({
    content,
    title,
    lastUpdate,
    prev,
    next,
    breadcrumbs,
    guildId,
    slug
}: {
    content: string,
    title: string,
    lastUpdate: string,
    prev?: { title: string, slug: string } | null,
    next?: { title: string, slug: string } | null,
    breadcrumbs?: { label: string, href: string }[],
    guildId?: string | null,
    slug?: string
}) {
    const [headings, setHeadings] = React.useState<{ id: string; text: string; level: number }[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);

    // Module route link
    const moduleRoute = slug ? MODULE_ROUTES[slug] : null;
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

                    <h1 className="mb-3 text-2xl font-semibold leading-snug text-foreground">
                        {title}
                    </h1>
                    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span className="reg-mono">Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>
                    </div>
                </header>

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
