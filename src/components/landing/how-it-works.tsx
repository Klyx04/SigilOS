const STEPS = [
    {
        title: "Connecter ton Discord",
        description: "En 1 clic si tu es admin, ou accompagné par ticket via notre Discord.",
    },
    {
        title: "Configurer",
        description: "Choisis tes modules et relie ton serveur Discord.",
    },
    {
        title: "Inviter la guilde",
        description: "Tes membres se connectent avec Discord et jouent ensemble.",
    },
];

export function HowItWorks() {
    return (
        <section className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-10">
                    <p className="text-sm font-semibold text-success mb-4">
                        Mise en route
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                        Trois étapes, et on joue.
                    </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {STEPS.map((step, idx) => (
                        <div key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                            <div className="text-body-sm font-bold text-success tabular-nums mb-4">
                                0{idx + 1}
                            </div>
                            <h3 className="text-base font-bold text-foreground mb-2">{step.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
