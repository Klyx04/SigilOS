export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Brisage Dofus : rentabilité des runes (2026)",
    description:
        "Formule du focus, coefficients du brisage, calcul du seuil d'équilibre et méthode pas à pas pour rentabiliser vos runes sur Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
    draft: false,
    badgeColor: "purple",
    body: `
        <div class="callout callout-tip">
            <strong>Règles Officielles &amp; Réalités Économiques (Dofus Unity 2026)</strong>
            <p>
                Le concasseur d'atelier de forgemagie est la <strong>source quasi-exclusive de création de runes</strong> dans Dofus. Son rôle économique fondamental (documenté dès les devblogs 2.27 et 2.31) est de détruire des équipements pour réguler l'offre d'objets en jeu. Ce guide s'appuie sur les mécaniques officielles, les modèles communautaires vérifiés et les réalités de marché en Hôtel des Ventes.
            </p>
        </div>

        <div class="guide-image-container my-6">
            <img src="/images/guides/brisage/concasseur.png" alt="Concasseur en atelier de forgemagie" class="guide-image max-h-48 object-contain p-2 rounded-xl border border-white/10 bg-zinc-900/50" />
            <span class="guide-caption">Le concasseur présent dans les ateliers de forgemagie de Bonta, Brâkmar et des cités</span>
        </div>

        <h2>1. Les Règles Fondamentales du Concasseur</h2>
        <p>
            Avant d'engager des kamas dans la fabrication d'équipements destinés au concassage, plusieurs règles et correctifs historiques majeurs doivent être maîtrisés.
        </p>

        <div class="callout callout-danger">
            <strong>Règle Officielle : Les objets brisés ne génèrent jamais de runes Pa ou Ra</strong>
            <p>
                Depuis la <strong>mise à jour 2.31</strong>, Ankama a explicitement supprimé la génération directe des runes <strong>Pa</strong> et <strong>Ra</strong> (par exemple <em>Pa Ine, Ra Ine, Pa Fo, Ra Fo, Pa Vi, Ra Vi</em>) lors du brisage.
            </p>
            <p>
                Quel que soit le niveau de l'objet détruit (niveau 1 ou niveau 200), le concasseur produit <strong>uniquement des runes simples de base</strong>. Les rangs Pa et Ra s'obtiennent <strong>exclusivement par fusion (3 pour 1)</strong> dans l'interface du concasseur.
            </p>
        </div>

        <!-- Schéma visuel de la fusion Pa/Ra -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Principe de génération et fusion des runes (MàJ 2.31)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                    <img src="/images/guides/fm/rune_ga_pa.png" alt="Ga PA" class="class-icon w-8 h-8 shrink-0 object-contain" />
                    <div>
                        <strong class="text-foreground block">Rune Ga PA (Poids 100)</strong>
                        <span class="text-muted-foreground text-[11px]">Rune de base unique de Point d'Action (non concernée par la suppression des rangs Pa/Ra).</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/30">
                    <strong class="text-foreground block mb-1">Fusion exclusive en atelier (3 pour 1) :</strong>
                    <div class="flex items-center gap-2 mt-2 font-mono text-xs text-foreground flex-wrap">
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            3× Ine
                        </span>
                        <span class="text-muted-foreground">➔</span>
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold text-sky-400">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            1× Pa Ine
                        </span>
                        <span class="text-muted-foreground">➔</span>
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold text-amber-400">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            1× Ra Ine
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <h3>Le mythe du rendement garanti à 500%</h3>
        <p>
            Le brisage ne constitue pas une rente automatique. Le système a été pensé par Ankama pour <strong>faire chuter le rendement d'un objet dès qu'il est détruit de manière répétée</strong> par la communauté. La rentabilité réelle dépend du coût d'achat des ingrédients, de la valeur marchande effective des runes en HDV et du coefficient instantané propre à votre serveur.
        </p>

        <h2>2. Comment le Jeu Calcule le Volume de Runes</h2>
        <p>
            La quantité de runes générées lors de la destruction d'un équipement dépend de quatre facteurs déterminants :
        </p>
        <ol class="steps">
            <li>
                <strong>Le niveau de l'équipement :</strong> Le volume global augmente avec le niveau de l'objet. La refonte 2.31 a revalorisé le rendement des tranches de niveau intermédiaire (niveaux 50 à 150).
            </li>
            <li>
                <strong>Le jet réel au moment du brisage :</strong> Le jeu calcule les runes à partir des statistiques réelles de l'exemplaire détruit. Une ligne absente ne produit aucune rune (par exemple une Caracoiffe sans son PA ne donnera aucune rune Ga PA).
            </li>
            <li>
                <strong>Le poids unitaire (PWR) de la caractéristique :</strong> Les caractéristiques lourdes (PA, PM, PO) génèrent des runes rares en faible volume, tandis que les caractéristiques légères (Vitalité, Initiative) produisent des centaines d'unités.
            </li>
            <li>
                <strong>Le coefficient dynamique du serveur :</strong> Le multiplicateur secret appliqué à cet objet sur votre serveur au moment précis de l'opération.
            </li>
        </ol>

        <!-- Schéma Pipeline Sobre avec numéros clairs -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Schéma — Pipeline de génération des runes au concasseur
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">01</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">1. Objet &amp; Jet réel</strong>
                        <span class="text-muted-foreground text-[11px]">Niveau de l'item et lignes de statistiques effectives</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">02</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">2. Poids (PWR)</strong>
                        <span class="text-muted-foreground text-[11px]">Densité unitaire de chaque caractéristique</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">03</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">3. Coefficient serveur</strong>
                        <span class="text-muted-foreground text-[11px]">Multiplicateur dynamique caché propre au serveur</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">04</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">4. Panier de runes</strong>
                        <span class="text-muted-foreground text-[11px]">Runes simples générées (sans ou avec focus)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="callout callout-warning">
            <strong>Faut-il remonter les jets d'un objet avant brisage ?</strong>
            <p>
                Un meilleur jet génère un rendement théorique supérieur. Néanmoins, investir des runes pour remonter un équipement n'est judicieux que si <strong>la valeur marchande des runes additionnelles dépasse le coût des runes consommées pour la forgemagie</strong>. Sur les équipements de niveau bas et moyen, cette opération est généralement déficitaire.
            </p>
        </div>

        <h2>3. Le Coefficient Secret : Vases Communicants</h2>
        <p>
            Chaque équipement dispose d'un taux multiplicateur dynamique calculé indépendamment sur chaque serveur de jeu :
        </p>
        <ul>
            <li>
                <strong>Objets fréquemment brisés :</strong> Le coefficient diminue au fur et à mesure des destructions, pouvant descendre jusqu'à des planchers très bas (10% à 20%).
            </li>
            <li>
                <strong>Objets délaissés ou méconnus :</strong> La destruction des autres objets sur le serveur redistribue progressivement du bonus sur l'ensemble du catalogue. Les recettes oubliées peuvent ainsi atteindre des coefficients élevés (fréquemment observés entre 200% et 800%, avec des relevés communautaires jusqu'à 4000%).
            </li>
        </ul>

        <!-- Schéma Vases communicants -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Fonctionnement dynamique du système de coefficient (Devblog 2.27)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="p-3.5 rounded-lg border border-border">
                    <strong class="text-foreground block mb-1">Destruction massive d'un objet populaire</strong>
                    <p class="text-muted-foreground text-[11px] m-0">
                        Chaque exemplaire brisé fait baisser son propre coefficient. Le rendement unitaire diminue à mesure que le volume augmente.
                    </p>
                </div>
                <div class="p-3.5 rounded-lg border border-border">
                    <strong class="text-foreground block mb-1">Redistribution vers les objets délaissés</strong>
                    <p class="text-muted-foreground text-[11px] m-0">
                        L'activité globale de brisage alimente le bonus des recettes non exploitées. Ce mécanisme n'est pas un minuteur fixe : sans activité sur le serveur, les taux ne montent pas.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-important">
            <strong>Règle de sécurité : Le test sur un exemplaire unique</strong>
            <p>
                Le coefficient d'un objet reste inconnu tant qu'un exemplaire n'a pas été brisé. Ne lancez jamais une série de 20 ou 50 crafts sans avoir <strong>fabriqué et concassé un seul exemplaire test</strong>.
            </p>
            <p class="mt-2 text-xs">
                <strong>Attention au piège du double comptage :</strong> les runes obtenues lors de votre test intègrent <em>déjà</em> le coefficient du serveur. Si vous évaluez les runes réellement reçues, n'appliquez pas une seconde fois le pourcentage affiché dans le chat.
            </p>
        </div>

        <h2>4. L'Option de Focus et la Règle des 50%</h2>
        <p>
            Dans l'interface de concassage, vous pouvez choisir de briser normalement ou de sélectionner un <strong>Focus de Statistique</strong> (par exemple Focus Vitalité, Focus % Résistance Eau, Focus Retrait PA).
        </p>

        <div class="callout callout-important">
            <strong>Formule Officielle du Focus (Devblog Ankama)</strong>
            <p class="font-mono text-sm my-2 p-2 rounded bg-muted/60 border border-border">
                Densité Focus = Densité de la stat ciblée + (Densité de la totalité des autres stats ÷ 2)
            </p>
            <p class="text-xs text-muted-foreground m-0">
                Avec l'option de focus, la totalité du produit du brisage est convertie <strong>exclusivement dans la rune sélectionnée</strong>. La ligne ciblée conserve 100% de sa valeur, tandis que les autres caractéristiques subissent une <strong>perte de 50%</strong> lors de leur conversion.
            </p>
        </div>

        <!-- Schéma conversion focus -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Exemple chiffré de conversion avec focus
            </p>
            <div class="space-y-3 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/20">
                    <div class="flex items-center justify-between font-semibold mb-1">
                        <span class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                            Brisage standard (sans focus)
                        </span>
                        <span class="font-mono text-foreground">Total = 400 unités de densité réparties</span>
                    </div>
                    <p class="text-muted-foreground text-[11px] m-0">
                        Statistique A (100 unités) + Statistique B (180 unités) + Statistique C (120 unités) = Chacune génère ses runes respectives sans perte.
                    </p>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/20">
                    <div class="flex items-center justify-between font-semibold mb-1">
                        <span class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Brisage avec focus sur la Statistique A
                        </span>
                        <span class="font-mono text-foreground">Total = 250 unités de la rune A</span>
                    </div>
                    <p class="text-muted-foreground text-[11px] m-0">
                        100 (Stat A conservée à 100%) + (180 + 120) ÷ 2 (300 unités réduites de moitié = 150) = <strong>250 unités concentrées sur la rune A</strong>. 150 unités de densité ont été détruites par le malus.
                    </p>
                </div>
            </div>
        </div>

        <h3>Quand faut-il activer le focus ?</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 text-xs">
            <div class="p-4 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2 mb-2 font-bold text-foreground">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>Quand activer le focus</span>
                </div>
                <p class="text-muted-foreground text-[11px] leading-relaxed m-0">
                    Lorsque l'équipement comporte une seule caractéristique à très forte valeur marchande (par exemple <strong>% Résistance élémentaire</strong> ou <strong>Retrait PA</strong>) entourée de lignes mineures peu rentables (Initiative, Pods). Le gain sur la rune chère compense largement la division par 2 des lignes secondaires.
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2 mb-2 font-bold text-foreground">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span>Quand ne PAS activer le focus</span>
                </div>
                <p class="text-muted-foreground text-[11px] leading-relaxed m-0">
                    Lorsque l'équipement possède plusieurs lignes majeures équilibrées (par exemple <strong>PA</strong>, <strong>PO</strong>, <strong>Dommages</strong> et <strong>Invocations</strong>). Le brisage sans focus permet de récupérer l'ensemble de ces runes précieuses sans leur faire subir le malus de 50%.
                </p>
            </div>
        </div>

        <h2>5. Modèle de Rentabilité et Seuil d'Équilibre</h2>
        <p>
            Un coefficient élevé ne garantit pas à lui seul un bénéfice. Si un équipement coûte 60 000 kamas à fabriquer et que son panier de runes ne vaut que 10 000 kamas à taux neutre, un coefficient de 400% reste déficitaire.
        </p>

        <div class="p-4 rounded-xl border border-border bg-surface my-4">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Formule du coefficient minimal d'équilibre (c_min)
            </p>
            <p class="font-mono text-sm p-2 rounded bg-muted/60 border border-border my-1">
                c_min = Coût de fabrication ÷ ( Valeur estimée à 100% × (1 - Frais HDV) )
            </p>
            <p class="text-xs text-muted-foreground mt-2 m-0">
                Ce seuil correspond au multiplicateur exact en dessous duquel l'opération engendre une perte financière nette après prise en compte des taxes de vente.
            </p>
        </div>

        <h3>Simulation chiffrée</h3>
        <p>
            Considérons un équipement intermédiaire avec les paramètres suivants :
        </p>
        <table>
            <thead>
                <tr>
                    <th>Indicateur</th>
                    <th>Valeur</th>
                    <th>Rôle dans la décision</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Coût de fabrication</strong></td>
                    <td class="font-mono">
                        <img src="/assets/dofus/game-icons/kamas.png" alt="" class="class-icon inline-block align-middle mr-1" />
                        40 000 kamas
                    </td>
                    <td>Dépense d'achat des ingrédients en HDV.</td>
                </tr>
                <tr>
                    <td><strong>Valeur estimée à 100%</strong></td>
                    <td class="font-mono">
                        <img src="/assets/dofus/game-icons/kamas.png" alt="" class="class-icon inline-block align-middle mr-1" />
                        16 000 kamas
                    </td>
                    <td>Rendement théorique à taux neutre.</td>
                </tr>
                <tr>
                    <td><strong>Taxe de mise en vente HDV</strong></td>
                    <td class="font-mono">2% (0.02)</td>
                    <td>Frais de commercialisation.</td>
                </tr>
                <tr>
                    <td><strong>Seuil d'équilibre (c_min)</strong></td>
                    <td class="font-mono font-semibold">255%</td>
                    <td>Taux minimal requis pour amortir le craft.</td>
                </tr>
            </tbody>
        </table>

        <ul>
            <li><strong>Taux testé à 160% :</strong> Valeur réelle produite d'environ 25 600 kamas. L'opération entraîne une perte de plus de 14 000 kamas par exemplaire. Arrêt immédiat.</li>
            <li><strong>Taux testé à 260% :</strong> Valeur produite d'environ 41 600 kamas. Opération à l'équilibre strict sans marge significative.</li>
            <li><strong>Taux testé à 600% :</strong> Valeur produite d'environ 96 000 kamas. Marge nette supérieure à 50 000 kamas par unité. Feu vert pour une série calibrée.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>Valeur estimée en inventaire vs Kamas réels en banque</strong>
            <p>
                Une estimation de stock en inventaire n'est pas une recette encaissée. Tenez compte de la <strong>vitesse de vente des runes</strong> en HDV (les runes de niche mettent plusieurs jours à partir), des <strong>taxes récurrentes</strong> en cas d'ajustement des prix, et du <strong>capital immobilisé</strong>.
            </p>
        </div>

        <h2>6. La Méthode de Production Sécurisée en 5 Étapes</h2>
        <p>
            Pour structurer vos sessions de brisage de manière méthodique :
        </p>
        <ol class="steps">
            <li>
                <strong>Sourcing et calcul préalable du seuil :</strong> Repérez les recettes entre les niveaux 60 et 150 dont les ressources sont disponibles en quantité à prix raisonnable. Calculez le seuil <code>c_min</code> avant d'acheter la moindre ressource.
            </li>
            <li>
                <strong>Craft test d'un seul exemplaire :</strong> Fabriquez un seul exemplaire sans défaut majeur de jet. Concassez-le immédiatement (avec ou sans focus selon votre calcul). Le canal information affiche le coefficient réel du serveur.
            </li>
            <li>
                <strong>Valorisation directe des runes obtenues :</strong> Évaluez le panier de runes généré aux prix actuels du marché. Soustrayez le coût de fabrication pour confirmer la rentabilité unitaire effective.
            </li>
            <li>
                <strong>Lancement d'une série calibrée (5 à 15 exemplaires) :</strong> Ne lancez pas de volumes excessifs. Chaque objet brisé fait baisser le coefficient. Une série courte permet de sécuriser la marge avant que le taux ne franchisse le seuil d'équilibre.
            </li>
            <li>
                <strong>Vente fractionnée et arbitrage de fusion :</strong> Mettez vos runes en vente par lots de 10 et 100 en étalant les dépôts pour préserver les cours du marché.
            </li>
        </ol>

        <h2>7. La Fusion des Runes au Concasseur (3 pour 1)</h2>
        <p>
            L'atelier de forgemagie permet de fusionner les runes de base dans l'interface du concasseur :
        </p>
        <pre><code>3 Runes Simples ➔ 1 Rune Pa (ex: 3 Ine = 1 Pa Ine)
3 Runes Pa ➔ 1 Rune Ra (ex: 3 Pa Ine = 1 Ra Ine, soit 9 Ine simples)</code></pre>

        <div class="callout callout-warning">
            <strong>Arbitrage de prix : ne fusionnez pas automatiquement</strong>
            <p>
                La fusion n'est rentable que si le <strong>prix unitaire de la rune de rang supérieur dépasse 3 fois le prix unitaire de la rune inférieure</strong> (après prise en compte des taxes de vente).
            </p>
            <p class="mt-2 text-xs">
                <em>Exemple :</em> Si la rune Force se vend 140 kamas et la Pa Force 360 kamas, fusionner 3 runes Force (qui valent 420 kamas séparément) représente une <strong>perte sèche de 60 kamas</strong> par opération. Vendez vos runes simples en lots sans les fusionner.
            </p>
        </div>

        <h2>8. Questions Fréquentes</h2>

        <h3>Puis-je obtenir une rune Ga PA sur un équipement sans PA ?</h3>
        <p>
            Non. Le concasseur calcule les runes exclusivement sur les caractéristiques effectivement présentes sur l'objet au moment de sa destruction. Une statistique absente a une valeur de zéro et ne peut générer aucune rune, quel que soit le coefficient.
        </p>

        <h3>Pourquoi le coefficient a-t-il baissé entre mon test et ma série ?</h3>
        <p>
            C'est le fonctionnement normal du jeu : chaque objet détruit applique un malus sur son propre multiplicateur pour réguler l'économie. C'est pourquoi il est recommandé de limiter les séries à des lots de 5 à 15 exemplaires et de recalibrer vos calculs après chaque lot.
        </p>

        <h3>Les calculateurs de brisage en ligne sont-ils exacts à 100% ?</h3>
        <p>
            Ce sont des modèles prédictifs communautaires très utiles, mais Ankama ne publie pas les formules internes exactes ni les paramètres d'arrondi du moteur de jeu. Utilisez-les comme des outils d'aide à la décision, mais fiez-vous toujours au résultat mesuré lors de votre craft test d'un exemplaire.
        </p>
    `,
};
