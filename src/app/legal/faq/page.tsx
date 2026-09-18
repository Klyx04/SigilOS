import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import {
    HelpCircle,
    Users,
    Layers,
    MessageSquare,
    Lock,
    LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { getServerI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
    title: "FAQ & Aide | SigilOS",
    description: "Réponses aux questions fréquentes sur SigilOS : accès via Discord, gestion de guilde Dofus, permissions, modules, données collectées et sécurité.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/faq`,
    },
};

export default async function FAQPage() {
    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";
    const { t } = await getServerI18n();

    const sections = [
        { id: "acces", title: t.faqPage.sections.acces.title, icon: HelpCircle, items: t.faqPage.sections.acces.items },
        { id: "guilde", title: t.faqPage.sections.guilde.title, icon: Users, items: t.faqPage.sections.guilde.items },
        { id: "modules", title: t.faqPage.sections.modules.title, icon: Layers, items: t.faqPage.sections.modules.items },
        { id: "discord", title: t.faqPage.sections.discord.title, icon: MessageSquare, items: t.faqPage.sections.discord.items },
        { id: "donnees", title: t.faqPage.sections.donnees.title, icon: Lock, items: t.faqPage.sections.donnees.items },
        { id: "support", title: t.faqPage.sections.support.title, icon: LifeBuoy, items: t.faqPage.sections.support.items },
    ];

    // FAQPage structured data — generated from the same data as the UI to keep
    // visible content and rich snippets strictly in sync.
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: sections.flatMap((section) =>
            section.items.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
            }))
        ),
    };

    return (
        <>
            <JsonLd id="json-ld-faq" nonce={nonce} data={faqJsonLd} />

            <header className="max-w-2xl">
                <p className="reg-eyebrow">{t.faqPage.eyebrow}</p>
                <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    {t.faqPage.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {t.faqPage.subtitle}
                </p>
            </header>

            {/* Sommaire — liens textuels, pas de pastilles bordées */}
            <nav aria-label="Sommaire de la FAQ" className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {sections.map((section) => (
                    <Link key={section.id} href={`/legal/faq#${section.id}`} className="reg-link-quiet">
                        {section.title}
                    </Link>
                ))}
            </nav>

            {/* Sections — accordéons natifs */}
            <div className="mt-12 space-y-12">
                {sections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-24">
                        <div className="flex items-center gap-2.5">
                            <section.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <h2 className="text-base font-bold text-foreground tracking-tight">{section.title}</h2>
                        </div>
                        <div className="reg-faq mt-3">
                            {section.items.map((item, idx) => (
                                <details key={`${section.id}-${idx}`}>
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* CTA support — un panneau, une action */}
            <div className="reg-panel mt-14 p-6 md:p-8">
                <h2 className="text-base font-bold text-foreground">{t.faqPage.noAnswerTitle}</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    {t.faqPage.noAnswerDesc}
                </p>
                <a
                    href="https://discord.gg/uX7G6SUDgN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reg-btn reg-btn-primary mt-5"
                >
                    {t.faqPage.discordCta}
                </a>
            </div>
        </>
    );
}

