import { CalendarDays, BookOpen, Users } from "lucide-react";

const PILLARS = [
    {
        icon: CalendarDays,
        title: "Coordonner",
        description:
            "Sorties, groupes, événements et disponibilités au même endroit, notifiés sur Discord.",
    },
    {
        icon: BookOpen,
        title: "Progresser",
        description:
            "Guides Dofus, missions et suivi de quêtes pour avancer ensemble vers les mêmes objectifs.",
    },
    {
        icon: Users,
        title: "Faire vivre",
        description:
            "Sondages, annuaire et mini-jeux pour animer la communauté au-delà des donjons.",
    },
];

export function ThreePillars() {
    return (
        <section className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-10">
                    <p className="text-caption font-semibold uppercase tracking-[0.14em] text-success mb-4">
                        Ce que vous retrouvez
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                        Trois piliers pour faire vivre la guilde.
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {PILLARS.map((pillar) => (
                        <div
                            key={pillar.title}
                            className="rounded-2xl border border-border bg-[#101313] p-6"
                        >
                            <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mb-4">
                                <pillar.icon className="w-5 h-5 text-success" aria-hidden="true" />
                            </div>
                            <h3 className="text-base font-bold text-foreground mb-2">{pillar.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {pillar.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
