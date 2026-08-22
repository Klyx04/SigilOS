"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";


/**
 * Schéma d'URL pouvant exécuter du code (CodeQL js/incomplete-url-scheme-check).
 * `javascript:`, `data:` et `vbscript:` sont rejetés, y compris quand :
 *   - la casse varie (`JaVaScRiPt:`) ;
 *   - le schéma est encodé en `%xx` (`%6a%61vascript:`) ;
 *   - des espaces/contrôles précèdent le schéma (`\rjavascript:`, `\u00a0javascript:`).
 * Retourne `true` pour tout href qui ne doit être ni exécuté par le navigateur ni
 * passé à `router.push` (sinon injection de code / XSS).
 */
function isExecutableScheme(rawHref: string): boolean {
    let u = rawHref;
    try {
        // Décodé `%xx` (ex. `%6a%61vascript:` → `javascript:`), mais une URI malformée
        // jette une erreur → on évalue alors la valeur brute.
        u = decodeURI(rawHref);
    } catch {
        /* ignore -> u reste brut */
    }
    // On retire espaces/contrôles en tête puis on compare en insensible à la casse.
    u = u.replace(/^[\s\u0000-\u001f\u00a0]+/i, "").trim().toLowerCase();
    return u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:");
}

/**
 * `UnsavedChangesGuard` — pattern réutilisable « modifications non sauvegardées ».
 *
 * Quand `hasUnsavedChanges` est vrai et que l'utilisateur tente de quitter la page,
 * on l'avertit au lieu de perdre silencieusement son travail :
 *   1. `beforeunload` → refresh / fermeture d'onglet (modale native navigateur).
 *   2. Clics sur liens internes du dashboard (`<a href>`) → modale custom + navigation différée.
 *   3. Back / forward navigateur (`beforePopState`) → blocage + modale custom, re-navigation après confirmation.
 *
 * Usage : `<UnsavedChangesGuard hasUnsavedChanges={isDirty} />` à la fin du composant.
 *
 * NB : les navigations programmatiques (`router.push`) ne passent PAS par un clic sur
 * `<a>` et ne sont donc pas interceptées ici (best-effort — le cas dominant est couvert).
 */
export function UnsavedChangesGuard({
    hasUnsavedChanges,
    message = "Vous avez des modifications non sauvegardées. Quitter cette page les perdra définitivement.",
    confirmLabel = "Quitter sans sauvegarder",
}: {
    hasUnsavedChanges: boolean;
    message?: string;
    confirmLabel?: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const hasUnsavedRef = useRef(hasUnsavedChanges);
    hasUnsavedRef.current = hasUnsavedChanges;

    const pendingNavRef = useRef<(() => void) | null>(null);

    // 1. Refresh / fermeture d'onglet → modale native du navigateur
    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasUnsavedChanges]);

    // 2. Back / forward navigateur → on « épingle » l'entrée d'historique courante
    //    (pushState) pour neutraliser la navigation, on affiche la modale et on
    //    re-navigue vers la destination après confirmation.
    //    NB : `router.beforePopState` n'existe PAS en App Router (next/navigation).
    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const currentUrl = window.location.href;
        // Épingle l'entrée courante → un back/forward ne quitte pas réellement la page
        window.history.pushState(null, "", currentUrl);
        const onPopState = () => {
            const attemptedUrl = window.location.href;
            // Re-pin : annule visuellement la navigation (l'URL reste sur la page courante)
            window.history.pushState(null, "", currentUrl);
            pendingNavRef.current = () => router.push(attemptedUrl);
            setOpen(true);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [router, hasUnsavedChanges]);

    // 3. Clics sur liens internes du dashboard → modale + navigation différée
    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const onClick = (e: MouseEvent) => {
            if (!hasUnsavedRef.current) return;
            if (e.defaultPrevented) return;
            if (e.button !== 0) return;
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            // Ne jamais intercepter les clics dans la modale elle-même
            if ((e.target as HTMLElement).closest("[data-unsaved-guard-dialog]")) return;

            const anchor = (e.target as HTMLElement).closest("a");
            if (!anchor) return;
            if (anchor.getAttribute("target") === "_blank") return;

            const href = anchor.getAttribute("href");
            if (!href) return;

            // Sécurité (CodeQL js/incomplete-url-scheme-check) : un schéma exécutable
            // (javascript:, data:, vbscript:) est bloqué — jamais laissé au navigateur
            // ni poussé via router.push (sinon injection de code / XSS).
            if (isExecutableScheme(href)) {
                e.preventDefault();
                return;
            }

            // Liens non-navigation (ancre, mailto, tel) -> laisser le navigateur gérer
            if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

            // Liens externes → laisser faire (ouvre généralement un nouvel onglet)
            if (/^https?:\/\//i.test(href)) {
                try {
                    const url = new URL(href, window.location.origin);
                    if (url.origin !== window.location.origin) return;
                } catch {
                    return;
                }
            }

            // Navigation interne → bloquer et demander confirmation
            e.preventDefault();
            e.stopPropagation();
            pendingNavRef.current = () => router.push(href);
            setOpen(true);
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [router, hasUnsavedChanges]);

    const handleConfirm = useCallback(() => {
        setOpen(false);
        const nav = pendingNavRef.current;
        pendingNavRef.current = null;
        if (nav) nav();
    }, [router]);

    const handleCancel = useCallback(() => {
        setOpen(false);
        pendingNavRef.current = null;
    }, []);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
            <DialogContent data-unsaved-guard-dialog className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                        Modifications non sauvegardées
                    </DialogTitle>
                    <DialogDescription className="pt-1 leading-relaxed">{message}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button variant="ghost" onClick={handleCancel} className="h-11 rounded-xl text-xs font-black uppercase tracking-wider">
                        Rester sur la page
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm} className="h-11 rounded-xl text-xs font-black uppercase tracking-wider">
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Compare deux valeurs (par JSON) pour détecter un formulaire « sale ».
 * Retourne `false` tant que `initial` est null (chargement pas terminé).
 */
export function isDirty(current: unknown, initial: unknown): boolean {
    if (initial === null || initial === undefined) return false;
    return JSON.stringify(current) !== JSON.stringify(initial);
}
