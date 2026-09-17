import Image from "next/image";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";
import { groupPublicScreens } from "@/lib/landing-utils";

/**
 * Landing — le guide en jeu.
 *
 * Remplace la démonstration par onglets auto-rotatifs (« Guides / Sorties &
 * groupes / Progression / Guilde ») : quatre promesses d'onglets pour une seule
 * capture lisible. Ici, chaque capture pilotée par le God devient une **figure
 * légendée** affichée à une taille exploitable, commentée par trois notes
 * courtes qui décrivent des actions réelles.
 */

const NOTES = [
    {
        index: "01",
        scope: "Position",
        title: "Copier le /travel",
        detail: "Une coordonnée directement exploitable, sans recopier ni changer de fenêtre.",
    },
    {
        index: "02",
        scope: "Reprise",
        title: "Revenir au bon endroit",
        detail: "L'étape courante est conservée pour reprendre la quête plus tard.",
    },
    {
        index: "03",
        scope: "Groupe",
        title: "Voir qui avance",
        detail: "Dans une guilde, le même guide devient un point de rendez-vous collectif.",
    },
];

const FALLBACK_SCREEN: PublicLandingScreen = {
    id: "guide-default",
    label: "Rush Sylvestre",
    title: null,
    description: null,
    imageUrl: "/assets/screenshots/guide-complet.png",
    alt: "Guide Rush Sylvestre de SigilOS : étapes, coordonnées et suivi collectif",
    sortOrder: 0,
};

function ScreenFigure({ screen, priority = false }: { screen: PublicLandingScreen; priority?: boolean }) {
    return (
        <figure className="reg-screen">
            <figcaption className="reg-mono flex items-center justify-between gap-4 border-b border-border bg-muted px-3 py-2 text-xs">
                <span className="text-foreground">{screen.label || "Capture"}</span>
                <span className="text-muted-foreground">Capture de l&apos;interface</span>
            </figcaption>
            <Image
                src={screen.imageUrl}
                alt={screen.alt || screen.title || "Interface SigilOS"}
                width={1440}
                height={900}
                priority={priority}
                loading={priority ? undefined : "lazy"}
                sizes="(max-width: 1024px) 100vw, 680px"
                className="w-full h-auto"
            />
        </figure>
    );
}

export function LandingGuide({ screens = [] }: { screens?: PublicLandingScreen[] }) {
    const groups = groupPublicScreens(screens);
    const mainScreen = groups[0]?.images[0] ?? FALLBACK_SCREEN;
    const extraGroups = groups.slice(1);

    return (
        <section aria-labelledby="guide-titre" className="reg-section">
            <div className="reg-shell">
                <div className="grid gap-4 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-10">
                    <p className="reg-eyebrow">En jeu</p>
                    <div>
                        <h2
                            id="guide-titre"
                            className="max-w-[24ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            La quête reste visible. Pas le site.
                        </h2>
                        <p className="mt-3 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            Le guide se détache dans une fenêtre compacte au-dessus de Dofus Unity. Ce qui suit est le
                            vrai outil, à une taille qui reste lisible.
                        </p>
                    </div>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-10 lg:items-start">
                    <ScreenFigure screen={mainScreen} priority />

                    <div className="grid gap-6">
                        {NOTES.map((note) => (
                            <article key={note.index} className="pt-3 border-t-2 border-border-strong">
                                <p className="reg-mono text-xs text-accent">
                                    {note.index} / {note.scope}
                                </p>
                                <h3 className="mt-1.5 text-base font-bold text-foreground">{note.title}</h3>
                                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{note.detail}</p>
                            </article>
                        ))}
                    </div>
                </div>

                {extraGroups.length > 0 && (
                    <div className="mt-12 grid gap-8 md:grid-cols-2">
                        {extraGroups.map((group) => (
                            <div key={group.key}>
                                <h3 className="text-base font-bold text-foreground">{group.title || group.label}</h3>
                                {group.description && (
                                    <p className="mt-2 mb-4 max-w-[46ch] text-sm text-muted-foreground leading-relaxed">
                                        {group.description}
                                    </p>
                                )}
                                <div className="mt-4 space-y-6">
                                    {group.images.map((image) => (
                                        <ScreenFigure key={image.id} screen={image} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
