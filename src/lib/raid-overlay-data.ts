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
  bullets: string[];
  alert?: { label: string; desc: string; danger?: boolean };
  keyMechanics: { label: string; desc: string; danger?: boolean }[];
  strategy: string[];
  proTips: string[];
  hasExecrabePad?: boolean;
  hasBurstGuide?: boolean;
  hasSafeTravelGuide?: boolean;
}

export interface BurstOptiData {
  rules: string[];
  scale: { dmg: string; pts: string; note?: string }[];
  classes: {
    classId: string;
    category: string;
    keySpells: string;
  }[];
  keyItems: { name: string; desc: string }[];
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
  burstOpti?: BurstOptiData;
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
        title: "Camp de base & Minage",
        bossName: "Nettoyage 18 groupes",
        coords: "[3, 2]",
        travelCommand: "/travel 3,2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        secondaryImages: [
          { label: "Gisements de sel marin", src: "/images/guides/gigalodon/27-gisement-sel.jpg" },
          { label: "Luminomachine du camp", src: "/images/guides/gigalodon/18-luminomachine.jpg" }
        ],
        summary: "Camp de base. Scindez le raid en 3 escouades de 4 pour nettoyer les 5 cartes et miner le sel.",
        bullets: [
          "18 groupes en 3 escouades de 4 (pas de repop)",
          "Nettoyer les 5 cartes en parallèle (chrono 60 min)",
          "Minage : 4 filons de sel ([3, 2], [2, 2], [4, 2], [3, 3])",
          "Tous les monstres : drop possible du 1er fragment de clé",
          "Conserver les stocks de sel pour les boss suivants"
        ],
        alert: {
          label: "Palier 10 000 pts au coffre",
          desc: "Le drop du 4e fragment Krak'Haine passe de 1% à 20% dès 10 000 pts déposés !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Palier 10 000 pts au coffre",
            desc: "Le drop du 4e fragment sur les Krak'Haine (-5) passe de 1% à 20% dès 10 000 points déposés au coffre.",
            danger: true
          },
          {
            label: "3 escouades de 4",
            desc: "18 groupes sans repop. Nettoyer les 5 cartes en parallèle pour préserver le chrono global (60 min)."
          },
          {
            label: "1er fragment de clé",
            desc: "Drop commun possible sur n'importe quel monstre de l'étage."
          }
        ],
        strategy: [
          "Scinder le raid en 3 escouades de 4 dès l'entrée.",
          "Miner les 4 filons de sel marin en [3, 2], [2, 2], [4, 2] et [3, 3].",
          "Conserver le sel : la luminomachine démarre déjà au Niveau 4.",
          "Prendre la sortie vers l'étage -2 en [4, 3]."
        ],
        proTips: [
          "Marchande PNJ : vend des potions de soin (aucun échange entre joueurs possible).",
          "Ne tentez pas le succès '100 Sels' lors d'un run de score (nuit noire permanente)."
        ]
      },
      {
        id: "step-2",
        floor: "Étage -2",
        title: "Boss 1 : Mureine des Abysses",
        bossName: "Mureine",
        bossHp: "51 000 PV",
        coords: "[4, 7]",
        travelCommand: "/travel 4,7",
        primaryImage: "/images/guides/gigalodon/46-boss-mureine.jpg",
        secondaryImages: [
          { label: "Technique de blocage en coin", src: "/images/guides/gigalodon/58-placement-blocage-mureine.jpg" },
          { label: "Accès à l'antre (trou central)", src: "/images/guides/gigalodon/44-position-mureine.jpg" }
        ],
        summary: "Anguille colossale (51 000 PV). Accompagnée de 3 monstres normaux : Madrépire, Kokayou et Léviatank.",
        bullets: [
          "Lumière Niveau 4 impérative avant d'engager (sinon 153k PV / +1 000 Pui)",
          "Tuer en priorité les 3 monstres normaux (Madrépire, Kokayou, Léviatank)",
          "Invoque 2 Murares/tour à <10 PO (+100 Pui/invo) · Tuer une Murare purge le poison",
          "Panda blocage : coincer la Mureine en coin derrière ses propres Murares",
          "Victoire = 2e fragment de clé + Unité de Mureine (1 000 pts coffre)"
        ],
        alert: {
          label: "Lumière Niveau 4 obligatoire",
          desc: "Rechargez la Luminomachine en [4, 5] ou [2, 7] au Niv. 4 avant de lancer le combat !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Lumière Niveau 4 obligatoire",
            desc: "Recharger au Niv. 4 en [4, 5] ou [2, 7] avant d'engager, sinon le boss gagne +200% PV (153k PV) et +1 000 Puissance.",
            danger: true
          },
          {
            label: "Tuer les 3 accompagnateurs d'abord",
            desc: "Éliminer Madrépire, Kokayou et Léviatank au T1-T2 pour libérer la vue."
          },
          {
            label: "Invocations Murares",
            desc: "Invoque 2 Murares/tour à <10 PO (+100 Pui). Tuer une Murare purge le poison Corroside à 2 cases."
          }
        ],
        strategy: [
          "Panda blocage : isoler la Mureine dans un angle derrière 2 Murares ou invocations.",
          "DPS distance : rester à > 10 PO pour bloquer son sort Disperssssion.",
          "Éliminer les 3 monstres normaux, puis burst la Mureine.",
          "Descendre vers l'étage -3 via l'accès en [2, 7]."
        ],
        proTips: [
          "Équiper du stuff rési Eau et Terre sur le tank au contact.",
          "Le retrait PM neutralise une grande partie de sa mobilité."
        ]
      },
      {
        id: "step-3",
        floor: "Étage -3",
        title: "Falaise Noyée & Luminarium",
        bossName: "Énigme des Poissons-Lanternes",
        coords: "[4, 12]",
        travelCommand: "/travel 4,12",
        primaryImage: "/images/guides/gigalodon/62-mur-luminarium.jpg",
        secondaryImages: [
          { label: "Méthode d'allumage par cascade", src: "/images/guides/gigalodon/65-methode-solution-luminarium.jpg" }
        ],
        summary: "Grotte du Luminarium. Énigme sur un mur vertical (grille 4×4 de poissons-lanternes). Zéro combat, zone safe.",
        bullets: [
          "Zone 100% safe : aucun monstre, aucun sel à dépenser",
          "1 seul joueur désigné manipule la grille murale (clics simultanés = bug/perte de temps)",
          "Principe Lights Out : chaque clic inverse le poisson et ses 4 voisins",
          "Méthode cascade : cliquer sur la ligne du dessous pour allumer les lampes éteintes du dessus",
          "Dès que le mur s'ouvre, traverser vers l'étage -4"
        ],
        alert: {
          label: "1 seul joueur clique sur le mur",
          desc: "Tous les autres joueurs restent en retrait. Plusieurs clics simultanés désynchronisent la grille !",
          danger: false
        },
        keyMechanics: [
          {
            label: "1 seul joueur manipule le mur",
            desc: "Désigner un seul joueur. Si plusieurs personnes cliquent en même temps, les états s'annulent.",
            danger: true
          },
          {
            label: "Zéro sel dépensé",
            desc: "Zone sans combat : préservez l'intégralité de vos réserves de sel."
          }
        ],
        strategy: [
          "Tous les joueurs en retrait, un seul joueur manipule la grille murale.",
          "Cascade : Ligne 1 éteinte ➔ cliquer Ligne 2.",
          "Ligne 2 éteinte ➔ cliquer Ligne 3 · Ligne 3 ➔ cliquer Ligne 4.",
          "Ajuster les coins de la Ligne 4 pour illuminer l'ensemble.",
          "Traverser vers l'étage -4 dès l'effondrement du mur."
        ],
        proTips: [
          "Consultez l'image de solution intégrée si le schéma est bloqué.",
          "Ne rechargez aucune machine ici : stockez pour Exécrabe et Willorque."
        ]
      },
      {
        id: "step-4",
        floor: "Étage -4",
        title: "Boss 2 : Terrier d'Exécrabe",
        bossName: "Exécrabe",
        bossHp: "4 Formes",
        coords: "[9, 11]",
        travelCommand: "/travel 9,11",
        primaryImage: "/images/guides/gigalodon/71-boss-execrabe.jpg",
        secondaryImages: [
          { label: "Statues de l'énigme sous le lac", src: "/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" },
          { label: "Ouverture du raccourci en [6, 10]", src: "/images/guides/gigalodon/95-ouverture-raccourci.jpg" }
        ],
        summary: "Crustacé massif aux 4 apparences. Mémorisation obligatoire des 4 formes pour activer les statues sous le lac.",
        bullets: [
          "Noter l'ordre des 4 formes élémentaires aux seuils de PV (Coquillage, Oursin, Perle, Poulpe)",
          "Statues sous le lac en [9, 11] : -1 000 pts par erreur (le score peut devenir négatif !)",
          "Lumière Niveau 4 en [8, 11] conseillée (5 monstres accompagnateurs)",
          "Pince d'Exécrabe : drop garanti pour ouvrir le raccourci majeur en [6, 10]",
          "Ne pas descendre en -5 ! Remonter impérativement au coffre déposer les reliques"
        ],
        alert: {
          label: "Noter l'ordre des formes & -1 000 pts/erreur",
          desc: "Notez les 4 formes via le pad ci-dessous. Toute erreur sous le lac en [9, 11] inflige -1 000 points au raid !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Noter l'ordre des 4 formes",
            desc: "Seuils PV : Coquillage (Terre), Oursin (Air), Perle (Feu), Poulpe (Eau). Noter l'ordre avec le pad.",
            danger: true
          },
          {
            label: "Pénalité -1 000 pts par erreur",
            desc: "Cliquer sur une mauvaise statue sous le lac retire 1 000 points au raid !",
            danger: true
          },
          {
            label: "Pince d'Exécrabe",
            desc: "Drop garanti. Permet d'ouvrir le raccourci en [6, 10] vers l'étage -2."
          }
        ],
        strategy: [
          "Éliminer les 5 monstres d'accompagnement en retirant les PM d'Exécrabe.",
          "Noter l'ordre des formes au fur et à mesure avec notre pad.",
          "Après victoire : cliquer sur l'eau en [9, 11] et activer les 4 statues dans l'ordre.",
          "Le joueur détenant la Pince clique sur le poisson-lanterne en [6, 10] pour ouvrir le raccourci.",
          "Remonter au coffre déposer les trésors (ne descendez pas en -5 !)."
        ],
        proTips: [
          "L'Exécrabe n'a que 64 Esquive PM : le retrait PM le neutralise complètement.",
          "Les statues au bord de la map de combat s'illuminent en bleu à chaque palier."
        ],
        hasExecrabePad: true
      },
      {
        id: "step-5",
        floor: "Étage -1",
        title: "Dépôt Stratégique au Coffre",
        bossName: "Validation Palier 10k",
        coords: "[3, 2]",
        travelCommand: "/travel 3,2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        summary: "Remontée impérative au coffre avant l'étage -5. Le drop du 4e fragment passe de 1% à 20% dès 10 000 points !",
        bullets: [
          "Échanges impossibles en raid : les 12 joueurs doivent remonter au coffre vider leur sacoche",
          "Ressources à poser : Mureine (1k) + Exécrabe (5k) + sel/minerais (4k+) = >10 000 pts",
          "Passage du drop du 4e fragment de 1% à 20% sur les Krak'Haine (-5)",
          "Itinéraire safe : [6, 10] ➔ [4, 7] ➔ /travel 2,7 ➔ /travel 3,2",
          "Redescendre vers l'étage -5 une fois le palier 10 000 validé"
        ],
        alert: {
          label: "12 joueurs doivent déposer au coffre",
          desc: "Aucun échange possible entre joueurs ! Sans ce dépôt, le fragment 4 drope à 1% au lieu de 20%.",
          danger: true
        },
        keyMechanics: [
          {
            label: "Échanges strictement impossibles",
            desc: "Aucun échange entre joueurs. Tous les membres doivent déposer leurs propres récoltes au coffre.",
            danger: true
          },
          {
            label: "Seuil 10 000 pts = drop 20%",
            desc: "Fait bondir le taux de drop du 4e fragment de 1% à 20% sur les Krak'Haine.",
            danger: true
          }
        ],
        strategy: [
          "Emprunter le raccourci en [6, 10] ➔ [4, 7] ➔ /travel 2,7 ➔ /travel 3,2.",
          "Les 12 joueurs cliquent sur le coffre et déposent toutes leurs ressources.",
          "Vérifier dans l'interface que le score dépasse bien 10 000 points.",
          "Redescendre vers l'étage -5 via le raccourci."
        ],
        proTips: [
          "Sans ce palier, vous risquez d'épuiser le chrono de 60 min sur les Krak'Haine.",
          "Pensez à racheter des potions à la marchande PNJ si nécessaire."
        ],
        hasSafeTravelGuide: true
      },
      {
        id: "step-6",
        floor: "Étage -5",
        title: "Ossuaire Abyssal : Krak'Haine",
        bossName: "Collecte Fragment 4",
        coords: "[10, 14]",
        travelCommand: "/travel 10,14",
        primaryImage: "/images/guides/gigalodon/95-ouverture-raccourci.jpg",
        summary: "Zone d'ossements géants. Grâce aux 10 000 pts déposés, le 4e fragment tombe à 20% sur les Krak'Haine.",
        bullets: [
          "Farmer les packs avec Krak'Haine en escouades de 4 (drop en 1 à 3 combats)",
          "Drop partagé : dès qu'un combat le valide, tout le raid débloque le fragment",
          "Piège map [12, 13] : le clic sur l'os marin coupe net l'autopilote et l'autofollow !",
          "Dès l'obtention des 4 fragments : regrouper tout le monde en [10, 14]",
          "Prendre la cage de plongée en [10, 14] vers l'étage -6"
        ],
        alert: {
          label: "Piège map [12, 13] : coupure autopilote",
          desc: "Sur [12, 13], cliquer sur l'os marin désactive l'autopilote et l'autofollow ! Reprendre en manuel.",
          danger: true
        },
        keyMechanics: [
          {
            label: "Map [12, 13] : os marin",
            desc: "La transition coupe l'autopilote et l'autofollow. Reprendre les commandes manuelles.",
            danger: true
          },
          {
            label: "Drop partagé",
            desc: "Dès validation du combat, le fragment s'ajoute pour les 12 joueurs."
          }
        ],
        strategy: [
          "Engager les packs avec Krak'Haine en groupes de 4.",
          "Vérifier l'altération de personnage 'Quatrième fragment de clef'.",
          "Regrouper le raid en [10, 14] dès validation.",
          "Prendre la cage de plongée vers l'étage -6."
        ],
        proTips: [
          "Gisements de sel : [11, 14], [12, 14], [12, 13], [11, 13].",
          "Les Krak'Haine repopent très vite : enchaînez sans attendre."
        ]
      },
      {
        id: "step-7",
        floor: "Étage -6",
        title: "Boss 3 : Sombrefond de Willorque",
        bossName: "Willorque",
        bossHp: "62 000 PV",
        coords: "[11, 16]",
        travelCommand: "/travel 11,16",
        primaryImage: "/images/guides/gigalodon/103-boss-willorque.jpg",
        secondaryImages: [
          { label: "Panda Cheese : isolement en coin", src: "/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" },
          { label: "Map Willorque dans l'obscurité", src: "/images/guides/gigalodon/108-map-willorque-sombre.jpg" }
        ],
        summary: "Boss enraciné (62 000 PV), SEUL sur la carte [11, 16]. Obscurité totale permanente. Zéro monstre, zéro orque spectre.",
        bullets: [
          "Aggro immédiate à 10 PO en 5 secondes dans le noir (entrer groupés et prêts)",
          "Boss seul sur la map : 0 monstre, 0 orque spectre, 10 lanternes invulnérables",
          "Panda Cheese : porter Willorque T1 et l'isoler à > 3 PO de toute lanterne/statue",
          "Isolé en coin, Willorque ne déclenche aucun Switch et le raid reste hors de Sombre Chant",
          "Focus 100% DPS sur le boss (ignorer les lanternes) ➔ Relique +10 000 pts"
        ],
        alert: {
          label: "Panda Cheese : isoler Willorque en coin",
          desc: "Porter Willorque T1 et le placer à plus de 3 PO de toute lanterne/statue pour neutraliser ses sorts !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Aggro immédiate (10 PO / 5 sec)",
            desc: "Entrer tous groupés et prêts ! Willorque agresse à 10 cases en 5s dans le noir.",
            danger: true
          },
          {
            label: "Panda Cheese : loin des statues",
            desc: "Isoler Willorque à plus de 3 PO de toute lanterne : annule ses Switchs et neutralise Sombre Chant.",
            danger: true
          },
          {
            label: "Zéro orque spectre (focus boss)",
            desc: "Ignorer les 10 lanternes : focus 100% DPS sur Willorque (+10 000 pts de relique au coffre)."
          }
        ],
        strategy: [
          "Entrer prêts sur la carte [11, 16] pour contrer l'agression immédiate.",
          "Tour 1 : Le Pandawa porte Willorque et le bloque dans un coin dégagé loin des lanternes.",
          "Tank au contact, reste du raid à mi-distance (hors de Sombre Chant 10 PO).",
          "Après victoire : remonter au coffre (-1) poser la relique (+10 000 pts) et engager le Gigalodon !"
        ],
        proTips: [
          "Option du jeu : 'Afficher les entités au premier plan' pour cibler Willorque facilement.",
          "Insensible aux Idées Noires : aucun sel requis dans ce combat."
        ]
      },
      {
        id: "step-8",
        floor: "Hub -1",
        title: "Combat Ultime : Le Gigalodon",
        bossName: "Gigalodon (Burst 3 Tours)",
        coords: "[3, 2]",
        travelCommand: "/travel 3,2",
        primaryImage: "/images/guides/gigalodon/118-boss-gigalodon.jpg",
        secondaryImages: [
          { label: "Hitbox & Dents de l'Amer", src: "/images/guides/gigalodon/125-glyphe-hitbox-gigalodon.jpg" },
          { label: "Zone d'attrapage (devant la gueule)", src: "/images/guides/gigalodon/127-zone-attrapage-gigalodon.jpg" },
          { label: "Exemple de zones Gigarâle (3 PO)", src: "/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" },
          { label: "Sort Ultrasplash (cônes latéraux)", src: "/images/guides/gigalodon/130-sort-ultrasplash.jpg" },
          { label: "Sort Tournageoire (repousse 7 cases)", src: "/images/guides/gigalodon/129-sort-tournageoire.jpg" }
        ],
        summary: "Phase de burst chronométrée en 3 tours depuis le coffre (-1). Victoire automatique au T4 via Gigalodoom. But : burst max pour saturer le score (+15 000 pts) !",
        bullets: [
          "3 tours de jeu seulement : fin automatique et victoire au T4 via Gigalodoom",
          "Jamais sur les 3 cases devant la gueule : avalé + glyphe noir = OS si un allié marche dessus",
          "Placement en diagonales strict : esquive les cônes d'Ultrasplash et la poussée de Tournageoire",
          "3 cases d'écart minimum entre chaque allié : Gigarâle ricoche à 2 PO (700 dmg terre)",
          "Privilégier le monocible pur : les sorts de zone ne tapent qu'une seule fois sur la hitbox"
        ],
        alert: {
          label: "3 règles vitales de survie",
          desc: "Diagonales strictes · 3 cases d'écart entre alliés · Jamais devant la gueule (glyphe noir = OS).",
          danger: true
        },
        keyMechanics: [
          {
            label: "Jamais devant la gueule",
            desc: "Terminer sur les 3 cases mêlée = avalé. Marcher sur le glyphe noir = mort définitive (OS).",
            danger: true
          },
          {
            label: "3 cases d'écart entre alliés",
            desc: "Gigarâle inflige 700 dmg terre et ricoche à 2 PO. 3 cases d'écart = 0 dégât.",
            danger: true
          },
          {
            label: "Placement en diagonales",
            desc: "Esquive les cônes d'eau et évite la projection de 7 cases contre les berges."
          }
        ],
        strategy: [
          "T1 : Placement en diagonales, pose des buffs PA/Puissance/Vulné (Brassage, Massacre, Thanathena).",
          "T2 : Burst maximal monocible (Nébuleux, gros sorts).",
          "T3 : Dernier round de frappes avant Gigalodoom au début du T4."
        ],
        proTips: [
          "Le boss joue 2 fois par tour : en début de tour et au milieu du groupe.",
          "Les sorts de zone ne touchent qu'une seule fois : privilégier le monocible pur."
        ],
        hasBurstGuide: true
      }
    ],
    safeRoutes: [
      {
        id: "remontee-execrabe",
        title: "Remontée post-Exécrabe",
        subtitle: "Boucle vers le coffre (-1) pour valider le palier > 10 000 pts",
        badge: "Pivot Majeur · Drop 20%",
        dangerWarning: "Aucun échange possible : les 12 joueurs doivent remonter au coffre déposer leurs ressources !",
        steps: [
          {
            stepNum: 1,
            label: "Sortie Étage -4",
            coords: "[6, 10]",
            command: "/travel 6,10",
            action: "Depuis la salle du boss ou des statues en [9, 11], travel vers [6, 10]."
          },
          {
            stepNum: 2,
            label: "Passage Secret (Poisson-Lanterne)",
            coords: "[6, 10]",
            command: "/travel 6,10",
            action: "Le joueur avec la Pince clique sur le poisson-lanterne en [6, 10]. Tout le monde traverse vers [4, 7] (-2).",
            isBlockPoint: true,
            warning: "Coupure autopilote : seul le joueur porteur de la Pince d'Exécrabe peut ouvrir !"
          },
          {
            stepNum: 3,
            label: "Traversée Étage -2 vers -1",
            coords: "[2, 7]",
            command: "/travel 2,7",
            action: "Depuis [4, 7], travel vers [2, 7] puis cliquer sur l'accès pour remonter à l'étage -1."
          },
          {
            stepNum: 4,
            label: "Arrivée au Coffre du Raid",
            coords: "[3, 2]",
            command: "/travel 3,2",
            action: "Depuis [4, 3], travel vers [3, 2]. Les 12 joueurs vident leur sacoche au coffre (>10 000 pts validés)."
          }
        ]
      },
      {
        id: "redescente-krakhaine",
        title: "Redescente vers Krak'Haine (-5)",
        subtitle: "Accès à l'Ossuaire Abyssal pour dropper le 4e Fragment (20%)",
        badge: "Accès Ossuaire",
        dangerWarning: "Attention sur [12, 13] : le clic sur l'os marin casse net l'autopilote et l'autofollow !",
        steps: [
          {
            stepNum: 1,
            label: "Descente vers Étage -2",
            coords: "[4, 3]",
            command: "/travel 4,3",
            action: "Depuis le coffre [3, 2], travel en [4, 3] et descendre par l'échelle vers l'étage -2."
          },
          {
            stepNum: 2,
            label: "Grotte du Raccourci vers -4",
            coords: "[4, 7]",
            command: "/travel 4,7",
            action: "En [4, 7], emprunter la grotte en bas à droite pour réapparaître directement en [6, 10] (-4)."
          },
          {
            stepNum: 3,
            label: "Accès sous le Lac vers -5",
            coords: "[9, 11]",
            command: "/travel 9,11",
            action: "Travel vers [9, 11], cliquer sur l'eau (statues résolues) puis sortie bas droite vers -5."
          },
          {
            stepNum: 4,
            label: "Transition Os Marin",
            coords: "[12, 13]",
            command: "/travel 12,13",
            action: "Sur [12, 13], cliquer sur l'os marin pour descendre. L'autopilotage se coupe ici !",
            isBlockPoint: true,
            warning: "Reprenez le contrôle manuel sur cette carte pour éviter les aggros !"
          },
          {
            stepNum: 5,
            label: "Cage de Plongée vers -6",
            coords: "[10, 14]",
            command: "/travel 10,14",
            action: "Farmer les Krak'Haine jusqu'au 4e fragment (20%). Puis tout le raid prend la cage en [10, 14]."
          }
        ]
      },
      {
        id: "remontee-willorque",
        title: "Remontée Post-Willorque",
        subtitle: "Dépôt des 10 000 pts de Willorque & Engagement du Combat Final",
        badge: "Phase Finale",
        steps: [
          {
            stepNum: 1,
            label: "Victoire Willorque",
            coords: "[11, 16]",
            command: "/travel 11,16",
            action: "Willorque vaincu ➔ Obtention de la 'Noirceur de Willorque' (+10 000 pts au coffre)."
          },
          {
            stepNum: 2,
            label: "Retour Cage de Plongée",
            coords: "[10, 14]",
            command: "/travel 10,14",
            action: "Reprendre la cage de plongée vers l'étage -5."
          },
          {
            stepNum: 3,
            label: "Remontée vers le Coffre",
            coords: "[3, 2]",
            command: "/travel 3,2",
            action: "Remonter via le raccourci vers [3, 2]. Déposer la relique de Willorque."
          },
          {
            stepNum: 4,
            label: "Lancement Gigalodon",
            coords: "[3, 2]",
            command: "/travel 3,2",
            action: "Parler au coffre en [3, 2] pour déclencher le combat de 3 tours contre le Gigalodon !"
          }
        ]
      }
    ],
    saltLocations: [
      {
        floor: "Étage -1",
        zoneName: "Avant-poste des Explorateurs",
        luminomachines: [
          { coords: "[3, 2]", command: "/travel 3,2" },
          { coords: "[4, 3]", command: "/travel 4,3" }
        ],
        salts: [
          { coords: "[3, 2]", command: "/travel 3,2" },
          { coords: "[2, 2]", command: "/travel 2,2" },
          { coords: "[4, 2]", command: "/travel 4,2" },
          { coords: "[3, 3]", command: "/travel 3,3" }
        ]
      },
      {
        floor: "Étage -2",
        zoneName: "Plateau de la Mureine",
        luminomachines: [
          { coords: "[4, 5]", command: "/travel 4,5" },
          { coords: "[2, 7]", command: "/travel 2,7" }
        ],
        salts: [
          { coords: "[3, 5]", command: "/travel 3,5" },
          { coords: "[2, 6]", command: "/travel 2,6" },
          { coords: "[4, 6]", command: "/travel 4,6" },
          { coords: "[3, 7]", command: "/travel 3,7" },
          { coords: "[4, 7]", command: "/travel 4,7", note: "2 filons" },
          { coords: "[5, 9]", command: "/travel 5,9", note: "Passage secret" }
        ]
      },
      {
        floor: "Étage -3",
        zoneName: "Falaise Noyée & Luminarium",
        luminomachines: [
          { coords: "[4, 12]", command: "/travel 4,12" }
        ],
        salts: [
          { coords: "[2, 10]", command: "/travel 2,10" },
          { coords: "[3, 10]", command: "/travel 3,10" },
          { coords: "[1, 11]", command: "/travel 1,11" },
          { coords: "[2, 12]", command: "/travel 2,12" }
        ]
      },
      {
        floor: "Étage -4",
        zoneName: "Terrier d'Exécrabe",
        luminomachines: [
          { coords: "[5, 11]", command: "/travel 5,11" },
          { coords: "[8, 11]", command: "/travel 8,11" }
        ],
        salts: [
          { coords: "[6, 11]", command: "/travel 6,11" },
          { coords: "[7, 10]", command: "/travel 7,10" },
          { coords: "[8, 10]", command: "/travel 8,10", note: "2 filons" }
        ]
      },
      {
        floor: "Étage -5",
        zoneName: "Ossuaire Abyssal",
        luminomachines: [
          { coords: "[10, 13]", command: "/travel 10,13" },
          { coords: "[10, 14]", command: "/travel 10,14" }
        ],
        salts: [
          { coords: "[11, 14]", command: "/travel 11,14" },
          { coords: "[12, 14]", command: "/travel 12,14" },
          { coords: "[12, 13]", command: "/travel 12,13" },
          { coords: "[11, 13]", command: "/travel 11,13" }
        ]
      }
    ],
    burstOpti: {
      rules: [
        "Diagonales strictes : esquive cônes Ultrasplash & repousse 7 cases de Tournageoire",
        "3 cases d'écart entre alliés : Gigarâle ricoche à 2 PO (700 dégâts terre)",
        "0 joueur devant la gueule : les 3 cases mêlée posent un glyphe noir (OS définitif si marché)",
        "Monocible pur : les sorts de zone ne tapent qu'une seule fois sur la hitbox"
      ],
      scale: [
        { dmg: "100 000 dmg", pts: "+5 000 pts", note: "Découverte" },
        { dmg: "250 000 dmg", pts: "+9 000 pts", note: "Bonne coordination" },
        { dmg: "500 000 dmg", pts: "+12 000 pts", note: "Compo optimisée" },
        { dmg: "1 000 000 dmg", pts: "+15 000 pts", note: "Cap Max atteint" }
      ],
      classes: [
        {
          classId: "pandawa",
          category: "Noyau incontournable",
          keySpells: "Brassage, Vulnérabilité, portage & placement CaC"
        },
        {
          classId: "iop",
          category: "Noyau incontournable",
          keySpells: "Massacre, Colère T3 synchronisée, Puissance"
        },
        {
          classId: "eliotrope",
          category: "Noyau incontournable",
          keySpells: "Réseau 4 portails, amplification max des dégâts"
        },
        {
          classId: "huppermage",
          category: "Top DPS monocible",
          keySpells: "Volcan Terre/Feu, Cycle Élémentaire (baisse rési)"
        },
        {
          classId: "roublard",
          category: "Top DPS monocible",
          keySpells: "Mur de bombes, Poudre & Rebours T3 sous portails"
        },
        {
          classId: "cra",
          category: "Top DPS monocible",
          keySpells: "Balise, Flèches Destructrice & Emplie"
        },
        {
          classId: "sram",
          category: "Amplificateurs & Boosts",
          keySpells: "Marque Mortuaire (+20% subis), Coupe-Gorge"
        },
        {
          classId: "zobal",
          category: "Amplificateurs & Boosts",
          keySpells: "Transfiguration, Masque Psychopathe, Furia"
        },
        {
          classId: "ouginak",
          category: "Amplificateurs & Boosts",
          keySpells: "Gibier, Acharnement (+dégâts finaux)"
        }
      ],
      keyItems: [
        {
          name: "Dofus Nébuleux",
          desc: "Burst synchro T1 (tour impair +20%) et T3 (+20% dégâts finaux)"
        },
        {
          name: "Jugement de Thanathena",
          desc: "Arme légendaire : +4% dégâts subis cumulables par frappe"
        },
        {
          name: "Trophées Arcaniste / Impétueux",
          desc: "Concentration des stats mono-élément pour les DPS principaux"
        }
      ]
    }
  },
  "jardin-eternel": {
    id: "jardin-eternel",
    name: "Sanctuaire des Jardins Éternels",
    shortName: "Sanctuaire",
    worldId: 40,
    zoneName: "Sanctuaire des Jardins Éternels",
    badge: "Raid 16 Joueurs · 20 PV",
    themeColor: "#10b981",
    guideUrl: "/guides/raid-sanctuaire-jardins-eternels-dofus-guide",
    description: "Raid collaboratif à 20 PV partagés : 4 énigmes interconnectées, 4 gardiens, corridor 60 combats solo et double boss Reine Écarlate & Princesse Maudite.",
    steps: [
      {
        id: "sanctuaire-step-1",
        floor: "Aile 1",
        title: "Réserve de Belladone & Bataille Navale",
        bossName: "Énigme des 6 Bateaux",
        coords: "[19, 15]",
        travelCommand: "/travel 19,15",
        primaryImage: "/images/guides/sanctuaire/018-26bataille.jpg",
        summary: "Bataille navale sur 2 cartes [19, 15] et [21, 17]. 1 joueur dans l'Ouvrage révèle les 6 bateaux, les tireurs coordonnent les boulets.",
        bullets: [
          "1 joueur dans l'Ouvrage clique sur les 6 bateaux en papier",
          "2 joueurs sur les grilles maritimes en [19, 15] et [21, 17]",
          "La carte [21, 17] commence la séquence de tir",
          "Combiner lettre (A à D) et chiffre (1 à 3) pour faire feu",
          "Couler les 3 bateaux sur chaque carte (6 au total)",
          "+2 000 points et éveil du Défenseur de la Réserve"
        ],
        alert: {
          label: "Coordination des tirs",
          desc: "Chaque tir réussi allume une coordonnée adverse. Coordonnez vos tirs sans gaspiller de tour !",
          danger: false
        },
        keyMechanics: [
          {
            label: "Grilles 4x3 jumelles",
            desc: "Deux cartes nautiques connectées où chaque position de navire doit être neutralisée."
          }
        ],
        strategy: [
          "Utilisez l'outil Bateaux dans l'onglet Énigmes pour noter instantanément les 6 navires.",
          "Annoncez vos coordonnées en vocal ou via le canal groupe."
        ],
        proTips: [
          "Les coordonnées des bateaux changent à chaque nouvelle instance de raid."
        ]
      },
      {
        id: "sanctuaire-step-2",
        floor: "Aile 2",
        title: "Cour d'Éphèdre & L'Échiquier",
        bossName: "Énigme des 4 Pièces",
        coords: "[12, 14]",
        travelCommand: "/travel 12,14",
        primaryImage: "/images/guides/sanctuaire/108-93tour.jpg",
        summary: "Noter les 4 pièces illuminées en vert dans la Réserve (grille A1..K11), puis engager le combat d'échecs à 4 joueurs en Cour d'Éphèdre.",
        bullets: [
          "Parler à Belladone en Cour d'Éphèdre [12, 14]",
          "Relever les 4 pièces illuminées en vert dans la Réserve",
          "Noter les cases exactes (Tour B., Tour N., Fou B., Fou N.)",
          "Engager le combat d'échecs à 4 joueurs en Cour d'Éphèdre",
          "Positionner ses personnages sur les cases identiques aux pièces",
          "+2 000 points et éveil de la Sentinelle de la Cour"
        ],
        alert: {
          label: "Précision des cases",
          desc: "Une erreur de case déduit 1 PV au compteur de raid (20 PV max). Vérifiez bien vos lettres et chiffres.",
          danger: true
        },
        keyMechanics: [
          {
            label: "Grille d'échecs 11x11",
            desc: "De A1 à K11. Chaque personnage doit reproduire la case de la pièce correspondante."
          }
        ],
        strategy: [
          "Renseignez les 4 coordonnées dans l'outil Échecs de l'overlay avant de lancer le combat."
        ],
        proTips: [
          "Attribuez une pièce précise à chaque joueur du quatuor pour éviter les confusions."
        ]
      },
      {
        id: "sanctuaire-step-3",
        floor: "Aile 3",
        title: "Ouvrage Monochrome & Piédestaux",
        bossName: "Énigme des Fleurs en Papier",
        coords: "[11, 21]",
        travelCommand: "/travel 11,21",
        primaryImage: "/images/guides/sanctuaire/153-123fleurcamp.jpg",
        summary: "Relever les 2 objets sur chaque stèle I à IV dans le Clos, puis activer les 4 fleurs associées dans l'Ouvrage pour débloquer la couleur.",
        bullets: [
          "Examiner les piédestaux I à IV en [11, 21] et [12, 20] dans le Clos",
          "Noter les 2 objets par piédestal (8 objets au total)",
          "Dans l'Ouvrage, activer les fleurs associées aux objets clés",
          "Renseigner la couleur finale obtenue (Orange, Bleu, Rouge, Vert)",
          "+2 000 points et éveil du Veilleur de l'Ouvrage"
        ],
        alert: {
          label: "Couleur finale indispensable",
          desc: "Notez précieusement la couleur obtenue : elle est la clé absolue de l'énigme des Statues !",
          danger: false
        },
        keyMechanics: [
          {
            label: "8 objets et 4 piédestaux",
            desc: "Crayons, Bobine, Lanterne, Kamas, Arakne, Bougie, Bague, Règle."
          }
        ],
        strategy: [
          "Cochez les objets dans l'outil Objets de l'overlay au fur et à mesure de votre passage."
        ],
        proTips: [
          "Un joueur rapide peut relever les 4 stèles en moins de 90 secondes."
        ]
      },
      {
        id: "sanctuaire-step-4",
        floor: "Aile 4",
        title: "Clos des Protecteurs & Statues",
        bossName: "Énigme de la Miniature",
        coords: "[11, 19]",
        travelCommand: "/travel 11,19",
        primaryImage: "/images/guides/sanctuaire/157-133statues.jpg",
        summary: "Comparer les 4 vues du Clos à la miniature d'Éphèdre. Identifier la statue apparue et la couleur pour localiser le protecteur cible.",
        bullets: [
          "Comparer les 4 vues (Haut, Bas, Gauche, Droite) Clos vs Éphèdre",
          "Identifier la statue de monstre apparue au centre",
          "Sélectionner la statue et la couleur dans le solveur de l'overlay",
          "Rejoindre la coordonnée calculée et se tourner dans la bonne direction",
          "Éliminer le protecteur pour valider l'énigme (+2 000 pts)",
          "Éveil du Gardien du Clos"
        ],
        alert: {
          label: "Orientation sur la stèle",
          desc: "Placez-vous sur la dalle indiquée et orientez votre regard dans la direction de la flèche.",
          danger: true
        },
        keyMechanics: [
          {
            label: "4 Protecteurs possibles",
            desc: "Fracamélia, Tritulipe, Muguégide ou Dahliane selon la table de vérité."
          }
        ],
        strategy: [
          "L'outil Statues de l'overlay calcule instantanément la position et fournit le bouton /travel cliquable."
        ],
        proTips: [
          "Une fois les 4 énigmes résolues, éliminez les 4 gardiens pour accumuler 20 000 points."
        ]
      },
      {
        id: "sanctuaire-step-5",
        floor: "Château",
        title: "Le Corridor du Château (60 Combats)",
        bossName: "Épreuve des Protecteurs",
        coords: "[14, 18]",
        travelCommand: "/travel 14,18",
        primaryImage: "/images/guides/sanctuaire/106-87monstres.jpg",
        summary: "10 salles de 6 monstres en combat strictement solo. Initiative 2 601+ obligatoire et fin de tour à 4 PO ou moins sans LDV.",
        bullets: [
          "Combat strictement individuel (compagnons désactivés)",
          "Équiper un trophée Initiative : atteindre 2 601+ pour jouer premier",
          "Terminer son tour à 4 PO ou moins du monstre",
          "À > 4 PO sans obstacle : le monstre gagne 100% crit et dégâts doublés",
          "Chaque défaite déduit 1 PV au compteur de raid (20 PV max)",
          "Nettoyer les 60 monstres pour déverrouiller l'accès aux deux boss"
        ],
        alert: {
          label: "Initiative 2 601+ obligatoire",
          desc: "Sans initiative, les monstres peuvent vous one-shot dès le T1. Équipez un trophée Initiative !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Passif Férocité des Protecteurs",
            desc: "À plus de 4 PO avec vue dégagée, le monstre frappe avec des dégâts dévastateurs."
          }
        ],
        strategy: [
          "Posez une invocation statique devant vous pour couper la ligne de vue si vous ne pouvez pas vous rapprocher.",
          "Prenez des classes à forte régénération ou burst T1."
        ],
        proTips: [
          "Tous les membres peuvent combattre en parallèle dans des salles différentes pour aller 4x plus vite."
        ]
      },
      {
        id: "sanctuaire-step-6",
        floor: "Cryptes",
        title: "Boss 1 : La Reine Écarlate",
        bossName: "Reine Écarlate (50 000 PV)",
        coords: "[16, 20]",
        travelCommand: "/travel 16,20",
        primaryImage: "/images/guides/sanctuaire/110-95reine.jpg",
        summary: "Affrontement à 8 joueurs. Libérer les cachots via le Floracle (5k HP), protéger les Évadés du CaC de la Reine et détruire Pommeau/Lame.",
        bullets: [
          "Départ en duos dans 4 cachots : tuer les monstres liés pour ouvrir",
          "Exil Impérial : frapper le Floracle (5 000 dégâts) pour libérer l'allié",
          "État Évadé : maintenir la Reine à distance pendant 1 tour (OS au CaC)",
          "Châtiment Royal : libérer tous les cachots avant la fin du décompte de 2 tours",
          "Phase 2 (1 PV) : éliminer d'abord la Volonté de la Princesse (30 000 PV)",
          "Détruire le Pommeau Enraciné et la Lame Fleurie pour dissiper l'invulnérabilité",
          "Achever la Reine Écarlate (+10 000 points de raid)"
        ],
        alert: {
          label: "Danger mortel : Exécution de l'Évadé",
          desc: "Tout joueur qui sort du cachot porte l'état Évadé : si la Reine le touche au CaC, il subit plus de 3 000 dégâts !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Libération par Floracle",
            desc: "Le Floracle subit +100% de dégâts : détruisez-le immédiatement dès qu'un allié est capturé."
          }
        ],
        strategy: [
          "Le Pandawa doit tacler ou repousser la Reine en continu loin des cachots.",
          "Concentrez les attaques lourdes sur la Volonté de la Princesse dès le début de la Phase 2."
        ],
        proTips: [
          "Prévoyez des sorts de poussée ou de pesanteur pour empêcher la Reine d'atteindre les évadés."
        ]
      },
      {
        id: "sanctuaire-step-7",
        floor: "Sommet",
        title: "Boss 2 : La Princesse Maudite",
        bossName: "Princesse Maudite (50 000 PV)",
        coords: "[18, 22]",
        travelCommand: "/travel 18,22",
        primaryImage: "/images/guides/sanctuaire/152-123fleur.jpg",
        summary: "Invulnérable en mêlée permanente. Utiliser la Fleur Maudite, esquiver la statufication LDV et délock avec 2 Incantations Florales.",
        bullets: [
          "Invulnérabilité en mêlée permanente : frappes à distance exclusivement",
          "Fleur Maudite (10k HP) : tomber à 1 PV pour obtenir +300 Puissance & soins",
          "Tour 2+ : ne jamais être en ligne de vue de la Princesse (Statue = OS au T+1)",
          "Phase 2 : tuer la Volonté de la Reine (30k HP) pour stopper Lien Familial",
          "Passer dans les 2 glyphes de la Fleur pour lancer Incantation Florale x2",
          "Tempête Florale soigne de 10 000 PV : appliquer Insoignable ou Leçon de Grunob",
          "Finir la Princesse à distance pour sécuriser les 50 000 points du raid !"
        ],
        alert: {
          label: "Statufication = Mort instantanée",
          desc: "Être en vue directe de la Princesse au début de son tour vous pétrifie. Mort au tour suivant sans libération alliée !",
          danger: true
        },
        keyMechanics: [
          {
            label: "Double Incantation Florale",
            desc: "Nécessite 2 passages dans les glyphes violets posés par la Fleur dans le camp ennemi pour retirer l'invulnérabilité."
          }
        ],
        strategy: [
          "Placez des invocations ou cachez-vous derrière les piliers pour briser la ligne de vue de la Princesse.",
          "Un joueur avec grande mobilité (Crâ, Eliotrope, Huppermage) prend les glyphes pour debuff."
        ],
        proTips: [
          "Tempête Florale se déclenche après 6 incréments de Floraison : préparez vos protections et réductions de soins."
        ]
      }
    ],
    safeRoutes: [
      {
        id: "ailes-sanctuaire",
        title: "Navigation des 4 Ailes",
        subtitle: "Liaisons entre les 4 salles d'énigmes et le château central",
        badge: "Parcours Énigmes",
        dangerWarning: "Chaque échec ou défaite en combat retire 1 PV au compteur de raid !",
        steps: [
          {
            stepNum: 1,
            label: "Cour Centrale",
            coords: "[10, 15]",
            command: "/travel 10,15",
            action: "Carrefour principal reliant les 4 ailes du Sanctuaire des Jardins Éternels."
          },
          {
            stepNum: 2,
            label: "Réserve de Belladone",
            coords: "[19, 15]",
            command: "/travel 19,15",
            action: "Accès à la Bataille Navale et aux échiquiers de reconnaissance."
          },
          {
            stepNum: 3,
            label: "Cour d'Éphèdre",
            coords: "[12, 14]",
            command: "/travel 12,14",
            action: "Salle du grand échiquier et des miniatures de jardins."
          },
          {
            stepNum: 4,
            label: "Ouvrage Monochrome",
            coords: "[11, 21]",
            command: "/travel 11,21",
            action: "Salle des fleurs en papier et des 6 bateaux révélateurs."
          },
          {
            stepNum: 5,
            label: "Clos des Protecteurs",
            coords: "[11, 19]",
            command: "/travel 11,19",
            action: "Jardin des stèles et comparaison des statues."
          }
        ]
      },
      {
        id: "chateau-boss",
        title: "Accès au Château & Salles de Boss",
        subtitle: "Traversée du Corridor aux 60 combats vers la Reine et la Princesse",
        badge: "Accès Boss",
        dangerWarning: "Initiative 2 601+ obligatoire dans le corridor. Les combats sont strictement solo !",
        steps: [
          {
            stepNum: 1,
            label: "Entrée du Corridor",
            coords: "[14, 18]",
            command: "/travel 14,18",
            action: "Porte centrale s'ouvrant après la chute des 4 gardiens de zone."
          },
          {
            stepNum: 2,
            label: "Crypte de la Reine Écarlate",
            coords: "[16, 20]",
            command: "/travel 16,20",
            action: "Sous-sol de la tour : combat à 8 contre la Reine Écarlate (50 000 PV)."
          },
          {
            stepNum: 3,
            label: "Sommet de la Princesse Maudite",
            coords: "[18, 22]",
            command: "/travel 18,22",
            action: "Sommet de la flèche : combat à 8 contre la Princesse Maudite (50 000 PV, distance pure)."
          }
        ]
      }
    ],
    burstOpti: {
      rules: [
        "Stratégie Autowin Princesse : retrait total PM, isolée dans un angle à >16 PO de l'équipe",
        "Entrave 300+ PM & Malus Esquive : Enutrof + Sadida + Éliotrope + Éclat Entravant (+30 Retrait)",
        "Initiative stricte : Retraits PM jouent en 1er (Enu puis Sadi), Élio ensuite, Pandawa en dernier",
        "Initiative 2 601+ corridor : indispensable pour jouer avant les 60 protecteurs T1",
        "Hors LDV de la Princesse au début de son tour : esquive la statufication mortelle (OS)",
        "Anti-soin sur Tempête Florale P2 : neutralise les 10 000 PV de soin automatique de la Princesse"
      ],
      scale: [
        { dmg: "4 Énigmes résolues", pts: "+10 000 pts", note: "Éveil des gardiens" },
        { dmg: "4 Gardiens vaincus", pts: "+20 000 pts", note: "Ouverture du Corridor" },
        { dmg: "60 Monstres corridor", pts: "+30 000 pts", note: "Accès aux boss" },
        { dmg: "Reine & Princesse KO", pts: "+50 000 pts", note: "Score Max hebdomadaire" }
      ],
      classes: [
        {
          classId: "pandawa",
          category: "Noyau incontournable",
          keySpells: "Brassage, Vulnérabilité, Karcham — bloque la Reine Écarlate au CaC loin des Évadés + placeur en dernier pour repositionner l'équipe"
        },
        {
          classId: "cra",
          category: "Noyau incontournable",
          keySpells: "DPS distance pure sur la Princesse (Tir Éloigné, flèches sans LDV) — Pluie de Flèches réduit l'esquive PM de la Princesse de 20 pts pendant 2 tours"
        },
        {
          classId: "enutrof",
          category: "Entrave PM — Autowin Princesse",
          keySpells: "Obsolescence (−20 esquive PM / 2 tours), Maladresse, Clef de Bras (1 PM inesquivable / 2 PA), Boîte à Outils (boost PA/PM Sadida), Ruée vers l'Or, Pelle des Anciens"
        },
        {
          classId: "sadida",
          category: "Entrave PM — Autowin Princesse",
          keySpells: "Sève Paralysante (−15 esquive PM / 3 tours), Ronce Apaisante, Feu de Brousse, Herbes Folles, Mangrove, Ronces Agressives — jouez avant l'Éliotrope"
        },
        {
          classId: "eliotrope",
          category: "Entrave PM — Autowin Princesse",
          keySpells: "Portails pour retirer des PM à distance et frapper la Princesse depuis le coin — positionné juste après les deux retraits PM"
        },
        {
          classId: "ouginak",
          category: "Entrave PM — Autowin Princesse",
          keySpells: "Mâchoire (−30 esquive PM / 2 tours) — renfort optionnel si la Princesse tient encore son esquive PM"
        },
        {
          classId: "huppermage",
          category: "Top DPS distance",
          keySpells: "Volcan, Cycle Élémentaire — haute mobilité pour récupérer les glyphes violets d'Incantation Florale en Phase 2"
        },
        {
          classId: "roublard",
          category: "Top DPS burst",
          keySpells: "Mur de bombes pour pulvériser le Floracle (5k HP) et les Volontés (30k HP) en un passage"
        },
        {
          classId: "iop",
          category: "Finisher Reine Écarlate",
          keySpells: "Colère de Iop, Massacre, Puissance — déclenché après destruction du Pommeau et de la Lame"
        },
        {
          classId: "feca",
          category: "Support & Protection",
          keySpells: "Rempart, Trêve, Bouclier Féca — préserve les 20 PV partagés contre Châtiment Royal"
        },
        {
          classId: "eniripsa",
          category: "Support & Soins",
          keySpells: "Soins massifs, don de PA aux retraits PM, Mot Décourageant (Insoignable) pour neutraliser Tempête Florale"
        },
        {
          classId: "zobal",
          category: "Support & Protection",
          keySpells: "Plastron, Tortoruga à distance, Masque Psychopathe pour sécuriser les 20 PV d'équipe"
        }
      ],
      keyItems: [
        {
          name: "Trophée Initiative (2 601+)",
          desc: "Jouer avant les 60 protecteurs du corridor — évite l'OS dès le Tour 1"
        },
        {
          name: "Éclat Entravant",
          desc: "+30 Retrait PM pour 1 combat (obtenable auprès de l'Amateur de Guildatons au Hall de guilde) — à consommer sur les personnages retraits PM, mettre tous les points en sagesse"
        },
        {
          name: "Dofus Nébuleux",
          desc: "Cale les tours de burst pairs/impairs sur les Volontés (30 000 PV) et les boss délockés"
        },
        {
          name: "Leçon de Grunob / Insoignable",
          desc: "Neutralise le soin de 10 000 PV de Tempête Florale en Phase 2 de la Princesse"
        }
      ]
    }
  }
};

/* ─── Localized Raid Data (EN) for In-Game Overlay ─── */
export const RAIDS_DATA_EN: Record<string, RaidData> = {
  gigalodon: {
    ...RAIDS_DATA.gigalodon,
    name: "The Gigalodon Abyss",
    shortName: "Gigalodon",
    zoneName: "Abyssal Chasm · World 37",
    badge: "12 Players Raid · Lvl 200",
    description: "6-floor abyssal descent to secure the 4 chest fragments and defeat the Gigalodon in 3 burst turns.",
    safeRoutes: RAIDS_DATA.gigalodon.safeRoutes?.map((route) => {
      if (route.id === "remontee-execrabe") {
        return {
          ...route,
          title: "Shortcut Floor -4 ➔ Chest (-1)",
          subtitle: "Fast deposit route via Execrabe Claw",
          badge: "Crucial Deposit",
          dangerWarning: "The 12 players must deposit their gathered resources at the chest to trigger the 10,000 pts threshold!",
          steps: route.steps.map((st) => ({
            ...st,
            action: st.stepNum === 1
              ? "From boss or statues room at [9, 11], travel to [6, 10]."
              : st.stepNum === 2
              ? "Player with Claw clicks lanternfish at [6, 10]. Everyone crosses to [4, 7] (-2)."
              : st.stepNum === 3
              ? "From [4, 7], travel to [2, 7] then click access to return to Floor -1."
              : "From [4, 3], travel to [3, 2]. All 12 players empty bags at chest (>10,000 pts confirmed).",
            warning: st.warning ? "Autopilot disconnected: only player holding Execrabe Claw can open!" : undefined,
          })),
        };
      }
      if (route.id === "redescente-krakhaine") {
        return {
          ...route,
          title: "Descent to Krak'Haine (-5)",
          subtitle: "Access Abyssal Charnel to drop 4th Fragment (20%)",
          badge: "Ossuary Access",
          dangerWarning: "Careful on [12, 13]: clicking the sea bone interrupts autopilot and autofollow!",
          steps: route.steps.map((st) => ({
            ...st,
            action: st.stepNum === 1
              ? "From chest [3, 2], travel to [4, 3] and climb down ladder to Floor -2."
              : st.stepNum === 2
              ? "At [4, 7], take cave bottom-right to appear directly at [6, 10] (-4)."
              : st.stepNum === 3
              ? "Travel to [9, 11], click water (statues solved) then exit bottom-right to -5."
              : st.stepNum === 4
              ? "At [12, 13], click sea bone to descend. Autopilot turns off here!"
              : "Farm Krak'Haine until 4th fragment drops (20%). Entire raid takes diving cage at [10, 14].",
            warning: st.warning ? "Resume manual control on this map to avoid mob aggros!" : undefined,
          })),
        };
      }
      return {
        ...route,
        title: "Post-Willorc Ascent",
        subtitle: "Deposit Willorc's 10,000 pts & Launch Final Encounter",
        badge: "Final Phase",
        steps: route.steps.map((st) => ({
          ...st,
          action: st.stepNum === 1
            ? "Willorc defeated ➔ Obtain 'Darkness of Willorc' (+10,000 pts at chest)."
            : st.stepNum === 2
            ? "Take diving cage back to Floor -5."
            : "Ascend via shortcut to [3, 2]. Deposit Willorc's relic.",
        })),
      };
    }),
    saltLocations: RAIDS_DATA.gigalodon.saltLocations?.map((loc) => ({
      ...loc,
      zoneName:
        loc.floor === "Étage -1"
          ? "Base Camp & Mining"
          : loc.floor === "Étage -2"
          ? "Moray's Lair"
          : loc.floor === "Étage -4"
          ? "Execrabe's Burrow"
          : "Abyssal Charnel",
      floor:
        loc.floor === "Étage -1"
          ? "Floor -1"
          : loc.floor === "Étage -2"
          ? "Floor -2"
          : loc.floor === "Étage -4"
          ? "Floor -4"
          : "Floor -5",
    })),
    steps: [
      {
        ...RAIDS_DATA.gigalodon.steps[0],
        floor: "Floor -1",
        title: "Base Camp & Mining",
        bossName: "Clear 18 Mob Groups",
        summary: "Base camp. Split the raid into 3 squads of 4 to clear the 5 maps and mine sea salt.",
        bullets: [
          "18 groups split across 3 squads of 4 (no respawn)",
          "Clear all 5 maps simultaneously (60 min timer)",
          "Mining: 4 sea salt veins ([3, 2], [2, 2], [4, 2], [3, 3])",
          "All mobs can drop the 1st key fragment",
          "Save salt reserves for upcoming bosses",
        ],
        alert: {
          label: "10,000 pts threshold at chest",
          desc: "The 4th fragment drop from Krak'Haine jumps from 1% to 20% once 10,000 points are deposited!",
          danger: true,
        },
        strategy: [
          "Split raid into 3 squads of 4 upon entry.",
          "Mine the 4 sea salt veins at [3, 2], [2, 2], [4, 2] and [3, 3].",
          "Conserve salt: luminomachine starts at Level 4.",
          "Take the exit to Floor -2 at [4, 3].",
        ],
        proTips: [
          "NPC merchant sells healing potions (no trading between players).",
          "Do not attempt the '100 Salts' achievement during a score run (permanent darkness).",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[1],
        floor: "Floor -2",
        title: "Boss 1: Abyssal Moray",
        bossName: "Moray (51,000 HP)",
        summary: "Colossal eel (51,000 HP). Accompanied by 3 normal mobs: Madrepore, Kokayou, and Leviatank.",
        bullets: [
          "Level 4 Light mandatory before engaging (or 153k HP / +1,000 Power)",
          "Kill the 3 normal monsters first (Madrepore, Kokayou, Leviatank)",
          "Summons 2 Morays/turn at <10 Range (+100 Power/summon) · Killing a summon purges poison",
          "Panda lock: pin the Moray into a corner behind its own summons",
          "Victory = 2nd key fragment + Moray Unit (1,000 chest points)",
        ],
        alert: {
          label: "Level 4 Light mandatory",
          desc: "Recharge the Luminomachine at [4, 5] or [2, 7] to Level 4 before starting combat!",
          danger: true,
        },
        strategy: [
          "Panda lock: corner the Moray behind 2 summons or obstacles.",
          "Ranged DPS: stay at > 10 Range to prevent Dispersssion spell.",
          "Eliminate the 3 normal monsters, then burst the Moray.",
          "Descend to Floor -3 via access at [2, 7].",
        ],
        proTips: [
          "Equip Water and Earth resistance gear on the contact tank.",
          "MP reduction largely neutralizes its mobility.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[2],
        floor: "Floor -3",
        title: "Drowned Cliff & Luminarium",
        bossName: "Lanternfish Puzzle",
        summary: "Luminarium cave. Puzzle on a vertical wall (4x4 lanternfish grid). Zero combat, safe zone.",
        bullets: [
          "100% safe zone: no monsters, no salt to spend",
          "Designate only 1 player to manipulate the wall grid (simultaneous clicks desync)",
          "Lights Out logic: each click toggles the fish and its 4 neighbors",
          "Cascade method: click on the row below to light up unlit lamps above",
          "As soon as the wall collapses, advance to Floor -4",
        ],
        alert: {
          label: "Only 1 player clicks the wall",
          desc: "All other players stand back. Multiple simultaneous clicks desync the puzzle!",
          danger: false,
        },
        strategy: [
          "All players stand back, one player solves the wall grid.",
          "Cascade: Row 1 unlit ➔ click Row 2.",
          "Row 2 unlit ➔ click Row 3 · Row 3 ➔ click Row 4.",
          "Adjust Row 4 corners to illuminate the whole board.",
          "Cross over to Floor -4 once the wall opens.",
        ],
        proTips: [
          "Refer to the integrated solution image if the board gets stuck.",
          "Do not recharge any machines here: save salt for Execrabe and Willorc.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[3],
        floor: "Floor -4",
        title: "Boss 2: Execrabe's Burrow",
        bossName: "Execrabe (4 Forms)",
        summary: "Massive crustacean with 4 appearances. Memorization of the 4 forms required to activate the statues under the lake.",
        bullets: [
          "Record the order of the 4 elemental forms at HP thresholds (Shell, Urchin, Pearl, Squid)",
          "Statues under the lake at [9, 11]: -1,000 pts per mistake (score can become negative!)",
          "Level 4 Light at [8, 11] recommended (5 companion mobs)",
          "Execrabe Claw: guaranteed drop to open major shortcut at [6, 10]",
          "Do not descend to -5! Ascend to chest to deposit all relics",
        ],
        alert: {
          label: "Record form order & -1,000 pts/mistake",
          desc: "Record the 4 forms using the pad below. Any mistake under the lake at [9, 11] deducts 1,000 points from the raid!",
          danger: true,
        },
        strategy: [
          "Eliminate the 5 companion mobs while draining Execrabe's MP.",
          "Record the form order as phases change using our pad.",
          "After victory: click water at [9, 11] and activate the 4 statues in exact order.",
          "Player holding the Claw clicks the lanternfish at [6, 10] to open shortcut.",
          "Head back up to the chest to deposit relics (do not descend to -5!).",
        ],
        proTips: [
          "Execrabe has only 64 MP dodge: MP drain completely neutralizes it.",
          "Statues around the combat map illuminate in blue at each threshold.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[4],
        floor: "Floor -1",
        title: "Strategic Deposit at Chest",
        bossName: "10k Threshold Validation",
        summary: "Mandatory return to chest before Floor -5. 4th fragment drop jumps from 1% to 20% once 10,000 points are banked!",
        bullets: [
          "No player trading allowed: all 12 players must return to the chest to deposit bag contents",
          "Resources to bank: Moray (1k) + Execrabe (5k) + salt/ores (4k+) = >10,000 pts",
          "Increases 4th fragment drop rate from 1% to 20% on Krak'Haine mobs (-5)",
          "Safe route: [6, 10] ➔ [4, 7] ➔ /travel 2,7 ➔ /travel 3,2",
          "Descend back to Floor -5 once the 10,000 threshold is confirmed",
        ],
        alert: {
          label: "12 players must deposit at chest",
          desc: "Trading between players is impossible! Without this deposit, fragment 4 drops at 1% instead of 20%.",
          danger: true,
        },
        strategy: [
          "Take shortcut at [6, 10] ➔ [4, 7] ➔ /travel 2,7 ➔ /travel 3,2.",
          "All 12 players click the chest and deposit all gathered resources.",
          "Check interface to confirm score exceeds 10,000 points.",
          "Head back down to Floor -5 via the shortcut.",
        ],
        proTips: [
          "Without this threshold, you risk running out the 60-minute timer on Krak'Haine mobs.",
          "Restock potions from the NPC merchant if needed.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[5],
        floor: "Floor -5",
        title: "Abyssal Charnel: Krak'Haine",
        bossName: "Collect 4th Fragment",
        summary: "Giant bones zone. With 10,000 pts banked, the 4th fragment drops at 20% from Krak'Haine mobs.",
        bullets: [
          "Farm Krak'Haine mob packs in 4-player squads (drops in 1 to 3 fights)",
          "Shared drop: once validated in any fight, all 12 players unlock the fragment",
          "Trap on map [12, 13]: clicking the sea bone interrupts autopilot and autofollow!",
          "Once all 4 fragments are secured: gather everyone at [10, 14]",
          "Take diving cage at [10, 14] down to Floor -6",
        ],
        alert: {
          label: "Trap on [12, 13]: autopilot disconnect",
          desc: "On [12, 13], clicking the sea bone disables autopilot and autofollow! Navigate manually.",
          danger: true,
        },
        strategy: [
          "Engage Krak'Haine packs in groups of 4.",
          "Check character alteration 'Fourth Key Fragment'.",
          "Regroup the raid at [10, 14] once secured.",
          "Take the diving cage to Floor -6.",
        ],
        proTips: [
          "Salt deposits: [11, 14], [12, 14], [12, 13], [11, 13].",
          "Krak'Haine mobs respawn rapidly: chain fights without pause.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[6],
        floor: "Floor -6",
        title: "Boss 3: Willorc's Deepshade",
        bossName: "Willorc (62,000 HP)",
        summary: "Rooted boss (62,000 HP), ALONE on map [11, 16]. Permanent complete darkness. Zero mobs, zero phantom orcas.",
        bullets: [
          "Immediate aggro at 10 Range within 5 seconds in the dark (enter grouped and ready)",
          "Boss alone on map: 0 mobs, 0 phantom orcas, 10 invulnerable lanterns",
          "Panda Cheese: carry Willorc T1 and lock him >3 Range away from any lantern/statue",
          "Isolated in a corner, Willorc triggers no Switches and raid stays out of Dark Chant",
          "Focus 100% DPS on boss (ignore lanterns) ➔ Relic +10,000 pts",
        ],
        alert: {
          label: "Panda Cheese: corner Willorc",
          desc: "Carry Willorc on Turn 1 and position him >3 Range from any lantern/statue to shut down his spells!",
          danger: true,
        },
        strategy: [
          "Enter ready on map [11, 16] to handle immediate aggro.",
          "Turn 1: Pandawa carries Willorc and locks him in a clear corner far from lanterns.",
          "Tank in melee, rest of raid at mid-range (outside Dark Chant 10 Range).",
          "After victory: return to chest (-1) to deposit relic (+10,000 pts) and engage Gigalodon!",
        ],
        proTips: [
          "Game setting: 'Show entities in foreground' to target Willorc easily in darkness.",
          "Immune to Dark Thoughts: zero salt required in this fight.",
        ],
      },
      {
        ...RAIDS_DATA.gigalodon.steps[7],
        floor: "Hub -1",
        title: "Final Encounter: The Gigalodon",
        bossName: "Gigalodon (3-Turn Burst)",
        summary: "Timed 3-turn burst phase launched from the chest (-1). Automatic victory on Turn 4 via Gigalodoom. Goal: max burst damage to cap the score (+15,000 pts)!",
        bullets: [
          "3 turns only: automatic victory on Turn 4 via Gigalodoom",
          "Keep at least 3 cells away: melee players take lethal backlash",
          "Apply Vulnerability, place portal networks and bomb walls for Turn 3 burst",
          "Nebulous Dofus Turn 3 sync: align all major cooldowns",
          "Defeat or max damage secures the raid score!",
        ],
        alert: {
          label: "Stay > 3 cells away from boss",
          desc: "Any player within 3 cells takes massive backlash damage. Maintain distance!",
          danger: true,
        },
        strategy: [
          "Turn 1: Set up portals, place bombs, buff team damage.",
          "Turn 2: Apply Vulnerabilities, position away from boss breath cones.",
          "Turn 3: Unleash all heavy damage cooldowns (Wrath, Bomb detonation, Volcano).",
          "Turn 4: Gigalodoom triggers automatic victory.",
        ],
        proTips: [
          "Do not waste AP on defensive shields: pump 100% into single-target burst.",
        ],
      },
    ],
    burstOpti: {
      rules: [
        "Turn 3 Burst with Nebulous: coordinate all damage cooldowns on Turn 3 for maximum bonus score",
        "Melee Exclusion Zone: keep all players at least 3 cells away from Gigalodon to prevent lethal backlash",
        "Luminarium Salt Levels: charge pillars to level 4+ to prevent dark room wipe mechanics",
      ],
      scale: [
        { dmg: "Floors 1-3 Cleared", pts: "+5,000 pts", note: "Abyss descent" },
        { dmg: "Execrabe & Willorc", pts: "+15,000 pts", note: "Sub-bosses down" },
        { dmg: "Gigalodon 500k-1M Dmg", pts: "+30,000 pts", note: "High score tier" },
        { dmg: "Gigalodon >1.5M Dmg", pts: "+50,000 pts", note: "Max bonus score" },
      ],
      classes: [
        { classId: "pandawa", category: "Core Staple", keySpells: "Brewing, Vulnerability, carry out of the 3 melee cells" },
        { classId: "iop", category: "Core Staple", keySpells: "Wrath T3 synced with Nebulous, Slaughter, Power" },
        { classId: "eliotrope", category: "Core Staple", keySpells: "4-portal network, Mutual Aid, Focus" },
        { classId: "huppermage", category: "Top Single-Target DPS", keySpells: "Volcano Earth/Fire, Elemental Cycle" },
        { classId: "roublard", category: "Top Single-Target DPS", keySpells: "Bomb wall under portals, Powder, Countdown" },
        { classId: "cra", category: "Top Single-Target DPS", keySpells: "Tactical beacon, Destructive & Loaded Arrow" },
        { classId: "sram", category: "Amplifiers", keySpells: "Death Mark (+20% damage taken), Cut-Throat" },
        { classId: "zobal", category: "Amplifiers", keySpells: "Transfiguration, Psychopath Mask, Furia" },
        { classId: "ouginak", category: "Amplifiers", keySpells: "Quarry, Relentlessness, Prey" },
      ],
      keyItems: [
        { name: "Nebulous Dofus (T1 & T3 +20%)", desc: "Syncs damage boost with vulnerability and Turn 3 burst" },
        { name: "Judgment of Thanathena (+4%/hit)", desc: "Stacks up to +40% final damage on multi-hit spells" },
        { name: "Mono-element trophies & Vulbis", desc: "Maximizes flat element stats and movement range" },
      ],
    },
  },
  "jardin-eternel": {
    ...RAIDS_DATA["jardin-eternel"],
    name: "Eternal Gardens Sanctuary",
    shortName: "Sanctuary",
    zoneName: "Eternal Gardens Sanctuary",
    badge: "16 Players Raid · Lvl 200",
    description: "Cooperative guild raid with 20 shared HP: 4 interconnected wings, 4 area guardians, 60 corridor solo fights, Scarlet Queen and Cursed Princess.",
    steps: [
      {
        ...RAIDS_DATA["jardin-eternel"].steps[0],
        floor: "Wing 1",
        title: "Belladonna's Reserve & Naval Battle",
        bossName: "6 Paper Boats Puzzle",
        summary: "Naval battle across 2 maps [19, 15] and [21, 17]. 1 player in the Work reveals the 6 boats, gunners coordinate the cannonballs.",
        bullets: [
          "1 player in the Work clicks on the 6 paper boats",
          "2 players on naval grids at [19, 15] and [21, 17]",
          "Map [21, 17] initiates the firing sequence",
          "Combine letter (A to D) and number (1 to 3) to fire",
          "Sink the 3 boats on each map (6 total)",
          "+2,000 points and awakens the Reserve Defender",
        ],
        alert: {
          label: "Shot coordination",
          desc: "Each hit reveals an opposing coordinate. Coordinate your fire without wasting turns!",
          danger: false,
        },
        strategy: [
          "Use the Boats tool in the Puzzles tab to immediately record the 6 ships.",
          "Call out your coordinates in voice chat or party channel.",
        ],
        proTips: [
          "Boat coordinates randomize with every new raid instance.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[1],
        floor: "Wing 2",
        title: "Ephedra's Courtyard & The Chessboard",
        bossName: "4 Chess Pieces Puzzle",
        summary: "Note the 4 green illuminated pieces in the Reserve (A1..K11 grid), then initiate 4-player chess combat in Ephedra's Courtyard.",
        bullets: [
          "Talk to Belladonna in Ephedra's Courtyard [12, 14]",
          "Check the 4 green illuminated pieces in the Reserve",
          "Note exact squares (W. Rook, B. Rook, W. Bishop, B. Bishop)",
          "Engage the 4-player chess fight in Ephedra's Courtyard",
          "Position characters on the exact tiles matching the pieces",
          "+2,000 points and awakens the Courtyard Sentinel",
        ],
        alert: {
          label: "Tile accuracy",
          desc: "A tile error deducts 1 HP from the raid gauge (20 HP max). Double check letters and numbers.",
          danger: true,
        },
        strategy: [
          "Input the 4 coordinates into the Chess tool in the overlay before starting combat.",
        ],
        proTips: [
          "Assign a specific piece to each member of the quartet to avoid confusion.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[2],
        floor: "Wing 3",
        title: "Monochrome Work & Pedestals",
        bossName: "Paper Flowers Puzzle",
        summary: "Check the 2 objects on each stela I to IV in the Enclosure, then activate the 4 associated flowers in the Work to unlock the key color.",
        bullets: [
          "Inspect pedestals I to IV at [11, 21] and [12, 20] in the Enclosure",
          "Note the 2 objects per pedestal (8 objects total)",
          "In the Work, activate the flowers corresponding to the key objects",
          "Note the final color obtained (Orange, Blue, Red, Green)",
          "+2,000 points and awakens the Work Watcher",
        ],
        alert: {
          label: "Essential final color",
          desc: "Carefully note the resulting color: it is the master key for the Statues puzzle!",
          danger: false,
        },
        strategy: [
          "Check off items in the Items tool in the overlay as you visit each pedestal.",
        ],
        proTips: [
          "A fast player can check all 4 steles in under 90 seconds.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[3],
        floor: "Wing 4",
        title: "Protectors Enclosure & Statues",
        bossName: "Miniature Puzzle",
        summary: "Compare the 4 Enclosure views to Ephedra's miniature. Identify the spawned monster statue and color to locate the target protector.",
        bullets: [
          "Compare 4 views (Top, Bottom, Left, Right) Enclosure vs Ephedra",
          "Identify the monster statue that spawned at the center",
          "Select the statue and color in the overlay solver",
          "Reach the calculated coordinate and face the indicated direction",
          "Defeat the protector to validate the puzzle (+2,000 pts)",
          "Awakens the Enclosure Guardian",
        ],
        alert: {
          label: "Facing direction on tile",
          desc: "Stand on the indicated tile and face in the direction of the arrow.",
          danger: true,
        },
        strategy: [
          "The Statues tool in the overlay calculates the position and provides a clickable /travel command.",
        ],
        proTips: [
          "Once all 4 puzzles are solved, defeat all 4 guardians to accumulate 20,000 points.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[4],
        floor: "Castle",
        title: "Castle Corridor (60 Fights)",
        bossName: "Protectors Trial",
        summary: "10 rooms of 6 individual solo fights. 2,601+ Initiative mandatory and end turn within 4 Range or break LoS.",
        bullets: [
          "Strictly individual solo combat (sidekicks disabled)",
          "Equip an Initiative trophy: reach 2,601+ to play first",
          "End turn within 4 Range of the monster",
          "At > 4 Range with LoS: monster gains 100% crit and doubled damage",
          "Each defeat deducts 1 HP from the raid gauge (20 HP max)",
          "Clear all 60 monsters to unlock access to both bosses",
        ],
        alert: {
          label: "2,601+ Initiative required",
          desc: "Without initiative, monsters can one-shot you on turn 1. Equip an Initiative trophy!",
          danger: true,
        },
        strategy: [
          "Summon a static entity in front of you to block line of sight if you cannot close the distance.",
          "Choose classes with high sustain or Turn 1 burst.",
        ],
        proTips: [
          "All raid members can fight in parallel in different rooms to clear 4x faster.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[5],
        floor: "Crypts",
        title: "Boss 1: The Scarlet Queen",
        bossName: "Scarlet Queen (50,000 HP)",
        summary: "8-player fight: free prisoners via Floracle (5,000 HP), keep Escaped allies away from Queen melee, destroy Pommel & Blade.",
        bullets: [
          "Start in duos across 4 prison cells: kill linked mobs to open",
          "Imperial Exile: hit the Floracle (5,000 dmg) to free the captured ally",
          "Escaped state: keep the Queen away for 1 turn (lethal melee OS)",
          "Royal Retribution: free all cells before the 2-turn countdown ends",
          "Phase 2 (1 HP): eliminate Princess's Will (30,000 HP) first",
          "Destroy Rooted Pommel and Flowery Blade to dispel invulnerability",
          "Defeat the Scarlet Queen (+10,000 raid points)",
        ],
        alert: {
          label: "Lethal danger: Execution of the Escaped",
          desc: "Any player leaving a cell gets the Escaped state: if the Queen touches them in melee, they take over 3,000 damage!",
          danger: true,
        },
        strategy: [
          "Pandawa must lock or push the Queen continuously away from prison cells.",
          "Focus heavy damage on the Princess's Will as soon as Phase 2 begins.",
        ],
        proTips: [
          "Bring pushback or gravity spells to prevent the Queen from reaching escaped allies.",
        ],
      },
      {
        ...RAIDS_DATA["jardin-eternel"].steps[6],
        floor: "Summit",
        title: "Boss 2: The Cursed Princess",
        bossName: "Cursed Princess (50,000 HP)",
        summary: "Permanent melee invulnerability. Use the Cursed Flower, break LoS to avoid petrification, and dispel invulnerability with 2 Floral Incantations.",
        bullets: [
          "Permanent melee invulnerability: ranged strikes only",
          "Cursed Flower (10k HP): drop to 1 HP to gain +300 Power & heals",
          "Turn 2+: never stay in direct line of sight of the Princess (Statue = OS on next turn)",
          "Phase 2: defeat the Queen's Will (30k HP) to break Family Bond",
          "Step into the Flower's 2 purple glyphs to trigger Floral Incantation x2",
          "Floral Storm heals 10,000 HP: apply Incurable or Lesson of Grunob",
          "Finish the Princess at range to secure the 50,000 raid points!",
        ],
        alert: {
          label: "Petrification = Instant Death",
          desc: "Starting your turn in direct line of sight of the Princess petrifies you. Death on the following turn without allied dispel!",
          danger: true,
        },
        strategy: [
          "Use summons or hide behind pillars to break line of sight with the Princess.",
          "A high mobility player (Cra, Eliotrope, Huppermage) picks up the glyphs to debuff.",
        ],
        proTips: [
          "Floral Storm triggers after 6 Bloom increments: prepare shields and healing reduction.",
        ],
      },
    ],
    burstOpti: {
      rules: [
        "Autowin Princess Strategy: 0 MP removal, isolated in a corner at >16 Range from the squad",
        "300+ MP Retraction & Dodge Debuffs: Enutrof + Sadida + Eliotrope + Hindering Shard (+30 Retraction)",
        "Strict Turn Order: MP drainers act 1st (Enu then Sadi), Elio next, Pandawa last to reposition",
        "Corridor 2,601+ Initiative required: essential to act before the 60 protectors on Turn 1",
        "Out of Princess LoS at start of turn: avoids lethal petrification (OS)",
        "Incurable on Floral Storm P2: negates the Princess's automatic 10,000 HP heal",
      ],
      scale: [
        { dmg: "4 Puzzles solved", pts: "+10,000 pts", note: "Guardians awaken" },
        { dmg: "4 Guardians defeated", pts: "+20,000 pts", note: "Corridor opens" },
        { dmg: "60 Corridor monsters", pts: "+30,000 pts", note: "Boss access" },
        { dmg: "Queen & Princess KO", pts: "+50,000 pts", note: "Max weekly score" },
      ],
      classes: [
        {
          classId: "pandawa",
          category: "Core Staple",
          keySpells: "Brewing, Vulnerability, Karcham — locks Scarlet Queen in melee away from Escaped allies + positions squad at turn end",
        },
        {
          classId: "cra",
          category: "Core Staple",
          keySpells: "Pure ranged DPS on the Princess (Distant Shooting, non-LoS arrows) — Plaguing Arrow lowers Princess MP dodge by 20 for 2 turns",
        },
        {
          classId: "enutrof",
          category: "MP Drain — Autowin Princess",
          keySpells: "Obsolescence (-20 MP dodge / 2 turns), Clumsiness, Arm Key (1 unparriable MP / 2 AP), Tool Box (boost AP/MP on Sadida), Gold Rush, Shovel of the Ancients",
        },
        {
          classId: "sadida",
          category: "MP Drain — Autowin Princess",
          keySpells: "Paralyzing Sap (-15 MP dodge / 3 turns), Soothing Bramble, Bush Fire, Wild Grass, Mangrove, Aggressive Brambles — acts before Eliotrope",
        },
        {
          classId: "eliotrope",
          category: "MP Drain — Autowin Princess",
          keySpells: "Portals to drain MP and strike Princess safely from the opposite corner (> 16 Range)",
        },
        {
          classId: "ouginak",
          category: "MP Drain — Autowin Princess",
          keySpells: "Jaw (-30 MP dodge / 2 turns) — optional reinforcement to secure MP removal",
        },
        {
          classId: "huppermage",
          category: "Top Ranged DPS",
          keySpells: "Volcano, Elemental Cycle — high mobility to safely collect purple Floral Incantation glyphs in Phase 2",
        },
        {
          classId: "roublard",
          category: "Top Burst DPS",
          keySpells: "Bomb wall to melt the Floracle (5k HP) and Wills (30k HP) in a single detonation",
        },
        {
          classId: "iop",
          category: "Scarlet Queen Finisher",
          keySpells: "Iop's Wrath, Slaughter, Power — triggered once Pommel and Blade are destroyed",
        },
        {
          classId: "feca",
          category: "Support & Protection",
          keySpells: "Rampart, Truce, Feca Shield — protects shared 20 team HP against Royal Retribution",
        },
        {
          classId: "eniripsa",
          category: "Support & Healing",
          keySpells: "Raid heals, AP buff to MP drainers, Incurable debuff to negate Floral Storm 10k heal",
        },
        {
          classId: "zobal",
          category: "Support & Protection",
          keySpells: "Plastron, Tortoruga at range, Psychopath Mask to safeguard team HP",
        },
      ],
      keyItems: [
        {
          name: "Initiative Trophy (2,601+)",
          desc: "Act before the 60 corridor protectors — prevents lethal turn 1 criticals",
        },
        {
          name: "Hindering Shard",
          desc: "+30 MP Retraction for 1 fight (Guildaton Collector in Guild Hall) — consume on MP drainers, full Wisdom",
        },
        {
          name: "Nebulous Dofus",
          desc: "Sync burst turns on Wills (30,000 HP) and vulnerable boss phases",
        },
        {
          name: "Lesson of Grunob / Incurable",
          desc: "Negates the 10,000 HP heal from Floral Storm in Princess Phase 2",
        },
      ],
    },
  },
};

/**
 * Retourne les données du raid localisées selon la langue active (FR par défaut, EN).
 */
export function getLocalizedRaidData(slug: string, locale?: string): RaidData {
  if (locale === "en") {
    return RAIDS_DATA_EN[slug] || RAIDS_DATA[slug] || RAIDS_DATA.gigalodon;
  }
  return RAIDS_DATA[slug] || RAIDS_DATA.gigalodon;
}

