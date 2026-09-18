"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    Check,
    ArrowRight,
    Search,
} from "lucide-react";
import { MODULE_GROUPS, MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";
import type { ModuleKey } from "@/lib/module-types";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { useI18n } from "@/lib/i18n/client";

interface ModulesExplorerProps {
    moduleGroups?: typeof MODULE_GROUPS;
    assetsMap?: typeof MODULE_DOFUS_ASSETS;
}

/** Mapping module keys to category filter */
const KEY_TO_CATEGORY: Record<string, string> = {
    donjons: "sorties",
    calendar: "sorties",
    availability: "sorties",
    services: "sorties",
    songes: "sorties",
    quests: "quetes",
    ocre: "quetes",
    succes: "quetes",
    worldmap: "quetes",
    marche: "economie",
    resources: "economie",
    gallery: "economie",
    roster: "communaute",
    stats: "communaute",
    missions: "communaute",
    commandes: "communaute",
    reactionRoles: "communaute",
    tickets: "communaute",
    logs: "communaute",
    polls: "communaute",
    minigames: "communaute",
    presentation: "communaute",
    profile: "communaute",
    docs: "communaute",
};

/** Micro-badges techniques réels */
const MODULE_HIGHLIGHTS_FR: Partial<Record<ModuleKey, { badge: string; highlight: string }>> = {
    donjons: {
        badge: "Synchronisé Discord",
        highlight: "Bouton d'inscription sur Discord + gestion des compositions et rôles sur le web.",
    },
    songes: {
        badge: "Tactique & Bonus",
        highlight: "Suivi des étages, équipes fixes et fiches de boss intégrées.",
    },
    ocre: {
        badge: "Metamob compatible",
        highlight: "Bourse d'échange interne pour trouver qui a vos archimonstres manquants.",
    },
    quests: {
        badge: "HUD Overlay",
        highlight: "Guides étape par étape avec coordonnées /travel et suivi collectif.",
    },
    worldmap: {
        badge: "Plein écran & PiP",
        highlight: "Cartographie interactive complète de Dofus Unity avec repères partagés.",
    },
    marche: {
        badge: "Sans taxe",
        highlight: "Annonces d'équipements FM et commandes d'artisanat entre membres.",
    },
    calendar: {
        badge: "Rappels auto",
        highlight: "Planning hebdomadaire avec rappels automatiques dans vos salons Discord.",
    },
    missions: {
        badge: "XP & Activité",
        highlight: "Objectifs hebdos de guilde avec validation par capture d'écran.",
    },
};

const MODULE_HIGHLIGHTS_EN: Partial<Record<ModuleKey, { badge: string; highlight: string }>> = {
    donjons: {
        badge: "Discord Synced",
        highlight: "Signup button on Discord + team composition and roles on the web.",
    },
    songes: {
        badge: "Tactics & Bonus",
        highlight: "Floor tracking, fixed parties, and integrated boss strategy sheets.",
    },
    ocre: {
        badge: "Metamob compatible",
        highlight: "Internal trade board to find which guildmate has your missing archmonsters.",
    },
    quests: {
        badge: "HUD Overlay",
        highlight: "Step-by-step guides with /travel coordinates and collective progress.",
    },
    worldmap: {
        badge: "Fullscreen & PiP",
        highlight: "Complete interactive Dofus Unity world map with shared guild landmarks.",
    },
    marche: {
        badge: "Zero tax",
        highlight: "Mage-crafted gear listings and profession orders directly between members.",
    },
    calendar: {
        badge: "Auto reminders",
        highlight: "Weekly schedule with automated notifications in your Discord channels.",
    },
    missions: {
        badge: "XP & Activity",
        highlight: "Weekly guild goals with validation via in-game screenshot OCR.",
    },
};

const MODULE_I18N_EN: Partial<Record<ModuleKey, { label: string; description: string }>> = {
    presentation: {
        label: "Presentation",
        description: "Public guild presentation page. Recruitment, lore, history and core values.",
    },
    roster: {
        label: "Roster & Directory",
        description: "Guild member directory with characters, Discord roles and Dofus character statistics.",
    },
    stats: {
        label: "Guild Statistics",
        description: "Global guild performance dashboard (activity, missions, Dreams, events).",
    },
    calendar: {
        label: "Calendar",
        description: "Guild events, registrations, Discord reminders and recurring event management.",
    },
    availability: {
        label: "Availability",
        description: "Weekly player availability schedule. Gentle weekly reminder if not filled.",
    },
    commandes: {
        label: "Discord Bot Commands",
        description: "Slash command directory: syntax, allowed channels and required permissions.",
    },
    missions: {
        label: "Missions",
        description: "Weekly guild goals, proof submission and automated OCR or admin approval.",
    },
    songes: {
        label: "Infinite Dreams",
        description: "Dreams expedition coordination with team builders, signups, and Discord embeds.",
    },
    ocre: {
        label: "Eternal Harvest (Ochre)",
        description: "Metamob-powered quest tracking. Automatic duplicate matching and trade partner finder.",
    },
    ladder: {
        label: "Leaderboards",
        description: "Guild ranking by Dofus achievement points, synchronized directly from dofus.com.",
    },
    succes: {
        label: "Achievements",
        description: "Personal dungeon achievement checklist and guild directory of who completed what.",
    },
    gallery: {
        label: "Guild Gallery",
        description: "Share and explore gear builds and Dofusbook sets from your guildmates.",
    },
    ladderSync: {
        label: "Ankama Ladder Sync",
        description: "Automated achievement points sync via the official Ankama ladder.",
    },
    manualLadderSync: {
        label: "OCR Screenshot Sync",
        description: "Allows members to sync points by uploading in-game screenshots.",
    },
    services: {
        label: "Guild Services",
        description: "Dungeon carries, crafting assistance and service trades between members.",
    },
    marche: {
        label: "Marketplace",
        description: "Direct player-to-player gear and resource exchange with zero taxes and Discord posts.",
    },
    donjons: {
        label: "Dungeons & Quests",
        description: "Find partners for dungeons and quests. Community party matching tool.",
    },
    docs: {
        label: "Documentation Wiki",
        description: "Internal guild knowledge base and guides with role-based permissions.",
    },
    polls: {
        label: "Polls & Votes",
        description: "Guild governance polls, suggestions and votes with archive history.",
    },
    minigames: {
        label: "Minigames",
        description: "Retro arcade mini-games. Earn points for the guild ladder and challenge mates.",
    },
    quests: {
        label: "Dofus Quests",
        description: "Questline optimization, step-by-step guides, shared progress and party matching.",
    },
    worldmap: {
        label: "World Map",
        description: "Interactive Dofus world map with zones, resources, zaaps and shared landmarks.",
    },
    resources: {
        label: "Resources Hub",
        description: "Dofus info hub: Almanax, Ankama news, encyclopedia and community tools.",
    },
    profile: {
        label: "Member Profile",
        description: "Personalized player profile with character stats, badges and activity history.",
    },
    reactionRoles: {
        label: "Reaction Roles",
        description: "Interactive Discord role picker menus with buttons, dropdowns and auto-swap.",
    },
    tickets: {
        label: "Support Tickets",
        description: "Complete Discord ticket support desk with intake forms, staff claims and transcripts.",
    },
    logs: {
        label: "Audit Logs",
        description: "Audit trail of administrative actions, config edits and moderation events.",
    },
};

const GROUP_LABELS_EN: Record<string, string> = {
    "Général": "General",
    "Fonctionnalités": "Features",
    "Outils": "Tools",
    "Administration": "Administration",
};

export function ModulesExplorer({
    moduleGroups = MODULE_GROUPS,
    assetsMap = MODULE_DOFUS_ASSETS,
}: ModulesExplorerProps = {}) {
    const { t, locale } = useI18n();
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [search, setSearch] = useState("");

    const highlights = locale === "en" ? MODULE_HIGHLIGHTS_EN : MODULE_HIGHLIGHTS_FR;

    const categories = [
        { id: "all", label: t.modulesPage.categories.all },
        { id: "sorties", label: t.modulesPage.categories.sorties },
        { id: "quetes", label: t.modulesPage.categories.quetes },
        { id: "economie", label: t.modulesPage.categories.economie },
        { id: "communaute", label: t.modulesPage.categories.communaute },
    ];

    const allModules = moduleGroups.flatMap((group) =>
        group.modules.map((m) => {
            const enData = locale === "en" ? MODULE_I18N_EN[m.key] : null;
            return {
                ...m,
                label: enData?.label || m.label,
                description: enData?.description || m.description,
                groupLabel: (locale === "en" && GROUP_LABELS_EN[group.label]) ? GROUP_LABELS_EN[group.label] : group.label,
                asset: assetsMap[m.key] || "guild.png",
                category: KEY_TO_CATEGORY[m.key] || "communaute",
            };
        })
    );

    const filteredModules = allModules.filter((m) => {
        const matchesCategory = selectedCategory === "all" || m.category === selectedCategory;
        const matchesSearch =
            !search.trim() ||
            m.label.toLowerCase().includes(search.toLowerCase()) ||
            m.description.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="w-full">
            {/* 1. Header & Hero de la page */}
            <section className="border-b border-border bg-surface/30 pt-12 pb-14 sm:pt-16 sm:pb-20">
                <div className="reg-shell">
                    <div className="max-w-3xl">
                        <p className="reg-eyebrow">{t.modulesPage.badge}</p>
                        <h1 className="mt-3 text-[clamp(2rem,4vw,3.2rem)] font-bold tracking-tight text-foreground leading-[1.08]">
                            {t.modulesPage.title}
                        </h1>
                        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                            {t.modulesPage.subtitle}
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <form action={loginWithDiscord}>
                                <button type="submit" className="reg-btn reg-btn-primary cursor-pointer">
                                    <DiscordIcon className="w-4 h-4" />
                                    {t.modulesPage.configureGuildBtn}
                                </button>
                            </form>
                            <Link
                                href="/#haut"
                                className="px-4 py-2 text-sm font-semibold text-foreground hover:text-accent border border-border hover:border-border-strong rounded-lg bg-surface/40 transition-colors"
                            >
                                {locale === "en" ? "View dashboard preview →" : "Voir le tableau de bord en démo →"}
                            </Link>
                        </div>

                        {/* Réassurance factuelle */}
                        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground font-mono">
                            <span className="flex items-center gap-1.5 text-foreground">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                {locale === "en" ? "100% free" : "100% gratuit"}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                {locale === "en" ? "Discord roles synchronized" : "Rôles Discord synchronisés"}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                {locale === "en" ? "Zero Ankama password" : "Zéro mot de passe Ankama"}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. Filtres & Moteur de recherche */}
            <section className="py-8 border-b border-border bg-background sticky top-14 z-20 backdrop-blur-md bg-background/90">
                <div className="reg-shell flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Boutons de catégories */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    selectedCategory === cat.id
                                        ? "bg-accent text-accent-foreground shadow"
                                        : "bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Barre de recherche */}
                    <div className="relative w-full md:w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.modulesPage.searchPlaceholder}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong"
                        />
                    </div>
                </div>
            </section>

            {/* 3. Grille des Modules réels */}
            <section className="py-12 bg-background">
                <div className="reg-shell space-y-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                        <span>
                            {filteredModules.length} {t.modulesPage.modulesCount}
                        </span>
                        <span>
                            {locale === "en"
                                ? "Source: Official SigilOS Catalog v2.2"
                                : "Source : Catalogue officiel SigilOS v2.2"}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredModules.map((mod) => {
                            const highlight = highlights[mod.key];

                            return (
                                <article
                                    key={mod.key}
                                    className="p-5 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-border-strong transition-all flex flex-col justify-between gap-4 shadow-sm group"
                                >
                                    <div className="space-y-3.5">
                                        {/* En-tête : Asset Dofus officiel + Nom + Badge */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center p-2 group-hover:border-border-strong transition-colors shrink-0">
                                                    <Image
                                                        src={`/assets/dofus/modules/${mod.asset}`}
                                                        alt=""
                                                        width={36}
                                                        height={36}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>

                                                <div>
                                                    <h2 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-tight">
                                                        {mod.label}
                                                    </h2>
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                                        {mod.groupLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            {highlight ? (
                                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 shrink-0">
                                                    {highlight.badge}
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* Description officielle */}
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {mod.description}
                                        </p>

                                        {/* Encart focus si disponible */}
                                        {highlight ? (
                                            <div className="p-2.5 rounded-lg bg-background/80 border border-border/70 text-[11px] text-zinc-300 leading-snug">
                                                <span className="text-accent font-semibold">
                                                    {locale === "en" ? "In game: " : "En jeu : "}
                                                </span>
                                                {highlight.highlight}
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Pied de carte */}
                                    <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="font-mono text-[10px]">
                                            {locale === "en" ? "Module key: " : "Module clé : "}{mod.key}
                                        </span>
                                        <span className="text-foreground group-hover:text-accent font-semibold inline-flex items-center gap-1 transition-colors">
                                            {locale === "en" ? "Activatable" : "Activable"} <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 4. Section CTA finale pour meneurs de guilde */}
            <section className="py-16 border-t border-border bg-surface/40">
                <div className="reg-shell text-center max-w-2xl mx-auto space-y-5">
                    <p className="reg-eyebrow">
                        {locale === "en" ? "Ready to empower your guild?" : "Prêt à équiper ta guilde ?"}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {locale === "en"
                            ? "Deploy SigilOS on your Discord server in 2 minutes."
                            : "Déploie SigilOS sur ton serveur Discord en 2 minutes."}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {locale === "en"
                            ? "Pick your server, choose the modules your guild needs, and invite your members. Everything syncs automatically."
                            : "Choisis ton serveur, sélectionne les modules dont tu as besoin, et invite tes membres. Tout se synchronise automatiquement."}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                        <form action={loginWithDiscord}>
                            <button type="submit" className="reg-btn reg-btn-primary cursor-pointer">
                                <DiscordIcon className="w-4 h-4" />
                                {t.modulesPage.configureGuildBtn}
                            </button>
                        </form>
                        <Link
                            href="/legal/faq"
                            className="px-4 py-2 text-sm font-semibold text-foreground hover:text-accent border border-border rounded-lg bg-surface transition-colors"
                        >
                            {locale === "en" ? "Frequently asked questions →" : "Questions fréquentes →"}
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
