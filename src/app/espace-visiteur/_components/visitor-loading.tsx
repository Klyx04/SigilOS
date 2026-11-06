/** Chargement commun aux six segments (aucun layout shift, aucun texte décoratif). */
export function VisitorLoading() {
    return (
        <div className="space-y-3" role="status" aria-live="polite">
            <div className="h-6 w-40 animate-pulse rounded-md bg-elevated" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-elevated" />
            <div className="h-48 animate-pulse rounded-xl bg-elevated" />
            <span className="sr-only">Chargement de ton espace visiteur…</span>
        </div>
    );
}
