export const guide = {
    slug: "raid-sanctuaire-jardins-eternels-dofus-guide",
    title: "Guide du Raid : Sanctuaire des Jardins Éternels (Dofus 3)",
    description:
        "Guide complet du raid Sanctuaire des Jardins Éternels sur Dofus : les 4 énigmes interconnectées, les 4 gardiens, le corridor aux 60 monstres et les stratégies contre la Reine Écarlate et la Princesse Maudite.",
    publishedAt: "2026-09-22",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Raid de Guilde Collaboratif — Niveau 200 (8 à 16 Joueurs)</strong>
            <p>Le Sanctuaire des Jardins Éternels est le premier grand raid coopératif de Dofus 3. Basé sur une mécanique de <strong>Points de Vie d'instance (20 PV)</strong>, il exige une excellente répartition des rôles entre 4 salles à énigmes interconnectées, l'élimination de 4 gardiens de zone, un corridor de combat solo et un double affrontement final contre la <strong>Reine Écarlate</strong> et la <strong>Princesse Maudite</strong>.</p>
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
                    <td>Permet de scinder l'équipe sur les 4 ailes simultanément.</td>
                </tr>
                <tr>
                    <td><strong>Durée maximale</strong></td>
                    <td>2 heures (120 minutes)</td>
                    <td>Le raid s'interrompt si le chrono s'épuise ou si les PV du raid tombent à 0.</td>
                </tr>
                <tr>
                    <td><strong>Plafond de score</strong></td>
                    <td>50 000 points</td>
                    <td>11 paliers de récompenses hebdomadaires.</td>
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
            Votre guilde démarre avec un compteur de <strong>20 PV d'équipe</strong>. Si ce compteur atteint zéro, l'instance échoue immédiatement.
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
            Le sanctuaire est articulé autour d'une cour centrale distribuant 4 zones distinctes. Chaque zone abrite une énigme dont la solution dépend directement d'indices ou d'actions réalisées dans une autre zone :
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/015-23enigmes.png" alt="Schéma des liaisons d'énigmes" class="guide-image" />
            <span class="guide-caption">Interconnexions des 4 ailes du Sanctuaire des Jardins Éternels</span>
        </div>

        <h3>1. Énigme 1 : La Bataille Navale de Belladone (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Ouvrage Monochrome + Réserve de Belladone.<br />
            <strong>Rôle Équipe :</strong> 1 joueur dans l'Ouvrage clique sur les <strong>6 bateaux en papier</strong> (« Dévoiler la position »). Les bateaux apparaissent alors sur les deux grilles maritimes en [21,17] et [19,15].
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/018-26bataille.jpg" alt="Grille de bataille navale de Belladone" class="guide-image" />
            <span class="guide-caption">Grille de tir : combinez une lettre (colonne) et un chiffre (ligne) pour couler les navires</span>
        </div>

        <p>
            Deux joueurs (ou un joueur en double-compte) se placent sur chacune des deux cartes de la Réserve. La carte [21,17] commence : activez une lettre et un chiffre pour envoyer un boulet sur la coordonnée du navire adverse (ex: A + 2). Réitérez tour par tour jusqu'à couler les 6 bateaux.
        </p>

        <hr />

        <h3>2. Énigme 2 : L'Échiquier d'Éphèdre (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Cour d'Éphèdre [12,14] + Réserve de Belladone.<br />
            <strong>Rôle Équipe :</strong> Parlez à Belladone en Cour d'Éphèdre pour réveiller les 4 échiquiers dans la Réserve. Notez les 4 pièces illuminées en vert. Rejoignez ensuite le combat d'échecs en Cour d'Éphèdre à 4 joueurs et replacez vos personnages sur les cases identiques pour remporter l'épreuve.
        </p>

        <hr />

        <h3>3. Énigme 3 : L'Ouvrage Monochrome (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Clos des Protecteurs + Ouvrage Monochrome.<br />
            <strong>Rôle Équipe :</strong> Examinez les piédestaux en [11,21] et [12,20] dans le Clos des Protecteurs pour relever l'ordre des 4 reliques. Rendez-vous ensuite dans l'Ouvrage Monochrome pour activer les fleurs en papier <strong>dans l'ordre exact correspondant</strong>.
        </p>

        <hr />

        <h3>4. Énigme 4 : Le Clos des Protecteurs (2 000 pts)</h3>
        <p>
            <strong>Zones impliquées :</strong> Clos des Protecteurs + Cour d'Éphèdre.<br />
            <strong>Rôle Équipe :</strong> Reconstituez les 4 parterres de jardins floraux en plaçant les dalles par paires symétriques pour déclencher l'affrontement du protecteur de pierre.
        </p>

        <h2>IV. Les 4 Gardiens & Le Corridor du Château</h2>
        <p>
            Une fois les 4 énigmes résolues, les 4 gardiens de salle s'éveillent. Chaque victoire rapporte <strong>5 000 points</strong> (20 000 pts au total) :
        </p>
        <ul>
            <li><strong>Veilleur de l'Ouvrage :</strong> Gardien Air/Terre avec répulsion en zone.</li>
            <li><strong>Gardien du Clos :</strong> Protecteur robuste avec glyphes de protection d'armure.</li>
            <li><strong>Défenseur de la Réserve :</strong> Spécialiste du vol de vie et du retrait PM.</li>
            <li><strong>Sentinelle de la Cour :</strong> Attaques à longue portée sans ligne de vue.</li>
        </ul>

        <h3>Le Corridor du Château (10 Salles / 60 Combats Solo)</h3>
        <p>
            La porte centrale s'ouvre sur une enfilade de 10 salles contenant 6 monstres chacune. Chaque membre doit affronter ses monstres en <strong>combat strictement solo</strong> (les compagnons sont désactivés).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/106-87monstres.jpg" alt="Le Corridor du Château" class="guide-image" />
            <span class="guide-caption">Les 60 monstres du corridor : terminez votre tour à 4 PO ou moins du monstre</span>
        </div>

        <div class="callout callout-tip">
            <strong>Optimisation du Corridor</strong>
            <ul>
                <li><strong>Initiative :</strong> Les monstres ont 2 600 d'initiative. Équipez un trophée Initiative pour atteindre <strong>2 601+ Init</strong> et jouer en premier.</li>
                <li><strong>Passif « Férocité des Protecteurs » :</strong> Si vous terminez votre tour à plus de 4 PO du monstre sans obstacle bloquant sa vue, il gagne 100% de critique et des dégâts doublés. Restez à mi-distance ou utilisez une invocation statique pour masquer la ligne de vue !</li>
            </ul>
        </div>

        <h2>V. Combat Final 1 : La Reine Écarlate (10 000 pts)</h2>
        <p>
            Située dans les cryptes souterraines de la tour, la Reine Écarlate (50 000 PV, Lourd, Inérodable) propose un combat à 8 joueurs d'une haute intensité tactique.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/110-95reine.jpg" alt="Boss Reine Écarlate" class="guide-image" />
            <span class="guide-caption">La Reine Écarlate dans la salle du trône des profondeurs</span>
        </div>

        <h3>1. Phase 1 : Les Cachots & L'État « Évadé »</h3>
        <ul>
            <li><strong>Disposition de départ :</strong> Les joueurs débutent enfermés par duos dans 4 cachots aux coins de la carte avec 2 monstres par cellule partageant leurs dégâts. Éliminez tous les monstres pour ouvrir simultanément les 4 cellules.</li>
            <li><strong>Sort « Exil Impérial » :</strong> À chaque tour, la Reine enferme un joueur aléatoire dans un cachot. Le joueur emprisonné subit 10% de ses PV par tour et passe son tour.</li>
            <li><strong>Libération via le Floracle (5 000 dégâts) :</strong> Pour libérer un allié emprisonné, frappez l'entité <em>Floracle</em> située devant la cellule (elle subit +100% de dégâts).</li>
            <li><strong>État Évadé (Danger Mortel) :</strong> À sa sortie, le joueur libéré porte l'état <em>Évadé</em> pendant 1 tour. Si la Reine le frappe au corps-à-corps avec son sort <em>Exécution de l'Évadé</em>, il subit plus de 3 000 dégâts feu instantanés ! Taclez ou repoussez impérativement la Reine durant ce tour.</li>
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
                <li>Frappez et détruisez le <strong>Pommeau Enraciné</strong> et la <strong>Lame Fleurie</strong> situés sur les berges.</li>
                <li>L'invulnérabilité de la Reine se dissipe : burstez ses 50 000 PV restants pour remporter le combat !</li>
            </ol>
        </div>

        <h2>VI. Combat Final 2 : La Princesse Maudite (10 000 pts)</h2>
        <p>
            Au sommet de la flèche du château se dresse la Princesse Maudite (50 000 PV, Invulnérable en Mêlée permanente, Lourd, Inérodable).
        </p>

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
            <li>Un joueur marche dans le glyphe et obtient le sort <strong>« Incantation Florale »</strong> (2 PA, 10 PO sans LDV).</li>
            <li>Lancez <em>Incantation Florale</em> une première fois sur la Princesse (applique l'état), puis une seconde fois via un nouveau glyphe pour <strong>lui retirer définitivement son invulnérabilité</strong>.</li>
            <li>Achevez la Princesse <strong>exclusivement avec des sorts et attaques à distance</strong> (l'invulnérabilité en mêlée reste active !).</li>
        </ol>

        <h2>VII. Récompenses & Objets de Panoplie</h2>
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
            <p>Retrouvez vos fiches de composition, l'organisation des rôles et l'inscription des membres directement dans le calendrier et l'outil de gestion de raids de votre espace de guilde SigilOS.</p>
        </div>
    `,
};
