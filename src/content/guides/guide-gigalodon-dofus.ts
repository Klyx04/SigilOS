export const guide = {
    slug: "raid-gigalodon-dofus-guide",
    title: "Guide du Raid : Gouffre du Gigalodon (Dofus 3)",
    description:
        "Guide tactique complet du Gouffre du Gigalodon : checklist de préparation, gestion de la lumière, strats des 3 boss, boucle de raccourci à 20% de drop, énigmes et burst du Gigalodon.",
    publishedAt: "2026-09-20",
    // Vraie date d'écriture (dernier commit du fichier, 27/09) : le `2026-10-02` d'origine était
    // la date de sortie du raid — un `lastmod` **futur** publié dans le sitemap et affiché
    // « mis à jour le 2 octobre » en ligne, mesuré le 29/09/2026.
    updatedAt: "2026-09-27",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Raid de Guilde — Niveau 200 (8 à 12 Joueurs)</strong>
            <p>Le Gouffre du Gigalodon est une instance chronométrée de 60 minutes pour déclencher le combat final. Ce guide condensé rassemble les meilleures stratégies de guilde : réglages clients indispensables, gestion économique de la lumière, élimination des 3 boss intermédiaires, boucle de raccourci à 20% de drop et maximisation du burst sur le Gigalodon pour saturer la frise de 60 000 points.</p>
        </div>

        <h2>I. Préparation & Configuration (Checklist Pré-Raid)</h2>
        <p>
            L'ouverture de l'instance s'effectue directement depuis le <strong>Hall de Guilde</strong> (Boutique de Guilde &gt; onglet Raids) par un membre détenant les permissions requises.
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
                    <td>Le chrono ne sert qu'à déclencher le Gigalodon. Une fois engagé, le combat final peut durer au-delà.</td>
                </tr>
                <tr>
                    <td><strong>Échanges en raid</strong></td>
                    <td>Strictement interdits</td>
                    <td>Chaque joueur doit gérer ses propres consommables et ressources de drop.</td>
                </tr>
                <tr>
                    <td><strong>Plafond de score</strong></td>
                    <td>60 000 points pour la frise complète</td>
                    <td>Cumule les ressources déposées au coffre et les dégâts infligés au Gigalodon.</td>
                </tr>
            </tbody>
        </table>

        <h3>Checklist de démarrage (Les 5 réflexes obligatoires)</h3>
        <ul>
            <li><strong>Entités au premier plan :</strong> Activez l'option en jeu <em>Afficher les entités au premier plan</em> dans vos paramètres d'affichage. Sans cela, cibler Willorque derrière les 10 lanternes à l'étage -6 devient un calvaire.</li>
            <li><strong>Automatisations client :</strong> Activez l'auto-suivi de groupe, l'auto-join des combats et l'auto-prêt pour économiser de précieuses minutes sur le chrono global.</li>
            <li><strong>Consommables en amont :</strong> Prévoyez vos stocks de pain, potions d'énergie et potions de rappel avant d'entrer. Aucun échange entre joueurs n'est possible dans le Gouffre.</li>
            <li><strong>Répartition en 3 escouades de 4 :</strong> Divisez vos 12 joueurs en 3 groupes autonomes de 4 combattants. Cette configuration est indispensable pour raser en parallèle les 18 packs de l'étage -1 et farmer rapidement l'étage -5.</li>
            <li><strong>Arbitrage des succès :</strong> Validez les challenges classiques sur les monstres et les boss. En revanche, <em>ignorez le succès « Sel » (100 sels en stock)</em> lors d'un run de score, car stocker 100 sels plonge le raid dans le noir complet et transforme les monstres en sacs à PV mortels.</li>
        </ul>

        <hr />

        <h2>II. Le Mécanisme de Lumière & Malus « Idées Noires »</h2>
        <p>
            Chaque étage possède un niveau de luminosité oscillant entre <strong>Intensité 4</strong> (pleine clarté) et <strong>Intensité 0</strong> (ténèbres totales). Toutes les <strong>2 minutes</strong>, l'étage perd un cran d'intensité (il faut donc 8 minutes pour plonger un étage dans le noir complet).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/18-luminomachine.jpg" alt="Luminomachine du Gouffre du Gigalodon" class="guide-image" />
            <span class="guide-caption">Luminomachine présente à l'entrée et à la sortie de chaque étage</span>
        </div>

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

        <div class="callout callout-tip">
            <strong>Règle d'or de gestion du Sel</strong>
            <p>Maintenez la lumière au <strong>Niveau 3</strong> sur les étages de nettoyage des monstres : le bonus accordé aux monstres (+20% PV / +100 Puissance) reste négligeable et cela économise vos sels communs. En revanche, montez impérativement à <strong>Niveau 4</strong> juste avant d'engager la Mureine (-2) et l'Exécrabe (-4) afin d'annuler leurs 200% de PV bonus. Notez bien que Willorque (-6) et le Gigalodon ignorent totalement la mécanique d'Idées Noires.</p>
        </div>

        <hr />

        <h2>III. Économie du Score : Dépôt au Coffre & Barème</h2>
        <p>
            Descendre dans le gouffre ne rapporte aucun point passif. Le score du raid provient uniquement des trésors minéraux et des reliques de boss <strong>déposés physiquement dans le Coffre du Raid</strong> à l'Avant-poste (-1).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/04-coffre-du-raid.jpg" alt="Coffre du Raid à l'avant-poste" class="guide-image" />
            <span class="guide-caption">Le coffre de dépôt à l'étage -1 : sécurisez vos ressources avant le boss final</span>
        </div>

        <div class="callout callout-warning">
            <strong>Attention au wipe</strong>
            <p>Si un joueur perd un combat, il est renvoyé à l'entrée et <strong>perd l'intégralité des ressources non déposées</strong> qu'il transportait dans sa sacoche de raid ! Sécurisez toujours vos reliques via les raccourcis.</p>
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

        <hr />

        <h2>IV. Progression Étage par Étage (Stratégie & Macros /travel)</h2>

        <h3>Étage -1 : Avant-poste des explorateurs</h3>
        <p>
            Cet étage compte 5 cartes abritant 18 groupes au total. Répartissez vos 3 escouades de 4 joueurs pour vider l'ensemble des monstres en quelques minutes. Les monstres ne réapparaissent plus une fois vaincus. Récupérez le sel sur les filons et obtenez le <em>Premier fragment de clé de la cage</em> (1% de drop commun sur tous les monstres).
        </p>
        <p>Positions des Luminomachines : [3,2] et [4,3]. Gisements de sel : [3,2], [2,2], [4,2], [3,3]. Sortie vers l'étage -2 :</p>
        <pre><code>/travel 4,3</code></pre>

        <hr />

        <h3>Étage -2 : Plateau de la Mureine (Boss 1)</h3>
        <p>
            Rejoignez directement le boss au centre de la zone. Avant d'engager, remontez impérativement la lumière au <strong>Niveau 4</strong> via la Luminomachine pour retirer ses 200% de vitalité et 1 000 de puissance.
        </p>
        <pre><code>/travel 4,7</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/46-boss-mureine.jpg" alt="Boss Mureine" class="guide-image" />
            <span class="guide-caption">La Mureine et ses invocations de Murares</span>
        </div>

        <ul>
            <li><strong>Fiche technique du Boss :</strong> 51 000 PV, 6 PM, 264 Esquive PM (accompagnée de 3 monstres : Madrépire, Kokayou, Léviatank).</li>
            <li><strong>Sort clé « Disperssssion » :</strong> Inflige 700 dégâts eau et invoque jusqu'à 2 <em>Murares</em> au contact des joueurs situés à moins de 10 PO (maximum 10 Murares sur le terrain).</li>
            <li><strong>Passif « Impératrice » :</strong> La Mureine gagne +100 Puissance par Murare présente sur la carte.</li>
            <li><strong>Poison « Corroside » :</strong> Les Murares appliquent un poison cumulatif infligeant 250 dégâts feu supplémentaires pour chaque ligne de dégâts subie par la cible.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>Deux stratégies de neutralisation de la Mureine</strong>
            <p><strong>Stratégie A (Tacle en coin) :</strong> Le Pandawa isole la Mureine dans un angle et la coince entre 2 de ses propres Murares. En taclant ces deux invocations avec un personnage résistant, la Mureine est totalement paralysée et ne peut plus invoquer.<br /><strong>Stratégie B (Distance de sécurité) :</strong> Placez tous vos attaquants à plus de 10 PO de la Mureine au lancement du combat. Sans cible dans sa portée d'incantation de 10 PO, elle ne peut invoquer aucune Murare.</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/58-placement-blocage-mureine.jpg" alt="Placement blocage de la Mureine" class="guide-image" />
            <span class="guide-caption">Technique de blocage en coin de la Mureine derrière ses invocations</span>
        </div>

        <p>À sa mort, la Mureine confère automatiquement le <em>Deuxième fragment de clé</em> et l'<em>Unité de Mureine</em> (1 000 pts). Empruntez la sortie vers l'étage -3 :</p>
        <pre><code>/travel 2,7</code></pre>

        <hr />

        <h3>Étage -3 : Falaise Noyée & Énigme du Luminarium</h3>
        <p>
            Rejoignez la grotte du Luminarium. C'est une safe-zone sans aucun monstre : <strong>ne dépensez aucun sel ici</strong> afin d'économiser vos réserves.
        </p>
        <pre><code>/travel 4,12</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/62-mur-luminarium.jpg" alt="Le mur du Luminarium" class="guide-image" />
            <span class="guide-caption">Grille 4x4 des poissons-lanternes du Luminarium</span>
        </div>

        <div class="callout callout-warning">
            <strong>Règle d'or de guilde : 1 seul joueur sur le puzzle</strong>
            <p>Désignez <strong>un seul joueur</strong> pour manipuler la grille 4x4. Si plusieurs équipiers cliquent en simultané, les actions s'annulent et vous perdrez plusieurs minutes sur le chrono global.</p>
        </div>

        <p><strong>Méthode de résolution rapide (Chasse des lumières) :</strong></p>
        <ol>
            <li>Partez de la rangée 1 (haut) : pour chaque lanterne éteinte, cliquez sur le poisson situé directement en dessous (rangée 2).</li>
            <li>Répétez sur la rangée 2 en cliquant sur la rangée 3 pour allumer les lampes éteintes du dessus.</li>
            <li>Répétez sur la rangée 3 vers la rangée 4.</li>
            <li>Traitez les deux coins inférieurs pour finaliser l'allumage complet et ouvrir le passage vers l'étage -4.</li>
        </ol>

        <hr />

        <h3>Étage -4 : Terrier d'Exécrabe (Boss 2 & Puzzle Mémoriel)</h3>
        <p>
            Rejoignez l'antre de l'Exécrabe en [9,11]. Remontez la lumière au Niveau 4 avant d'engager le combat. L'équipe peut équiper du stuff retrait PM pour faciliter la temporisation.
        </p>
        <pre><code>/travel 9,11</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/71-boss-execrabe.jpg" alt="Boss Exécrabe" class="guide-image" />
            <span class="guide-caption">L'Exécrabe change d'élément et de morphologie à chaque seuil de PV</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Numéro</th>
                    <th>Forme Élémentaire</th>
                    <th>Élément de frappe</th>
                    <th>Symbole au sol</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>1</strong></td>
                    <td>Coquillage</td>
                    <td>Terre</td>
                    <td>Cercle</td>
                </tr>
                <tr>
                    <td><strong>2</strong></td>
                    <td>Oursin</td>
                    <td>Air</td>
                    <td>Étoile</td>
                </tr>
                <tr>
                    <td><strong>3</strong></td>
                    <td>Perle</td>
                    <td>Feu</td>
                    <td>Carré</td>
                </tr>
                <tr>
                    <td><strong>4</strong></td>
                    <td>Poulpe</td>
                    <td>Eau</td>
                    <td>Cône</td>
                </tr>
            </tbody>
        </table>

        <ul>
            <li><strong>Priorité de combat :</strong> Éliminez d'abord tous les monstres d'accompagnement, puis concentrez vos dégâts sur l'Exécrabe.</li>
            <li><strong>Mémorisation de l'ordre :</strong> Notez scrupuleusement l'ordre d'apparition des 4 formes pendant le combat (les statues autour de la carte s'illuminent en bleu à chaque transition de phase).</li>
            <li><strong>Résolution sous le lac :</strong> Après la victoire, cliquez sur le petit plan d'eau pour entrer dans la salle des statues. Le joueur désigné active les 4 statues dans l'ordre exact observé. <em>Chaque erreur inflige une pénalité sévère de -1 000 points de score au raid !</em></li>
            <li><strong>Drops obtenus :</strong> Le <em>Troisième fragment de clé</em> (partagé) et la <em>Pince d'Exécrabe</em> (obtenue par un membre de l'équipe).</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" alt="Statues de l'énigme d'Exécrabe" class="guide-image" />
            <span class="guide-caption">Les statues à activer dans l'ordre des seuils de PV rencontrés</span>
        </div>

        <p>Le joueur ayant obtenu la Pince d'Exécrabe active immédiatement le poisson-lanterne en [6,10] pour ouvrir le raccourci majeur vers l'étage -2 :</p>
        <pre><code>/travel 6,10</code></pre>

        <hr />

        <div class="callout callout-important">
            <strong>LE PIVOT STRATÉGIQUE DU RAID : La Boucle du Raccourci (Drop 20%)</strong>
            <p><strong>Ne descendez surtout pas directement à l'étage -5 !</strong> Le taux de drop du 4e fragment sur les Krak'Haine dépend directement de votre score déjà déposé au coffre : 1% sous 5 000 pts, 5% entre 5 000 et 7 000 pts, 10% entre 7 000 et 10 000 pts, et <strong>20% au-delà de 10 000 points</strong> !<br />En remontant déposer maintenant les reliques de Mureine (1 000 pts), d'Exécrabe (5 000 pts) et vos minerais (plus de 4 000 pts récoltés), vous franchissez instantanément le cap des 10 000 points. Le 4e fragment tombe alors en 1 ou 2 combats au lieu d'y passer 25 minutes !</p>
        </div>

        <h3>La Séquence de Remontée & Dépôt Express</h3>
        <ol>
            <li>Depuis [6,10], empruntez le poisson-lanterne pour réapparaître à l'étage -2 en [4,8].</li>
            <li>Exécutez <pre><code>/travel 2,7</code></pre> puis <pre><code>/travel 3,2</code></pre></li>
            <li>Montez à l'échelle pour regagner l'Avant-poste (-1).</li>
            <li><strong>Déposez l'intégralité de vos trésors dans le Coffre du Raid</strong> pour sécuriser plus de 10 000 points.</li>
            <li>Redescendez l'échelle, puis faites <pre><code>/travel 4,3</code></pre> suivi de <pre><code>/travel 4,8</code></pre></li>
            <li>Empruntez la grotte en bas à droite pour revenir instantanément à l'étage -4.</li>
            <li>Faites <pre><code>/travel 9,11</code></pre>, cliquez sur le petit lac, puis prenez la grotte en bas à droite pour basculer à l'étage -5.</li>
        </ol>

        <hr />

        <h3>Étage -5 : Ossuaire Abyssal (Collecte du Fragment 4)</h3>
        <p>
            Grâce à votre dépôt intermédiaire à plus de 10 000 points, le taux de drop du 4e fragment sur les <em>Krak'Haine</em> est désormais de <strong>20%</strong>. Le drop est partagé pour toute la guilde : dès qu'un combat le valide, tout le raid obtient le fragment !
        </p>
        <pre><code>/travel 10,14</code></pre>

        <div class="callout callout-danger">
            <strong>Piège d'environnement sur la map [12,13]</strong>
            <p>Sur la carte [12,13], la transition vers la partie inférieure requiert de cliquer sur un os d'animal marin. Ce clic <strong>désactive brutalement l'auto-suivi et l'autopilotage</strong> de tous les suiveurs ! Prévenez vos équipiers de reprendre les commandes manuelles sur cette carte.</p>
        </div>

        <p>Une fois les 4 fragments réunis, empruntez la cage de plongée en [10,14] pour descendre au dernier sous-sol.</p>

        <hr />

        <h3>Étage -6 : Sombrefond de Willorque (Boss 3)</h3>
        <p>
            Rejoignez la salle de Willorque en [11,16]. <strong>Attention : cet étage est plongé dans une obscurité totale de Niveau 0. Willorque agresse automatiquement à 10 PO en 5 secondes !</strong> Entrez tous groupés et soyez prêts instantanément.
        </p>
        <pre><code>/travel 11,16</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/103-boss-willorque.jpg" alt="Boss Willorque" class="guide-image" />
            <span class="guide-caption">Willorque dans l'obscurité totale du sombrefond</span>
        </div>

        <ul>
            <li><strong>Fiche technique :</strong> 62 000 PV, Enraciné (indéplaçable par les sorts classiques, mais portable par un Pandawa !), insensible aux Idées Noires.</li>
            <li><strong>Mécanique des lanternes :</strong> 10 poissons-lanternes entourent le boss et déclenchent des malus de PM, d'invisibilité et des hausses de dégâts sur son sort <em>Sombre Chant</em>.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>La Stratégie Pro « Panda Cheese » (Ignorez les 10 lanternes)</strong>
            <p>Ne perdez pas une seule seconde à allumer ou éteindre les lanternes ! Dès le Tour 1, le Pandawa porte Willorque et le jette dans un coin isolé de la carte, <strong>à plus de 3 PO de toute lanterne</strong>. Le Pandawa et un second combattant résistant le bloquent au contact. Le reste du raid se recule pour encaisser un Sombre Chant modéré et concentre 100% de ses sorts pour tomber ses 62 000 PV. Vous encaissez ainsi la <em>Noirceur de Willorque</em> (+10 000 points directs) !</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" alt="Blocage de Willorque par un Pandawa" class="guide-image" />
            <span class="guide-caption">Willorque isolé dans un angle par un Pandawa et un cogneur résistant</span>
        </div>

        <p>Après la victoire, remontez vers l'Avant-poste via le raccourci et <strong>déposez la relique de Willorque (10 000 pts) et tous vos minerais au coffre</strong>. Vous êtes prêts pour le combat final !</p>

        <hr />

        <h2>V. Le Boss Final : Le Gigalodon (Burst 3 Tours)</h2>
        <p>
            Le combat s'engage en parlant au Coffre du Raid à l'Avant-poste (-1). Le combat dure <strong>exactement 3 tours de jeu</strong>. Au début du Tour 4, le sort automatique <em>« Gigalodoom »</em> valide instantanément la victoire de votre équipe. L'objectif n'est pas de tuer le boss mais de <strong>lui infliger le maximum absolu de dégâts</strong> pour engranger jusqu'à +15 000 points de bonus !
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/118-boss-gigalodon.jpg" alt="Combat contre le Gigalodon" class="guide-image" />
            <span class="guide-caption">Le Gigalodon émergeant des profondeurs (hitbox large)</span>
        </div>

        <h3>Les 3 Règles de Survie Absolues</h3>
        <ul>
            <li><strong>Zone mortelle « Les Dents de l'Amer » :</strong> Ne commencez JAMAIS votre tour sur les 3 cases en mêlée directe devant la gueule du Gigalodon. Si vous y terminez un tour, il vous avale (tour passé) et pose un glyphe noir. Si un allié marche dessus, le personnage avalé meurt sur le coup !</li>
            <li><strong>Diagonales obligatoires :</strong> Positionnez vos personnages en diagonale du monstre pour esquiver les cônes d'eau latéraux (<em>Ultrasplash</em>) et éloignez-vous des berges pour ne pas être repoussé de 7 cases par <em>Tournageoire</em>.</li>
            <li><strong>Dispersion de 3 cases minimum :</strong> Le Gigalodon lance <em>Gigarâle</em> : 700 dégâts terre à toute cible située à 2 PO ou moins d'un allié ou d'une invocation, avec propagation en chaîne. Respectez scrupuleusement 3 cases de distance entre chaque joueur.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" alt="Zones de propagation de Gigarâle" class="guide-image" />
            <span class="guide-caption">Dispersion obligatoire : respectez 3 cases d'écart minimum entre alliés pour neutraliser Gigarâle</span>
        </div>

        <h3>Barème de Conversion Dégâts &gt; Score Bonus</h3>
        <table>
            <thead>
                <tr>
                    <th>Dégâts cumulés (3 tours)</th>
                    <th>Points Bonus accordés</th>
                    <th>Profil d'équipe recommandé</th>
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
                    <td>Bonne coordination de boosts (PA / Puissance)</td>
                </tr>
                <tr>
                    <td>500 000 dégâts</td>
                    <td>+12 000 points</td>
                    <td>Compo optimisée (Portails Eliotrope + Vulnérabilité)</td>
                </tr>
                <tr>
                    <td><strong>1 000 000 dégâts</strong></td>
                    <td><strong>+15 000 points (Cap Max)</strong></td>
                    <td>Burst parfait (Iop, Pandawa, Roublard/Cra, Nébuleux T1/T3, Vulbis)</td>
                </tr>
            </tbody>
        </table>

        <hr />

        <h2>VI. Récompenses & Frise Hebdomadaire</h2>
        <p>
            Chaque semaine, votre meilleur score enregistré débloque les paliers sur la frise de guilde (les paliers vont de 1 000 à 60 000 points) :
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/133-frise-recompenses.jpg" alt="Frise des récompenses du raid Gigalodon" class="guide-image" />
            <span class="guide-caption">Frise de récompenses hebdomadaire (Paliers de 1 000 à 60 000 pts)</span>
        </div>

        <ul>
            <li><strong>Paliers 1 à 5 (1 000 à 13 000 pts) :</strong> Guildatons, XP de guilde et <em>Coffres du Gouffre</em> (contient des ressources abyssales et 1% de drop du familier <strong>Minilodon</strong>).</li>
            <li><strong>Paliers 6 à 10 (19 000 à 60 000 pts) :</strong> <em>Coffres Majestueux du Gouffre</em>, ressources rares de boss, 1% Minilodon, et 0,5% de drop direct des pièces de la <strong>Panoplie du Gouffre</strong> (Dorsale de Willorque, Lancepince d'Exécrabe, Visage de Mureine).</li>
            <li><strong>Classement de Guilde (Mardi 6h) :</strong> Ornements Or, Argent et Bronze exclusifs pour les membres du Top 3 interserveur.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/136-panoplie-du-gouffre.png" alt="Panoplie du Gouffre" class="guide-image" />
            <span class="guide-caption">Équipements exclusifs de la Panoplie du Gouffre obtenus dans les coffres</span>
        </div>

        <hr />

        <h2>VII. Carte Interactive & Outils SigilOS</h2>
        <div class="callout callout-info">
            <strong>Monde 37 intégré à la Worldmap SigilOS</strong>
            <p>Retrouvez l'intégralité du Gouffre du Gigalodon sur notre <a href="/dashboard">Carte Interactive Dofus HD</a> en sélectionnant le monde <em>Gouffre du Gigalodon</em> (Monde 37). Tous les boss, le raccourci de la pince, l'énigme du Luminarium et les commandes /travel y sont intégrés en accès direct !</p>
        </div>

        <p>
            Pour compléter votre entraînement, consultez notre <a href="/guides/raid-sanctuaire-jardins-eternels-dofus-guide">Guide du Sanctuaire des Jardins Éternels</a> et profitez des calendriers d'événements automatisés de SigilOS.
        </p>
`,
};
