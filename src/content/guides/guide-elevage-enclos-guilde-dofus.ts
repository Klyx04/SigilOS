export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Élevage de montures Dofus 3.7 : le guide",
    description:
        "Capturer sa monture, monter éleveur, enclos, sérénité, accouplements, croisements, clonage et génétons : le guide complet à jour de la MàJ 3.7.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
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

        <!-- ── COCKPIT BANNER STUDIO ÉLEVAGE ──────────────────────────────── -->
        <div class="my-8 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-950 p-6 shadow-xl">
            <div class="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div class="flex items-center gap-5">
                    <div class="relative w-20 h-20 shrink-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-2 flex items-center justify-center shadow-inner">
                        <img src="/images/guides/elevage/dragodindes.png" alt="Dragodinde SigilOS Studio" class="no-zoom w-16 h-16 object-contain filter drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]" />
                    </div>
                    <div>
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[11px] mb-1.5">
                            ✨ Outil Gratuit & Simulateur Interactif
                        </div>
                        <h3 class="text-lg font-bold text-foreground">Studio Élevage Dofus Unity 3.7</h3>
                        <p class="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                            Testez vos probabilités de croisement à 100% (Optimakina + niveaux), simulez vos durées d'XP en mangeoire et évitez la dérive de sérénité grâce au minuteur d'enclos.
                        </p>
                    </div>
                </div>
                <a href="/elevage" class="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02]">
                    <img src="/images/guides/elevage/dragodindes.png" alt="" class="no-zoom w-4 h-4 object-contain" />
                    <span>Lancer le Studio Élevage 3.7 →</span>
                </a>
            </div>
        </div>

        <!-- ── BANNIÈRE EN-TÊTE FAMILLES ──────────────────────────────────── -->
        <div class="my-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.jpg" alt="Les 3 familles de montures Dofus Unity" class="rounded-xl w-full max-h-[380px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">Les 3 familles de montures sur 10 générations : Dragodindes, Muldos et Volkornes — niveaux 1 à 200</span>
        </div>

        <!-- ── STRUCTURE EN 4 ONGLETS DYNAMIQUES ───────────────────────────── -->
        <div class="guide-tabs my-8" data-default-tab="demarrer">
            <!-- Barre de navigation des onglets -->
            <div class="guide-tab-nav flex flex-wrap border-b border-border gap-2 mb-8 pb-px">
                <button type="button" class="guide-tab-btn active px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-amber-500 bg-amber-500/10 text-foreground transition-all flex items-center gap-2" data-tab="demarrer">
                    <span>🧭 1. Bien Débuter & Enclos</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="serenite">
                    <span>⚖️ 2. Sérénité & Humeur</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="reproduction">
                    <span>🧬 3. Reproduction & Arbres</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="rentabilite">
                    <span>💰 4. XP 200 & Rentabilité</span>
                </button>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- ONGLET 1 : BIEN DÉBUTER & ENCLOS                                -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane" data-pane="demarrer">
                <h2>I. Les Fondations de l'Élevage Unity (MàJ 3.5 & 3.7)</h2>
                <p>
                    L'élevage dans Dofus Unity a été entièrement repensé pour supprimer les contraintes historiques lourdes.
                    Voici les changements fondamentaux à retenir :
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-amber-300 block mb-1">❌ Fin des Certificats</strong>
                        <p class="text-zinc-400 text-[11px]">Les montures sont désormais des objets d'équipement direct stockés en inventaire ou à l'étable, sans péremption.</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-cyan-300 block mb-1">❌ Fin de la Fatigue & Énergie</strong>
                        <p class="text-zinc-400 text-[11px]">Les montures ne se fatiguent plus et n'ont plus besoin d'énergie pour être montées ou accouplées.</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-emerald-300 block mb-1">⚡ Naissance Immédiate</strong>
                        <p class="text-zinc-400 text-[11px]">Plus de délai de gestation : la fécondation donne naissance au bébé sur le champ (parents stériles).</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-rose-300 block mb-1">🏠 Enclos Publics Uniques</strong>
                        <p class="text-zinc-400 text-[11px]">Les enclos privés n'existent plus : tout se passe aux 6 enclos publics du Village des Éleveurs.</p>
                    </div>
                </div>

                <h3>Les 3 Espèces de Montures (10 Générations Chacune)</h3>
                <p>
                    Contrairement aux anciennes versions du jeu, <strong>les 3 familles de montures couvrent désormais 10 générations complètes</strong>. Chaque famille confère un bonus signature garanti dès le niveau 100 :
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/dragodindes.png" alt="Dragodindes" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-amber-300 text-sm">Dragodindes (66 robes)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 générations.</strong> Bonus signature : <strong>Vitalité</strong> (300 au lvl 100, 400 au lvl 200), Puissance et statistiques élémentaires. L'espèce historique idéale pour débuter.</p>
                        <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Stats Dragodindes" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/muldos.png" alt="Muldos" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-emerald-300 text-sm">Muldos (82 robes)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 générations.</strong> Bonus signature : <strong>+1 PM</strong> garanti dès le niveau 100, complété par des résistances % et caractéristiques. Succès dédié : <em>Générations aquatiques</em>.</p>
                        <img src="/images/guides/elevage/stats_muldos.jpg" alt="Stats Muldos" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/volkornes.png" alt="Volkornes" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-rose-300 text-sm">Volkornes (80 robes)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 générations.</strong> Bonus signature : <strong>+1 PA</strong> garanti dès le niveau 100, complété par des coups critiques et statistiques primaires. Succès dédié : <em>Génération V</em>.</p>
                        <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Stats Volkornes" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                </div>

                <h3>Les 4 États de Fertilité</h3>
                <ul>
                    <li><strong>Fertile :</strong> monture accouplable une fois ses 3 jauges personnelles maximisées.</li>
                    <li><strong>Féconde :</strong> prête pour l'accouplement immédiat (les 3 jauges sont à 100%).</li>
                    <li><strong>Stérile :</strong> a déjà effectué sa reproduction. Plus aucun accouplement possible, mais clonage et extraction autorisés.</li>
                    <li><strong>Sénile :</strong> montures héritées d'avant la 3.5 : ni accouplement ni clonage, équipables et XP uniquement.</li>
                </ul>

                <h2>II. Capturer sa Première Monture</h2>
                <p>
                    Le sort historique <em>Apprivoisement de monture</em> n'est plus appris au donjon Koulosse : il s'obtient automatiquement en équipant un <strong>filet de capture</strong> dans vos consommables de combat.
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                    <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                        <img src="/images/guides/elevage/zone_dragodindes.jpg" alt="Zone Dragodindes" class="rounded-lg w-full h-32 object-cover mb-2" />
                        <strong class="text-amber-300 text-xs block">Territoire des Dragodindes</strong>
                        <p class="text-[11px] text-zinc-400 mt-1">Montagne des Koalaks (Amande, Rousse, Dorée sauvages). Niveau 60.</p>
                    </div>
                    <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                        <img src="/images/guides/elevage/zone_muldos.jpg" alt="Zone Muldos" class="rounded-lg w-full h-32 object-cover mb-2" />
                        <strong class="text-emerald-300 text-xs block">Bassin des Muldos</strong>
                        <p class="text-[11px] text-zinc-400 mt-1">Baie de Sufokia (Abysses). Monstres de niveau 60 accessibles sans plongée.</p>
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
                            <li>• <strong>Filet multiplicateur renforcé (Niveau 200) :</strong> Capture en zone cercle rayon 3 <em>et duplique</em> l'ensemble des cibles !</li>
                        </ul>
                    </div>
                </div>

                <h2>III. L'Étable & Les Enclos Publics</h2>
                <p>
                    Toute la logistique s'opère dans les <strong>6 maps du Village des Éleveurs en [-18, 0]</strong>, accessibles et progressifs selon votre niveau d'Éleveur :
                </p>

                <div class="my-4 rounded-xl overflow-hidden border border-white/10">
                    <img src="/images/guides/elevage/enclos_guilde.jpg" alt="Enclos du Village des Éleveurs" class="w-full h-48 object-cover" />
                </div>

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

                <div class="callout callout-info">
                    <strong>🏠 Étable étendue à 500 places</strong>
                    <p>Depuis la 3.7, la capacité de stockage de l'étable a été portée à <strong>500 montures</strong> par joueur. Vous pouvez ainsi héberger d'immenses pools génétiques sans saturer vos inventaires.</p>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- ONGLET 2 : SÉRÉNITÉ & HUMEUR                                    -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="serenite">
                <h2>I. Les 4 Plages de Sérénité & Les Smileys</h2>
                <p>
                    Pour devenir <strong>Féconde</strong>, une monture doit remplir ses 3 jauges (<strong>Endurance</strong>, <strong>Maturité</strong>, <strong>Amour</strong>).
                    La montée de ces jauges dépend exclusivement de la valeur de sa <strong>Sérénité</strong> (qui oscille entre <strong>-5 000 et +5 000</strong>) :
                </p>

                <div class="guide-image-container my-6 text-center">
                    <img src="/images/guides/elevage/smileys_humeur.png" alt="Les 4 zones de sérénité et les smileys d'humeur associés" class="guide-image max-w-md mx-auto rounded-lg border border-border" />
                    <span class="text-xs text-zinc-400 mt-2 block">Les 4 zones de sérénité et les smileys d'humeur en jeu</span>
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
                            <td>Ajustement de l'humeur</td>
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

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/jauges_enclos.png" alt="Interface des jauges d'enclos Unity" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Interface de contrôle des 5 jauges d'enclos et des carburants injectés</span>
                </div>

                <div class="callout callout-warning">
                    <strong>⚠️ Alerte 3.7 : Le Piège de la Granularité</strong>
                    <p>
                        L'efficacité des carburants ayant été doublée (6 000 pts / 200 000 max), <strong>la sérénité dérive 2 fois plus vite</strong>.
                        Si vous laissez des baffeurs ou des caresseurs actifs sans calculer le temps d'enclos, votre monture franchira la zone neutre et basculera à l'extrême opposé.
                    </p>
                </div>

                <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 my-6">
                    <strong class="text-amber-300 text-sm block mb-2">⚡ Le Protocole en 2 Étapes pour Rendre Féconde sans Dérive :</strong>
                    <ol class="text-xs text-zinc-300 space-y-2 list-decimal pl-4">
                        <li>
                            <strong>Phase 1 (Endurance + Maturité en simultané) :</strong> Ajustez la sérénité entre <strong>-2 000 et -1</strong> (Smiley Bleu :(). Activez dans l'enclos la jauge de <strong>Foudroyeur</strong> et d'<strong>Abreuvoir</strong>. Votre monture montera son endurance ET sa maturité en même temps !
                        </li>
                        <li>
                            <strong>Phase 2 (Amour + Fin de Maturité) :</strong> Utilisez un caresseur pour basculer la sérénité entre <strong>0 et +2 000</strong> (Smiley Violet :). Activez la jauge de <strong>Dragofesse</strong> (et d'Abreuvoir si nécessaire). Votre monture devient <strong>Féconde</strong> sans jamais avoir visité les extrêmes !
                        </li>
                    </ol>
                </div>

                <!-- CTA CONTEXTUEL MINUTEUR SÉRÉNITÉ -->
                <div class="my-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">⏱️</span>
                        <div>
                            <strong class="text-xs text-foreground block">Simulateur Anti-Dérive de Sérénité</strong>
                            <p class="text-[11px] text-muted-foreground mt-0.5">Calculez les paliers de carburants et le minuteur exact avant bascule dans le Studio Élevage.</p>
                        </div>
                    </div>
                    <a href="/elevage" class="shrink-0 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 font-semibold text-xs hover:bg-cyan-400 transition-colors">
                        Ouvrir le Minuteur →
                    </a>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- ONGLET 3 : REPRODUCTION, ARBRES & MAKINAS                       -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="reproduction">
                <h2>I. Reproduction Immédiate & Calcul Génération Cible</h2>
                <p>
                    L'accouplement se déclenche directement depuis l'étable entre un mâle et une femelle féconds de même famille.
                    La naissance est <strong>immédiate</strong> et les parents deviennent <strong>stériles</strong>.
                </p>

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/accouplement_interface.jpg" alt="Interface d'accouplement Unity 3.7" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Interface d'accouplement avec choix de la Makina catalytique</span>
                </div>

                <p>La probabilité d'obtenir la <strong>Génération Cible</strong> (la plus haute issue des deux parents) répond à la formule suivante :</p>

                <div class="p-4 rounded-xl bg-zinc-900 border border-white/10 font-mono text-center text-xs sm:text-sm text-amber-300 my-4">
                    Probabilité = 30% (Base) + (Niveau Parent 1 × 0,15%) + (Niveau Parent 2 × 0,15%) + Optimakina (+20%) + Takeza (+20%)
                </div>

                <div class="callout callout-tip">
                    <strong>🎯 Le Seuil 100% avec l'Optimakina (MàJ 3.7)</strong>
                    <p>
                        L'Optimakina apportant désormais <strong>+20%</strong> (au lieu de 10%), il ne reste que <strong>50%</strong> à combler grâce au niveau des parents.
                        Vous atteignez <strong>100% de chance garanti</strong> dès que la somme des niveaux des deux parents atteint <strong>334</strong> :
                    </p>
                    <ul class="text-xs text-zinc-300 mt-2 space-y-1">
                        <li>• Deux parents <strong>niveau 167</strong> + Optimakina = 30% + 50,1% + 20% = <strong>100% garanti</strong> !</li>
                        <li>• Un parent <strong>niveau 200</strong> + un parent <strong>niveau 134</strong> + Optimakina = 30% + 30% + 20,1% + 20% = <strong>100% garanti</strong> !</li>
                        <li><em>Économie colossale :</em> Vous évitez de monter vos deux parents au niveau 200 pour sécuriser vos croisements.</li>
                    </ul>
                </div>

                <!-- CTA CONTEXTUEL CROISEMENTS -->
                <div class="my-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🎯</span>
                        <div>
                            <strong class="text-xs text-foreground block">Testez vos deux montures en direct</strong>
                            <p class="text-[11px] text-muted-foreground mt-0.5">Vérifiez vos pourcentages et calculez les niveaux requis dans le Calculateur de Croisements.</p>
                        </div>
                    </div>
                    <a href="/elevage" class="shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400 transition-colors">
                        Tester mes croisements →
                    </a>
                </div>

                <h2>II. Les 3 Makinas (Refonte 3.7)</h2>
                <p>Consommables d'accouplement fabriqués par les éleveurs (une seule Makina par portée) :</p>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/30 text-center">
                        <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-cyan-300 text-sm block">Animakina (MàJ 3.7)</strong>
                        <p class="text-xs text-zinc-300 mt-1">Permet de <strong>choisir à 100% le sexe du bébé (Mâle ♂ ou Femelle ♀)</strong>. Met fin définitivement aux déséquilibres de genre.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 text-center">
                        <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-emerald-300 text-sm block">Optimakina (+20%)</strong>
                        <p class="text-xs text-zinc-300 mt-1">Confère <strong>+20% de probabilité</strong> (au lieu de 10%) d'obtenir la génération cible lors de l'accouplement.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-purple-500/30 text-center">
                        <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-purple-300 text-sm block">Kromakina</strong>
                        <p class="text-xs text-zinc-300 mt-1">Transmet avec certitude la capacité <strong>Caméléone</strong> au bébé (la monture adopte les couleurs du personnage).</p>
                    </div>
                </div>

                <h2>III. L'Arbre Généalogique & Les Lignées Pures</h2>
                <p>
                    L'arbre généalogique enregistre les ancêtres sur <strong>4 générations (14 ancêtres)</strong>.
                    Chaque génération d'ancêtres pèse dans le tirage aléatoire de la couleur du bébé :
                </p>

                <div class="my-4 text-center">
                    <img src="/images/guides/elevage/arbre_genetique.jpg" alt="Arbre généalogique d'élevage Dofus" class="rounded-xl mx-auto max-h-[280px] border border-white/10" />
                    <span class="text-xs text-zinc-400 mt-2 block">Pondération génétique : Parents (50%), Grands-parents (25%), Arrière-grands-parents (12,5%), Arrière-arrière-grands-parents (6,25%)</span>
                </div>

                <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-xs text-zinc-300 space-y-1.5 my-4">
                    <strong class="text-amber-300 block mb-1">Pourquoi épurer ses lignées ?</strong>
                    <p>• Une <strong>lignée pure</strong> est une monture dont les 14 ancêtres sont de la même race exacte.</p>
                    <p>• Deux parents de lignée pure croisés ensemble ont <strong>100% de chance</strong> de transmettre leur couleur sans risque de régression vers une génération antérieure.</p>
                </div>

                <h2>IV. Les 6 Capacités Génétiques Majeures</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Capacité</th>
                            <th>Effet en Jeu</th>
                            <th>Utilité Élevage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Reproductrice</strong></td>
                            <td>Donne <strong>1 bébé supplémentaire</strong> par portée (2 bébés au lieu d'un seul).</td>
                            <td>La capacité reine de l'élevage de masse : rentabilité doublée.</td>
                        </tr>
                        <tr>
                            <td><strong>Sage</strong></td>
                            <td>Gains d'expérience <strong>multipliés par 2</strong> en mangeoire.</td>
                            <td>Permet d'atteindre le niveau 200 en seulement ~30h chrono.</td>
                        </tr>
                        <tr>
                            <td><strong>Caméléone</strong></td>
                            <td>La monture prend les couleurs exactes du personnage équipé.</td>
                            <td>Très forte valeur commerciale en hôtel des ventes.</td>
                        </tr>
                        <tr>
                            <td><strong>Précoce</strong></td>
                            <td>Gains de maturité <strong>doublés</strong> lors des passages en abreuvoir.</td>
                            <td>Accélère considérablement la phase d'enclos neutre.</td>
                        </tr>
                        <tr>
                            <td><strong>Amoureuse</strong></td>
                            <td>Gains d'amour <strong>doublés</strong> lors des passages en dragofesse.</td>
                            <td>Raccourcit de moitié le temps nécessaire pour la jauge rouge.</td>
                        </tr>
                        <tr>
                            <td><strong>Endurante</strong></td>
                            <td>Gains d'endurance <strong>doublés</strong> lors des passages en foudroyeur.</td>
                            <td>Raccourcit de moitié le temps nécessaire pour la jauge jaune.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- ONGLET 4 : XP 200, RENTABILITÉ & SUCCÈS                         -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="rentabilite">
                <h2>I. Monter une Monture Niveau 200 (XP Mangeoire)</h2>
                <p>
                    Une monture progresse du niveau 1 au niveau 200 en accumulant <strong>867 582 XP</strong> via la jauge de Mangeoire.
                    Le débit d'XP dépend du Tier de carburant injecté dans l'enclos :
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>Tier Carburant</th>
                            <th>Carburant d'Élevage</th>
                            <th>Débit XP</th>
                            <th>Niveau 1 → 100</th>
                            <th>Niveau 1 → 200</th>
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

                <h2>II. Le Clonage & Recyclage Rentable</h2>
                <p>
                    L'interface de <strong>Clonage</strong> permet de fusionner <strong>deux montures stériles de même type et même génération</strong> pour en récupérer une <strong>fertile</strong>.
                </p>

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/clonage_interface.jpg" alt="Interface de Clonage Unity" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Interface de clonage : fusion de 2 stériles pour recréer une fertile</span>
                </div>

                <div class="callout callout-tip">
                    <strong>🔥 L'Avantage Décisif du Clonage 3.7</strong>
                    <p>
                        Contrairement aux anciennes versions où les jauges dérivaient aléatoirement, <strong>la monture issue du clonage conserve désormais la sérénité exacte de la monture modèle</strong> !
                        Si vous clonez une monture calée en zone neutre ([-2000, 0]), votre nouvelle monture fertile peut être placée directement en foudroyeur/abreuvoir sans aucun détour par un caresseur.
                    </p>
                </div>

                <h2>III. Barème des Génétons 3.7 & Extraction</h2>
                <p>
                    Un accouplement rapporte des <strong>Génétons</strong> seulement si le bébé dépasse <strong>toutes</strong> les montures des deux arbres généalogiques.
                    Échangeables au Village des Éleveurs en <strong>[-18, 1]</strong> auprès du PNJ <strong>Eugène Éton</strong> contre des parchemins de caractéristiques et des tourmalines.
                </p>

                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 text-center">
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 1 : <strong class="text-zinc-300">2</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 2 : <strong class="text-zinc-300">4</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 3 : <strong class="text-zinc-300">8</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 4 : <strong class="text-zinc-300">16</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 5 : <strong class="text-zinc-300">30</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 6 : <strong class="text-zinc-300">60</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 7 : <strong class="text-zinc-300">120</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 8 : <strong class="text-zinc-300">240</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-amber-500/30 text-xs text-amber-300">Gen 9 : <strong>500</strong></div>
                    <div class="p-2 rounded-lg bg-zinc-900 border border-amber-500/30 text-xs text-amber-300">Gen 10 : <strong>500</strong></div>
                </div>

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

                <h2>IV. Calendrier Almanax de l'Éleveur : Les 13 Dates Clés</h2>
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
                            <td><strong>+20% de probabilité d'obtenir la génération cible</strong> lors de tous les accouplements ! Le jour le plus important de l'année.</td>
                        </tr>
                        <tr><td><strong>10 Novembre</strong></td><td>Otoul</td><td>100% des bébés naissent avec la capacité <strong>Précoce</strong>.</td></tr>
                        <tr><td><strong>10 Décembre</strong></td><td>Foya</td><td>Effet des <strong>Dragofesses</strong> doublé en enclos (Amour ×2).</td></tr>
                    </tbody>
                </table>

                <h2>V. Les Succès d'Élevage Unity</h2>
                <p>La progression en élevage débloque de précieux points de succès et des titres d'apparat :</p>
                <ul>
                    <li><strong>Succès de Naissances :</strong> paliers cumulés de 1, 10, 50, 100, 500 jusqu'à <strong>1 000 naissances</strong>.</li>
                    <li><strong>Succès Muldos :</strong> <em>Muldo : Première génération</em> à <em>Muldo : Dixième génération</em> culminant avec le méta-succès <strong>Générations aquatiques</strong>.</li>
                    <li><strong>Succès Volkornes :</strong> <em>Volkorne : Première génération</em> à <em>Volkorne : Dixième génération</em> culminant avec le méta-succès <strong>Génération V</strong>.</li>
                </ul>

                <!-- GRAND BANDEAU FINAL STUDIO -->
                <div class="mt-8 p-6 rounded-2xl border border-border bg-surface/60 text-center">
                    <h3 class="text-base font-bold text-foreground mb-1.5">Prêt à optimiser vos portées ?</h3>
                    <p class="text-xs text-muted-foreground max-w-lg mx-auto mb-4">Accédez à notre simulateur interactif pour tester vos probabilités de croisement, calculer vos fenêtres de sérénité et suivre vos 10 générations.</p>
                    <a href="/elevage" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-opacity">
                        <img src="/images/guides/elevage/dragodindes.png" alt="" class="no-zoom w-4 h-4 object-contain" />
                        <span>Lancer le Studio Élevage 3.7</span>
                    </a>
                </div>
            </div>
        </div>
    `,
};
