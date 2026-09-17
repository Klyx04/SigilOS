"use client";

/**
 * Pied de page public — registre (refonte anti-slop).
 *
 * Ce qui a été retiré volontairement :
 *  - la capsule flottante centrée qui se cachait au scroll (composant
 *    démonstratif qui rivalisait avec les actions produit) ;
 *  - les libellés tout en capitales `font-black uppercase tracking-widest` ;
 *  - la mention « Système Opérationnel » dupliquée en deux endroits.
 *
 * Ce qui le remplace : un pied de page statique en colonnes de texte, une
 * ligne de statut réellement mesurée (`/api/health`), le lien de soutien
 * (Ko-fi) rangé ici plutôt qu'en pastille flottante, et les liens légaux.
 */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { loginWithDiscord } from "@/server/actions/auth-actions";

type SystemStatus = "online" | "degraded" | "offline";

interface GalacticFooterProps {
    /** Conservé pour compatibilité d'appel ; le pied de page est désormais identique partout. */
    variant?: "standard" | "compact";
    isMember?: boolean;
}

/** « Tableau de bord » est rendu à part : il déclenche la connexion sans session. */
const PLATFORM_LINKS = [
    { label: "Annuaire des guildes", href: "/guilds" },
    { label: "Guides", href: "/guides" },
    { label: "Journal des mises à jour", href: "/changelog" },
    { label: "Feuille de route", href: "/roadmap" },
];

const TOOL_LINKS = [
    { label: "Rush Sylvestre", href: "/guides/rush-sylvestre" },
    { label: "Fiches boss & donjons", href: "/boss" },
    { label: "Almanax", href: "/almanax" },
    { label: "Carte du monde", href: "/carte-du-monde" },
];

const LEGAL_LINKS = [
    { label: "CGU", href: "/legal/cgu" },
    { label: "Confidentialité", href: "/legal/privacy" },
    { label: "Mentions légales", href: "/legal/mentions" },
    { label: "FAQ", href: "/legal/faq" },
];

const SUPPORT_URL = "https://ko-fi.com/wylan";

/** Serveur Discord d'entraide — seule invitation publique connue. */
const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

export function GalacticFooter({ variant = "standard", isMember: _isMember = false }: GalacticFooterProps) {
    const [systemStatus, setSystemStatus] = useState<SystemStatus>("online");
    const [mounted, setMounted] = useState(false);
    // La session est fournie par le SessionProvider du layout racine : aucune
    // requête supplémentaire, `useSession` lit simplement le contexte.
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    useEffect(() => {
        setMounted(true);
        let cancelled = false;
        const checkHealth = async () => {
            try {
                const res = await fetch("/api/health");
                if (cancelled) return;
                if (!res.ok) {
                    setSystemStatus("offline");
                    return;
                }
                const data = await res.json();
                setSystemStatus(
                    data.status === "healthy" ? "online" : data.status === "degraded" ? "degraded" : "offline",
                );
            } catch {
                if (!cancelled) setSystemStatus("offline");
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 60000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const statusLabel =
        systemStatus === "online" ? "Service opérationnel" : systemStatus === "degraded" ? "Service dégradé" : "Service indisponible";

    const statusDot = (
        <span
            aria-hidden="true"
            className={cn(
                "w-1.5 h-1.5 rounded-full",
                systemStatus === "online" ? "bg-success" : systemStatus === "degraded" ? "bg-warning" : "bg-danger",
            )}
        />
    );

    /* ── Variant compact ──────────────────────────────────────────────────────
       Une seule ligne, **dans le flux** (plus de capsule `fixed` centrée qui se
       cachait au scroll). C'est la forme attendue par les coques applicatives
       (espace de guilde, docs) : le parent décide de la largeur, et le bloc se
       place normalement à la fin de la zone scrollable. Aucune classe `.reg-*`
       ici : ces coques gardent la typographie du dashboard (Monospace Geist). */
    if (variant === "compact") {
        return (
            <div className="border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <span className="font-semibold text-foreground">
                        SigilOS
                        <span className="font-mono font-normal text-muted-foreground"> · v2.2 · bêta</span>
                    </span>

                    <nav aria-label="Informations légales" className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link href="/changelog" className="text-muted-foreground hover:text-foreground transition-colors">
                            Journal
                        </Link>
                        <Link href="/legal/cgu" className="text-muted-foreground hover:text-foreground transition-colors">
                            CGU
                        </Link>
                        <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                            Confidentialité
                        </Link>
                        <Link href="/legal/mentions" className="text-muted-foreground hover:text-foreground transition-colors">
                            Mentions
                        </Link>
                        <Link href="/legal/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                            Aide
                        </Link>
                        <a
                            href={SUPPORT_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Soutenir
                        </a>
                    </nav>

                    <Link
                        href="/status"
                        className="ml-auto inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {statusDot}
                        <span className="font-mono">{mounted ? statusLabel : "État du service"}</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <footer className="w-full border-t border-border bg-background mt-auto">
            <div className="reg-shell py-12">
                <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
                    {/* Marque */}
                    <div>
                        <Link href="/" className="flex items-center gap-2" aria-label="SigilOS, accueil">
                            <Image src="/assets/ui/logo-v2.png" alt="" width={26} height={26} className="object-contain" />
                            <span className="text-base font-bold tracking-tight text-foreground">SigilOS</span>
                        </Link>
                        <p className="mt-3 max-w-[26rem] text-sm text-muted-foreground leading-relaxed">
                            Tableau de bord de guilde Dofus relié à Discord : sorties, quêtes, membres et progression au
                            même endroit. Gratuit, sans accès au compte Ankama.
                        </p>
                        <p className="mt-4 reg-mono text-xs text-muted-foreground">Bêta ouverte · v2.2</p>
                    </div>

                    {/* Plateforme */}
                    <nav aria-label="Plateforme">
                        <h2 className="reg-eyebrow">Plateforme</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            {/* Sans session : on démarre la connexion Discord au lieu d'envoyer
                                vers /dashboard, qui n'a plus d'écran pour les visiteurs. */}
                            <li>
                                {isAuthenticated ? (
                                    <Link
                                        href="/dashboard"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Tableau de bord
                                    </Link>
                                ) : (
                                    <form action={loginWithDiscord}>
                                        <button
                                            type="submit"
                                            className="text-left text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Tableau de bord
                                        </button>
                                    </form>
                                )}
                            </li>
                            {PLATFORM_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Outils */}
                    <nav aria-label="Outils ouverts">
                        <h2 className="reg-eyebrow">Outils ouverts</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            {TOOL_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Système */}
                    <div>
                        <h2 className="reg-eyebrow">Système</h2>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link
                                    href="/status"
                                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {statusDot}
                                    {mounted ? statusLabel : "État du service"}
                                </Link>
                            </li>
                            <li>
                                <a
                                    href={DISCORD_INVITE_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground transition-colors reg-external"
                                >
                                    Serveur Discord
                                </a>
                            </li>
                            <li>
                                <a
                                    href={SUPPORT_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground transition-colors reg-external"
                                >
                                    Soutenir SigilOS
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Mentions */}
                <div className="mt-10 pt-6 border-t border-border flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <p className="max-w-[46rem] text-xs text-muted-foreground leading-relaxed">
                        Projet communautaire indépendant, sans affiliation avec Ankama. DOFUS est une marque déposée
                        d&apos;Ankama Games. Données complémentaires par DofusDB (LPNC-IA 1.0) et Ganymède. © 2026 Sigil
                        Project.
                    </p>
                    <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                        {LEGAL_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </footer>
    );
}
