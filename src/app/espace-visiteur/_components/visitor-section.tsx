import type { ReactNode } from "react";

/**
 * Une **seule** surface par sujet (pas de boîte dans la boîte), rayon `rounded-xl`
 * (12 px max), tokens uniquement — la DA de la landing.
 */
export function VisitorSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-surface p-5">
            <header className="mb-4">
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </header>
            {children}
        </section>
    );
}
