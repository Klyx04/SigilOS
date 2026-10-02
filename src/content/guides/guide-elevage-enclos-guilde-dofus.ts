export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Guide de l'Éleveur Dofus Unity (MàJ 3.7) — Enclos, Croisements & Rentabilité",
    description:
        "Le guide ultime de l'élevage Dofus Unity 3.7 : capture, gestion de la sérénité sans gaspillage, jauges 200k, Animakina (choix du sexe), Optimakina (+20%), clonage à sérénité conservée, courbe d'XP et table des génétons.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    badgeColor: "amber",
    body: `
        <div class="callout callout-tip">
            <strong>Mise à Jour 3.7 — Confort de Jeu & Ajustements Économiques</strong>
            <p>Ce guide intègre l'ensemble des correctifs et équilibrages de la <strong>MàJ 3.7</strong> :
            <strong>Animakina</strong> (choix du sexe garanti à 100%), <strong>Optimakina</strong> renforcée à <strong>+20%</strong>,
            <strong>conservation de la sérénité lors du clonage</strong>, étables étendues à <strong>500 places</strong>,
            jauges d'enclos et efficacité des carburants doublées (6 000 pts / 200 000 max), et nouveau barème des <strong>Génétons jusqu'à 500</strong>.</p>
        </div>

        <div class="my-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <strong class="text-amber-300 text-sm block">🚀 Outil Interactif Disponible</strong>
                <p class="text-xs text-zinc-300 mt-1">Simulez vos probabilités de génération cible, calculez vos durées d'enclos sans risque d'overshoot de sérénité et estimez vos gains en génétons avec notre outil dédié.</p>
            </div>
            <a href="/elevage" class="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
                Ouvrir le Studio Élevage 3.7 →
            </a>
        </div>

        <div class="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.jpg" alt="Les 3 familles de montures Dofus Unity" class="rounded-xl w-full max-h-[380px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">Les 3 familles de montures : Dragodindes, Muldos et Volkornes — niveaux 1 à 200</span>
        </div>

        <h2>I. Les 3 Espèces de Montures & Paliers de Niveau</h2>
        <p>
            Dans Dofus Unity, les montures ne gagnent plus d'expérience lors des combats de personnages : elles évoluent passivement de <strong>niveau 1 à 200</strong> grâce à la jauge de <strong>Mangeoire</strong> en enclos.
            Chaque espèce possède un arbre génétique et des bonus caractéristiques distincts :
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/dragodindes.png" alt="Dragodindes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-amber-300 text-sm">Dragodindes</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>10 générations (66 robes).</strong> Bonus majeurs : Vitalité (jusqu'à 400 au lvl 200), Puissance et statistiques élémentaires mono/bi-éléments. Espèce reine de l'élevage de masse.</p>
                <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Stats Dragodindes" class="mt-3 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/muldos.png" alt="Muldos" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-emerald-300 text-sm">Muldos</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>6 générations (21 robes).</strong> Bonus signature : <strong>+1 PM</strong> garanti dès le niveau 100, avec résistances % et caractéristiques. Reproduction unique par individu.</p>
                <img src="/images/guides/elevage/stats_muldos.jpg" alt="Stats Muldos" class="mt-3 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/volkornes.png" alt="Volkornes" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-rose-300 text-sm">Volkornes</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>4 générations (10 robes).</strong> Bonus signature : <strong>+1 PA</strong> garanti dès le niveau 100, complété par des coups critiques et stats primaires. Très prisés en PvP.</p>
                <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Stats Volkornes" class="mt-3 rounded border border-white/5 w-full" />
            </div>
        </div>

        <h2>II. Capturer une Monture Sauvage</h2>
        <p>
            Depuis la refonte Unity, la capture ne nécessite plus de terminer le donjon Koulosse. Le sort <strong>Apprivoisement de monture</strong> s'obtient automatiquement lorsque vous équipez un filet de capture dans vos consommables de combat.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_dragodindes.jpg" alt="Zone Dragodindes" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-amber-300 text-xs block">Territoire des Dragodindes</strong>
                <p class="text-[11px] text-zinc-400 mt-1">Montagne des Koalaks (Amande, Rousse, Dorée). Niveau 60.</p>
            </div>
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_muldos.jpg" alt="Zone Muldos" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-emerald-300 text-xs block">Bassin des Muldos</strong>
                <p class="text-[11px] text-zinc-400 mt-1">Nord de Sufokia (Abysses). Monstres de niveau 60 accessibles sans plongée.</p>
            </div>
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_volkornes.jpg" alt="Zone Volkornes" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-rose-300 text-xs block">Haras de Brâkmar</strong>
                <p class="text-[11px] text-zinc-400 mt-1">Sud des remparts de Brâkmar. Monstres de niveau 60.</p>
            </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <img src="/images/guides/elevage/filet_universel.png" alt="Filets de capture" class="w-20 h-20 object-contain shrink-0" />
            <div>
                <strong class="text-sm text-foreground block mb-1">Les 4 Paliers de Filets (Métier Éleveur) :</strong>
                <ul class="text-xs text-zinc-300 space-y-1">
                    <li>• <strong>Filet de capture universel (Niveau 1) :</strong> Capture la monture ciblée en fin de combat.</li>
                    <li>• <strong>Filet multiplicateur (Niveau 100) :</strong> Capture et <em>duplique</em> la monture (obtention de 2 montures identiques).</li>
                    <li>• <strong>Filet renforcé (Niveau 150) :</strong> Capture en <strong>zone cercle de rayon 3</strong>.</li>
                    <li>• <strong>Filet multiplicateur renforcé (Niveau 200) :</strong> Capture en zone de rayon 3 <em>et duplique</em> l'intégralité des cibles !</li>
                </ul>
                <p class="text-[11px] text-zinc-400 mt-2"><em>Règle de combat :</em> Lancez le sort <strong>Apprivoisement de monture</strong> sur les montures souhaitées : l'état dure indéfiniment jusqu'à la fin du combat. Vous êtes libre d'éliminer les monstres sans contrainte de tour.</p>
            </div>
        </div>

        <h2>III. Les Enclos & L'Étable (Refonte 3.7)</h2>
        <p>
            Les enclos privés de maison n'existent plus. L'élevage s'effectue dans les <strong>enclos publics du Village des Éleveurs</strong> en <strong>[-18, 0]</strong>, accessibles et progressifs selon votre niveau dans le métier d'éleveur :
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 my-4 text-center">
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Niveau 1</span>
                <strong class="text-zinc-200">Débutant</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-18, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Niveau 40</span>
                <strong class="text-zinc-200">Novice</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-19, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Niveau 80</span>
                <strong class="text-zinc-200">Apprenti</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-20, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Niveau 120</span>
                <strong class="text-zinc-200">Initié</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-20, 2]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Niveau 160</span>
                <strong class="text-zinc-200">Vétéran</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-19, 2]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-amber-500/30 text-xs bg-amber-500/5">
                <span class="text-amber-400 block text-[10px]">Niveau 200</span>
                <strong class="text-amber-300">Maître</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-18, 2]</span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/20">
                <strong class="text-cyan-300 text-sm block mb-1">🏠 Étable portée à 500 places</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    La capacité de stockage maximale de l'étable a été doublée, passant de 250 à <strong>500 montures</strong>. Cette augmentation majeure permet de préserver de vastes pools génétiques sans saturer son inventaire.
                </p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/20">
                <strong class="text-emerald-300 text-sm block mb-1">⚡ Ravitaillement & Jauges Doublées</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    Depuis la 3.7, la jauge maximale d'un enclos atteint <strong>200 000 points</strong> (segmentée à 20k, 40k, 60k ou 80k selon l'enclos). L'efficacité des carburants est multipliée par 2 (un carburant qui apportait 3 000 points en injecte désormais <strong>6 000 points</strong>).
                </p>
            </div>
        </div>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/jauges_enclos.png" alt="Interface des jauges d'enclos Unity" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Interface de contrôle des 5 jauges d'enclos et des carburants associés</span>
        </div>

        <h2>IV. Maîtriser la Sérénité & Rendre une Monture Féconde</h2>
        <p>
            Pour qu'une monture puisse se reproduire, elle doit impérativement afficher l'état <strong>Féconde</strong>.
            Cet état requiert de maximiser ses 3 jauges (<strong>Endurance</strong>, <strong>Maturité</strong>, <strong>Amour</strong>).
            L'augmentation de ces jauges est strictement conditionnée par la valeur de la <strong>Sérénité</strong> (qui varie entre <strong>-5 000 et +5 000</strong>) :
        </p>

        <div class="guide-image-container my-6">
            <img src="/images/guides/elevage/smileys_humeur.png" alt="Les 4 zones de sérénité et les smileys d'humeur associés" class="guide-image max-w-md mx-auto rounded-lg border border-border" />
            <span class="guide-caption">Les 4 zones de sérénité et les smileys d'humeur associés en jeu</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Jauge Monture</th>
                    <th>Plage de Sérénité Requise</th>
                    <th>Smiley Associé</th>
                    <th>Actionneur d'Enclos</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Endurance</strong></td>
                    <td><span class="text-amber-400 font-bold">Négative</span> (-5 000 à -1)</td>
                    <td>Rouge :C ou Bleu :(</td>
                    <td><strong>Foudroyeur</strong> (Jauge Jaune)</td>
                </tr>
                <tr>
                    <td><strong>Maturité</strong></td>
                    <td><span class="text-cyan-400 font-bold">Neutre</span> (-2 000 à +2 000)</td>
                    <td>Bleu :( ou Violet :)</td>
                    <td><strong>Abreuvoir</strong> (Jauge Bleue)</td>
                </tr>
                <tr>
                    <td><strong>Amour</strong></td>
                    <td><span class="text-rose-400 font-bold">Positive</span> (+1 à +5 000)</td>
                    <td>Violet :) ou Vert :D</td>
                    <td><strong>Dragofesse</strong> (Jauge Rouge)</td>
                </tr>
                <tr>
                    <td><strong>Sérénité</strong></td>
                    <td>Ajustement libre</td>
                    <td>—</td>
                    <td><strong>Baffeur</strong> (-) / <strong>Caresseur</strong> (+)</td>
                </tr>
                <tr>
                    <td><strong>XP Monture</strong></td>
                    <td>Toute valeur</td>
                    <td>—</td>
                    <td><strong>Mangeoire</strong> (Jauge Beige)</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>⚠️ Alerte MàJ 3.7 : Le Piège de la Granularité</strong>
            <p>
                L'efficacité des carburants ayant été doublée, <strong>la sérénité dérive désormais deux fois plus vite</strong>.
                Si vous injectez du carburant de baffeur ou de caresseur sans calcul, votre monture franchira la fenêtre neutre ([-2000, +2000]) et basculera à l'extrême opposé.
                <strong>Règle d'or :</strong> Utilisez les paliers de carburant adaptés et retirez vos montures dès que la plage cible est atteinte.
            </p>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 my-6">
            <strong class="text-amber-300 text-sm block mb-2">⚡ Le Protocole en 2 Étapes pour Rendre Féconde Rapidement :</strong>
            <ol class="text-xs text-zinc-300 space-y-2 list-decimal pl-4">
                <li>
                    <strong>Phase 1 (Endurance + Maturité en simultané) :</strong> Ajustez la sérénité entre <strong>-2 000 et -1</strong> (Smiley Bleu :(). Activez dans l'enclos la jauge de <strong>Foudroyeur</strong> et d'<strong>Abreuvoir</strong>. Votre monture montera son endurance ET sa maturité en même temps !
                </li>
                <li>
                    <strong>Phase 2 (Amour + Fin de Maturité) :</strong> Utilisez un caresseur pour basculer la sérénité entre <strong>0 et +2 000</strong> (Smiley Violet :). Activez la jauge de <strong>Dragofesse</strong> (et d'Abreuvoir si la maturité n'était pas pleine). Votre monture devient <strong>Féconde</strong> sans jamais avoir visité les extrêmes !
                </li>
            </ol>
        </div>

        <h2>V. Reproduction & Calcul de la Génération Cible (3.7)</h2>
        <p>
            Lorsqu'un mâle et une femelle féconds de même famille sont placés dans l'interface d'accouplement, la naissance est <strong>immédiate</strong> (plus aucun temps de gestation).
            Les deux parents deviennent instantanément <strong>stériles</strong> et vous obtenez un bébé (ou 2 bébés si l'un des parents possède la capacité <em>Reproductrice</em>).
        </p>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/accouplement_interface.jpg" alt="Interface d'accouplement Unity 3.7" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Interface d'accouplement 3.7 avec filtres de sexe, niveau et insertion de Makina</span>
        </div>

        <p>
            La probabilité d'obtenir la <strong>Génération Cible</strong> (la génération la plus haute issue de la combinaison des deux arbres généalogiques) répond à une formule mathématique stricte :
        </p>

        <div class="p-4 rounded-xl bg-zinc-900 border border-white/10 font-mono text-center text-xs sm:text-sm text-amber-300 my-4">
            Probabilité = 30% (Base) + (Niveau Parent 1 × 0,15%) + (Niveau Parent 2 × 0,15%) + Optimakina (+20%)
        </div>

        <div class="callout callout-tip">
            <strong>🎯 Le Seuil 100% sans Niveau 200 (Nouveauté 3.7)</strong>
            <p>
                L'Optimakina passant de <strong>+10% à +20%</strong> en 3.7, il ne reste plus que <strong>50%</strong> à combler grâce au niveau des parents (au lieu de 60%).
                Vous atteignez <strong>100% de chance de génération cible</strong> dès lors que le cumul des niveaux des parents atteint <strong>334</strong> :
            </p>
            <ul class="text-xs text-zinc-300 mt-2 space-y-1">
                <li>• Deux parents <strong>niveau 167</strong> + Optimakina = 30% + 50,1% + 20% = <strong>100% garanti</strong> !</li>
                <li>• Un parent <strong>niveau 200</strong> + un parent <strong>niveau 134</strong> + Optimakina = 30% + 30% + 20,1% + 20% = <strong>100% garanti</strong> !</li>
                <li><em>Économie colossale :</em> Vous épargnez plus de 40 heures d'enclos mangeoire par rapport à l'obligation de monter deux parents niveau 200.</li>
            </ul>
        </div>

        <h2>VI. Les Makinas (Refonte Complète 3.7)</h2>
        <p>
            Les Makinas sont des catalyseurs consommables craftés par les Éleveurs, insérables au moment précis de l'accouplement (une seule Makina par portée).
            Leurs recettes ont été assainies en 3.7 pour éliminer les ressources de boss anormalement spéculatives :
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/30 text-center">
                <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-cyan-300 text-sm block">Animakina (Nouveau 3.7)</strong>
                <p class="text-xs text-zinc-300 mt-1">Permet de <strong>choisir à 100% le sexe du bébé (Mâle ♂ ou Femelle ♀)</strong>. Met fin définitivement aux pénuries de genre dans vos lignées.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 text-center">
                <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-emerald-300 text-sm block">Optimakina (Boostée 3.7)</strong>
                <p class="text-xs text-zinc-300 mt-1">Confère <strong>+20% de probabilité</strong> (au lieu de 10%) d'obtenir la génération cible lors de l'accouplement.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-purple-500/30 text-center">
                <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-purple-300 text-sm block">Kromakina</strong>
                <p class="text-xs text-zinc-300 mt-1">Transmet avec certitude la capacité <strong>Caméléone</strong> au bébé (la monture adopte les couleurs du personnage une fois équipée).</p>
            </div>
        </div>

        <h2>VII. Le Clonage & Recyclage Rentable (Astuce Sérénité)</h2>
        <p>
            Après l'accouplement, vos montures deviennent stériles. L'interface de <strong>Clonage</strong> permet de fusionner <strong>deux montures stériles de même type et même génération</strong> pour en récupérer une <strong>fertile</strong>.
        </p>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/clonage_interface.jpg" alt="Interface de Clonage Unity" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Interface de clonage : fusion de 2 montures stériles pour recréer une monture fertile pivot</span>
        </div>

        <div class="callout callout-tip">
            <strong>🔥 L'Avantage Décisif du Clonage 3.7 (Révélé par Liche)</strong>
            <p>
                Contrairement aux anciennes versions où les jauges étaient entièrement remises à zéro de façon aléatoire, <strong>la monture issue du clonage conserve désormais la sérénité exacte de la monture modèle</strong> !
                Si vous clonez une monture dont la sérénité était déjà calée dans la zone neutre ([-2000, 0]), votre nouvelle monture fertile peut être placée directement en foudroyeur/abreuvoir sans aucun détour par un caresseur.
            </p>
        </div>

        <h2>VIII. Monter une Monture Niveau 200 (XP & Mangeoires)</h2>
        <p>
            Une monture progresse du niveau 1 au niveau 200 en accumulant <strong>867 582 XP</strong> via la jauge de Mangeoire.
            Le débit d'XP dépend du Tier de carburant injecté dans l'enclos :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Tier Carburant</th>
                    <th>Objet d'Élevage</th>
                    <th>Gain d'XP</th>
                    <th>Temps Niveau 1 → 100</th>
                    <th>Temps Niveau 1 → 200</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Tier 1</strong></td>
                    <td>Extrait de mangeoire (Niv. 5+)</td>
                    <td>10 XP / 10 s</td>
                    <td>~48 heures</td>
                    <td>~241 heures (~10 jours)</td>
                </tr>
                <tr>
                    <td><strong>Tier 2</strong></td>
                    <td>Philtre de mangeoire (Niv. 55+)</td>
                    <td>20 XP / 10 s</td>
                    <td>~24 heures</td>
                    <td>~120 heures (~5 jours)</td>
                </tr>
                <tr>
                    <td><strong>Tier 3</strong></td>
                    <td>Potion de mangeoire (Niv. 105+)</td>
                    <td>30 XP / 10 s</td>
                    <td>~16 heures</td>
                    <td>~80 heures (~3,3 jours)</td>
                </tr>
                <tr>
                    <td><strong>Tier 4</strong></td>
                    <td>Élixir de mangeoire (Niv. 155+)</td>
                    <td>40 XP / 10 s</td>
                    <td>~12 heures</td>
                    <td><strong>~60 heures (~2,5 jours)</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Capacité Sage : Vitesse Doublée !</strong>
            <p>Une monture dotée de la capacité génétique <strong>Sage</strong> double tous ses gains d'XP en mangeoire. Le niveau 200 est alors atteint en <strong>~30 heures chrono</strong> en Tier 4 !</p>
        </div>

        <h2>IX. Économie, Barème des Génétons 3.7 & Extraction</h2>
        <p>
            Chaque accouplement génère des <strong>Génétons</strong>, échangeables au Village des Éleveurs en <strong>[-18, 1]</strong> auprès du PNJ <strong>Eugène Éton</strong> contre des parchemins de caractéristiques et des tourmalines.
            Le barème a été très nettement rehaussé pour récompenser les hautes générations :
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 text-center">
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 1 : <strong class="text-zinc-300">1</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 2 : <strong class="text-zinc-300">2</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 3 : <strong class="text-zinc-300">4</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 4 : <strong class="text-zinc-300">8</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 5 : <strong class="text-zinc-300">15</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 6 : <strong class="text-zinc-300">30</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 7 : <strong class="text-zinc-300">60</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 8 : <strong class="text-zinc-300">120</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-amber-500/30 text-xs text-amber-300">Gen 9 : <strong>250</strong></div>
            <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/50 text-xs text-amber-300 font-bold">Gen 10 : <strong>500</strong></div>
        </div>

        <p class="text-xs text-zinc-400">
            <em>Ajustement 3.7 :</em> Le coût d'achat des ressources auprès des PNJ de guilde passe de 15 à <strong>30 génétons</strong>, confirmant que l'achat PNJ doit rester un appoint et non une filière spéculative autonome. De plus, les ressources d'élevage sont retirées des cadeaux de l'île de Nowel.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/neurone_dragodinde.png" alt="Neurone de Dragodinde" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Neurone de Dragodinde</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtenu par extraction des Dragodindes stériles (Gen 2+).</span>
                </div>
            </div>
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/ambre_muldo.png" alt="Ambre de Muldo" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Ambre de Muldo</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtenu par extraction des Muldos stériles (Gen 2+).</span>
                </div>
            </div>
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/corne_volkorne.png" alt="Corne de Volkorne" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Corne de Volkorne</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtenu par extraction des Volkornes stériles (Gen 2+).</span>
                </div>
            </div>
        </div>

        <h2>X. Calendrier Almanax de l'Éleveur : Les 13 Dates Clés</h2>
        <p>
            Certains jours du calendrier Almanax modifient drastiquement la rentabilité de votre cheptel. Notez ces 13 dates indispensables :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Méryde</th>
                    <th>Bonus Élevage & Impact Stratégique</th>
                </tr>
            </thead>
            <tbody>
                <tr><td><strong>10 Janvier</strong></td><td>Trôma</td><td>Effet des <strong>Abreuvoirs</strong> doublé en enclos (Maturité ×2).</td></tr>
                <tr><td><strong>10 Février</strong></td><td>Meash</td><td>100% des bébés naissent avec la capacité <strong>Endurante</strong>.</td></tr>
                <tr><td><strong>10 Mars</strong></td><td>Inndo</td><td>Effet des <strong>Foudroyeurs</strong> doublé en enclos (Endurance ×2).</td></tr>
                <tr><td><strong>10 Avril</strong></td><td>Nunu</td><td>Effet des <strong>Baffeurs</strong> doublé (baisse de sérénité accélérée).</td></tr>
                <tr><td><strong>10 Mai</strong></td><td>Loumi</td><td>Économie de <strong>15% des ingrédients</strong> lors des crafts d'objets d'élevage.</td></tr>
                <tr><td><strong>10 Juin</strong></td><td>Jibejan</td><td>Effet des <strong>Mangeoires</strong> doublé (XP monture ×2).</td></tr>
                <tr><td><strong>10 Juillet</strong></td><td>Jihelair</td><td>100% des bébés naissent avec la capacité <strong>Amoureuse</strong>.</td></tr>
                <tr><td><strong>10 Août</strong></td><td>Rigamix</td><td><strong>25% de chance</strong> d'obtenir un second objet lors des crafts d'élevage.</td></tr>
                <tr><td><strong>10 Septembre</strong></td><td>Mau</td><td>Effet des <strong>Caresseurs</strong> doublé (hausse de sérénité accélérée).</td></tr>
                <tr><td><strong>10 Octobre</strong></td><td>Benjo</td><td>100% des bébés naissent avec la capacité <strong>Sage</strong> (XP doublée à vie !).</td></tr>
                <tr>
                    <td><strong>12 Octobre</strong></td>
                    <td><strong>Takeza</strong></td>
                    <td><strong>+20% de probabilité d'obtenir la génération cible</strong> lors de tous les accouplements ! Le jour le plus important de l'année pour monter ses générations.</td>
                </tr>
                <tr><td><strong>10 Novembre</strong></td><td>Otoul</td><td>100% des bébés naissent avec la capacité <strong>Précoce</strong>.</td></tr>
                <tr><td><strong>10 Décembre</strong></td><td>Foya</td><td>Effet des <strong>Dragofesses</strong> doublé en enclos (Amour ×2).</td></tr>
            </tbody>
        </table>

        <div class="mt-8 p-6 rounded-2xl border border-border bg-surface/60 text-center">
            <h3 class="text-base font-bold text-foreground mb-1.5">Prêt à optimiser vos portées ?</h3>
            <p class="text-xs text-muted-foreground max-w-lg mx-auto mb-4">Accédez à notre simulateur interactif pour tester vos probabilités de croisement, calculer vos fenêtres de sérénité et suivre vos générations.</p>
            <a href="/elevage" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-opacity">
                Lancer le Studio Élevage 3.7
            </a>
        </div>
    `,
};
