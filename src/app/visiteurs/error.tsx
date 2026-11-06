"use client";

import { Button } from "@/components/ui/button";

/**
 * Erreur du segment `/visiteurs` : une phrase et une action, aucun code technique.
 *
 * ⚠️ Une base indisponible ne doit **jamais** s'afficher comme « annuaire vide » : la liste
 * vide est un état métier légitime, l'erreur en est un autre. Ce fichier les sépare.
 */
export default function VisitorsError({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="registre relative min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1">
                <section className="reg-section">
                    <div className="reg-shell">
                        <div className="rounded-xl border border-border bg-surface p-5">
                            <h1 className="text-base font-semibold text-foreground">
                                L&apos;annuaire n&apos;a pas pu se charger.
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Réessaie dans un instant. Si le problème persiste, recharge la page.
                            </p>
                            <Button className="mt-4" onClick={reset}>
                                Réessayer
                            </Button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
