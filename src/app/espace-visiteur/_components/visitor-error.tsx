"use client";

import { Button } from "@/components/ui/button";

/** Erreur commune aux six segments : une phrase, une action, aucun code technique. */
export function VisitorError({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-foreground">Cet écran n'a pas pu se charger.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Réessaie dans un instant. Si le problème persiste, déconnecte-toi puis reconnecte-toi.
            </p>
            <Button className="mt-4" onClick={reset}>
                Réessayer
            </Button>
        </div>
    );
}
