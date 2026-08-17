export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Guide du Brisage et Rentabilité des Runes sur Dofus (2026)",
    description:
        "Calcul des coefficients de concassage, focus de caractéristiques et astuces pour rentabiliser vos sessions de brisage d'équipements.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Optimisation Économique</strong>
            <p>Le brisage est le moteur numéro 1 de production de runes sur Dofus. Une bonne maîtrise des coefficients permet de générer des millions de kamas avec un investissement de départ modeste.</p>
        </div>

        <p>
            Le brisage (ou concassage) d'objets auprès du concasseur dans les ateliers de forgemagie est le moyen exclusif de générer des <strong>runes de forgemagie</strong> sur Dofus. Comprendre comment le jeu calcule la quantité de runes produites permet de transformer des crafts anodins en véritables jackpots en kamas.
        </p>

        <h2>1. Comment fonctionne le Coefficient de Brisage ?</h2>
        <p>
            Chaque équipement brisable sur le serveur possède un <strong>coefficient secret</strong> (exprimé en pourcentage, généralement compris entre 20% et plusieurs centaines de %).
        </p>
        <ul>
            <li><strong>Plus un objet est rarement brisé sur le serveur :</strong> Plus son coefficient monte (jusqu'à 500%, 1000%+ sur les items oubliés !).</li>
            <li><strong>Plus un objet est massivement brisé :</strong> Plus son coefficient baisse pour converger vers un seuil minimal.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Règle du Brisage Test</strong>
            <p>Avant de lancer un craft de 50 ou 100 exemplaires d'un objet, <strong>concassez toujours 1 seul exemplaire</strong> pour afficher son coefficient exact dans le canal information !</p>
        </div>

        <h2>2. L'Impact du Niveau de l'Objet</h2>
        <p>
            Le niveau de l'objet détruit agit comme un <strong>multiplicateur géométrique</strong> sur la formule de génération des runes :
        </p>
        <table>
            <thead>
                <tr>
                    <th>Tranche de Niveau</th>
                    <th>Volume de Runes Obtenu</th>
                    <th>Rareté des Runes</th>
                    <th>Recommandation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Niveau 1 à 60</strong></td>
                    <td>Très faible</td>
                    <td>Runes simples uniquement</td>
                    <td>À réserver pour monter les métiers ou débloquer des succès.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 61 à 150</strong></td>
                    <td>Moyen à Élevé</td>
                    <td>Runes simples et Runes Pa</td>
                    <td>Excellente rentabilité si les ressources de craft sont abondantes.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 151 à 200</strong></td>
                    <td>Très Élevé</td>
                    <td>Runes Pa et Runes Ra garanties</td>
                    <td>Le cœur de la rentabilité : génération massive de runes lourdes (Vi, Stats, % Ré).</td>
                </tr>
            </tbody>
        </table>

        <h2>3. L'Option de Focus : Maximiser une Statistique Spécifique</h2>
        <p>
            Dans l'interface de concassage, vous pouvez choisir un <strong>Focus de Statistique</strong> (ex: Focus Vitalité, Focus Retrait PA, Focus % Résistance Eau) :
        </p>
        <p>
            <em>Effet du focus :</em> L'intégralité de la valeur brute du brisage est convertie <strong>uniquement dans la rune ciblée</strong>, au détriment des autres runes de l'objet. C'est l'outil parfait pour générer massivement des runes rares et chères (comme les runes % Résistance ou les runes de stats lourdes).
        </p>

        <div class="callout callout-warning">
            <strong>Quand NE PAS utiliser le focus ?</strong>
            <p>Si l'équipement brisé possède plusieurs statistiques de grande valeur (ex: PA + PO + Invo + % Résistance), le brisage sans focus est souvent plus rentable car il génère l'ensemble de ces runes précieuses sans perte.</p>
        </div>

        <h2>4. Stratégie pour Rentabiliser vos Sessions de Brisage</h2>
        <ol>
            <li><strong>Repérer les recettes peu coûteuses :</strong> Analysez les prix des ressources en hôtel de vente par rapport au niveau de l'item crafté.</li>
            <li><strong>Briser des séries test :</strong> Concassez 1 exemplaire pour révéler le coefficient actuel du serveur avant de fabriquer en grande quantité.</li>
            <li><strong>Utiliser le Focus avec discernement :</strong> N'activez le focus que si le prix de la rune ciblée compense largement la perte des runes annexes.</li>
        </ol>
    `,
};
