export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Guide de l'Éleveur Dofus — Édition 2026 (Unity)",
    description:
        "Le guide complet de l'élevage Dofus 2026 : capturer, rendre fécondes, accoupler, XP ses montures via la jauge Mangeoire, généalogie, Makinas et clonage.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Édition 2026 — Dofus Unity 3.5+</strong>
            <p>Ce guide couvre l'intégralité de l'élevage après la refonte Unity : capture, jauges, reproduction, XP via la Mangeoire, généalogie, Makinas et clonage.</p>
        </div>

        <div class="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.png" alt="Les 3 types de montures Dofus" class="rounded-xl w-full max-h-[360px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">Les 3 familles de montures : Dragodindes, Muldos et Volkornes — niveaux 1 à 200</span>
        </div>

        <h2>I. Les 3 Types de Montures</h2>
        <p>Il existe <strong>3 espèces</strong> de montures dans Dofus, chacune allant de <strong>niveau 1 à 200</strong> :</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/dragodindes.png" alt="Dragodindes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-amber-300 text-sm">Dragodindes</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>10 générations.</strong> Bonus de stat selon la couleur (Vitalité, Force, Agilité…). Idéales pour l'élevage de masse.</p>
                <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Stats Dragodindes" class="mt-2 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/muldos.png" alt="Muldos" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-emerald-300 text-sm">Muldos</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>6 générations.</strong> Bonus : +1 PM (lvl 100+). Une seule reproduction par individu.</p>
                <img src="/images/guides/elevage/stats_muldos.jpg" alt="Stats Muldos" class="mt-2 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/volkornes.png" alt="Volkornes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-rose-300 text-sm">Volkornes</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>4 générations.</strong> Bonus : +1 PA (lvl 100+). Très recherchés en PvP.</p>
                <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Stats Volkornes" class="mt-2 rounded border border-white/5 w-full" />
            </div>
        </div>

        <h2>II. Capturer une Monture Sauvage</h2>
        <div class="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <img src="/images/guides/elevage/filet_capture.png" alt="Filet de capture" class="w-20 h-20 object-contain shrink-0" />
            <div>
                <p class="text-sm text-zinc-300 leading-relaxed">
                    Achetez un <strong>Filet de capture</strong> auprès du PNJ Kito au village des éleveurs (<strong>[-17, 0]</strong>). Équipez-le et utilisez le sort <em>Apprivoisement de Monture</em> avant le dernier coup sur la monture sauvage en combat.
                </p>
                <ul class="text-xs text-zinc-400 mt-2 space-y-1">
                    <li>• <strong>Dragodindes :</strong> Montagne des Koalaks et environs.</li>
                    <li>• <strong>Muldos :</strong> Sufokia (Abysses).</li>
                    <li>• <strong>Volkornes :</strong> Territoire des Nimbos.</li>
                </ul>
            </div>
        </div>

        <h2>III. Les Enclos — Comment ça marche</h2>
        <p>
            L'XP et le conditionnement des montures se font dans des <strong>enclos</strong>.
            Même au <strong>niveau 1 du métier d'éleveur</strong>, vous accédez à l'<strong>Enclos du Débutant</strong> en <strong>[-18, 0]</strong>.
            En montant le métier, vous débloquez des enclos plus grands, avec des jauges plus efficaces.
        </p>

        <div class="callout callout-info">
            <strong>Note importante</strong>
            <p>La jauge se vide à la même vitesse qu'il y ait 1 ou 10 montures dans l'enclos. Placez-en le maximum pour XP plusieurs montures en même temps avec le même carburant !</p>
        </div>

        <h2>IV. Les Jauges — Rendre une Monture Féconde</h2>
        <p>Pour qu'une monture puisse s'accoupler, elle doit être <strong>Féconde</strong>. Cela nécessite de remplir ses jauges <strong>Endurance</strong> et <strong>Amour</strong>, en ajustant d'abord la <strong>Sérénité</strong> :</p>

        <table>
            <thead>
                <tr>
                    <th>Jauge</th>
                    <th>Sérénité Requise</th>
                    <th>Objet / Carburant</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Endurance</strong></td>
                    <td><span class="text-amber-400 font-bold">Négative</span></td>
                    <td>Foudroyeurs</td>
                </tr>
                <tr>
                    <td><strong>Maturité</strong></td>
                    <td><span class="text-zinc-400">Neutre</span></td>
                    <td>Abreuvoirs</td>
                </tr>
                <tr>
                    <td><strong>Amour</strong></td>
                    <td><span class="text-rose-400 font-bold">Positive</span></td>
                    <td>Dragofesses</td>
                </tr>
                <tr>
                    <td><strong>XP (Mangeoire)</strong></td>
                    <td>Toute valeur</td>
                    <td>Carburants de Mangeoire (4 tiers)</td>
                </tr>
                <tr>
                    <td><strong>Sérénité</strong></td>
                    <td>—</td>
                    <td>Baffeurs (baisse) / Caresseurs (hausse)</td>
                </tr>
            </tbody>
        </table>

        <h2>V. XP — La Jauge Mangeoire en 4 Tiers</h2>

        <table>
            <thead>
                <tr><th>Tier</th><th>Carburant</th><th>XP gagnée</th><th>Durée avant vide</th></tr>
            </thead>
            <tbody>
                <tr><td><strong>Tier 1</strong></td><td>Extrait de mangeoire</td><td>1 XP / 10 s</td><td>~11h06</td></tr>
                <tr><td><strong>Tier 2</strong></td><td>Philtre de mangeoire</td><td>2 XP / 10 s</td><td>~4h09</td></tr>
                <tr><td><strong>Tier 3</strong></td><td>Potion de mangeoire</td><td>3 XP / 10 s</td><td>~1h51</td></tr>
                <tr><td><strong>Tier 4</strong></td><td>Élixir de mangeoire</td><td>4 XP / 10 s</td><td>~42 min</td></tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>Temps pour le niveau 200</strong>
            <p>Il faut <strong>867 582 XP</strong> pour atteindre le niveau 200. Avec Tier 4 en permanence : <strong>~60 heures</strong>. En entretien Tier 2 régulier : <strong>~120 à 150 heures</strong>. Une monture avec la capacité <em>Sage</em> gagne l'XP 2× plus vite !</p>
        </div>

        <h2>VI. Reproduction — Une Seule Fois, Puis Stérilité</h2>
        <p>Après un accouplement, les deux parents deviennent <strong>stériles</strong>. Vous avez alors plusieurs options :</p>
        <ul>
            <li><strong>Vendre en HDV</strong> (après XP pour augmenter leur valeur).</li>
            <li><strong>Équiper</strong> sur votre personnage pour leurs statistiques.</li>
            <li><strong>Extraire les ressources</strong> — la monture est supprimée mais vous obtenez des matériaux d'équipement.</li>
            <li><strong>Cloner</strong> pour récupérer une monture fertile de même généalogie.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Le Clonage</strong>
            <p>Combinez <strong>deux montures de même génération et même type</strong> dans l'interface de clonage. Les deux sont consommées, vous récupérez l'une d'elles <strong>fertile</strong>, avec le même genre et la même généalogie — mais les jauges réinitialisées et sans capacité spéciale.</p>
        </div>

        <h2>VII. Génération Cible et Probabilités</h2>
        <p>
            Lors d'un accouplement, le bébé a <strong>30% de chance de base</strong> d'être de la génération cible
            (la plus haute combinaison possible selon les deux arbres généalogiques). Cette probabilité augmente via :
        </p>
        <ul>
            <li><strong>+0,15% par niveau de chaque parent</strong> (les deux cumulés). Deux parents lvl 200 → +60%.</li>
            <li><strong>+10% avec une Optimakina.</strong></li>
        </ul>

        <div class="callout callout-tip">
            <strong>Combo Optimal</strong>
            <p>Deux parents <strong>niveau 200</strong> + <strong>Optimakina</strong> = 30% + 60% + 10% = <strong>100%</strong> de chance d'obtenir la génération cible !</p>
        </div>

        <h2>VIII. Les Makinas</h2>
        <p>Consommables craftables par les éleveurs, utilisés <strong>lors d'un accouplement</strong> (une seule par accouplement, optionnelle) :</p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-cyan-300 text-sm block">Animakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Donne une <strong>capacité aléatoire</strong> au bébé : Amoureuse, Endurante, Précoce, Sage ou Reproductrice.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-purple-300 text-sm block">Kromakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Le bébé obtient la capacité <strong>Caméléone</strong> — robe changeante aléatoirement.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-emerald-300 text-sm block">Optimakina</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>+10%</strong> de chance d'obtenir la génération cible lors de cet accouplement.</p>
            </div>
        </div>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/craft_objets.png" alt="Objets d'élevage craftables" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Carburants et objets d'élevage craftables par les Éleveurs (Bricoleurs)</span>
        </div>
    `,
};

