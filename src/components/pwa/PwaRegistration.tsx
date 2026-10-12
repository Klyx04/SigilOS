"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, Check, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PwaRegistration() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js").then((registration) => {
                    // ⚠️ FIX (icônes cassées après déploiement PWA) : le navigateur ne
                    // re-vérifie `/sw.js` qu'à la navigation, et encore : seulement si
                    // le script n'est pas mis en cache. Pour qu'un nouveau SW (ex. après
                    // la correction cache-first) soit pris en compte IMMÉDIATEMENT, on
                    // force `registration.update()` au chargement.
                    registration.update().catch(() => {
                        // Ignorer les erreurs — le navigateur réessaiera à la navigation.
                    });

                    // Dès qu'une nouvelle version est téléversée, elle va passer par
                    // skipWaiting() + clients.claim() (déjà dans sw.js) → prend la main
                    // sans rechargement. On notifie juste pour diagnostiquer.
                    registration.addEventListener("updatefound", () => {
                        const sw = registration.installing;
                        if (!sw) return;
                        sw.addEventListener("statechange", () => {
                            if (sw.state === "activated") {
                                console.info("[SW] Nouvelle version active (caches purgés).");
                            }
                        });
                    });
                }).catch(() => {
                    // Silently fail if SW unsupported
                });
            });
        }
    }, []);

    return null;
}

const LS_DISMISSED_AT = "sigilos-pwa-dismissed-at";
const LS_IMPRESSIONS = "sigilos-pwa-impressions";
const LS_INSTALLED_AT = "sigilos-pwa-installed-at";
const LS_VISITS = "sigilos-pwa-visits";
const LS_MINIMIZED = "sigilos-pwa-minimized";
/** Silence après un refus explicite « Ne plus me proposer ». */
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
/** Plafond d'affichages auto de la bannière pleine — après, seule la pastille passive reste. */
const MAX_BANNER_IMPRESSIONS = 3;
/** Délai avant l'apparition auto (laisse la page respirer, pas de popup à froid). */
const SHOW_DELAY_MS = 6000;
/** Pas d'auto-affichage à la toute première visite. */
const MIN_VISITS_FOR_AUTOSHOW = 2;

interface InstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readNum(key: string): number {
    try {
        const raw = window.localStorage.getItem(key);
        const n = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

function writeStr(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Stockage indisponible (navigation privée) — on reste non persistant, sans casser.
    }
}

function isStandaloneMode(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

function isIosDevice(): boolean {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent || "";
    const iosUA = /iPad|iPhone|iPod/.test(ua);
    const iPadOsDesktopUA = window.navigator.maxTouchPoints > 2 && /Mac/.test(ua);
    return iosUA || iPadOsDesktopUA;
}

function isAndroidDevice(): boolean {
    if (typeof window === "undefined") return false;
    return /Android/.test(window.navigator.userAgent || "");
}

function dismissedRecently(): boolean {
    const at = readNum(LS_DISMISSED_AT);
    return at > 0 && Date.now() - at < COOLDOWN_MS;
}

/**
 * Prompt d'install partagé au niveau du module : `beforeinstallprompt` ne
 * fire qu'une fois par chargement de page, donc la bannière (montée dans le
 * layout racine) le publie ici pour les autres points d'entrée passifs
 * (ex. ligne « Installer l'app » des réglages profil, montée plus tard en nav SPA).
 */
type PromptListener = () => void;
let sharedPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<PromptListener>();

function getSharedPrompt(): InstallPromptEvent | null {
    return sharedPrompt;
}

function setSharedPrompt(e: InstallPromptEvent | null) {
    sharedPrompt = e;
    promptListeners.forEach((l) => l());
}

function subscribeSharedPrompt(l: PromptListener): () => void {
    promptListeners.add(l);
    return () => {
        promptListeners.delete(l);
    };
}

/**
 * Bannière d'installation PWA anti-nag :
 * - le refus explicite (« Ne plus me proposer ») fait taire TOUT pendant 30 j (localStorage),
 * - la bannière pleine ne s'affiche en auto que 3 fois max, après la 1re visite et 6 s de délai,
 * - la croix réduit en pastille passive (réouvrable au clic) au lieu de re-nagger,
 * - sur iOS (pas de `beforeinstallprompt`) : pastille passive + feuille d'instructions,
 * - l'install réussie est mémorisée (compteur local : impressions / visites / install).
 */
export function PwaInstallBanner() {
    const [phase, setPhase] = useState<"hidden" | "banner" | "mini">("hidden");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [ios, setIos] = useState(false);
    const [hasPrompt, setHasPrompt] = useState(false);
    const promptRef = useRef<InstallPromptEvent | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (isStandaloneMode()) {
            writeStr(LS_INSTALLED_AT, String(Date.now()));
            return;
        }
        if (readNum(LS_INSTALLED_AT) > 0) return;

        const visits = readNum(LS_VISITS) + 1;
        writeStr(LS_VISITS, String(visits));

        const onIos = isIosDevice();
        setIos(onIos);

        // Refus explicite récent → silence total (même pas la pastille).
        if (dismissedRecently()) return;

        if (onIos) {
            // iOS ne déclenche jamais `beforeinstallprompt` : seule la pastille
            // passive permet de découvrir l'install (jamais de bannière auto).
            if (visits >= MIN_VISITS_FOR_AUTOSHOW) setPhase("mini");
            return;
        }

        // Choix précédent « réduire » → on reste en pastille passive.
        if (readNum(LS_MINIMIZED) > 0) setPhase("mini");

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            promptRef.current = e as InstallPromptEvent;
            setSharedPrompt(promptRef.current);
            setHasPrompt(true);
            if (readNum(LS_MINIMIZED) > 0) return;
            if (visits < MIN_VISITS_FOR_AUTOSHOW) return;
            if (readNum(LS_IMPRESSIONS) >= MAX_BANNER_IMPRESSIONS) {
                setPhase((p) => (p === "hidden" ? "mini" : p));
                return;
            }
            if (timerRef.current !== null) return;
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                if (dismissedRecently()) return;
                writeStr(LS_IMPRESSIONS, String(readNum(LS_IMPRESSIONS) + 1));
                setPhase("banner");
            }, SHOW_DELAY_MS);
        };

        const handleInstalled = () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            promptRef.current = null;
            setSharedPrompt(null);
            setHasPrompt(false);
            setPhase("hidden");
            setSheetOpen(false);
            writeStr(LS_INSTALLED_AT, String(Date.now()));
            toast.success("Application SigilOS installée avec succès !");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        window.addEventListener("appinstalled", handleInstalled);

        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    // Échap ferme la feuille iOS.
    useEffect(() => {
        if (!sheetOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSheetOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [sheetOpen]);

    if (readNumSafeInstalled()) return null;

    const handleInstall = async () => {
        if (ios) {
            setSheetOpen(true);
            return;
        }
        const prompt = promptRef.current;
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
            promptRef.current = null;
            setSharedPrompt(null);
            setHasPrompt(false);
            setPhase("hidden");
            writeStr(LS_INSTALLED_AT, String(Date.now()));
        } else {
            // Refus du prompt natif = refus explicite → silence 30 j.
            writeStr(LS_DISMISSED_AT, String(Date.now()));
            setPhase("hidden");
        }
    };

    /** Croix : réduit en pastille passive (mémorisé), ne re-nag pas. */
    const handleMinimize = () => {
        writeStr(LS_MINIMIZED, "1");
        setPhase("mini");
    };

    /** « Ne plus me proposer » : silence total pendant 30 j. */
    const handleSnooze = () => {
        writeStr(LS_DISMISSED_AT, String(Date.now()));
        writeStr(LS_MINIMIZED, "0");
        setPhase("hidden");
        setSheetOpen(false);
    };

    const handleMiniClick = () => {
        if (ios) {
            setSheetOpen(true);
            return;
        }
        if (promptRef.current) setPhase("banner");
    };

    return (
        <>
            {phase === "banner" && (
                <div className="fixed bottom-24 right-6 z-50 max-w-sm p-3.5 rounded-3xl bg-surface/95 border border-warning/30 backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
                    <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-warning" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-foreground">Installer SigilOS App</h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                            Sorties, guides et rappels en 1 toucher, même hors-ligne
                        </p>
                        <button
                            type="button"
                            onClick={handleSnooze}
                            className="mt-1 text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            Ne plus me proposer
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            size="sm"
                            onClick={handleInstall}
                            className="h-8 px-3 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground text-xs font-black gap-1 shadow-md"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Installer
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleMinimize}
                            aria-label="Réduire la proposition d'installation"
                            title="Réduire"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {phase === "mini" && (hasPrompt || ios) && (
                <button
                    type="button"
                    onClick={handleMiniClick}
                    aria-label="Installer SigilOS App"
                    title="Installer SigilOS App"
                    className="fixed bottom-24 right-6 z-50 h-10 w-10 rounded-full bg-surface/95 border border-warning/30 backdrop-blur-xl shadow-xl flex items-center justify-center hover:border-warning/60 transition-colors"
                >
                    <Smartphone className="w-5 h-5 text-warning" />
                </button>
            )}

            <PwaIosSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSnooze={handleSnooze} />
        </>
    );
}

/** Feuille d'instructions iOS (Safari n'a pas de `beforeinstallprompt`). Partagée banner / réglages. */
export function PwaIosSheet({ open, onClose, onSnooze }: {
    open: boolean;
    onClose: () => void;
    onSnooze: () => void;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <button
                type="button"
                aria-label="Fermer"
                onClick={onClose}
                className="absolute inset-0 bg-black/60"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Installer SigilOS sur iPhone"
                className="relative w-full max-w-sm rounded-3xl bg-surface border border-border p-5 space-y-4 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-black text-foreground">Installer SigilOS sur iPhone</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            3 gestes, depuis Safari — ensuite c&apos;est une vraie app plein écran.
                        </p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onClose}
                        aria-label="Fermer"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <ol className="space-y-3 text-xs text-foreground">
                    <li className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0">
                            <Share className="w-4 h-4 text-info" />
                        </span>
                        <span><strong>1.</strong> Touchez <strong>Partager</strong> en bas de Safari</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0">
                            <Plus className="w-4 h-4 text-info" />
                        </span>
                        <span><strong>2.</strong> Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-success" />
                        </span>
                        <span><strong>3.</strong> Touchez <strong>Ajouter</strong> en haut à droite</span>
                    </li>
                </ol>

                <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onSnooze}
                        className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        Ne plus me proposer
                    </button>
                    <Button size="sm" onClick={onClose} className="h-9 px-4 rounded-xl text-xs font-bold">
                        Compris
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * Ligne « Installer l'app » pour les réglages du profil (carte Interface &
 * Performance — réglage local au navigateur, comme le mode performance).
 * Consomme le prompt partagé par la bannière : fonctionne même en nav SPA
 * quand `beforeinstallprompt` a déjà firé avant l'ouverture des réglages.
 */
export function PwaSettingsRow() {
    const [status, setStatus] = useState<"checking" | "installed" | "ios" | "ready" | "unavailable">("checking");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [showUninstallHelp, setShowUninstallHelp] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);

    useEffect(() => {
        setIsAndroid(isAndroidDevice());
        if (isStandaloneMode() || readNum(LS_INSTALLED_AT) > 0) {
            setStatus("installed");
            return;
        }
        if (isIosDevice()) {
            setStatus("ios");
            return;
        }
        if (getSharedPrompt()) {
            setStatus("ready");
            return;
        }
        const unsub = subscribeSharedPrompt(() => {
            setStatus(getSharedPrompt() ? "ready" : "unavailable");
        });
        const t = window.setTimeout(() => {
            setStatus((s) => (s === "checking" ? "unavailable" : s));
        }, 4000);
        return () => {
            unsub();
            window.clearTimeout(t);
        };
    }, []);

    const handleSnooze = () => {
        writeStr(LS_DISMISSED_AT, String(Date.now()));
        setSheetOpen(false);
    };

    const handleClick = async () => {
        if (status === "ios") {
            setSheetOpen(true);
            return;
        }
        const prompt = getSharedPrompt();
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        setSharedPrompt(null);
        if (outcome === "accepted") {
            writeStr(LS_INSTALLED_AT, String(Date.now()));
            setStatus("installed");
            toast.success("Application SigilOS installée avec succès !");
        } else {
            // Refus explicite → silence global 30 j (cohérent avec la bannière).
            writeStr(LS_DISMISSED_AT, String(Date.now()));
            setStatus("unavailable");
        }
    };

    return (
        <>
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 p-4 bg-surface rounded-2xl border border-border group hover:border-warning/30 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4.5 h-4.5 text-warning" />
                    </div>
                    <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                            Installer l&apos;app SigilOS
                        </p>
                        <p className="text-caption text-muted-foreground leading-tight">
                            {status === "installed"
                                ? "Installée sur cet appareil."
                                : status === "unavailable"
                                    ? "Proposée automatiquement quand votre navigateur le permet (Chrome / Edge)."
                                    : "Accès en 1 toucher, plein écran, hors-ligne."}
                        </p>
                    </div>
                </div>
                {status === "installed" ? (
                    <button
                        type="button"
                        onClick={() => setShowUninstallHelp((v) => !v)}
                        aria-expanded={showUninstallHelp}
                        title="Comment désinstaller l'app ?"
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 border border-success/20 rounded-xl px-3 h-9 hover:bg-success/20 transition-colors"
                    >
                        <Check className="w-3.5 h-3.5" /> Installée
                    </button>
                ) : status === "checking" ? (
                    <Button size="sm" disabled className="h-9 px-4 rounded-xl text-xs font-bold shrink-0">
                        …
                    </Button>
                ) : status === "unavailable" ? (
                    <Button size="sm" disabled title="Revenez avec Chrome / Edge (ou Safari sur iPhone)" className="h-9 px-4 rounded-xl text-xs font-bold shrink-0">
                        Indisponible
                    </Button>
                ) : (
                    <Button size="sm" onClick={handleClick} className="h-9 px-4 rounded-xl text-xs font-bold shrink-0 gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Installer
                    </Button>
                )}
            </div>
            {status === "installed" && showUninstallHelp && (
                <div className="p-4 bg-surface rounded-2xl border border-border text-xs text-muted-foreground leading-relaxed">
                    <p className="font-bold text-foreground text-[13px] mb-1">Désinstaller l&apos;app</p>
                    <p>
                        {isAndroid
                            ? "Appui long sur l'icône SigilOS → « Désinstaller » (ou Réglages Android → Applications → SigilOS)."
                            : isIosDevice()
                                ? "Appui long sur l'icône SigilOS → « Supprimer l'app »."
                                : "Clic droit sur l'icône SigilOS → « Désinstaller » (ou via chrome://apps / edge://apps)."}
                    </p>
                    <p className="mt-1">Les navigateurs ne permettent pas la désinstallation depuis un site — ça passe forcément par le système.</p>
                </div>
            )}
            </div>
            <PwaIosSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSnooze={handleSnooze} />
        </>
    );
}

/** Lecture sûre (rendu) du flag d'install — le `useEffect` écrit, le rendu ne fait que lire. */
function readNumSafeInstalled(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return isStandaloneMode() || readNum(LS_INSTALLED_AT) > 0;
    } catch {
        return false;
    }
}
