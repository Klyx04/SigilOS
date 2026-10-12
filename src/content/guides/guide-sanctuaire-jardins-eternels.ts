export const guide = {
    slug: "raid-sanctuaire-jardins-eternels-dofus-guide",
    title: "Guide du Raid : Sanctuaire des Jardins Éternels (Dofus 3)",
    description:
        "Guide complet du raid Sanctuaire des Jardins Éternels sur Dofus : les 4 énigmes interconnectées, les 4 gardiens, le corridor aux 60 monstres, compositions optis et stratégies contre la Reine Écarlate et la Princesse Maudite.",
    publishedAt: "2026-09-22",
    updatedAt: "2026-09-30",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Raid de Guilde Collaboratif — Niveau 200 (8 à 16 Joueurs)</strong>
            <p>Le Sanctuaire des Jardins Éternels est le grand raid coopératif de Dofus 3. Basé sur une mécanique de <strong>Points de Vie d'instance partagés (20 PV)</strong>, il exige une coordination sans faille entre 4 ailes d'énigmes interconnectées, l'élimination de 4 gardiens de zone, un corridor de combat solo et un double affrontement final contre la <strong>Reine Écarlate</strong> et la <strong>Princesse Maudite</strong>.</p>
        </div>

        <div class="callout callout-info">
            <strong>🛠️ Outils Publics Raid Studio 3.6 & Overlay Détachable</strong>
            <p>Pour organiser vos 16 joueurs et réussir les énigmes sans perdre de points de vie d'équipe, SigilOS propose une suite d'outils interactifs 100% gratuits :</p>
            <ul>
                <li><strong>Planificateur d'Escouades 16 Joueurs :</strong> répartissez les rôles (Tank CaC, DPS distance, Healer, Placement), composez vos duos pour les 4 ailes et exportez l'annonce en 1 clic pour Discord.</li>
                <li><strong>Solveurs des 4 Énigmes du Sanctuaire :</strong>
                    <ul>
                        <li>⛵ <em>Solveur Bataille Navale :</em> grilles maritimes jumelles 4x3 en [19,15] et [21,17].</li>
                        <li>♟️ <em>Solveur Échiquier de Belladone :</em> grille 11x11 A1..K11 et calcul des 4 pièces (Tours et Fous).</li>
                        <li>🌸 <em>Suivi des Objets & Fleurs :</em> inventaire des 8 objets sur les stèles I à IV et détection de la couleur clé.</li>
                        <li>🗿 <em>Calculateur Protecteurs & Statues :</em> comparaison Clos vs Éphèdre, détection du monstre central, calcul automatique de la cible et flèche d'orientation.</li>
                    </ul>
                </li>
                <li><strong>Overlay In-Game Toujours au Premier Plan (PiP) :</strong> activez l'overlay via le bouton en haut de page pour copier les positions <code>/travel</code> d'un clic et exécuter les solveurs directement en jeu sans alt-tab.</li>
            </ul>
            <p><a href="/raids?raid=sanctuaire"><strong>→ Ouvrir le Planificateur Sanctuaire & les 4 Solveurs dans Raid Studio 3.6</strong></a></p>
        </div>

        <h2>I. Synthèse & Règles Fondamentales</h2>
        <p>
            L'instance s'achète dans l'onglet Raids de Guilde de la boutique par un meneur ou bras droit habilité.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/001-4achat.png" alt="Achat du raid Sanctuaire des Jardins éternels" class="guide-image" />
            <span class="guide-caption">Initialisation du raid dans le menu de guilde</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Paramètre</th>
                    <th>Valeur / Règle</th>
                    <th>Détail stratégique</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Coût de lancement</strong></td>
                    <td>480 Kamas de Guilde</td>
                    <td>Accessible à toutes les guildes actives.</td>
                </tr>
                <tr>
                    <td><strong>Effectif</strong></td>
                    <td>8 à 16 joueurs (Niveau 200)</td>
                    <td>Permet de scinder l'équipe sur les 4 ailes simultanément (4 duos ou 4 quatuors).</td>
                </tr>
                <tr>
                    <td><strong>Durée maximale</strong></td>
                    <td>2 heures (120 minutes)</td>
                    <td>Le raid s'interrompt si le chrono s'épuise ou si les PV du raid tombent à 0.</td>
                </tr>
                <tr>
                    <td><strong>Plafond de score</strong></td>
                    <td>50 000 points</td>
                    <td>11 paliers de récompenses hebdomadaires de guilde.</td>
                </tr>
                <tr>
                    <td><strong>Progression partagée</strong></td>
                    <td>Validation globale</td>
                    <td>Dès qu'un membre ou binôme valide une étape, elle est validée pour l'ensemble du raid.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. La Jauge de Survie : Les 20 PV du Raid</h2>
        <p>
            Votre guilde démarre avec un compteur de <strong>20 PV d'équipe partagés</strong>. Si ce compteur atteint zéro, l'instance échoue immédiatement pour tout le monde.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/003-6vie.png" alt="Compteur de PV de l'équipe" class="guide-image" />
            <span class="guide-caption">Indicateur de PV partagés : chaque défaite en combat ou erreur d'énigme déduit des points</span>
        </div>

        <ul>
            <li><strong>Erreur dans une énigme :</strong> -1 PV de raid.</li>
            <li><strong>Défaite en combat :</strong> -1 PV de raid <em>par personnage engagé</em> dans le combat perdu.</li>
            <li><strong>Validation d'une énigme :</strong> +1 PV de raid (dans la limite des 20 PV maximum).</li>
        </ul>

        <h2>III. Schéma Général : Les 4 Énigmes Interconnectées</h2>
        <p>
            Le sanctuaire est articulé autour d'une <strong>Cour Centrale en [10,15]</strong> distribuant 4 zones distinctes. Chaque zone abrite une énigme dont la solution dépend directement d'indices ou d'actions réalisées dans une autre zone :
        </p>
        <pre><code>/travel 10,15</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/015-23enigmes.png" alt="Schéma des liaisons d'énigmes" class="guide-image" />
            <span class="guide-caption">Interconnexions des 4 ailes du Sanctuaire des Jardins Éternels</span>
        </div>

        <h3>1. Énigme 1 : La Bataille Navale de Belladone (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Ouvrage Monochrome [11,21] + Réserve de Belladone [19,15] et [21,17].<br />
            <strong>Rôle Équipe :</strong> 1 joueur dans l'Ouvrage clique sur les <strong>6 bateaux en papier</strong> (« Dévoiler la position »). Les bateaux apparaissent alors sur les deux grilles maritimes de la Réserve.
        </p>
        <pre><code>/travel 19,15</code></pre>
        <pre><code>/travel 21,17</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/018-26bataille.jpg" alt="Grille de bataille navale de Belladone" class="guide-image" />
            <span class="guide-caption">Grille de tir 4x3 : combinez une lettre (colonne A à D) et un chiffre (ligne 1 à 3) pour faire feu</span>
        </div>

        <p>
            Deux joueurs (ou un joueur en double-compte) se placent sur chacune des deux cartes de la Réserve. <strong>La carte [21,17] commence la séquence de tir :</strong> activez une lettre et un chiffre pour envoyer un boulet sur la coordonnée du navire adverse (ex: B + 2). Réitérez tour par tour jusqu'à couler les 6 bateaux.
        </p>

        <div class="callout callout-tip">
            <strong>Outil Bateaux Interactif</strong>
            <p>Utilisez l'onglet <strong>Énigmes &gt; Bateaux</strong> dans Raid Studio 3.6 ou l'overlay PiP pour cliquer sur la grille 4x3 et cocher vos 6 navires au fur et à mesure.</p>
        </div>

        <hr />

        <h3>2. Énigme 2 : L'Échiquier d'Éphèdre (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Cour d'Éphèdre [12,14] + Réserve de Belladone [19,15].<br />
            <strong>Rôle Équipe :</strong> Parlez à Belladone en Cour d'Éphèdre pour réveiller les 4 échiquiers dans la Réserve. Notez les 4 pièces illuminées en vert sur la grille 11x11 (de A1 à K11) :
        </p>
        <pre><code>/travel 12,14</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/108-93tour.jpg" alt="Pièce d'échiquier illuminée" class="guide-image" />
            <span class="guide-caption">Repérez les 4 pièces : Tour Blanche, Tour Noire, Fou Blanc, Fou Noir</span>
        </div>

        <p>
            Engagez ensuite le combat d'échecs à 4 joueurs en Cour d'Éphèdre [12,14]. Chaque joueur doit positionner son personnage sur la case exacte correspondant à l'une des 4 pièces notées. Une fois les 4 cases occupées, passez votre tour pour valider l'épreuve (+2 000 pts).
        </p>

        <div class="callout callout-warning">
            <strong>Attention aux erreurs de case</strong>
            <p>Toute case incorrecte déduit 1 PV au compteur de raid (20 PV max). Utilisez le sélecteur de grille A1..K11 dans l'overlay pour noter les positions avant d'engager.</p>
        </div>

        <hr />

        <h3>3. Énigme 3 : L'Ouvrage Monochrome & Piédestaux (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Clos des Protecteurs [11,21] / [12,20] + Ouvrage Monochrome [11,21].<br />
            <strong>Rôle Équipe :</strong> Examinez les piédestaux stèles I à IV dans le Clos des Protecteurs. Notez les 2 objets par piédestal (8 objets au total : <em>Crayons, Bobine, Lanterne, Kamas, Arakne, Bougie, Bague, Règle</em>).
        </p>
        <pre><code>/travel 11,21</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/153-123fleurcamp.jpg" alt="Fleurs de l'Ouvrage Monochrome" class="guide-image" />
            <span class="guide-caption">Activez les fleurs associées aux objets clés dans l'Ouvrage Monochrome</span>
        </div>

        <p>
            Rendez-vous dans l'Ouvrage Monochrome pour activer les 4 fleurs associées. La couleur finale qui s'illumine (<strong>Orange, Bleu, Rouge ou Vert</strong>) est la clé absolue de l'énigme des Statues !
        </p>

        <hr />

        <h3>4. Énigme 4 : Le Clos des Protecteurs & Statues (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Clos des Protecteurs [11,19] + Cour d'Éphèdre [12,14].<br />
            <strong>Rôle Équipe :</strong> Comparez les 4 vues du Clos (Haut, Bas, Gauche, Droite) à la miniature d'Éphèdre pour identifier la statue de monstre apparue au centre et la couleur débloquée à l'étape 3.
        </p>
        <pre><code>/travel 11,19</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/157-133statues.jpg" alt="Statues du Clos des Protecteurs" class="guide-image" />
            <span class="guide-caption">Vérifiez la statue centrale et orientez votre regard sur la dalle indiquée</span>
        </div>

        <p>
            Selon la table de vérité (reproduite fidèlement dans notre solveur interactif), vous obtenez la coordonnée du protecteur cible (<em>Fracamélia, Tritulipe, Muguégide ou Dahliane</em>) ainsi que l'orientation requise. Rendez-vous sur la case, faites face dans la bonne direction et engagez le combat pour réveiller le Gardien du Clos.
        </p>

        <h2>IV. Les 4 Gardiens & Le Corridor du Château</h2>
        <p>
            Une fois les 4 énigmes résolues, les 4 gardiens de zone s'éveillent. Chaque victoire rapporte <strong>5 000 points</strong> (20 000 pts au total) :
        </p>
        <ul>
            <li><strong>Veilleur de l'Ouvrage :</strong> Gardien Air/Terre avec répulsion en zone.</li>
            <li><strong>Gardien du Clos :</strong> Protecteur robuste avec glyphes d'armure.</li>
            <li><strong>Défenseur de la Réserve :</strong> Spécialiste du vol de vie et du retrait PM.</li>
            <li><strong>Sentinelle de la Cour :</strong> Attaques à longue portée sans ligne de vue.</li>
        </ul>

        <h3>Le Corridor du Château (10 Salles / 60 Combats Solo)</h3>
        <p>
            Après la chute des 4 gardiens, la grande porte du château s'ouvre en [14,18]. Les joueurs entrent dans une série de 10 salles contenant 6 monstres chacune. Chaque combat est <strong>strictement individuel</strong> (compagnons désactivés).
        </p>
        <pre><code>/travel 14,18</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/106-87monstres.jpg" alt="Le Corridor du Château" class="guide-image" />
            <span class="guide-caption">Les 60 monstres du corridor : terminez votre tour à 4 PO ou moins du monstre</span>
        </div>

        <div class="callout callout-warning">
            <strong>Règles vitales du Corridor (Danger d'OS)</strong>
            <ul>
                <li><strong>Initiative 2 601+ obligatoire :</strong> Les monstres ont 2 600 d'initiative. Équipez impérativement un trophée Initiative pour jouer en premier et éviter de subir un tour dévastateur.</li>
                <li><strong>Passif « Férocité des Protecteurs » :</strong> Si vous terminez votre tour à plus de 4 PO du monstre avec une ligne de vue dégagée, il gagne 100% de critique et ses dégâts sont doublés. Terminez toujours à 4 PO ou moins, ou posez un obstacle statique (arbre, cawotte, cadran) pour casser la vue !</li>
                <li><strong>Chaque défaite retire 1 PV au raid :</strong> Ne prenez aucun risque inutile, privilégiez le vol de vie et les sorts de protection.</li>
            </ul>
        </div>

        <h2>V. Combat Final 1 : La Reine Écarlate (10 000 pts)</h2>
        <p>
            Située dans les cryptes souterraines de la tour en [16,20], la Reine Écarlate (50 000 PV, Lourd, Inérodable) propose un combat à 8 joueurs d'une haute intensité tactique.
        </p>
        <pre><code>/travel 16,20</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/110-95reine.jpg" alt="Boss Reine Écarlate" class="guide-image" />
            <span class="guide-caption">La Reine Écarlate dans la salle du trône des profondeurs</span>
        </div>

        <h3>1. Phase 1 : Les Cachots & L'État « Évadé »</h3>
        <ul>
            <li><strong>Départ en 4 duos :</strong> Les joueurs débutent séparés par duos dans 4 cellules aux coins de la carte avec 2 monstres par cellule partageant leurs dégâts. Éliminez tous les monstres pour ouvrir simultanément les cachots.</li>
            <li><strong>Sort « Exil Impérial » :</strong> À chaque tour, la Reine enferme un joueur aléatoire dans un cachot. Le joueur emprisonné subit 10% de ses PV par tour et passe son tour.</li>
            <li><strong>Libération via le Floracle (5 000 dégâts) :</strong> Pour libérer un allié emprisonné, frappez l'entité <em>Floracle</em> située devant la cellule (elle subit +100% de dégâts).</li>
            <li><strong>État Évadé (Danger Mortel) :</strong> À sa sortie, le joueur libéré porte l'état <em>Évadé</em> pendant 1 tour. Si la Reine le frappe au corps-à-corps avec son sort <em>Exécution de l'Évadé</em>, il subit plus de 3 000 dégâts instantanés ! <strong>Le Pandawa doit impérativement tacler ou repousser la Reine loin des évadés.</strong></li>
            <li><strong>Châtiment Royal :</strong> Sort à retardement de 2 tours qui inflige 2 000 dégâts globaux (+1 200 dégâts supplémentaires si des alliés sont encore en cachot). Libérez vos coéquipiers avant la détonation !</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/131-99floracle.jpg" alt="Le Floracle devant le cachot" class="guide-image" />
            <span class="guide-caption">Infligez 5 000 dégâts au Floracle pour libérer immédiatement votre coéquipier</span>
        </div>

        <h3>2. Phase 2 : La Volonté de la Princesse & Le Délock</h3>
        <p>
            À 1 PV, la Reine se soigne entièrement, devient <strong>invulnérable</strong>, joue désormais <strong>2 fois par tour</strong> et invoque la <em>Volonté de la Princesse</em> (30 000 PV).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/138-107epee.jpg" alt="Pommeau Enraciné et Lame Fleurie" class="guide-image" />
            <span class="guide-caption">Le Pommeau Enraciné et la Lame Fleurie aux deux extrémités de la carte</span>
        </div>

        <div class="callout callout-tip">
            <strong>Procédure de délock de la Reine</strong>
            <ol>
                <li>Éliminez en priorité la <strong>Volonté de la Princesse</strong> pour stopper ses soins et ses retraits PM.</li>
                <li>Frappez et détruisez le <strong>Pommeau Enraciné</strong> et la <strong>Lame Fleurie</strong> situés sur les berges opposées.</li>
                <li>L'invulnérabilité de la Reine se dissipe : déclenchez votre burst le plus lourd (Colère de Iop, bombes Roublard) pour terrasser ses 50 000 PV !</li>
            </ol>
        </div>

        <h2>VI. Combat Final 2 : La Princesse Maudite (10 000 pts)</h2>
        <p>
            Au sommet de la flèche du château en [18,22] se dresse la Princesse Maudite (50 000 PV, <strong>Invulnérable en Mêlée permanente</strong>, Lourd, Inérodable).
        </p>
        <pre><code>/travel 18,22</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/152-123fleur.jpg" alt="La Fleur Maudite au centre de l'arène" class="guide-image" />
            <span class="guide-caption">La Fleur Maudite (10 000 PV) : faites basculer son contrôle dans votre camp</span>
        </div>

        <h3>1. La Fleur Maudite (L'Alliée Clé)</h3>
        <p>
            Une grande fleur de 4 cases occupe le centre. Lorsqu'elle tombe à 1 PV, elle rejoint votre camp pendant <strong>2 tours complets</strong> :
        </p>
        <ul>
            <li>Elle soigne votre équipe de <strong>1 200 PV par tour</strong>.</li>
            <li>Elle accorde un bonus massif de <strong>+300 Puissance et +10% Critique</strong> à tous vos combattants.</li>
        </ul>

        <h3>2. L'Aura Maudite & La Statufication</h3>
        <p>
            À partir du Tour 2, tout personnage se trouvant dans la <strong>ligne de vue directe</strong> de la Princesse au début de son tour est transformé en <em>Statue Maudite</em> et subira une mort instantanée (OS) au tour suivant !
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/157-133statues.jpg" alt="Alliés transformés en statue" class="guide-image" />
            <span class="guide-caption">Statufication : masquez votre ligne de vue ou donnez un coup de corps-à-corps pour libérer un allié pétrifié</span>
        </div>

        <h3>3. Phase 2 : La Volonté de la Reine & Le Sort « Incantation Florale »</h3>
        <p>
            Au seuil de 1 PV, la Princesse devient invulnérable et invoque la <em>Volonté de la Reine</em> (30 000 PV).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/166-129glyphe.jpg" alt="Glyphe violet pour Incantation Florale" class="guide-image" />
            <span class="guide-caption">Marchez dans le glyphe violet posé par la Fleur pour débloquer le sort Incantation Florale</span>
        </div>

        <ol>
            <li>Tuez la <strong>Volonté de la Reine</strong> pour éviter son sort <em>Lien Familial</em> (partage de dégâts).</li>
            <li>Laissez la Fleur Maudite dans le camp ennemi : elle fait apparaître un <strong>glyphe violet</strong> au sol.</li>
            <li>Un joueur très mobile marche dans le glyphe et obtient le sort <strong>« Incantation Florale »</strong> (2 PA, 10 PO sans LDV).</li>
            <li>Lancez <em>Incantation Florale</em> une première fois sur la Princesse (applique l'état), puis une seconde fois via un nouveau glyphe pour <strong>lui retirer définitivement son invulnérabilité</strong>.</li>
            <li><strong>Attention au sort « Tempête Florale » :</strong> La Princesse se soigne de 10 000 PV lorsqu'elle atteint 6 incréments de Floraison. Appliquez l'état Insoignable (Éniripsa ou Leçon de Grunob) pour neutraliser ce soin massif.</li>
            <li>Achevez la Princesse <strong>exclusivement avec des attaques et sorts à distance</strong> (l'invulnérabilité en mêlée reste active jusqu'à la fin !).</li>
        </ol>

        <h3>4. Stratégie Optimisée « Autowin » : Confinement par Retrait PM</h3>
        <p>
            Face aux 50 000 PV de la Princesse Maudite et à ses frappes de zone portant jusqu'à <strong>16 PO</strong>, la méthode la plus sûre consiste à la priver totalement de PM pour la parquer dans un angle de carte, pendant que vos 8 combattants se regroupent à l'opposé absolu.
        </p>

        <div class="guide-image-container">
            <img src="/assets/dofus/eclat-entravant.png" alt="Éclat Entravant dans le Hall de guilde" class="guide-image" />
            <span class="guide-caption">Éclat Entravant : bonus de +30 Retrait PM et +30 Retrait PA pour un combat (Amateur de Guildatons)</span>
        </div>

        <p>
            <strong>Prérequis d'équipement &amp; statistiques (300+ Retrait PM) :</strong> Deux personnages dédiés au retrait PM (idéalement un <strong>Enutrof</strong> et un <strong>Sadida</strong>) doivent obligatoirement franchir le cap des <strong>300 de retrait PM</strong>. Attribuez tous vos points de caractéristiques en Sagesse et consommez un <em>Éclat Entravant</em> (+30 Retrait PM et +30 Retrait PA pour le combat, vendu au Hall de guilde par l'Amateur de Guildatons).
        </p>

        <p>
            <strong>Érosion de l'esquive PM (Princesse à 350 d'esquive de base) :</strong> Même avec 300+ de retrait, retirer 6 PM à une cible dotée de 350 d'esquive exige d'abaisser préalablement son esquive avec des sorts dédiés :
        </p>
        <ul>
            <li><strong>Sève Paralysante (Sadida) :</strong> −15 esquive PM pendant 3 tours.</li>
            <li><strong>Obsolescence (Enutrof) :</strong> −20 esquive PM pendant 2 tours.</li>
            <li><strong>Pluie de Flèches (Crâ) :</strong> −20 esquive PM pendant 2 tours.</li>
            <li><strong>Mâchoire (Ouginak) :</strong> −30 esquive PM pendant 2 tours.</li>
        </ul>

        <p>
            <strong>Sorts indispensables sur vos entravateurs :</strong>
        </p>
        <ul>
            <li><strong>Sadida :</strong> <em>Ronce Apaisante, Feu de Brousse, Herbes Folles, Mangrove, Sève Paralysante, Ronces Agressives</em>.</li>
            <li><strong>Enutrof :</strong> <em>Obsolescence, Maladresse, Clef de Bras</em> (retire 1 PM inesquivable à chaque tour pour 2 PA), <em>Ruée vers l'Or, Tamisage, Pelle des Anciens, Pelle Aurifère, Boîte à Outils</em> (octroie un boost vital de PA et PM au Sadida pour multiplier ses retraits).</li>
        </ul>

        <p>
            <strong>Ordre d'initiative et coordination tactique :</strong>
        </p>
        <ul>
            <li><strong>Initiative 1 &amp; 2 :</strong> Les deux entravateurs (Enutrof en premier, Sadida juste après) agissent en tête pour immobiliser la Princesse dès le début de la rotation.</li>
            <li><strong>Initiative 3 :</strong> L'<strong>Eliotrope</strong> joue immédiatement après pour déployer ses portails : l'équipe peut ainsi frapper et réappliquer les retraits à très grande distance en restant protégée au coin opposé.</li>
            <li><strong>Dons de PA :</strong> Toutes les capacités de don de PA de l'équipe doivent être investies en priorité sur les deux personnages de retrait PM.</li>
            <li><strong>Fermeture du tour (Placeur) :</strong> Un <strong>Pandawa</strong> placé en toute fin d'initiative ramène systématiquement les alliés qui se seraient avancés pour maintenir la distance de sécurité (&gt; 16 PO).</li>
            <li><strong>Persistance en Phase 2 :</strong> Le retrait PM s'étendant sur un tour de table entier, la Princesse reste bloquée à 0 PM lors de ses 2 tours de jeu consécutifs en phase 2.</li>
        </ul>

        <h2>VII. Compositions &amp; Synergies Recommandées (16 Joueurs)</h2>
        <p>
            Une bonne répartition des classes garantit la victoire sur les 4 ailes et le double boss final :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Classe</th>
                    <th>Rôle dans le Raid</th>
                    <th>Sorts &amp; Actions Clés</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/12.png" alt="Pandawa" class="class-icon" width="20" height="20" />
                            Pandawa
                        </span>
                    </td>
                    <td><strong>Noyau Incontournable</strong> (Placement CaC)</td>
                    <td><em>Brassage, Vulnérabilité, Karcham</em>. Bloque la Reine Écarlate au contact et la maintient éloignée des alliés portant l'état Évadé.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/9.png" alt="Crâ" class="class-icon" width="20" height="20" />
                            Crâ
                        </span>
                    </td>
                    <td><strong>Noyau Incontournable</strong> (DPS Distance Pure)</td>
                    <td><em>Tir Éloigné, Flèche Destructrice, sorts sans LDV</em>. Le DPS principal contre la Princesse Maudite (invulnérable en mêlée).</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/3.png" alt="Enutrof" class="class-icon" width="20" height="20" />
                            Enutrof
                        </span>
                    </td>
                    <td><strong>Entrave PM (Autowin)</strong></td>
                    <td><em>Obsolescence, Clef de Bras, Maladresse, Boîte à Outils</em>. Réduit l'esquive PM de 20, retire 1 PM inesquivable/tour pour 2 PA et booste le Sadida.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/10.png" alt="Sadida" class="class-icon" width="20" height="20" />
                            Sadida
                        </span>
                    </td>
                    <td><strong>Entrave PM (Autowin)</strong></td>
                    <td><em>Sève Paralysante, Ronce Apaisante, Herbes Folles, Mangrove</em>. Réduit l'esquive PM de 15 et cloue la Princesse à 0 PM.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/16.png" alt="Eliotrope" class="class-icon" width="20" height="20" />
                            Eliotrope
                        </span>
                    </td>
                    <td><strong>Réseau Portails &amp; Sécurité</strong></td>
                    <td><em>Portails, Entraide, Focalisation</em>. Permet d'entraver et de pilonner la Princesse depuis le coin opposé à plus de 16 PO.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/18.png" alt="Ouginak" class="class-icon" width="20" height="20" />
                            Ouginak
                        </span>
                    </td>
                    <td><strong>Entrave &amp; Amplificateur (Optionnel)</strong></td>
                    <td><em>Mâchoire, Gibier, Proie</em>. Applique le malus lourd de -30 esquive PM pendant 2 tours pour sécuriser l'entrave.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/17.png" alt="Huppermage" class="class-icon" width="20" height="20" />
                            Huppermage
                        </span>
                    </td>
                    <td><strong>Top DPS Distance &amp; Mobilité</strong></td>
                    <td><em>Volcan, Cycle Élémentaire, Polarité</em>. Récupère facilement les glyphes violets d'Incantation Florale grâce à sa haute mobilité.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/13.png" alt="Roublard" class="class-icon" width="20" height="20" />
                            Roublard
                        </span>
                    </td>
                    <td><strong>Top DPS Burst</strong></td>
                    <td><em>Mur de bombes, Poudre, Rebours</em>. Pulvérise le Floracle (5k HP) en un coup et nettoie les Volontés (30k HP).</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/8.png" alt="Iop" class="class-icon" width="20" height="20" />
                            Iop
                        </span>
                    </td>
                    <td><strong>Finisher Reine Écarlate</strong></td>
                    <td><em>Colère de Iop, Massacre, Puissance</em>. Termine la Reine Écarlate dès que le Pommeau et la Lame sont détruits.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/1.png" alt="Féca" class="class-icon" width="20" height="20" />
                            Féca
                        </span>
                    </td>
                    <td><strong>Support &amp; Protection</strong></td>
                    <td><em>Rempart, Trêve, Bouclier Féca</em>. Prévient les pertes de PV de raid sur les sorts globaux comme Châtiment Royal.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/7.png" alt="Éniripsa" class="class-icon" width="20" height="20" />
                            Éniripsa
                        </span>
                    </td>
                    <td><strong>Support &amp; Soins</strong></td>
                    <td><em>Soins massifs de raid, Mot Revigorant, Mot Décourageant (Insoignable)</em>. Neutralise le heal de 10k PV de la Princesse.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/14.png" alt="Zobal" class="class-icon" width="20" height="20" />
                            Zobal
                        </span>
                    </td>
                    <td><strong>Support &amp; Protection</strong></td>
                    <td><em>Plastron, Tortoruga à distance, Masque Psychopathe</em>. Fournit les boucliers indispensables pour sécuriser les 20 PV partagés.</td>
                </tr>
            </tbody>
        </table>

        <h3>Équipements &amp; Optimisations Clés</h3>
        <ul>
            <li><strong>Éclat Entravant (Hall de guilde) :</strong> Confère +30 Retrait PM et +30 Retrait PA pour 1 combat, indispensable pour hisser vos entravateurs au-delà des 300 de retrait PM.</li>
            <li><strong>Stuff 300+ Retrait PM (Full Sagesse) :</strong> Investissement total en Sagesse et panoplies retrait pour clouer les 350 d'esquive de la Princesse.</li>
            <li><strong>Trophée Initiative (2 601+ requis) :</strong> Indispensable sur tous les combattants du corridor pour jouer avant les monstres et éviter les dégâts critiques du T1.</li>
            <li><strong>Dofus Nébuleux :</strong> Permet de caler les tours pairs/impairs de burst sur les Volontés (30 000 PV) et sur les boss délockés.</li>
            <li><strong>Leçon de Grunob ou sorts Insoignable :</strong> Réduit à néant le soin de 10 000 PV de <em>Tempête Florale</em> en Phase 2 de la Princesse Maudite.</li>
        </ul>

        <h2>VIII. Récompenses & Objets de Panoplie</h2>
        <p>
            La frise hebdomadaire du Sanctuaire comporte 11 échelons (de 2 000 à 50 000 points) :
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/170-149recompenses.jpg" alt="Frise des récompenses du Sanctuaire" class="guide-image" />
            <span class="guide-caption">Frise de récompenses hebdomadaire du Sanctuaire des Jardins Éternels</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Score Atteint</th>
                    <th>Coffres & Récompenses Clés</th>
                    <th>Loot Spécial</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>2 000 à 8 000 pts</td>
                    <td>Guildatons + Expérience de guilde</td>
                    <td>Ressources de base</td>
                </tr>
                <tr>
                    <td>13 000 à 28 000 pts</td>
                    <td>Coffres du Sanctuaire</td>
                    <td>Fleurs des protecteurs, Pièces d'armure</td>
                </tr>
                <tr>
                    <td>30 000 pts (Palier 9)</td>
                    <td>10 Fleurs des protecteurs (garanties)</td>
                    <td>Composant de craft légendaire</td>
                </tr>
                <tr>
                    <td><strong>40 000 à 50 000 pts</strong></td>
                    <td><strong>Coffres Majestueux du Sanctuaire</strong></td>
                    <td>Panoplie du Sanctuaire, <strong>Chachardon</strong> (familier 1%)</td>
                </tr>
            </tbody>
        </table>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/173-153panoplie-jardins.png" alt="Panoplie du Sanctuaire des Jardins éternels" class="guide-image" />
            <span class="guide-caption">Panoplie complète du Sanctuaire des Jardins Éternels (Grèves Écarlates, Étreinte Végétale, Heaume)</span>
        </div>

        <div class="callout callout-info">
            <strong>Planifier votre prochain raid de guilde</strong>
            <p>Retrouvez vos fiches de composition, l'organisation des rôles et l'inscription des membres directement dans le <a href="/raids?raid=sanctuaire"><strong>Raid Studio 3.6</strong></a> et l'outil de gestion de raids de votre espace de guilde SigilOS.</p>
        </div>
    `,
};
