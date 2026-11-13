"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    X,
    ExternalLink,
    Sparkles,
    Shield,
    UserCheck,
    Puzzle,
    BellRing,
    BookmarkCheck,
    PinOff
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GuildGettingStartedBannerProps {
    guildId: string;
    guildName: string;
    hasPseudo: boolean;
    isAdmin: boolean;
}

export function GuildGettingStartedBanner({
    guildId,
    guildName,
    hasPseudo,
    isAdmin,
}: GuildGettingStartedBannerProps) {
    const [dismissed, setDismissed] = useState(true); // default true to avoid flash
    const [collapsed, setCollapsed] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        try {
            const isDismissed = window.localStorage.getItem(`sigilos-guide-banner-dismissed-${guildId}`) === "true";
            const isCollapsed = window.localStorage.getItem(`sigilos-guide-banner-collapsed-${guildId}`) === "true";
            setDismissed(isDismissed);
            setCollapsed(isCollapsed);
        } catch {
            setDismissed(false);
        }
    }, [guildId]);

    if (!isAdmin || dismissed) return null;

    const handleDismiss = () => {
        try {
            window.localStorage.setItem(`sigilos-guide-banner-dismissed-${guildId}`, "true");
        } catch { /* storage fallback */ }
        setDismissed(true);
        toast.info("Guide désépinglé. Vous pouvez retrouver la configuration dans Centre Admin.");
    };

    const toggleCollapse = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
            window.localStorage.setItem(`sigilos-guide-banner-collapsed-${guildId}`, next ? "true" : "false");
        } catch { /* storage fallback */ }
    };

    const copyDashboardLink = () => {
        const url = `${window.location.origin}/dashboard/${guildId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            toast.success("Lien d'accès copié ! Vous pouvez le coller dans Discord.");
            setTimeout(() => setCopied(false), 2500);
        }).catch(() => {
            toast.error("Échec de la copie automatique.");
        });
    };

    return (
        <section
            aria-label="Guide de mise en route de guilde"
            className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.04] via-black/40 to-black/25 p-5 md:p-6 shadow-sm transition-all"
        >
            {/* Header de la bannière */}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            Guide de démarrage · Staff
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            Configurez l&apos;essentiel avant d&apos;inviter vos membres
                        </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                        Bienvenue dans le QG de {guildName} !
                    </h2>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/30 transition-colors"
                        title={collapsed ? "Déplier le guide" : "Réduire le guide"}
                        aria-label={collapsed ? "Déplier le guide" : "Réduire le guide"}
                    >
                        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-black/30 transition-colors"
                        title="Désépingler ce guide"
                        aria-label="Désépingler ce guide"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Corps déplié : Les 4 étapes clés */}
            {!collapsed && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Étape 1 : Partager le lien du dashboard */}
                    <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-400">Étape 1</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Prioritaire
                                </span>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Inviter vos membres</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Donnez ce lien à vos membres pour qu&apos;ils puissent se connecter avec leur compte Discord.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={copyDashboardLink}
                            className="reg-btn reg-btn-gold w-full text-xs py-2 flex items-center justify-center gap-1.5"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? "Lien copié !" : "Copier le lien d'accès"}</span>
                        </button>
                    </div>

                    {/* Étape 2 : Lier son personnage */}
                    <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-400">Étape 2</span>
                                {hasPseudo ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Fait
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        À faire
                                    </span>
                                )}
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Votre identité Dofus</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {hasPseudo
                                    ? "Votre personnage est bien lié à votre profil staff."
                                    : "Liez votre pseudo pour être reconnu par vos membres."}
                            </p>
                        </div>
                        {hasPseudo ? (
                            <Link
                                href={`/dashboard/${guildId}/profile`}
                                className="reg-btn reg-btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                            >
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Voir mon profil</span>
                            </Link>
                        ) : (
                            <Link
                                href={`/dashboard/${guildId}/profile?edit=identity`}
                                className="reg-btn reg-btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                            >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Lier mon personnage</span>
                            </Link>
                        )}
                    </div>

                    {/* Étape 3 : Modules actifs */}
                    <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-400">Étape 3</span>
                                <span className="text-[10px] font-semibold text-muted-foreground">Personnalisation</span>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Activer vos modules</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Choisissez ce dont votre guilde a besoin : Missions, Songes, Ocre, Services...
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${guildId}/admin/modules`}
                            className="reg-btn reg-btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                        >
                            <Puzzle className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Gérer les modules</span>
                        </Link>
                    </div>

                    {/* Étape 4 : Salons de notification Discord */}
                    <div className="rounded-xl border border-border bg-black/30 p-4 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-400">Étape 4</span>
                                <span className="text-[10px] font-semibold text-muted-foreground">Optionnel</span>
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Salons du bot Discord</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Définissez où le bot publie les missions, récapitulatifs et annonces de guilde.
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${guildId}/admin/settings?tab=annonces`}
                            className="reg-btn reg-btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                        >
                            <BellRing className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Régler les salons</span>
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
}
