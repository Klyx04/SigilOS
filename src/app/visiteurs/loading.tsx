/**
 * Chargement de l'annuaire : trois blocs qui reprennent la hauteur réelle de la page
 * (titre, filtres, liste) — aucun décalage quand la réponse arrive.
 */
export default function VisitorsLoading() {
    return (
        <div className="registre relative min-h-screen flex flex-col bg-background text-foreground">
            <main className="flex-1">
                <section className="reg-section">
                    <div className="reg-shell space-y-4" role="status" aria-live="polite">
                        <div className="h-9 w-72 animate-pulse rounded-md bg-elevated" />
                        <div className="h-4 w-[min(32rem,100%)] animate-pulse rounded-md bg-elevated" />
                        <div className="h-10 w-[min(24rem,100%)] animate-pulse rounded-md bg-elevated" />
                        <div className="h-64 animate-pulse rounded-xl bg-elevated" />
                        <span className="sr-only">Chargement de l'annuaire des visiteurs…</span>
                    </div>
                </section>
            </main>
        </div>
    );
}
