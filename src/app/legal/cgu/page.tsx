import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";
import { getServerI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
    title: "Conditions Générales d'Utilisation | SigilOS",
    description: "CGU de SigilOS : règles d'utilisation, propriété intellectuelle, obligations et limitation de responsabilité.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/cgu`,
    },
};

export default async function CGUPage() {
    const { t } = await getServerI18n();
    const c = t.legalCgu;

    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    {c.title}
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">{c.lastUpdate}</p>
            </header>

            <div className="reg-doc mt-8">
                <p className="text-base text-foreground">
                    {c.intro} <strong>SigilOS</strong>.
                </p>

                <h2>{c.s1Title}</h2>
                <p>{c.s1Content}</p>

                <h2>{c.s2Title}</h2>
                <p>{c.s2Content}</p>

                <h2>{c.s3Title}</h2>
                <p>
                    <strong>{c.s3Disclaimer}</strong>
                </p>
                <p>{c.s3P1}</p>
                <p>{c.s3P2}</p>

                <h2>{c.s4Title}</h2>
                <p>{c.s4Intro}</p>
                <ul>
                    {c.s4Rules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                    ))}
                </ul>

                <h2>{c.s5Title}</h2>
                <p>{c.s5Content}</p>

                <h2>{c.s6Title}</h2>
                <p>{c.s6Content}</p>
            </div>
        </article>
    );
}
