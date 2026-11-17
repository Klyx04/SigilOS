"use client";

import Link from "next/link";
import { ShieldAlert, Eye, HelpCircle, X, ChevronLeft, ChevronRight, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Scope labels humains
const SCOPE_LABELS: Record<string, string> = {
    guilds: "Guildes",
    "game-data": "Game Data",
    users: "Utilisateurs",
    logs: "Logs",
    news: "News",
    maintenance: "Maintenance",
};

const TUTORIAL_KEY = "sigilos-god-tutorial-v1";

interface TutorialStep {
    icon: string;
    title: string;
    body: React.ReactNode;
}

/**
 * Construit les étapes du mini-tour contextuel pour un sub-god.
 * ⚠️ Les steps sont définies DANS le composant et reçoivent `activeScopes`
 * en paramètre (ne jamais référencer une fonction externe non définie).
 */
function getTutorialSteps(activeScopes: string[]): TutorialStep[] {
    const scopeNames =
        activeScopes.length > 0
            ? activeScopes.map(s => SCOPE_LABELS[s] || s).join(", ")
            : "aucun";

    return [
        {
            icon: "📜",
            title: "Tout ce que vous faites ici est tracé",
            body: (
                <>
                    Chaque clic, chaque action que vous effectuez dans ce panneau est
                    enregistré avec <strong className="text-warning">votre nom, la date et
                    ce que vous avez fait</strong>. Il existe une trace complète et
                    impossible à modifier de votre activité.
                </>
            ),
        },
        {
            icon: "🛡️",
            title: "Vous ne voyez que votre périmètre",
            body: (
                <>
                    Vous n'avez accès qu'aux sections qui vous ont été <strong className="text-warning">spécifiquement accordées</strong>.
                    Tout le reste est verrouillé par sécurité : si une section n'est pas
                    prévue pour vous, elle est <strong className="text-warning">inaccessible</strong> — c'est une
                    protection volontaire, pas un bug.
                </>
            ),
        },
        {
            icon: "🙋",
            title: "Besoin de plus d'accès ?",
            body: (
                <>
                    Pour obtenir des droits supplémentaires, adressez-vous à votre administrateur.
                    On accorde les accès un par un, uniquement si nécessaire. Pour voir ce qui
                    vous est actuellement accordé, cliquez sur le bouton{" "}
                    <strong className="text-warning">"Mon accès"</strong> en haut du bandeau.
                </>
            ),
        },
        {
            icon: "✅",
            title: "Vos accès actuels",
            body: (
                <>
                    <strong className="text-warning">{scopeNames}</strong>
                    {activeScopes.length === 0
                        ? " — vous n'avez actuellement aucun accès actif."
                        : " — voilà les sections sur lesquelles vous pouvez travailler."}
                </>
            ),
        },
    ];
}

/**
 * Bandeau d'avertissement + onboarding guidé affiché aux sub-gods dans le dashboard God.
 * - Rappelle que toutes les actions sont auditées + liste les scopes actifs.
 * - Mini tour contextuel (cards) à la 1ère visite (localStorage), rejouable via le bouton.
 * - Non affiché pour un super-admin complet (isFullAdmin).
 */
export function GodAccessBanner({ activeScopes, isFullAdmin, myGrants = [] }: { activeScopes: string[]; isFullAdmin: boolean; myGrants?: { brickId: string; label: string; expiresAt: string | null; scope: string | null }[] }) {
    const [mounted, setMounted] = useState(false);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    // Tick 1s → décomptes en h/m/s temps réel.
    // ⚡ Mesure du 25/10/2026 : ce timer tournait sur **toutes** les pages God, même quand le
    // bandeau n'était pas rendu (super-admin complet, ou aucun accès expirable) ⇒ un re-render
    // par seconde dans le shell pour rien. On ne tick que s'il y a un décompte à afficher.
    const [, setTick] = useState(0);
    const hasExpiryCountdown = !isFullAdmin && myGrants.some((grant) => !!grant.expiresAt);
    useEffect(() => {
        if (!hasExpiryCountdown) return;
        const t = setInterval(() => setTick(v => v + 1), 1000);
        return () => clearInterval(t);
    }, [hasExpiryCountdown]);

    /** Formate un temps restant en h/m/s. */
    const formatHMS = (expiresAt: string | null): string | null => {
        if (!expiresAt) return null;
        const leftMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
        const s = Math.floor(leftMs / 1000) % 60;
        const m = Math.floor(leftMs / 60000) % 60;
        const h = Math.floor(leftMs / 3600000);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    // Ne pas rendre le dial de tuto avant hydraulicité (évite les erreurs d'hydratation server/client).
    useEffect(() => {
        setMounted(true);
    }, []);

    const steps = getTutorialSteps(activeScopes);

    // 1ère visite : ouvrir le tuto automatiquement (localStorage non défini).
    useEffect(() => {
        if (!mounted || isFullAdmin) return;
        const seen = window.localStorage.getItem(TUTORIAL_KEY);
        if (seen !== "seen") {
            setTutorialOpen(true);
            setCurrentStep(0);
        }
    }, [mounted, isFullAdmin]);

    const closeTutorial = () => {
        setTutorialOpen(false);
        try {
            window.localStorage.setItem(TUTORIAL_KEY, "seen");
        } catch {
            // localStorage indisponible (ex : cookies bloqués) → on ne bloque pas l'UI.
        }
    };

    const replayTutorial = () => {
        setCurrentStep(0);
        setTutorialOpen(true);
    };

    const nextStep = () => {
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    if (isFullAdmin) return null;

    const scopeNames =
        activeScopes.length > 0
            ? activeScopes.map(s => SCOPE_LABELS[s] || s).join(", ")
            : "aucun";

    // Rendu du dial (overlay) du tuto — uniquement si ouvert + hydraté.
    const tutorialOverlay =
        mounted && tutorialOpen ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Tutoriel God">
                <div className="w-full max-w-md rounded-xl border border-warning/30 bg-background p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-warning/15 border border-warning/20 shrink-0">
                                <ShieldAlert className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-warning uppercase tracking-wide">Onboarding sub-god</div>
                                <div className="text-caption text-warning/80 font-semibold">Étape {currentStep + 1} / {steps.length}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={closeTutorial}
                            aria-label="Fermer le tutoriel"
                            className="p-2 rounded-xl bg-surface/10 hover:bg-elevated border border-border text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{steps[currentStep]?.icon}</span>
                            <h3 className="text-base font-semibold text-foreground">{steps[currentStep]?.title}</h3>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed">{steps[currentStep]?.body}</div>
                    </div>

                    {/* Points de progression */}
                    <div className="flex items-center justify-center gap-1.5 mb-4">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Aller à l'étape ${i + 1}`}
                                onClick={() => setCurrentStep(i)}
                                className={`h-1.5 rounded-full transition-all ${i === currentStep ? "w-6 bg-warning" : "w-1.5 bg-elevated/20 hover:bg-elevated/40"}`}
                            />
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-surface/10 hover:bg-elevated border border-border text-caption font-semibold text-foreground uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" /> Précédent
                        </button>

                        {currentStep === steps.length - 1 ? (
                            <button
                                type="button"
                                onClick={closeTutorial}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/20 hover:bg-warning/30 border border-warning/40 text-caption font-semibold text-warning uppercase tracking-wide transition-colors"
                            >
                                J'ai compris <CheckIcon />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-warning/20 hover:bg-warning/30 border border-warning/40 text-caption font-semibold text-warning uppercase tracking-wide transition-colors"
                            >
                                Suivant <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        ) : null;

    return (
        <>
            {tutorialOverlay}

            <div className="mx-4 mt-4 md:mx-8 lg:mx-12 rounded-xl border border-warning/30 bg-warning/10 p-4 flex flex-col md:flex-row md:items-center gap-4 ">
                <div className="flex items-center gap-3 shrink-0">
                    <div className="p-2 rounded-xl bg-warning/15 border border-warning/20 shrink-0">
                        <ShieldAlert className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-warning uppercase tracking-wide">Accès délégué (sub-god)</div>
                        <div className="text-caption text-warning/80 font-semibold">Scopes actifs : {scopeNames}</div>
                    </div>
                </div>

                <div className="flex-1 text-xs text-warning/90 leading-relaxed">
                    ⚠️ <strong>Tout ce que vous faites ici est tracé</strong> (qui, quand, quoi).
                    Vous ne pouvez agir que sur les sections qui vous ont été accordées.
                    Le reste est verrouillé par sécurité — aucune action n'est possible en dehors de votre périmètre.
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={replayTutorial}
                        aria-label="Aide / Revoir le tutoriel"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/10 hover:bg-elevated border border-border text-caption font-semibold text-warning uppercase tracking-wide transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" /> Aide / Revoir le tuto
                    </button>
                </div>
            </div>

            {/* 🔄 P3-R — Vue "Mon accès" : briques + temps restant, TOUJOURS visible (h/m/s temps réel) */}
            <div className="mx-4 md:mx-8 lg:mx-12 mt-2 rounded-xl border border-warning/20 bg-warning/5 p-4 ">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="text-caption font-semibold uppercase tracking-wide text-warning flex items-center gap-2">
                            <KeyRound className="w-3.5 h-3.5" /> Vos accès actifs — temps réel
                        </div>
                    </div>
                    {myGrants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun accès basé sur une brique accordée pour le moment.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {myGrants.map((g) => {
                                const expired = g.expiresAt ? new Date(g.expiresAt).getTime() < Date.now() : false;
                                const leftLabel = formatHMS(g.expiresAt);
                                return (
                                    <div key={g.brickId} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold text-foreground">{g.label}</div>
                                            <div className="text-caption text-muted-foreground">{g.scope ? SCOPE_LABELS[g.scope] || g.scope : "—"}</div>
                                        </div>
                                        {expired ? (
                                            <Badge className="bg-destructive/15 text-destructive border-destructive/30">EXPIRÉ</Badge>
                                        ) : leftLabel === null ? (
                                            <Badge className="bg-success/15 text-success border-success/30">ILLIMITÉ</Badge>
                                        ) : (
                                            <Badge className="bg-success/15 text-success border-success/30 font-mono">
                                                {leftLabel}
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
        </>
    );
}

/** Petit icône check inline (évite un import dédié lourd pour un seul usage). */
function CheckIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}