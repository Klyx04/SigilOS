const ROWS = [
    {
        situation: "Une quête qui dure des heures",
        without: "Coordonnées à l'écrit, on se disperse",
        with: "Étapes, positions et présence en direct",
    },
    {
        situation: "Organiser une sortie",
        without: "Doublons entre salons, besoins oubliés",
        with: "Un événement, des besoins de classe, une notification",
    },
    {
        situation: "Suivre la progression",
        without: "Pas de vue d'ensemble",
        with: "Missions, Dofus et Songes au même endroit",
    },
];

export function ProblemSolution() {
    return (
        <section className="w-full border-t border-white/5 py-16">
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-8">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-8">
                    Discord seul, on tient tout à la main.
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-caption font-semibold uppercase tracking-widest text-zinc-500 border-b border-white/10">
                                <th scope="col" className="py-3 pr-4 font-semibold">
                                    Situation
                                </th>
                                <th scope="col" className="py-3 pr-4 font-semibold">
                                    Sans SigilOS
                                </th>
                                <th scope="col" className="py-3 font-semibold text-emerald-400">
                                    Avec SigilOS
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map((row) => (
                                <tr key={row.situation} className="border-b border-white/5 align-top">
                                    <td className="py-4 pr-4 font-semibold text-white">
                                        {row.situation}
                                    </td>
                                    <td className="py-4 pr-4 text-zinc-500">{row.without}</td>
                                    <td className="py-4 text-emerald-300/90">{row.with}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
