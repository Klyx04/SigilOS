export const guide = {
    slug: "raid-gigalodon-dofus-guide",
    title: "Guide du Raid : Gouffre du Gigalodon (Dofus 3)",
    description:
        "Guide complet du raid Gouffre du Gigalodon sur Dofus : mécanique de lumière, boss (Mureine, Exécrabe, Willorque), énigmes, combat du Gigalodon et frise de récompenses.",
    publishedAt: "2026-09-20",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Raid de Guilde — Niveau 200 (8 à 12 Joueurs)</strong>
            <p>Le Gouffre du Gigalodon est une instance sous-marine compétitive et chronométrée (1h max pour déclencher le combat final). Ce guide décortique chaque palier de profondeur, la gestion indispensable de la luminosité, les stratégies d'élimination des 3 boss intermédiaires et l'optimisation maximale de vos dégâts sur le Gigalodon pour saturer la frise de score.</p>
        </div>

        <h2>I. Synthèse & Modalités d'accès</h2>
        <p>
            L'ouverture du Gouffre s'effectue directement depuis le <strong>Hall de Guilde</strong> (Boutique de Guilde &gt; onglet Raids) par un membre détenant les permissions requises.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/02-achat-raid-boutique.png" alt="Lancement du raid Gouffre du Gigalodon depuis la boutique" class="guide-image" />
            <span class="guide-caption">Achat et paramétrage de l'instance dans la boutique de guilde</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Paramètre</th>
                    <th>Valeur / Règle</th>
                    <th>Impact stratégique</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Coût de lancement</strong></td>
                    <td>360 Kamas de Guilde</td>
                    <td>Rentabilisé dès l'atteinte des paliers intermédiaires de guilde.</td>
                </tr>
                <tr>
                    <td><strong>Effectif requis</strong></td>
                    <td>8 à 12 joueurs (Niveau 200)</td>
                    <td>Les combats de boss peuvent se jouer jusqu'à 12 participants en simultané.</td>
                </tr>
                <tr>
                    <td><strong>Temps imparti</strong></td>
                    <td>60 minutes (1 heure)</td>
                    <td>La descente, les énigmes et le dépôt de coffre doivent être faits avant la fin du chrono. Le combat du Gigalodon, une fois engagé, peut durer au-delà.</td>
                </tr>
                <tr>
                    <td><strong>Échanges en raid</strong></td>
                    <td>Strictement interdits</td>
                    <td>Chaque joueur doit gérer ses propres ressources ou drops uniques.</td>
                </tr>
                <tr>
                    <td><strong>Plafond de score</strong></td>
                    <td>60 000 points pour la frise complète</td>
                    <td>Cumule les ressources déposées au coffre + les dégâts infligés au Gigalodon.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. Le Mécanisme Vital : La Lumière & les « Idées Noires »</h2>
        <p>
            Tout au long de votre descente dans les abysses, chaque étage possède un niveau de luminosité oscillant entre <strong>Intensité 4</strong> (pleine clarté) et <strong>Intensité 0</strong> (ténèbres totales).
            Toutes les <strong>2 minutes</strong>, l'étage perd un cran d'intensité (il faut donc 8 minutes pour plonger un étage dans le noir complet).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/18-luminomachine.jpg" alt="Luminomachine du Gouffre du Gigalodon" class="guide-image" />
            <span class="guide-caption">Luminomachine présente à l'entrée et à la sortie de chaque étage</span>
        </div>

        <h3>1. Malus d'obscurité : « Idées Noires »</h3>
        <p>
            À l'exception de Willorque et du Gigalodon, tous les monstres normaux ainsi que la <strong>Mureine</strong> et <strong>l'Exécrabe</strong> reçoivent des buffs massifs indexés sur l'obscurité ambiante au début de leur combat :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Intensité Lumineuse</th>
                    <th>Bonus des Monstres / Boss</th>
                    <th>Comportement hors combat</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Niveau 4</strong></td>
                    <td><strong>Aucun bonus</strong> (État neutre optimal)</td>
                    <td>Monstres passifs.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 3</strong></td>
                    <td>+20% Vitalité, +100 Puissance</td>
                    <td>Monstres passifs.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 2</strong></td>
                    <td>+50% Vitalité, +250 Puissance</td>
                    <td>Monstres passifs.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 1</strong></td>
                    <td>+100% Vitalité, +500 Puissance, +1 PM</td>
                    <td>Monstres passifs.</td>
                </tr>
                <tr>
                    <td><strong>Niveau 0 (Noir complet)</strong></td>
                    <td><strong>+200% Vitalité, +1 000 Puissance, +2 PM</strong></td>
                    <td><strong>Agression automatique</strong> à 10 cases de distance en 5 secondes !</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Alimentation des Luminomachines & Sel des Profondeurs</h3>
        <p>
            Pour remonter la jauge de lumière, déposez du <strong>Sel des profondeurs</strong> dans les <em>Luminomachines</em>. Le sel est une réserve <strong>commune à toute la guilde</strong> (affichée en haut de l'interface) obtenue via :
        </p>
        <ul>
            <li><strong>Le minage libre :</strong> des filons de sel récoltables sont disséminés à chaque étage (repoussent en 5 à 10 min, aucun métier requis).</li>
            <li><strong>Le drop de combat :</strong> chaque groupe éliminé donne une part fixe et égale de sel à tous les combattants.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Succès d'équipe — « Sel »</strong>
            <p>Si la réserve globale de votre guilde atteint simultanément <strong>100 sels</strong> (sans les avoir consommés entre-temps), toute l'équipe débloque le succès spécial <em>Sel</em>.</p>
        </div>

        <h2>III. Économie du Score : Dépôt au Coffre & Barème</h2>
        <p>
            Descendre dans le gouffre ne rapporte aucun point passif. Le score du raid provient uniquement des trésors minéraux et des reliques de boss <strong>déposés physiquement dans le Coffre du Raid</strong> à l'Avant-poste (-1).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/04-coffre-du-raid.jpg" alt="Coffre du Raid à l'avant-poste" class="guide-image" />
            <span class="guide-caption">Le coffre de dépôt à l'étage -1 : sécurisez vos ressources avant le boss final</span>
        </div>

        <div class="callout callout-warning">
            <strong>Attention à la défaite</strong>
            <p>Si un joueur perd un combat, il est renvoyé à l'entrée et <strong>perd l'intégralité des ressources non déposées</strong> qu'il transportait dans sa sacoche de raid !</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Type de Ressource</th>
                    <th>Nature du Drop</th>
                    <th>Valeur en Score</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Quartz / Opale / Amazonite</strong></td>
                    <td>Drop commun sur monstres (étages -1 à -3)</td>
                    <td>2 à 6 pts / unité</td>
                </tr>
                <tr>
                    <td><strong>Aventurine / Lapiz / Jais / Onyx</strong></td>
                    <td>Drop commun sur monstres abyssaux (-4 à -5)</td>
                    <td>10 à 30 pts / unité</td>
                </tr>
                <tr>
                    <td><strong>Unité de Mureine</strong></td>
                    <td>Drop unique à 100% sur le boss Mureine</td>
                    <td><strong>1 000 points</strong></td>
                </tr>
                <tr>
                    <td><strong>Rancune d'Exécrabe</strong></td>
                    <td>Drop unique à 100% sur le boss Exécrabe</td>
                    <td><strong>5 000 points</strong></td>
                </tr>
                <tr>
                    <td><strong>Noirceur de Willorque</strong></td>
                    <td>Drop unique à 100% sur le boss Willorque</td>
                    <td><strong>10 000 points</strong></td>
                </tr>
            </tbody>
        </table>

        <h2>IV. Progression Étage par Étage</h2>

        <h3>Étage -1 : Avant-poste des explorateurs</h3>
        <p>
            Cet étage introductif compte 5 cartes abritant 18 groupes au total. Une fois nettoyés, ils ne réapparaissent plus. C'est ici que l'équipe collecte le premier sel et a 1% de chance d'obtenir le <em>Premier fragment de clé de la cage</em>. L'accès vers l'étage -2 s'ouvre en [4,3].
        </p>

        <hr />

        <h3>Étage -2 : Plateau de la Mureine (Boss 1)</h3>
        <p>
            La Mureine niche au fond du trou central en [4,7]. Avant d'engager, <strong>montez la lumière à l'intensité 4</strong> pour lui retirer ses 200% de vitalité et 1 000 de puissance !
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/46-boss-mureine.jpg" alt="Boss Mureine" class="guide-image" />
            <span class="guide-caption">La Mureine et ses invocations de Murares</span>
        </div>

        <ul>
            <li><strong>Points de Vie :</strong> 51 000 PV (accompagnée de 3 monstres : Madrépire, Kokayou, Léviatank).</li>
            <li><strong>Sort Clé — « Disperssssion » :</strong> 700 dégâts eau, invoque jusqu'à 2 <em>Murares</em> au contact des joueurs (max 10 sur le combat).</li>
            <li><strong>Passif — « Impératrice » :</strong> +100 Puissance pour la Mureine par Murare présente sur le terrain.</li>
            <li><strong>Le Poison « Corroside » :</strong> les Murares appliquent un poison cumulatif infligeant 250 dégâts feu supplémentaires pour chaque ligne de dégâts subie par la cible.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>Stratégie de verrouillage (Tank Pandawa)</strong>
            <p>Isolez et taclez la Mureine dans un angle en coin. En coinçant la Mureine entre 2 de ses propres Murares taclées par un Pandawa ou un Sacrieur résistant, le boss ne peut plus invoquer ni atteindre vos attaquants à distance.</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/58-placement-blocage-mureine.jpg" alt="Placement blocage de la Mureine" class="guide-image" />
            <span class="guide-caption">Technique de blocage en coin de la Mureine derrière ses invocations</span>
        </div>

        <hr />

        <h3>Étage -3 : Falaise Noyée & Énigme du Luminarium</h3>
        <p>
            Aucun combat obligatoire. En [4,12] se dresse le <strong>Luminarium</strong> : un panneau de 16 poissons-lanternes (grille 4x4) dont certains sont allumés et d'autres éteints selon le principe du puzzle <em>Lights Out</em>.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/62-mur-luminarium.jpg" alt="Le mur du Luminarium" class="guide-image" />
            <span class="guide-caption">Grille 4x4 des poissons-lanternes du Luminarium</span>
        </div>

        <p><strong>Méthode de résolution rapide :</strong></p>
        <ol>
            <li>Partez de la rangée 1 (haut) : pour chaque poisson éteint, cliquez sur le poisson situé directement en dessous de lui (rangée 2).</li>
            <li>Répétez l'opération sur la rangée 2 en cliquant sur la rangée 3 pour allumer les lampes éteintes du dessus.</li>
            <li>Répétez pour la rangée 3 vers la rangée 4.</li>
            <li>Traitez les deux coins inférieurs pour finaliser l'allumage complet et déverrouiller la porte vers l'étage -4.</li>
        </ol>

        <hr />

        <h3>Étage -4 : Terrier d'Exécrabe (Boss 2 + Puzzle Mémoriel)</h3>
        <p>
            En [9,11], affrontez l'Exécrabe (accompagné de 5 monstres). Remontez impérativement la lumière à 4 avant de lancer.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/71-boss-execrabe.jpg" alt="Boss Exécrabe" class="guide-image" />
            <span class="guide-caption">L'Exécrabe change d'élément et de morphologie à chaque seuil de PV</span>
        </div>

        <ul>
            <li><strong>Les 4 Formes Élémentaires :</strong> Coquillage (Terre / Cercle), Oursin (Air / Étoile), Perle (Feu / Carré), Poulpe (Eau / Cône).</li>
            <li><strong>Mémorisation de l'ordre :</strong> notez scrupuleusement l'ordre d'apparition des 4 formes pendant le combat (les statues en bord de map clignotent en bleu à chaque transition).</li>
            <li><strong>Résolution de l'énigme post-combat :</strong> descendez sous le trou d'eau et cliquez sur les 4 statues dans l'ordre exact observé. <em>Chaque erreur inflige un malus de -1 000 pts au raid !</em></li>
            <li><strong>Raccourci de la Pince :</strong> le joueur ayant dropé la <em>Pince d'Exécrabe</em> doit activer le poisson-lanterne en [6,10] pour relier l'étage -2 à l'étage -4.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" alt="Statues de l'énigme d'Exécrabe" class="guide-image" />
            <span class="guide-caption">Les statues à activer dans l'ordre des seuils de PV rencontrés</span>
        </div>

        <hr />

        <h3>Étage -5 : Ossuaire Abyssal (Collecte des Fragments)</h3>
        <p>
            Pour ouvrir la cage de plongée vers l'étage -6 en [10,14], le groupe doit réunir <strong>4 fragments de clé</strong> :
        </p>
        <ul>
            <li><strong>Fragment 1 :</strong> Drop commun monstres (étage -1).</li>
            <li><strong>Fragment 2 :</strong> Obtenu automatiquement à la mort de la Mureine.</li>
            <li><strong>Fragment 3 :</strong> Obtenu automatiquement à la mort de l'Exécrabe.</li>
            <li><strong>Fragment 4 :</strong> Drop sur les monstres <em>Krak'Haine</em> à l'étage -5.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Optimisation du Taux de Drop (Score dépendant)</strong>
            <p>Le taux de drop du 4e fragment dépend du score actuel déposé au coffre : 1% sous 5 000 pts, 5% à 7 000 pts, 10% à 10 000 pts et <strong>20% au-delà de 10 000 pts</strong>. Il est donc fortement recommandé de remonter déposer les reliques de Mureine et d'Exécrabe avant de farmer l'étage -5 !</p>
        </div>

        <hr />

        <h3>Étage -6 : Sombrefond de Willorque (Boss 3)</h3>
        <p>
            Willorque (62 000 PV) se terre en [11,16]. C'est un boss enraciné (indéplaçable par les sorts conventionnels, mais portable par un Pandawa) qui ignore la mécanique d'Idées Noires.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/103-boss-willorque.jpg" alt="Boss Willorque" class="guide-image" />
            <span class="guide-caption">Willorque dans l'obscurité totale du sombrefond</span>
        </div>

        <div class="callout callout-tip">
            <strong>Stratégie de contournement (Ignorez le Light Count)</strong>
            <p>Ne perdez pas de temps à allumer/éteindre les 10 poissons-lanternes. Portez Willorque avec un Pandawa et déposez-le dans un coin isolé sans lanterne à moins de 3 PO. Coincez-le avec 2 personnages au contact. Éloignez le reste du raid pour encaisser Sombre Chant et tombez ses 62 000 PV pour empocher <strong>10 000 points</strong> d'un coup !</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" alt="Blocage de Willorque par un Pandawa" class="guide-image" />
            <span class="guide-caption">Willorque isolé dans un angle par un Pandawa et un cogneur résistant</span>
        </div>

        <h2>V. Le Boss Final : Le Gigalodon</h2>
        <p>
            Le combat final se lance via le Coffre du Raid en haut de l'avant-poste (-1). Il dure <strong>exactement 3 tours de jeu</strong>. Au début du Tour 4, le sort automatique <em>« Gigalodoom »</em> valide instantanément la victoire de l'équipe. L'objectif n'est pas de tuer le boss, mais de <strong>lui infliger le maximum absolu de dégâts</strong> pour accumuler des points de score !
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/118-boss-gigalodon.jpg" alt="Combat contre le Gigalodon" class="guide-image" />
            <span class="guide-caption">Le Gigalodon émergeant des profondeurs (hitbox large)</span>
        </div>

        <h3>1. Les Mécaniques du Gigalodon</h3>
        <ul>
            <li><strong>Double Tour d'Action :</strong> Le Gigalodon joue 2 fois par tour (au tout début du tour, puis au milieu de la timeline après le 4e ou 6e joueur).</li>
            <li><strong>Hitbox Multi-cases :</strong> Il occupe une large zone aquatique rouge. N'importe quelle case ciblée transmet les dégâts monocibles.</li>
            <li><strong>Capture « Les Dents de l'Amer » :</strong> Ne commencez JAMAIS votre tour sur les 3 cases de mêlée directe devant sa gueule ! Si vous y êtes, il vous avale (vous passez votre tour) et pose un glyphe noir. Si un allié marche dessus, le joueur avalé meurt sur le coup.</li>
            <li><strong>Gigarâle (Propagation) :</strong> Inflige 700 dégâts terre à toute entité située à 2 PO ou moins d'un allié/invocation. <strong>Écartez-vous d'au moins 3 cases les uns des autres !</strong></li>
            <li><strong>Ultrasplash & Tournageoire :</strong> Restez en diagonale pour éviter les cônes d'eau latéraux (Ultrasplash) et éloignez-vous des berges pour ne pas être repoussé par Tournageoire.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" alt="Zones de propagation de Gigarâle" class="guide-image" />
            <span class="guide-caption">Dispersion obligatoire : respectez 3 cases d'écart minimum entre alliés pour neutraliser Gigarâle</span>
        </div>

        <h3>2. Barème de Conversion Dégâts &gt; Score Bonus</h3>
        <table>
            <thead>
                <tr>
                    <th>Dégâts cumulés (3 tours)</th>
                    <th>Points Bonus accordés</th>
                    <th>Objectif d'équipe recommandé</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>100 000 dégâts</td>
                    <td>+5 000 points</td>
                    <td>Raid découverte / équipement standard</td>
                </tr>
                <tr>
                    <td>250 000 dégâts</td>
                    <td>+9 000 points</td>
                    <td>Bonne coordination de boost</td>
                </tr>
                <tr>
                    <td>500 000 dégâts</td>
                    <td>+12 000 points</td>
                    <td>Compo optimisée (Portails Eliotrope + Vulné)</td>
                </tr>
                <tr>
                    <td><strong>1 000 000 dégâts</strong></td>
                    <td><strong>+15 000 points (Cap Max)</strong></td>
                    <td>Burst parfait (Iop, Pandawa, Roublard/Cra, Nébuleux T1/T3)</td>
                </tr>
            </tbody>
        </table>

        <h2>VI. Récompenses & Frise Hebdomadaire</h2>
        <p>
            Chaque semaine, votre meilleur score enregistré débloque les paliers sur la frise de guilde :
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/133-frise-recompenses.jpg" alt="Frise des récompenses du raid Gigalodon" class="guide-image" />
            <span class="guide-caption">Frise de récompenses hebdomadaire (Paliers de 1 000 à 60 000 pts)</span>
        </div>

        <ul>
            <li><strong>Paliers 1 à 5 (1 000 à 13 000 pts) :</strong> Guildatons, XP de guilde et <em>Coffres du Gouffre</em>.</li>
            <li><strong>Paliers 6 à 10 (19 000 à 60 000 pts) :</strong> <em>Coffres Majestueux du Gouffre</em>, ressources de craft rares, pièces de la <strong>Panoplie du Gouffre</strong> et 1% de drop du familier d'apparat <strong>Minilodon</strong>.</li>
            <li><strong>Classement de Guilde (Mardi 6h) :</strong> Ornements Or/Argent/Bronze exclusifs pour les membres du Top 3 interserveur.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/136-panoplie-du-gouffre.png" alt="Panoplie du Gouffre" class="guide-image" />
            <span class="guide-caption">Équipements exclusifs de la Panoplie du Gouffre obtenus dans les coffres</span>
        </div>

        <div class="callout callout-info">
            <strong>Poursuivre votre entraînement</strong>
            <p>Consultez également notre <a href="/guides/raid-sanctuaire-jardins-eternels-dofus-guide">Guide du Sanctuaire des Jardins Éternels</a> et découvrez les outils de gestion d'événements et de calendrier sur SigilOS.</p>
        </div>
    `,
};
