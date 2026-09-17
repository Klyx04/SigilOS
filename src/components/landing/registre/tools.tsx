import Image from "next/image";
import Link from "next/link";

/**
 * Landing — barre « outils ouverts ».
 *
 * Une grille bento de quatre cartes hiérarchisait artificiellement des outils
 * équivalents. Ici, quatre lignes de tableau : ce que le joueur obtient et
 * l'action, sans compte à créer.
 *
 * Seule concession d'immersion : chaque ligne porte l'asset Dofus réel de
 * l'outil (œuf Sylvestre, marqueur de donjon, œuf Dolmanax, boussole), décrit
 * par le libellé à côté — donc `alt` vide. Ce sont les mêmes assets que ceux
 * du menu « Outils » de l'en-tête : quatre outils portent quatre repères.
 */

const TOOLS = [
    {
        name: "Rush Sylvestre",
        gain: "Étape courante, position de reprise, coordonnées `/travel` copiables",
        cta: "Ouvrir le guide",
        href: "/guides/rush-sylvestre",
        icon: "/module-dofus/Dofus_Sylvestre.png",
    },
    {
        name: "Fiches boss & donjons",
        gain: "Sorts, portées, résistances, monstres de salle, drops",
        cta: "Chercher un boss",
        href: "/boss",
        icon: "/assets/worldmap/dungeon-boss.png",
    },
    {
        name: "Almanax",
        gain: "Offrande du jour, bonus du Méryde, prévisions des prochains jours",
        cta: "Voir aujourd'hui",
        href: "/almanax",
        icon: "/module-dofus/Dofus_Dolmanax.png",
    },
    {
        name: "Carte du monde",
        gain: "Positions, trajets et repères utiles en jeu",
        cta: "Ouvrir la carte",
        href: "/carte-du-monde",
        icon: "/assets/nav/map.png",
    },
];

export function LandingTools() {
    return (
        <section aria-labelledby="outils-titre" className="reg-section reg-section-tight">
            <div className="reg-shell">
                <h2 id="outils-titre" className="reg-eyebrow">
                    Outils ouverts, sans compte
                </h2>

                <div className="mt-4 overflow-x-auto">
                    <table className="reg-table">
                        <thead>
                            <tr>
                                <th scope="col" className="w-[13rem]">
                                    Outil
                                </th>
                                <th scope="col">Ce que tu obtiens</th>
                                <th scope="col" className="w-[12rem] text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {TOOLS.map((tool) => (
                                <tr key={tool.href}>
                                    <th
                                        scope="row"
                                        className="py-[0.85rem] pr-4 text-left align-top text-sm font-semibold normal-case tracking-normal text-foreground border-b border-border"
                                    >
                                        <span className="flex items-start gap-2.5">
                                            <Image
                                                src={tool.icon}
                                                alt=""
                                                width={20}
                                                height={20}
                                                aria-hidden="true"
                                                className="mt-0.5 w-5 h-5 shrink-0 object-contain"
                                            />
                                            <span>{tool.name}</span>
                                        </span>
                                    </th>
                                    <td className="text-sm text-muted-foreground">{tool.gain}</td>
                                    <td className="text-right whitespace-nowrap">
                                        <Link href={tool.href} className="reg-link text-sm">
                                            {tool.cta}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
