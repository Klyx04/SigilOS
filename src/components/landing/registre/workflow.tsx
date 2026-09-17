import Image from "next/image";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";

/**
 * Landing — scénario de sortie.
 *
 * Remplace le tableau marketing « sans / avec » et la section « Coordonner /
 * Progresser / Faire vivre ». On décrit la suite réelle d'actions d'une soirée
 * de guilde, avec l'écran qui la porte.
 *
 * Aucune donnée d'instance n'est inventée : ni numéro de sortie, ni horodatage,
 * ni effectif d'exemple. Les étapes décrivent ce que l'outil fait.
 */

const STEPS = [
    {
        surface: "SigilOS",
        title: "La sortie est créée",
        detail: "Donjon ou activité, date, heure, succès visés et besoins de classe du groupe.",
    },
    {
        surface: "Discord",
        title: "L'annonce part dans le salon choisi",
        detail: "Les rôles concernés sont notifiés, sans message posté à la main.",
    },
    {
        surface: "SigilOS",
        title: "Les membres s'inscrivent",
        detail: "Depuis Discord ou le tableau de bord : la composition se remplit et reste lisible.",
    },
    {
        surface: "SigilOS",
        title: "Les classes recherchées restent affichées",
        detail: "Ce qui manque au groupe est visible jusqu'au départ, pas noyé dans un fil de discussion.",
    },
    {
        surface: "En jeu",
        title: "Coordonnées et reprise pour le groupe",
        detail: "Le guide Sylvestre garde l'étape courante et rend la position directement exploitable.",
    },
];

const FALLBACK_SCREEN: PublicLandingScreen = {
    id: "workflow-default",
    label: "Sorties & groupes",
    title: null,
    description: null,
    imageUrl: "/assets/screenshots/screenshot3.png",
    alt: "Écran des sorties de guilde SigilOS : groupe, besoins de classe et succès visés",
    sortOrder: 0,
};

export function LandingWorkflow({ screen }: { screen?: PublicLandingScreen | null }) {
    const figure = screen?.imageUrl ? screen : FALLBACK_SCREEN;

    return (
        <section aria-labelledby="sortie-titre" className="reg-section">
            <div className="reg-shell">
                <div className="grid gap-4 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-10">
                    <p className="reg-eyebrow">Une soirée de guilde</p>
                    <div>
                        <h2
                            id="sortie-titre"
                            className="max-w-[26ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            Du salon Discord au groupe complet.
                        </h2>
                        <p className="mt-3 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            Ce qui se perd habituellement entre Discord et le jeu — les besoins, l&apos;heure, la reprise
                            — reste au même endroit.
                        </p>
                    </div>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10 lg:items-start">
                    <figure className="reg-screen">
                        <figcaption className="reg-mono flex items-center justify-between gap-4 border-b border-border bg-muted px-3 py-2 text-xs">
                            <span className="text-foreground">{figure.label || "Sorties & groupes"}</span>
                            <span className="text-muted-foreground">Capture de l&apos;interface</span>
                        </figcaption>
                        <Image
                            src={figure.imageUrl}
                            alt={figure.alt || "Écran des sorties de guilde SigilOS"}
                            width={1440}
                            height={900}
                            loading="lazy"
                            sizes="(max-width: 1024px) 100vw, 640px"
                            className="w-full h-auto"
                        />
                    </figure>

                    <ol className="border-t border-border-strong">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3.5 border-b border-border">
                                <span className="reg-mono text-xs text-accent pt-0.5">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                                </div>
                                <span className="col-start-2 reg-mono text-[0.6875rem] text-subtle-foreground">
                                    {step.surface}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
