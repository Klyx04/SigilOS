import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";

/**
 * Habillage des pages légales — registre.
 *
 * Ce qui a été retiré volontairement :
 *  - deux orbes flous `blur-[120px]` + `animate-pulse-slow` qui produisaient un
 *    halo vert au-dessus du contenu (« coup en haut ») ;
 *  - une carte `rounded-2xl shadow-2xl backdrop-blur-xl` qui enfermait des
 *    documents légaux dans un contenant de landing ;
 *  - le `pt-32` hérité de l'ancien en-tête `fixed` (l'en-tête est désormais
 *    dans le flux, il n'y a plus de recouvrement à compenser) ;
 *  - `UnifiedModuleHeader` (« DOCUMENTS LÉGAUX » en capitales géantes) et
 *    `text-muted-foreground` imposé sur tout le contenu.
 *
 * À la place : une colonne de navigation légale, un document lisible et
 * gauche-aligné, traité par `.reg-doc`.
 */

const LEGAL_PAGES = [
    { label: "Conditions d'utilisation", href: "/legal/cgu" },
    { label: "Confidentialité", href: "/legal/privacy" },
    { label: "Mentions légales", href: "/legal/mentions" },
    { label: "FAQ & aide", href: "/legal/faq" },
];

export default async function LegalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col">
            <PublicHeader user={session?.user} backHref="/" backLabel="Accueil" isMember={userContext.isMember} />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] lg:gap-14">
                        <nav aria-label="Informations légales">
                            <p className="reg-eyebrow">Informations légales</p>
                            <ul className="mt-4 space-y-1.5 text-sm">
                                {LEGAL_PAGES.map((page) => (
                                    <li key={page.href}>
                                        <Link
                                            href={page.href}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {page.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        <div className="min-w-0">{children}</div>
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}

