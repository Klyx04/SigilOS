export interface SafeTravelStep {
  stepNum: number;
  label: string;
  coords?: string;
  command?: string;
  action: string;
  warning?: string;
  isBlockPoint?: boolean;
}

export interface SafeTravelRoute {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  dangerWarning?: string;
  steps: SafeTravelStep[];
}

export interface FloorSaltDeposit {
  floor: string;
  zoneName: string;
  luminomachines: { coords: string; command: string }[];
  salts: { coords: string; command: string; note?: string }[];
}

export interface RaidStep {
  id: string;
  floor: string;
  title: string;
  bossName?: string;
  bossHp?: string;
  coords: string;
  travelCommand: string;
  primaryImage: string;
  secondaryImages?: { label: string; src: string }[];
  summary: string;
  keyMechanics: { label: string; desc: string; danger?: boolean }[];
  strategy: string[];
  proTips: string[];
  hasExecrabePad?: boolean;
  hasBurstGuide?: boolean;
  hasSafeTravelGuide?: boolean;
}

export interface RaidData {
  id: "gigalodon" | "jardin-eternel";
  name: string;
  shortName: string;
  worldId: number;
  zoneName: string;
  badge: string;
  themeColor: string;
  guideUrl: string;
  description: string;
  steps: RaidStep[];
  safeRoutes?: SafeTravelRoute[];
  saltLocations?: FloorSaltDeposit[];
}

export const RAIDS_DATA: Record<string, RaidData> = {
  gigalodon: {
    id: "gigalodon",
    name: "Gouffre du Gigalodon",
    shortName: "Gigalodon",
    worldId: 37,
    zoneName: "Gouffre Abyssal · Monde 37",
    badge: "Raid 12 Joueurs · Niv. 200",
    themeColor: "#06b6d4",
    guideUrl: "/guides/raid-gigalodon-dofus-guide",
    description: "Descente en 6 étages abyssaux pour sécuriser les 4 fragments du coffre et terrasser le Gigalodon en 3 tours de burst.",
    steps: [
      {
        id: "step-1",
        floor: "Étage -1",
        title: "Avant-poste & Récoltes de Sel",
        bossName: "Nettoyage 18 Groupes & Minage",
        coords: "[3, 2]",
        travelCommand: "/travel 3 2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        secondaryImages: [
          { label: "Gisements de sel marin", src: "/images/guides/gigalodon/27-gisement-sel.jpg" },
          { label: "Luminomachine du camp", src: "/images/guides/gigalodon/18-luminomachine.jpg" }
        ],
        summary: "Camp de base du raid. 18 groupes de monstres à nettoyer en 3 escouades de 4. Minage des 4 filons de sel marin.",
        keyMechanics: [
          {
            label: "PALIER 10 000 PTS AU COFFRE",
            desc: "Le drop du 4e fragment sur les Krak'Haine à l'étage -5 passe de 1% (sans score) à 20% dès 10 000 points déposés au coffre ! Vous sécuriserez ce palier après la Mureine et l'Exécrabe.",
            danger: true
          },
          {
            label: "3 Escouades de 4 Combattants",
            desc: "Les 18 groupes ne repopent pas une fois vaincus. Nettoyez les 5 cartes en parallèle pour économiser le chrono global (60 min)."
          },
          {
            label: "1er Fragment de Clé",
            desc: "Tous les monstres de l'étage peuvent lâcher le premier fragment de clé de la cage (drop commun partagé)."
          }
        ],
        strategy: [
          "Scindez le raid en 3 escouades de 4 dès l'entrée pour raser les 5 cartes en simultané.",
          "Minez les 4 gisements de sel marin en [3,2], [2,2], [4,2] et [3,3].",
          "Conservez vos réserves de sel : la luminomachine démarre déjà en Niveau 4.",
          "Empruntez la sortie vers l'étage -2 en [4,3]."
        ],
        proTips: [
          "La marchande PNJ vend des potions et consommables essentiels : aucun échange entre joueurs n'est possible.",
          "Ne tentez PAS le succès '100 Sels' lors d'un run de score (100 sels plonge l'instance dans le noir complet permanent)."
        ]
      },
      {
        id: "step-2",
        floor: "Étage -2",
        title: "Boss 1 : Mureine des Abysses",
        bossName: "Mureine (51 000 PV)",
        bossHp: "51 000 PV",
        coords: "[4, 7]",
        travelCommand: "/travel 4 7",
        primaryImage: "/images/guides/gigalodon/46-boss-mureine.jpg",
        secondaryImages: [
          { label: "Technique de blocage en coin", src: "/images/guides/gigalodon/58-placement-blocage-mureine.jpg" },
          { label: "Accès à l'antre (trou central)", src: "/images/guides/gigalodon/44-position-mureine.jpg" }
        ],
        summary: "Anguille géante colossale (51 000 PV). Accompagnée de 3 monstres normaux : Madrépire, Kokayou et Léviatank.",
        keyMechanics: [
          {
            label: "LUMIÈRE NIVEAU 4 OBLIGATOIRE",
            desc: "Rechargez impérativement la Luminomachine en [4,5] ou [2,7] au Niveau 4 AVANT d'engager, sinon le boss et les monstres gagnent jusqu'à +200% PV (153k PV) et +1 000 Puissance !",
            danger: true
          },
          {
            label: "TUER LES 3 MOBS D'ACCOMPAGNEMENT D'ABORD",
            desc: "Éliminez au T1-T2 les 3 monstres normaux (Madrépire, Kokayou, Léviatank) pour libérer les lignes de vue et respirer.",
            danger: false
          },
          {
            label: "Invocations Murares & Poison Corroside",
            desc: "La Mureine invoque jusqu'à 2 Murares par tour à moins de 10 PO (sort Disperssssion) et gagne +100 Puissance par Murare. Éliminer une Murare retire le poison Corroside dans un cercle de 2 cases (Antidote).",
            danger: true
          },
          {
            label: "2e Fragment & Unité de Mureine",
            desc: "La victoire valide le 2e fragment de clé et donne l'Unité de Mureine (1 000 pts au coffre)."
          }
        ],
        strategy: [
          "Stratégie A (Panda Blocage) : Un Pandawa coince la Mureine dans un angle derrière 2 de ses propres Murares ou invocations fixes.",
          "Stratégie B (Distance > 10 PO) : Gardez les DPS à plus de 10 PO de la Mureine pour qu'elle ne puisse pas lancer Disperssssion.",
          "Éliminez en priorité les 3 monstres d'accompagnement normaux, puis concentrez le burst sur la Mureine.",
          "Descendez vers l'étage -3 via l'accès en [2,7]."
        ],
        proTips: [
          "Équipez des résistances Eau et Terre élevées sur le personnage au corps-à-corps.",
          "Le retrait PM neutralise une grande partie de sa mobilité (264 Esquive PM mais contrôlable)."
        ]
      },
      {
        id: "step-3",
        floor: "Étage -3",
        title: "Falaise Noyée & Le Luminarium",
        bossName: "Énigme des Poissons-Lanternes",
        coords: "[4, 12]",
        travelCommand: "/travel 4 12",
        primaryImage: "/images/guides/gigalodon/62-mur-luminarium.jpg",
        secondaryImages: [
          { label: "Méthode d'allumage par cascade", src: "/images/guides/gigalodon/65-methode-solution-luminarium.jpg" }
        ],
        summary: "Grotte du Luminarium. Énigme sur un mur vertical composé d'une grille 4×4 de poissons-lanternes. ZÉRO combat, zone safe.",
        keyMechanics: [
          {
            label: "1 SEUL JOUEUR CLIQUE SUR LE MUR",
            desc: "Désignez UN SEUL joueur pour cliquer sur les poissons-lanternes du mur ! Si plusieurs joueurs cliquent en même temps, les états s'annulent et vous perdez de précieuses minutes.",
            danger: true
          },
          {
            label: "ZÉRO SEL DÉPENSÉ ICI",
            desc: "C'est une zone sans aucun monstre : NE DÉPENSEZ AUCUN SEL dans cette salle pour économiser vos stocks."
          }
        ],
        strategy: [
          "Tous les joueurs restent en retrait, un seul joueur désigné manipule la grille murale.",
          "Méthode de la cascade (ligne par ligne) :",
          "1. Ligne 1 (haut) : pour chaque lanterne éteinte, cliquez sur le poisson directement en dessous (ligne 2).",
          "2. Ligne 2 : cliquez sur la ligne 3 pour allumer les lampes éteintes du dessus.",
          "3. Ligne 3 : cliquez sur la ligne 4 pour allumer le reste.",
          "4. Ligne 4 : traitez les coins inférieurs pour allumer l'intégralité du mur.",
          "Dès que le mur disparaît, traversez vers l'Étage -4."
        ],
        proTips: [
          "Chaque clic bascule l'état du poisson cliqué et de ses 4 voisins orthogonaux (principe Lights Out).",
          "Consultez l'image de solution intégrée si vous êtes bloqués."
        ]
      },
      {
        id: "step-4",
        floor: "Étage -4",
        title: "Boss 2 : Terrier d'Exécrabe",
        bossName: "Exécrabe & Énigme des Statues",
        coords: "[9, 11]",
        travelCommand: "/travel 9 11",
        primaryImage: "/images/guides/gigalodon/71-boss-execrabe.jpg",
        secondaryImages: [
          { label: "Statues de l'énigme sous le lac", src: "/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" },
          { label: "Ouverture du raccourci en [6,10]", src: "/images/guides/gigalodon/95-ouverture-raccourci.jpg" }
        ],
        summary: "Crustacé massif aux 4 apparences. Mémorisation obligatoire des 4 formes élémentaires pour activer les 4 statues sous le lac.",
        keyMechanics: [
          {
            label: "NOTER L'ORDRE DES 4 FORMES",
            desc: "À chaque seuil de PV, l'Exécrabe change d'apparence et la statue correspondante s'illumine en bleu : 1. Coquillage (Terre) · 2. Oursin (Air) · 3. Perle (Feu) · 4. Poulpe (Eau). Notez cet ordre avec le mémo ci-dessous !",
            danger: true
          },
          {
            label: "PÉNALITÉ -1 000 PTS PAR ERREUR",
            desc: "Sous le lac, cliquer sur une mauvaise statue inflige un flash rouge et retire 1 000 points au raid (le score peut devenir négatif) !",
            danger: true
          },
          {
            label: "Lumière Niveau 4 Recommandée",
            desc: "Rechargez la Luminomachine en [8,11] au Niveau 4 pour retirer ses 200% de vitalité bonus. Accompagné de 5 monstres (2 Calarmure, Kokayou, Écaillon, Léviatank)."
          },
          {
            label: "Pince d'Exécrabe Obtenue",
            desc: "Drop unique garanti sur l'un des joueurs. Permet d'ouvrir le raccourci majeur en [6,10] vers l'Étage -2 !"
          }
        ],
        strategy: [
          "Éliminez tous les monstres d'accompagnement en retirant les PM de l'Exécrabe (64 Esquive PM).",
          "Notez l'ordre des formes au fur et à mesure (ou les statues bleues en bord de map) avec notre pad.",
          "Après le combat, cliquez sur le petit plan d'eau en [9,11] pour entrer dans la salle des statues.",
          "Activez les 4 statues dans l'ordre exact mémorisé.",
          "Le joueur détenant la Pince d'Exécrabe file en [6,10] et clique sur le poisson-lanterne pour ouvrir le raccourci !"
        ],
        proTips: [
          "NE DESCENDEZ PAS EN -5 APRÈS CE COMBAT ! Remontez au coffre déposer les trésors (voir étape suivante).",
          "Retrait PM très efficace pour temporiser l'Exécrabe à distance (portée de frappe courte)."
        ],
        hasExecrabePad: true
      },
      {
        id: "step-5",
        floor: "Étage -1",
        title: "Dépôt Stratégique au Coffre (10 000 pts)",
        bossName: "Le Pivot : Validation Drop 20%",
        coords: "[3, 2]",
        travelCommand: "/travel 3 2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        summary: "Remontée impérative au coffre avant l'Étage -5. Le taux de drop du 4e fragment passe de 1% à 20% dès 10 000 points déposés !",
        keyMechanics: [
          {
            label: "ÉCHANGES STRICTEMENT INTERDITS",
            desc: "AUCUN échange entre joueurs n'est possible en raid ! Tout le monde a miné du sel et récolté des drops : TOUT LE MONDE DOIT REMONTER au coffre déposer ses ressources personnelles.",
            danger: true
          },
          {
            label: "SEUIL 10 000 PTS = 20% DROP ACCÉLÉRÉ",
            desc: "Ressources à poser : Mureine (1 000 pts) + Exécrabe (5 000 pts) + filons de sel/minerais (4 000+ pts). Le cap des 10 000 pts est franchi !",
            danger: true
          }
        ],
        strategy: [
          "Suivez la séquence Safe-Travel : [6,10] (raccourci poisson-lanterne) ➔ [4,7] ➔ /travel 2 7 ➔ /travel 3 2.",
          "TOUS les 12 joueurs interagissent avec le coffre et vident leur sacoche de raid.",
          "Vérifiez que le score de raid affiché dépasse bien 10 000 points.",
          "Redescendez ensuite vers l'Étage -5 via la séquence de redescente safe."
        ],
        proTips: [
          "Sans ce dépôt, le fragment 4 drope à 1% : vous risquez de passer 35 minutes sur les Krak'Haine et d'échouer au chrono global !"
        ],
        hasSafeTravelGuide: true
      },
      {
        id: "step-6",
        floor: "Étage -5",
        title: "Ossuaire Abyssal : Farm Krak'Haine",
        bossName: "Collecte du Fragment 4 (Drop 20%)",
        coords: "[10, 14]",
        travelCommand: "/travel 10 14",
        primaryImage: "/images/guides/gigalodon/95-ouverture-raccourci.jpg",
        summary: "Zone d'ossements géants. Grâce aux 10 000 pts déposés, le 4e fragment de clé tombe à 20% sur les monstres Krak'Haine.",
        keyMechanics: [
          {
            label: "PIÈGE MAP [12, 13] : OS MARIN",
            desc: "Sur la carte [12,13], la transition vers la partie inférieure requiert de cliquer sur un os d'animal marin. Ce clic COUPE L'AUTOPILOTE ET L'AUTOFOLLOW ! Reprenez les commandes manuelles.",
            danger: true
          },
          {
            label: "Drop Commun à Toute la Guilde",
            desc: "Le 4e fragment est une altération partagée : dès qu'un combat le valide, tout le raid le débloque instantanément."
          },
          {
            label: "Cage de Plongée en [10, 14]",
            desc: "Dès que les 4 fragments sont acquis, descendez immédiatement à l'Étage -6 via la cage."
          }
        ],
        strategy: [
          "Engagez les packs contenant des Krak'Haine en escouades de 4.",
          "Avec le bonus 20%, le fragment tombe en 1 à 3 combats seulement.",
          "Consultez vos altérations de personnage pour confirmer l'obtention du 'Quatrième fragment de clef'.",
          "Dès validation, regroupez tout le monde en [10,14] et prenez la cage de plongée vers l'Étage -6."
        ],
        proTips: [
          "Gisements de sel de l'étage : [11,14], [12,14], [12,13], [11,13].",
          "Les Krak'Haine repopent très vite : enchaînez sans attendre."
        ]
      },
      {
        id: "step-7",
        floor: "Étage -6",
        title: "Boss 3 : Sombrefond de Willorque",
        bossName: "Willorque (62 000 PV)",
        bossHp: "62 000 PV",
        coords: "[11, 16]",
        travelCommand: "/travel 11 16",
        primaryImage: "/images/guides/gigalodon/103-boss-willorque.jpg",
        secondaryImages: [
          { label: "Panda Cheese : isolement en coin", src: "/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" },
          { label: "Map Willorque dans l'obscurité", src: "/images/guides/gigalodon/108-map-willorque-sombre.jpg" }
        ],
        summary: "Boss enraciné (62 000 PV), SEUL sur la carte [11,16]. Obscurité totale permanente (agression à 10 PO en 5s). ZÉRO monstre, ZÉRO orque spectre.",
        keyMechanics: [
          {
            label: "AGGRO IMMÉDIATE (10 PO / 5 SEC)",
            desc: "Entrez tous groupés et prêts ! Willorque agresse à 10 cases en 5 secondes dans le noir de la map [11,16].",
            danger: true
          },
          {
            label: "PANDA CHEESE : LOIN DES STATUES/LANTERNES",
            desc: "Le Pandawa porte Willorque au Tour 1 et l'isole dans un coin à PLUS DE 3 PO DE TOUTE LANTERNE/STATUE ! Ainsi Willorque ne déclenche aucun Switch et le raid reste hors de son Sombre Chant.",
            danger: true
          },
          {
            label: "Mécanique du Light Count",
            desc: "Willorque invoque 10 Poissons-Lanternes invulnérables (4 allumés au début). Chaque lanterne allumée donne +10% Light Count. À 100%, il perd 20% résistances. Seuil à 43 400 PV (Random Fish : reset à 0%)."
          },
          {
            label: "ZÉRO ORQUE SPECTRE (IGNOREZ LES LANTERNES)",
            desc: "Il n'y a aucun orque spectre ! Ne perdez pas de temps sur les lanternes : focus 100% DPS sur Willorque pour sécuriser la 'Noirceur de Willorque' (+10 000 pts) !"
          }
        ],
        strategy: [
          "Entrez tous prêts sur la carte [11,16] pour contrer l'agression 5 secondes.",
          "Tour 1 : Le Pandawa porte Willorque (il est enraciné mais portable) et le balance dans un angle dégagé, loin des lanternes.",
          "Le Pandawa et un cogneur résistant le bloquent au corps-à-corps.",
          "Le reste du raid reste groupé à mi-distance (hors de Sombre Chant 10 PO) et déchaîne le burst.",
          "Après la victoire : remontez au coffre (-1) déposer la Noirceur de Willorque (10 000 pts) et engager le Gigalodon !"
        ],
        proTips: [
          "Activez 'Afficher les entités au premier plan' dans les options du jeu pour cibler Willorque sans être gêné par le décor.",
          "Willorque est insensible à la mécanique d'Idées Noires : pas de sel à utiliser ici."
        ]
      },
      {
        id: "step-8",
        floor: "Hub -1",
        title: "Combat Ultime : Le Gigalodon",
        bossName: "Gigalodon (Burst 3 Tours)",
        coords: "[3, 2]",
        travelCommand: "/travel 3 2",
        primaryImage: "/images/guides/gigalodon/118-boss-gigalodon.jpg",
        secondaryImages: [
          { label: "Hitbox & Dents de l'Amer", src: "/images/guides/gigalodon/125-glyphe-hitbox-gigalodon.jpg" },
          { label: "Zone d'attrapage (devant la gueule)", src: "/images/guides/gigalodon/127-zone-attrapage-gigalodon.jpg" },
          { label: "Exemple de zones Gigarâle (3 PO)", src: "/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" },
          { label: "Sort Ultrasplash (cônes latéraux)", src: "/images/guides/gigalodon/130-sort-ultrasplash.jpg" },
          { label: "Sort Tournageoire (repousse 7 cases)", src: "/images/guides/gigalodon/129-sort-tournageoire.jpg" }
        ],
        summary: "Phase de burst chronométrée en 3 tours depuis le Coffre (-1). Victoire automatique au T4 via Gigalodoom. But : BURST MAXIMUM pour saturer le score (+15 000 pts max) !",
        keyMechanics: [
          {
            label: "JAMAIS DEVANT LA GUEULE (3 CASES MÊLÉE)",
            desc: "Terminer sur les 3 cases mêlée = avalé par le boss (tour passé). Si un allié marche sur le glyphe noir = MORT DÉFINITIVE (OS) !",
            danger: true
          },
          {
            label: "ESPACEMENT DE 3 CASES ENTRE ALLIÉS",
            desc: "Gigarâle inflige 700 dégâts terre et ricoche sur toute cible à 2 PO ou moins d'un allié ou invo. 3 cases d'écart = AUCUN DÉGÂT !",
            danger: true
          },
          {
            label: "PLACEMENT EN DIAGONALE STRICT",
            desc: "Restez dans ses diagonales pour éviter les cônes d'Ultrasplash et restez loin des berges pour éviter la poussée de 7 cases de Tournageoire."
          }
        ],
        strategy: [
          "Tour 1 : Placement rigoureux en diagonales (3 cases d'écart entre joueurs), pose des gros buffs PA/Puissance/Vulnérabilité (Brassage, Massacre, Transfiguration, Thanathena).",
          "Tour 2 : Déchaînement du burst maximal (Nébuleux T1/T3, sorts à gros ratio de dégâts monocible).",
          "Tour 3 : Dernier round de frappes avant Gigalodoom au début du Tour 4."
        ],
        proTips: [
          "Barème de score bonus : 100k = +5 000 pts · 250k = +9 000 pts · 500k = +12 000 pts · 1M dmg = +15 000 pts (Cap Max).",
          "Les sorts de zone ne tapent qu'une seule fois sur la hitbox : privilégiez le monocible pur.",
          "Le Gigalodon joue deux fois par tour : en début de tour et à la moitié de l'équipe."
        ],
        hasBurstGuide: true
      }
    ],
    safeRoutes: [
      {
        id: "remontee-execrabe",
        title: "Remontée Sécurisée post-Exécrabe",
        subtitle: "Boucle Express vers le Coffre (-1) pour sécuriser >10 000 pts",
        badge: "Pivot Majeur · Drop 20%",
        dangerWarning: "AUCUN échange en raid : TOUS les 12 joueurs doivent remonter au coffre déposer leurs propres reliques et minerais !",
        steps: [
          {
            stepNum: 1,
            label: "Sortie Étage -4",
            coords: "[6, 10]",
            command: "/travel 6 10",
            action: "Depuis la salle du boss ou des statues en [9,11], travel vers [6,10]."
          },
          {
            stepNum: 2,
            label: "Passage Secret (Poisson-Lanterne)",
            coords: "[6, 10]",
            action: "⚠️ BLOCAGE AUTOPILOTE : Le joueur porteur de la Pince d'Exécrabe clique sur le Poisson-Lanterne en [6,10]. Tout le monde traverse le passage vers [4,7] (Étage -2).",
            isBlockPoint: true,
            warning: "L'autopilote s'arrête ici. Seul le joueur détenant la Pince peut ouvrir !"
          },
          {
            stepNum: 3,
            label: "Traversée Étage -2 vers -1",
            coords: "[2, 7]",
            command: "/travel 2 7",
            action: "Depuis [4,7], travel vers [2,7] puis cliquer sur l'accès pour remonter à l'Étage -1."
          },
          {
            stepNum: 4,
            label: "Arrivée au Coffre du Raid",
            coords: "[3, 2]",
            command: "/travel 3 2",
            action: "Depuis [4,3], travel vers [3,2]. Les 12 joueurs déposent TOUTES leurs ressources. Score > 10 000 pts validé !"
          }
        ]
      },
      {
        id: "redescente-krakhaine",
        title: "Redescente Sécurisée vers Krak'Haine (-5)",
        subtitle: "Accès à l'Ossuaire Abyssal pour dropper le 4e Fragment (20%)",
        badge: "Accès Ossuaire",
        dangerWarning: "Attention à la map [12,13] : le clic sur l'os marin casse net l'autopilote et l'autofollow !",
        steps: [
          {
            stepNum: 1,
            label: "Descente vers Étage -2",
            coords: "[4, 3]",
            command: "/travel 4 3",
            action: "Depuis le Coffre [3,2], travel en [4,3] et cliquer sur l'échelle pour descendre à l'Étage -2."
          },
          {
            stepNum: 2,
            label: "Grotte du Raccourci vers -4",
            coords: "[4, 7]",
            command: "/travel 4 7",
            action: "En [4,7], emprunter la grotte du raccourci en bas à droite pour réapparaître directement en [6,10] (Étage -4)."
          },
          {
            stepNum: 3,
            label: "Accès sous le Lac vers -5",
            coords: "[9, 11]",
            command: "/travel 9 11",
            action: "Travel vers [9,11], cliquer sur le petit plan d'eau (statues résolues) puis prendre la sortie en bas à droite vers l'Étage -5."
          },
          {
            stepNum: 4,
            label: "Transition Os Marin",
            coords: "[12, 13]",
            action: "⚠️ BLOCAGE AUTOPILOTE : Sur [12,13], cliquer sur l'os d'animal marin pour descendre. L'autopilotage et l'autofollow se coupent ici !",
            isBlockPoint: true,
            warning: "Reprenez impérativement le contrôle manuel sur cette carte pour éviter les aggros !"
          },
          {
            stepNum: 5,
            label: "Cage de Plongée vers -6",
            coords: "[10, 14]",
            command: "/travel 10 14",
            action: "Farmer les Krak'Haine jusqu'au 4e fragment (20% drop commun). Une fois obtenu, tout le raid prend la cage en [10,14] vers Willorque."
          }
        ]
      },
      {
        id: "remontee-willorque",
        title: "Remontée Post-Willorque vers Gigalodon",
        subtitle: "Dépôt des 10 000 pts de Willorque & Engagement du Combat Final",
        badge: "Phase Finale",
        steps: [
          {
            stepNum: 1,
            label: "Victoire Willorque",
            coords: "[11, 16]",
            action: "Willorque vaincu ➔ Récupération de la 'Noirceur de Willorque' (10 000 pts directs au coffre)."
          },
          {
            stepNum: 2,
            label: "Retour Cage de Plongée",
            coords: "[10, 14]",
            command: "/travel 10 14",
            action: "Reprendre la cage de plongée vers l'Étage -5."
          },
          {
            stepNum: 3,
            label: "Remontée vers le Coffre",
            coords: "[3, 2]",
            command: "/travel 3 2",
            action: "Remonter via le raccourci vers l'Avant-poste [3,2]. Déposer la relique de Willorque et les derniers minerais."
          },
          {
            stepNum: 4,
            label: "Lancement Gigalodon",
            coords: "[3, 2]",
            action: "Parler au Coffre du Raid en [3,2] pour déclencher le combat ultime de 3 tours contre le Gigalodon !"
          }
        ]
      }
    ],
    saltLocations: [
      {
        floor: "Étage -1",
        zoneName: "Avant-poste des Explorateurs",
        luminomachines: [
          { coords: "[3, 2]", command: "/travel 3 2" },
          { coords: "[4, 3]", command: "/travel 4 3" }
        ],
        salts: [
          { coords: "[3, 2]", command: "/travel 3 2" },
          { coords: "[2, 2]", command: "/travel 2 2" },
          { coords: "[4, 2]", command: "/travel 4 2" },
          { coords: "[3, 3]", command: "/travel 3 3" }
        ]
      },
      {
        floor: "Étage -2",
        zoneName: "Plateau de la Mureine",
        luminomachines: [
          { coords: "[4, 5]", command: "/travel 4 5" },
          { coords: "[2, 7]", command: "/travel 2 7" }
        ],
        salts: [
          { coords: "[3, 5]", command: "/travel 3 5" },
          { coords: "[2, 6]", command: "/travel 2 6" },
          { coords: "[4, 6]", command: "/travel 4 6" },
          { coords: "[3, 7]", command: "/travel 3 7" },
          { coords: "[4, 7]", command: "/travel 4 7", note: "2 gisements" },
          { coords: "[5, 9]", command: "/travel 5 9", note: "Passage secret" }
        ]
      },
      {
        floor: "Étage -3",
        zoneName: "Falaise Noyée & Luminarium",
        luminomachines: [
          { coords: "[4, 12]", command: "/travel 4 12" }
        ],
        salts: [
          { coords: "[2, 10]", command: "/travel 2 10" },
          { coords: "[3, 10]", command: "/travel 3 10" },
          { coords: "[1, 11]", command: "/travel 1 11" },
          { coords: "[2, 12]", command: "/travel 2 12" }
        ]
      },
      {
        floor: "Étage -4",
        zoneName: "Terrier d'Exécrabe",
        luminomachines: [
          { coords: "[5, 11]", command: "/travel 5 11" },
          { coords: "[8, 11]", command: "/travel 8 11" }
        ],
        salts: [
          { coords: "[6, 11]", command: "/travel 6 11" },
          { coords: "[7, 10]", command: "/travel 7 10" },
          { coords: "[8, 10]", command: "/travel 8 10", note: "2 gisements" }
        ]
      },
      {
        floor: "Étage -5",
        zoneName: "Ossuaire Abyssal",
        luminomachines: [
          { coords: "[10, 13]", command: "/travel 10 13" },
          { coords: "[10, 14]", command: "/travel 10 14" }
        ],
        salts: [
          { coords: "[11, 14]", command: "/travel 11 14" },
          { coords: "[12, 14]", command: "/travel 12 14" },
          { coords: "[12, 13]", command: "/travel 12 13" },
          { coords: "[11, 13]", command: "/travel 11 13" }
        ]
      }
    ]
  },
  "jardin-eternel": {
    id: "jardin-eternel",
    name: "Jardin Éternel",
    shortName: "Sanctuaire",
    worldId: 40,
    zoneName: "Sanctuaire Végétal · Monde 40",
    badge: "Raid Végétal · Bientôt Disponible",
    themeColor: "#10b981",
    guideUrl: "/guides",
    description: "Le deuxième grand raid de Dofus. Exploration de la canopée et du sanctuaire éternel.",
    steps: [
      {
        id: "sanctuaire-step-1",
        floor: "Niveau 1",
        title: "Entrée du Sanctuaire Végétal",
        bossName: "Portes de la Canopée",
        coords: "[0, 0]",
        travelCommand: "/travel 0 0",
        primaryImage: "/module-dofus/Dofus_Sylvestre.png",
        summary: "Zone d'introduction au raid du Jardin Éternel. Cartographie en cours de reconnaissance.",
        keyMechanics: [
          {
            label: "Cartographie en cours",
            desc: "Ce raid sera documenté en détail dès l'ouverture des premiers paliers sur les serveurs Unity."
          }
        ],
        strategy: [
          "Consultez les annonces de guilde pour les premières sessions de reconnaissance.",
          "Préparez des équipements orientés résistances Terre et Air."
        ],
        proTips: [
          "Basculez sur le raid Gigalodon pour vos sessions actuelles."
        ]
      }
    ]
  }
};
