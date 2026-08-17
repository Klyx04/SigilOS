export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Guide Ultime de l'Éleveur Dofus (Édition 2026 — Unity)",
    description:
        "Le guide absolu de l'élevage sur Dofus en 2026 : capturer, élever, équilibrer les jauges, généalogie, Makinas, capacités spéciales et gestion des 20 enclos de guilde.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Édition 2026 — Dofus Unity</strong>
            <p>Ce guide rassemble l'intégralité des mécaniques de l'élevage : capture des montures sauvages, manipulation de l'humeur, généalogie, Makinas et gestion optimale des 20 enclos de guilde.</p>
        </div>

        <div class="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.png" alt="Guide de l'éleveur Dofus" class="rounded-xl w-full max-h-[380px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">Les 3 familles de montures : Dragodindes, Muldos et Volkornes</span>
        </div>

        <h2>I. Introduction à l'Élevage et Types de Montures</h2>
        <p>
            L'élevage sur Dofus est une activité de gestion à très forte rentabilité. Il permet de produire des parchemins de caractéristiques, de fournir des montures optimisées à sa guilde et de générer un flux constant de kamas.
        </p>

        <p>
            Il existe aujourd'hui <strong>3 espèces de montures</strong> distinctes, chacune possédant un niveau allant de 1 à 200 :
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/dragodindes.png" alt="Dragodindes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-amber-300 text-sm">Dragodindes</strong>
                <p class="text-xs text-zinc-400 mt-1">10 générations. Bonus commun : <strong>Vitalité</strong> (+300 au lvl 100, +400 au lvl 200). Idéales pour les parchemins.</p>
                <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Stats Dragodindes" class="mt-2 rounded border border-white/5" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/muldos.png" alt="Muldos" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-emerald-300 text-sm">Muldos</strong>
                <p class="text-xs text-zinc-400 mt-1">6 générations. Bonus commun : <strong>+1 PM</strong>. 4 reproductions maximum par individu.</p>
                <img src="/images/guides/elevage/stats_muldos.jpg" alt="Stats Muldos" class="mt-2 rounded border border-white/5" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/volkornes.png" alt="Volkornes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-rose-300 text-sm">Volkornes</strong>
                <p class="text-xs text-zinc-400 mt-1">4 générations. Bonus commun : <strong>+1 PA</strong>. Très recherchés en PvP et PvM haut niveau.</p>
                <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Stats Volkornes" class="mt-2 rounded border border-white/5" />
            </div>
        </div>

        <h2>II. Capture des Montures Sauvages</h2>
        <div class="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <img src="/images/guides/elevage/filet_capture.png" alt="Filet de capture" class="w-20 h-20 object-contain shrink-0" />
            <div>
                <p class="text-sm text-zinc-300 leading-relaxed">
                    Pour démarrer l'élevage, vous devez capturer des spécimens sauvages. Équipez un <strong>Filet de capture</strong> (acheté auprès de Kito au village des éleveurs [-17,0]), lancez le sort <em>Apprivoisement de monture</em> avant d'achever la monture ciblée en combat :
                </p>
                <ul class="text-xs text-zinc-400 mt-2 space-y-1">
                    <li>• <strong>Dragodindes :</strong> Montagne des Koalaks (Amande, Rousse, Dorée).</li>
                    <li>• <strong>Muldos :</strong> Abysses de Sufokia (capturables avec un filet de capture sous-marin).</li>
                    <li>• <strong>Volkornes :</strong> Territoire des Nimbos et zones associées.</li>
                </ul>
            </div>
        </div>

        <h2>III. Les Jauges d'Élevage et l'Équilibrage de la Sérénité</h2>
        <p>
            Pour rendre une monture féconde, ses trois barres principales (<strong>Endurance</strong>, <strong>Maturité</strong>, <strong>Amour</strong>) doivent être montées au maximum (10 000 points). La jauge de <strong>Sérénité</strong> détermine laquelle de ces statistiques augmente lors des interactions :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Statistique Ciblée</th>
                    <th>Zone de Sérénité Obligatoire</th>
                    <th>Objets d'Enclos Associés</th>
                    <th>Seuil d'Activation Requis</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Endurance</strong></td>
                    <td><span class="text-amber-400 font-bold">Négative</span> (&lt; -2 000)</td>
                    <td><strong>Foudroyeurs</strong> / Mangeoires</td>
                    <td>10 000 / 10 000</td>
                </tr>
                <tr>
                    <td><strong>Maturité</strong></td>
                    <td><span class="text-emerald-400 font-bold">Équilibrée</span> (-2 000 à +2 000)</td>
                    <td><strong>Abreuvoirs</strong></td>
                    <td>Plafond variable selon génération</td>
                </tr>
                <tr>
                    <td><strong>Amour</strong></td>
                    <td><span class="text-rose-400 font-bold">Positive</span> (&gt; +2 000)</td>
                    <td><strong>Dragofesses</strong></td>
                    <td>10 000 / 10 000</td>
                </tr>
                <tr>
                    <td><strong>Ajustement Sérénité</strong></td>
                    <td>Toute valeur</td>
                    <td><strong>Baffeurs</strong> (baisse) / <strong>Caresseurs</strong> (hausse)</td>
                    <td>Déplacer le curseur dans la zone voulue</td>
                </tr>
            </tbody>
        </table>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/craft_objets.png" alt="Objets d'élevage" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Les différents types d'objets d'élevage fabriqués par les Bricoleurs</span>
        </div>

        <h2>IV. Enclos de Guilde & Optimisation (Plafond 20 Enclos)</h2>
        <div class="my-6 rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/enclos_guilde.jpg" alt="Enclos de Guilde Dofus" class="rounded-xl w-full max-h-[360px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">Disposition optimale des objets d'élevage en enclos privé de guilde</span>
        </div>

        <p>
            Chaque guilde peut détenir jusqu'à <strong>20 enclos privés</strong>. Les enclos de guilde permettent :
        </p>
        <ul>
            <li><strong>Des gains jusqu'à 5x plus rapides</strong> grâce aux objets d'élevage de haute durabilité et efficacité.</li>
            <li><strong>L'organisation en couloir :</strong> Disposer les objets de manière à ce qu'une monture touche 2 à 4 objets par pas.</li>
            <li><strong>La gestion collaborative :</strong> Sur SigilOS, administrez les droits d'enclos et suivez les accouplements en direct.</li>
        </ul>

        <h2>V. Nouveautés 2026 : Makinas & Capacités Spéciales</h2>
        <p>
            Le système de <strong>Makinas</strong> permet de modifier ou d'améliorer les montures directement :
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-cyan-300 text-sm block">Animakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Permet d'extraire et de transférer l'expérience d'une monture vers une autre.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-purple-300 text-sm block">Kromakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Favorise l'apparition de mutations génétiques et de couleurs rares lors des naissances.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-emerald-300 text-sm block">Optimakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Augmente les chances de transmission des capacités génétiques convoitées (Caméléone, Reproductrice).</p>
            </div>
        </div>

        <div class="callout callout-success">
            <strong>Astuce Rentabilité Guilde</strong>
            <p>Montez toujours vos montures au <strong>niveau 5</strong> minimum en combat pour déclencher l'état <em>Féconde</em>. Échangez les montures stériles ou en surplus auprès des PNJ d'Amakna pour récupérer des parchemins de caractéristiques immédiatement revendables en hôtel de vente !</p>
        </div>
    `,
};
