export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Guide du Brisage et Rentabilité des Runes sur Dofus (2026)",
    description:
        "Formule mathématique du focus, coefficients secrets de 1% à 4000%, paliers de niveau et méthode pas-à-pas pour rentabiliser vos sessions de concassage sur Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Moteur Économique Majeur</strong>
            <p>Le concasseur présent dans les ateliers de forgemagie est la <strong>source quasi-exclusive de création de runes</strong> dans l'écosystème Dofus. Une maîtrise rigoureuse de la formule de focus et des coefficients permet de générer des marges nettes de 200% à 500% avec un investissement de départ modeste.</p>
        </div>

        <p>
            Sur Dofus, détruire des équipements pour en extraire des runes est une véritable science. Beaucoup de joueurs concassent au hasard et perdent des kamas, alors qu'une lecture méthodique des prix en Hôtel des Ventes combinée aux <strong>règles mathématiques de brisage</strong> permet de dénicher des filons inépuisables.
        </p>

        <h2>1. Comment le Jeu Calcule le Volume de Runes Généré ?</h2>
        <p>
            Lorsque vous placez un équipement dans le concasseur, la quantité de runes produites découle de <strong>quatre facteurs déterminants</strong> :
        </p>
        <ol class="steps">
            <li><strong>Le niveau de l'objet :</strong> Plus le niveau de l'équipement est élevé, plus le multiplicateur de volume de runes est puissant (courbe exponentielle).</li>
            <li><strong>La qualité du jet de l'objet :</strong> Les runes sont calculées à partir des statistiques réelles de l'item au moment où il entre dans le concasseur. Un équipement aux caractéristiques parfaites ou over génère significativement plus de runes qu'un jet détruit !</li>
            <li><strong>Le poids unitaire (PWR) de la caractéristique :</strong> Les caractéristiques lourdes (PA, PM, PO) génèrent des runes rares en faible volume, tandis que les caractéristiques légères (Vitalité, Initiative) produisent des centaines de runes.</li>
            <li><strong>Le coefficient de brisage du serveur :</strong> Le multiplicateur dynamique secret appliqué à l'objet, fluctuant entre <strong>1% et 4000%</strong>.</li>
        </ol>

        <h2>2. Le Coefficient Secret : L'Échelle de 1% à 4000%</h2>
        <p>
            Chaque équipement du jeu possède sur votre serveur un <strong>taux de brisage secret</strong> qui évolue en temps réel selon la loi de l'offre et de la demande :
        </p>
        <ul>
            <li><strong>Plus un objet est massivement brisé par les joueurs :</strong> Plus son coefficient s'effondre pour converger vers un seuil plancher (pouvant descendre jusqu'à 1% ou 20%).</li>
            <li><strong>Plus un objet est ignoré ou oublié :</strong> Plus son coefficient monte avec le temps. Sur les recettes méconnues ou complexes, il n'est pas rare de voir des taux exploser à <strong>300%, 800% voire jusqu'au plafond maximal de 4000%</strong> !</li>
        </ul>

        <div class="callout callout-warning">
            <strong>Règle d'or absolue : Le Craft Test d'1 Exemplaire</strong>
            <p>Ne lancez <strong>JAMAIS</strong> une production de 50 ou 100 équipements sans avoir d'abord <strong>fabriqué et brisé 1 seul exemplaire</strong>. Le canal information affichera immédiatement le pourcentage exact du serveur. Si le taux est à 40%, vous évitez une catastrophe industrielle ; s'il est à 650%, vous pouvez lancer la série en toute confiance !</p>
        </div>

        <h2>3. L'Option de Focus : Formule Mathématique &amp; Arbitrage</h2>
        <p>
            Dans l'interface de concassage, vous avez le choix entre briser sans focus ou activer un <strong>Focus de Statistique</strong> (ex: Focus % Résistance Feu, Focus Force, Focus Retrait PM).
        </p>

        <div class="callout callout-important">
            <strong>La Formule Officielle de Densité de Brisage avec Focus</strong>
            <p class="font-mono text-cyan-300 my-2">
                Densité du brisage focus = Densité de la stat ciblée + (Densité de la totalité des autres stats / 2)
            </p>
            <p>En activant le focus, l'intégralité du produit du brisage est convertie <strong>exclusivement dans la rune sélectionnée</strong>, mais les autres statistiques de l'item ne participent qu'à <strong>50%</strong> de leur valeur.</p>
        </div>

        <h3>La Règle de Décision Infaillible pour Activer le Focus</h3>
        <p>
            Faut-il cocher le focus ou laisser le brisage standard ? La réponse est purement mathématique :
        </p>
        <p class="bg-zinc-900/60 p-4 rounded-lg border border-zinc-800 font-semibold text-emerald-400">
            Activez le focus si le ratio [Prix / Densité] de la rune ciblée est au moins 2 fois supérieur au ratio moyen [Prix / Densité] de l'ensemble des autres statistiques de l'objet.
        </p>
        <ul>
            <li><strong>Quand NE PAS faire de focus :</strong> Lorsque l'équipement possède plusieurs lignes très nobles et équilibrées (ex: un item qui donne PA + PO + 3% Ré + 15 Do). Le brisage sans focus produit toutes ces runes précieuses sans leur faire subir la division par 2 !</li>
            <li><strong>Quand FAIRE un focus :</strong> Lorsque l'item ne possède qu'une seule statistique de très haute valeur (ex: +4% Résistance Eau à 100 000k/u les runes) entourée de statistiques à faible valeur marchande (quelques points d'initiative ou de stats de base). Le focus concentre toute la valeur du craft sur la rune d'or.</li>
        </ul>

        <h2>4. Rentabilité par Tranche de Niveau d'Objets</h2>
        <p>
            Tous les niveaux d'objets n'ont pas la même vocation économique :
        </p>

        <div class="overflow-x-auto my-6">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-zinc-700 bg-zinc-900/80 text-sm">
                        <th class="p-3">Tranche de Niveau</th>
                        <th class="p-3">Types de Runes Générées</th>
                        <th class="p-3">Comportement du Taux</th>
                        <th class="p-3">Stratégie Recommandée</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800 text-sm">
                    <tr>
                        <td class="p-3 font-semibold text-zinc-300">Niveau 1 à 60</td>
                        <td class="p-3">Runes simples uniquement (Vi, Fo, Ini...)</td>
                        <td class="p-3">Souvent très bas (10% à 60%) en raison du craft massif pour monter les métiers de base.</td>
                        <td class="p-3 text-zinc-400">À réserver pour valider les succès ou recycler les résidus de montée de métier. Rentabilité rare.</td>
                    </tr>
                    <tr class="bg-emerald-950/20">
                        <td class="p-3 font-bold text-emerald-300">Niveau 61 à 150 <span class="text-xs bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">La Zone d'Or</span></td>
                        <td class="p-3">Runes simples, Runes Pa et premières Runes Ra</td>
                        <td class="p-3 font-semibold text-emerald-400">Taux cachés exceptionnels (200% à 1200% sur des centaines d'items oubliés).</td>
                        <td class="p-3 text-zinc-300"><strong>Le cœur du bénéfice !</strong> Recettes peu chères, ressources de monstres et donjons abondantes. Multiplicateur de kamas colossal.</td>
                    </tr>
                    <tr class="bg-amber-950/20">
                        <td class="p-3 font-bold text-amber-300">Niveau 151 à 200</td>
                        <td class="p-3">Runes Pa et Ra garanties, Ga PA, Ga PM, % Ré</td>
                        <td class="p-3 font-semibold text-amber-400">Taux stables (50% à 250%), rarement au-dessus de 400%.</td>
                        <td class="p-3 text-zinc-300">Production de masse de runes lourdes très liquides. Exige un capital de départ plus élevé pour financer les galets et essences.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>5. La Fusion des Runes au Concasseur (3 pour 1)</h2>
        <p>
            Dans les ateliers de forgemagie, le concasseur propose également une fonctionnalité indispensable : la <strong>fusion de runes</strong>.
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-yellow-400 border border-zinc-800">
            3 Runes Simples ➔ 1 Rune Pa (ex: 3 Ine = 1 Pa Ine)<br />
            3 Runes Pa ➔ 1 Rune Ra (ex: 3 Pa Ine = 1 Ra Ine, soit 9 Ine simples)
        </p>
        <p>
            <strong>Pourquoi fusionner vos runes ?</strong>
        </p>
        <ul>
            <li><strong>Alléger le poids de l'inventaire :</strong> Les milliers de runes simples accumulées pèsent lourd sur les pods de votre personnage.</li>
            <li><strong>Augmenter vos marges de vente en HDV :</strong> Les forgemages de haut niveau achètent quasi-exclusivement des lots de runes Pa et Ra. Les runes Ra se vendent souvent plus cher par lot de 100 que l'équivalent de 900 runes de base !</li>
        </ul>

        <h2>6. La Méthode Complète en 5 Étapes pour des Sessions Toujours Rentables</h2>
        <ol class="steps">
            <li><strong>Sourcing des recettes peu coûteuses :</strong> Scrutez les prix des ressources en HDV. Repérez les équipements de niveau 80 à 140 dont le coût total de fabrication est inférieur à 30 000 ou 50 000 kamas.</li>
            <li><strong>Le Craft Test (1 exemplaire) :</strong> Fabriquez un seul exemplaire et concassez-le immédiatement. Notez le pourcentage affiché dans le canal discussion.</li>
            <li><strong>Calcul instantané du retour sur investissement :</strong> Multipliez la valeur estimée du panier de runes par le taux révélé. Si le bénéfice net estimé est supérieur à 150% du coût de craft, le feu est vert.</li>
            <li><strong>Lancement d'une série calibrée (10 à 25 exemplaires) :</strong> Ne craftiez pas 200 exemplaires d'un coup ! Chaque objet brisé fait baisser le taux. Une série de 15 à 25 exemplaires permet de capturer l'essentiel du profit avant que le taux ne s'effondre.</li>
            <li><strong>Vente fractionnée en HDV :</strong> Mettez vos runes en vente par lots de 10 et 100 en étalant les mises en rayon pour ne pas saturer le marché et préserver vos prix de vente.</li>
        </ol>
    `,
};
