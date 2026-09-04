import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
    {
        q: "Comment se connecter à SigilOS ?",
        a: "Uniquement via votre compte Discord (OAuth2). Il n'existe ni compte ni mot de passe SigilOS : vous vous connectez à Discord, puis vous accédez aux guildes où vous êtes membre ou administrateur.",
    },
    {
        q: "Combien ça coûte ?",
        a: "C'est 100% gratuit et sans publicité pour toutes les guildes Dofus.",
    },
    {
        q: "Comment installer SigilOS pour ma guilde ?",
        a: "Connectez-vous avec Discord. Si vous êtes administrateur de votre serveur Discord de guilde, l'installation se fait en autonomie en 1 clic. Un accompagnement VIP par ticket Discord reste disponible si vous préférez être guidé.",
    },
    {
        q: "Demandez-vous mon mot de passe Ankama ou mon e-mail ?",
        a: "Non, jamais. Vous connectez uniquement Discord. SigilOS ne demande aucun mot de passe de jeu et ne collecte aucune adresse e-mail.",
    },
    {
        q: "Comment intégrer les archimonstres (Ocre) ?",
        a: "Ajoutez votre pseudo Dofus et votre clé API Metamob en lecture seule. SigilOS synchronise vos captures pour que toute la guilde s'entraide sur la quête du Dofus Ocre.",
    },
];

export function FaqSection() {
    return (
        <section className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10">
                    <div className="max-w-md">
                        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-success mb-4">
                            FAQ
                        </p>
                        <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                            Vous vous demandez peut-être…
                        </h2>
                        <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
                            Les réponses aux questions les plus courantes avant de vous lancer.
                        </p>
                        <Link
                            href="/legal/faq"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-success hover:text-foreground transition-colors"
                        >
                            Consulter la FAQ complète
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                    </div>

                    <div>
                        <div className="space-y-3">
                            {FAQ_ITEMS.map((item) => (
                                <details
                                    key={item.q}
                                    className="group rounded-xl border border-border bg-surface/30 px-4 py-3 open:border-success/40 transition-colors"
                                >
                                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm font-semibold text-foreground/90 hover:text-foreground py-1 select-none">
                                        {item.q}
                                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
                                    </summary>
                                    <p className={cn("text-muted-foreground leading-relaxed text-sm mt-2 pb-2")}>
                                        {item.a}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
