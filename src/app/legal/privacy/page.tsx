import { ShieldCheck } from "lucide-react";
import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";
import { getServerI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
    title: { absolute: "Politique de Confidentialité | SigilOS" },
    description: "Politique RGPD de SigilOS : données collectées, finalités, sécurité, hébergement UE et droits des utilisateurs.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/privacy`,
    },
};

export default async function PrivacyPage() {
    const { t } = await getServerI18n();
    const p = t.legalPrivacy;

    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    {p.title}
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">{p.rgpdBadge}</p>
            </header>

            <div className="reg-callout reg-callout-accent mt-8">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                    <h3>{p.calloutTitle}</h3>
                    <p>{p.calloutDesc}</p>
                </div>
            </div>

            <div className="reg-doc mt-8">
                <h2>{p.s1Title}</h2>
                <p>{p.s1Intro}</p>
                <ul>
                    <li>
                        <strong>{p.s1IdentityTitle}</strong> {p.s1IdentityDesc}
                    </li>
                    <li>
                        <strong>{p.s1GameTitle}</strong> {p.s1GameDesc}
                    </li>
                    <li>
                        <strong>{p.s1ProofTitle}</strong> {p.s1ProofDesc}
                    </li>
                </ul>

                <h2>{p.s2Title}</h2>
                <p>{p.s2Content}</p>

                <h2>{p.s3Title}</h2>
                <p>{p.s3Intro}</p>
                <ul>
                    {p.s3Purposes.map((purpose, idx) => (
                        <li key={idx}>{purpose}</li>
                    ))}
                </ul>

                <h2>{p.s4Title}</h2>
                <p>{p.s4Content}</p>

                <h2>{p.s5Title}</h2>
                <p>{p.s5Content}</p>

                <h2>{p.s6Title}</h2>
                <p>{p.s6Content}</p>

                <h2>{p.s7Title}</h2>
                <p>{p.s7Content}</p>
            </div>
        </article>
    );
}
