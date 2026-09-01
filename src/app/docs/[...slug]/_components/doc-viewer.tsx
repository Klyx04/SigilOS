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
    "module-recrutement-cycle-de-vie": { label: "Recrutement & Cycle de Vie", href: "/admin/recruitment" },
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
            {/* Scroll Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 z-[60] pointer-events-none">
                <div
                    className="h-full bg-gradient-to-r from-teal-500 via-teal-400 to-teal-300 transition-all duration-150"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Article — min-w-0 empêche le débordement sous la TOC droite */}
            <article className="flex-1 min-w-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
                <header className="mb-8 border-b border-border pb-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            {breadcrumbs && <DocBreadcrumbs items={breadcrumbs} />}
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-foreground font-heading tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground">
                        {title}
                    </h1>
                    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>
                    </div>
                </header>

                <DocContent content={content} />

                <DocPagination prev={prev} next={next} />
            </article>

            {/* Table of Contents - Right Sticky */}
            {
                headings.length > 0 && (
                    <aside className="hidden xl:block w-64 shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/5">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2 flex items-center gap-2">
                                <div className="w-1 h-3 bg-teal-500 rounded-full" />
                                Sur cette page
                            </h4>
                            <nav className="flex flex-col gap-1">
                                {headings.map((heading, i) => (
                                    <a
                                        key={i}
                                        href={`#${heading.id}`}
                                        className={cn(
                                            "text-sm py-1.5 px-3 rounded-lg border border-transparent transition-all",
                                            activeId === heading.id
                                                ? "text-teal-400 bg-teal-500/10 font-bold border-teal-500/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-surface",
                                            heading.level === 3 && "ml-4 text-muted-foreground border-l border-border rounded-l-none"
                                        )}
                                    >
                                        {heading.text}
                                    </a>
                                ))}
                            </nav>

                            {/* Lien vers le module associé */}
                            {moduleHref && (
                                <div className="pt-6 mt-6 border-t border-border">
                                    <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest mb-3 px-2">Accéder au module</p>
                                    <Link
                                        href={moduleHref}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-teal-500/5 border border-teal-500/15 hover:bg-teal-500/10 hover:border-teal-500/30 transition-all group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0 group-hover:bg-teal-500/20 transition-colors">
                                            <ExternalLink className="w-4 h-4 text-teal-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-teal-300 group-hover:text-teal-200 transition-colors leading-tight truncate">{moduleRoute?.label}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">Ouvrir dans le dashboard</p>
                                        </div>
                                    </Link>
                                </div>
                            )}

                            <div className="pt-6 mt-6 border-t border-border">
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest mb-4 px-2">Besoin d&apos;aide ?</p>
                                <a
                                    href="https://discord.gg/BMVvXpYHEt"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10 hover:bg-teal-500/10 transition-all group"
                                >
                                    <p className="text-xs font-bold text-teal-300 mb-1 group-hover:text-foreground">Rejoindre le Discord</p>
                                    <p className="text-caption text-muted-foreground">Posez vos questions à la communauté.</p>
                                </a>
                            </div>
                        </div>
                    </aside>
                )
            }
        </div >
    );
}
