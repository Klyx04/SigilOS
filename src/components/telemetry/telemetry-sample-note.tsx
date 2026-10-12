/**
 * Bandeau d'**honnêteté d'échantillon** de la télémétrie produit (D-2bis).
 *
 * Un seul composant pour tout le module : l'écran doit dire sur **combien de données** il parle,
 * si un classement nominatif est publiable et si la lecture a été plafonnée. Dupliquer ce
 * bandeau dans chaque panneau serait le meilleur moyen qu'un panneau l'oublie.
 */
export function TelemetrySampleNote({
    sample,
    truncated,
    windowDays,
}: {
    sample: { actions: number; distinctActors: number; reliable: boolean };
    truncated: boolean;
    windowDays: number;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 rounded-xl border border-border bg-surface/60 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Échantillon</span>
            <span className="text-foreground tabular-nums">{sample.actions} action(s)</span>
            <span className="text-foreground tabular-nums">{sample.distinctActors} membre(s) distinct(s)</span>
            <span>compteurs sur {windowDays} jours</span>
            <span className="text-muted-foreground/60">·</span>
            <span>
                {sample.reliable
                    ? "classement nominatif possible (seuil de 15 membres distincts atteint)"
                    : `classement nominatif non publié : ${sample.distinctActors} membre(s) distinct(s) seulement (seuil 15)`}
            </span>
            {truncated && (
                <>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-warning">
                        lecture plafonnée : au-delà du plafond, les totaux affichés sont un échantillon
                    </span>
                </>
            )}
        </div>
    );
}
