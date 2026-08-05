"use client";

import Link from "next/link";
import { ShieldAlert, Eye, HelpCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

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
                    enregistré avec <strong className="text-amber-300">votre nom, la date et
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
                    Vous n'avez accès qu'aux sections qui vous ont été <strong className="text-amber-300">spécifiquement accordées</strong>.
                    Tout le reste est verrouillé par sécurité : si une section n'est pas
                    prévue pour vous, elle est <strong className="text-amber-300">inaccessible</strong> — c'est une
                    protection volontaire, pas un bug.
                </>
            ),
        },
        {
            icon: "🙋",
            title: "Besoin de plus d'accès ?",
            body: (
                <>
                    Pour obtenir des droits supplémentaires, demandez à votre administrateur
                    via la page{" "}
                    <Link href="/god/delegates" className="underline text-amber-300 hover:text-amber-200">
                        /god/delegates
                    </Link>
                    . On accorde les accès un par un, uniquement si nécessaire.
                </>
            ),
        },
        {
            icon: "✅",
            title: "Vos accès actuels",
            body: (
                <>
                    <strong className="text-amber-300">{scopeNames}</strong>
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
export function GodAccessBanner({ activeScopes, isFullAdmin }: { activeScopes: string[]; isFullAdmin: boolean }) {
    const [mounted, setMounted] = useState(false);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

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
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Tutoriel God">
                <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#111] p-5 shadow-2xl">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
                                <ShieldAlert className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-amber-300 uppercase tracking-widest">Onboarding sub-god</div>
                                <div className="text-[11px] text-amber-400/80 font-semibold">Étape {currentStep + 1} / {steps.length}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={closeTutorial}
                            aria-label="Fermer le tutoriel"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{steps[currentStep]?.icon}</span>
                            <h3 className="text-base font-black text-white">{steps[currentStep]?.title}</h3>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed">{steps[currentStep]?.body}</div>
                    </div>

                    {/* Points de progression */}
                    <div className="flex items-center justify-center gap-1.5 mb-4">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Aller à l'étape ${i + 1}`}
                                onClick={() => setCurrentStep(i)}
                                className={`h-1.5 rounded-full transition-all ${i === currentStep ? "w-6 bg-amber-400" : "w-1.5 bg-white/20 hover:bg-white/40"}`}
                            />
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black text-zinc-300 uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" /> Précédent
                        </button>

                        {currentStep === steps.length - 1 ? (
                            <button
                                type="button"
                                onClick={closeTutorial}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-black text-amber-200 uppercase tracking-widest transition-colors"
                            >
                                J'ai compris <CheckIcon />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-black text-amber-200 uppercase tracking-widest transition-colors"
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

            <div className="mx-4 mt-4 md:mx-8 lg:mx-12 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col md:flex-row md:items-center gap-4 backdrop-blur-md">
                <div className="flex items-center gap-3 shrink-0">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <div className="text-xs font-black text-amber-300 uppercase tracking-widest">Accès délégué (sub-god)</div>
                        <div className="text-[11px] text-amber-400/80 font-semibold">Scopes actifs : {scopeNames}</div>
                    </div>
                </div>

                <div className="flex-1 text-xs text-amber-300/90 leading-relaxed">
                    ⚠️ <strong>Tout ce que vous faites ici est tracé</strong> (qui, quand, quoi).
                    Vous ne pouvez agir que sur les sections qui vous ont été accordées.
                    Le reste est verrouillé par sécurité — aucune action n'est possible en dehors de votre périmètre.
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href="/god/delegates"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black text-amber-200 uppercase tracking-widest transition-colors"
                    >
                        <Eye className="w-4 h-4" /> Mes scopes
                    </Link>
                    <button
                        type="button"
                        onClick={replayTutorial}
                        aria-label="Aide / Revoir le tutoriel"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black text-amber-200 uppercase tracking-widest transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" /> Aide / Revoir le tuto
                    </button>
                </div>
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