import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";
import { getServerI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
    title: { absolute: "Mentions Légales | SigilOS" },
    description: "Mentions légales de SigilOS : éditeur, hébergement OVH, propriété intellectuelle Ankama Games, cookies et droit applicable.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/mentions`,
    },
};

export default async function MentionsPage() {
    const { t } = await getServerI18n();
    const m = t.legalMentions;

    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    {m.title}
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">{m.subtitle}</p>
            </header>

            <div className="reg-doc mt-8">
                <h2>{m.s1Title}</h2>
                <p>{m.s1P1}</p>
                <p>
                    <strong>{m.s1LeaderLabel}</strong> {m.s1LeaderVal}
                    <br />
                    <strong>{m.s1ContactLabel}</strong> {m.s1ContactVal}
                </p>

                <h2>{m.s2Title}</h2>
                <p>{m.s2Intro}</p>
                <p className="border-l-2 border-border-strong pl-4 whitespace-pre-line">
                    {m.s2Address}
                    <br />
                    <a href="https://www.ovhcloud.com" target="_blank" rel="noopener noreferrer">
                        {m.s2Web}
                    </a>
                </p>

                <h2>{m.s3Title}</h2>
                <p>{m.s3P1}</p>
                <p>
                    <strong>{m.s3AnkamaTitle}</strong>
                    <br />
                    {m.s3AnkamaDesc}
                </p>

                <h2>{m.s4Title}</h2>
                <p>{m.s4Intro}</p>
                <ul>
                    <li>
                        <strong>DofusDB :</strong> Données cartographiques, monstres, objets et API issues de{" "}
                        <a href="https://dofusdb.fr/" target="_blank" rel="noopener noreferrer">
                            DofusDB
                        </a>
                        . <em>« Données issues de DofusDB. Utilisation soumise à la licence LPNC-IA 1.0. »</em>
                    </li>
                    <li>
                        <strong>Ganymède :</strong> Parcours d'optimisation, guides et étapes de quêtes issus du site{" "}
                        <a href="https://ganymede-app.com/" target="_blank" rel="noopener noreferrer">
                            Ganymède
                        </a>
                        .
                    </li>
                    <li>
                        <strong>Dofensive :</strong> Données de combat, sorts, géométries de donjons et bestiaire issues de l'API du site{" "}
                        <a href="https://dofensive.com/" target="_blank" rel="noopener noreferrer">
                            Dofensive
                        </a>
                        .
                    </li>
                    <li>
                        <strong>Dofus pour les Noobs :</strong> Guides, parcours de quêtes et contenus de référence du site{" "}
                        <a href="https://www.dofuspourlesnoobs.com/" target="_blank" rel="noopener noreferrer">
                            Dofus pour les Noobs
                        </a>
                        .
                    </li>
                </ul>

                <h2>{m.s5Title}</h2>
                <p>{m.s5Content}</p>

                <h2>{m.s6Title}</h2>
                <p>{m.s6Content}</p>
            </div>
        </article>
    );
}
