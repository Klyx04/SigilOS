export interface RaidStep {
  id: string;
  floor: string;
  title: string;
  bossName?: string;
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
    description: "Descente en 6 étages abyssaux pour débloquer les 4 fragments du coffre et terrasser le Léviathan.",
    steps: [
      {
        id: "step-1",
        floor: "Étage -1",
        title: "Avant-poste & Récoltes de Sel",
        bossName: "18 groupes d'expédition",
        coords: "[3, 2]",
        travelCommand: "/travel 3 2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        secondaryImages: [
          { label: "Gisement de sel marin", src: "/images/guides/gigalodon/27-gisement-sel.jpg" },
          { label: "Luminomachine", src: "/images/guides/gigalodon/18-luminomachine.jpg" }
        ],
        summary: "Camp de base. Divisez l'escouade en 3 groupes de 4. Minez le sel marin et nettoyez l'avant-poste.",
        keyMechanics: [
          {
            label: "PALIER 10 000 PTS AU COFFRE",
            desc: "Déposez IMPÉRATIVEMENT les récoltes de sel au coffre dès le début ! Ce palier fait bondir le drop des fragments de 5% à 20% pour tout le reste du raid.",
            danger: true
          },
          {
            label: "18 Groupes de Monstres",
            desc: "Nettoyage en parallèle par 3 escouades de 4 pour ouvrir les accès sans perdre de temps."
          }
        ],
        strategy: [
          "Scindez le raid en 3 équipes de 4 dès l'entrée.",
          "Chaque équipe sécurise une zone et mine les filons de sel marin.",
          "Déposez tout au coffre central pour valider les 10 000 points AVANT d'entamer les boss."
        ],
        proTips: [
          "La marchande PNJ vend des potions et consommables essentiels de résistance élémentaire.",
          "Gardez 1 joueur mobile pour courir déposer au coffre sans bloquer les combats."
        ]
      },
      {
        id: "step-2",
        floor: "Étage -2",
        title: "Boss : Mureine des Abysses",
        bossName: "Mureine (Étage -2)",
        coords: "[4, 7]",
        travelCommand: "/travel 4 7",
        primaryImage: "/images/guides/gigalodon/46-boss-mureine.jpg",
        secondaryImages: [
          { label: "Placement blocage coin", src: "/images/guides/gigalodon/58-placement-blocage-mureine.jpg" }
        ],
        summary: "Anguille géante colossale. Dégâts massifs en ligne droite et lourds malus de caractéristiques.",
        keyMechanics: [
          {
            label: "NIVEAU 4 REQUIS",
            desc: "Ne JAMAIS lancer le combat avant que le niveau de raid n'ait atteint le niveau 4 de progression !",
            danger: true
          },
          {
            label: "Frénésie & Debuff de masse",
            desc: "Retire de la puissance et tape très fort en ligne et zone à grande portée.",
            danger: true
          },
          {
            label: "Fragment 2 Obtenu",
            desc: "La victoire garantit le 2ème fragment indispensable au coffre final."
          }
        ],
        strategy: [
          "Option Tank : Pandawa tank bloque la Mureine dans un coin avec des invocations fixes.",
          "Option Distance : Jouer à plus de 10 PO avec entrave PM stricte (Cra / Enutrof / Sadida).",
          "Tuez en priorité les monstres d'accompagnement (Murare) pour libérer les lignes de vue."
        ],
        proTips: [
          "Équipez des résistances Eau et Terre élevées sur le personnage au corps-à-corps.",
          "Le retrait PM neutralise 80% de sa dangerosité."
        ]
      },
      {
        id: "step-3",
        floor: "Étage -3",
        title: "Falaise Noyée & Luminarium",
        bossName: "Énigme des Faisceaux",
        coords: "[4, 12]",
        travelCommand: "/travel 4 12",
        primaryImage: "/images/guides/gigalodon/62-mur-luminarium.jpg",
        secondaryImages: [
          { label: "Solution grille 4×4", src: "/images/guides/gigalodon/65-methode-solution-luminarium.jpg" }
        ],
        summary: "Salle d'énigme lumineuse pour ouvrir la porte vers le niveau inférieur.",
        keyMechanics: [
          {
            label: "UN SEUL JOUEUR SUR LA GRILLE 4×4",
            desc: "Un SEUL joueur doit monter sur la grille au sol ! Si plusieurs joueurs y pénètrent, le mécanisme se réinitialise et les faisceaux s'éteignent.",
            danger: true
          },
          {
            label: "Alignement des miroirs",
            desc: "Orientez les luminomachines pour guider le faisceau vers la porte du fond."
          }
        ],
        strategy: [
          "Tous les joueurs restent sur la passerelle d'accès.",
          "Un joueur désigné marche sur les dalles de la grille selon le schéma de solution.",
          "Dès que la porte s'ouvre, le groupe traverse ensemble."
        ],
        proTips: [
          "Consultez la capture de solution intégrée si le faisceau est dévié.",
          "Aucun combat nécessaire dans cette salle."
        ]
      },
      {
        id: "step-4",
        floor: "Étage -4",
        title: "Boss : Exécrabe le Fouisseur",
        bossName: "Exécrabe (Étage -4)",
        coords: "[9, 11]",
        travelCommand: "/travel 9 11",
        primaryImage: "/images/guides/gigalodon/71-boss-execrabe.jpg",
        secondaryImages: [
          { label: "Statues de l'énigme du lac", src: "/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" }
        ],
        summary: "Crustacé massif fouisseur. L'observation des 4 formes est la clé de la suite du raid.",
        keyMechanics: [
          {
            label: "NOTER L'ORDRE DES 4 FORMES",
            desc: "Notez ABSOLUMENT l'ordre d'apparition des 4 formes d'Exécrabe pendant le combat ! Cet ordre est INDISPENSABLE pour activer les statues sous le lac.",
            danger: true
          },
          {
            label: "Carapace Blindée",
            desc: "Immunité et réduction massive tant qu'il reste dans sa coquille. Débuffez-le dès sa sortie."
          },
          {
            label: "Fragment 3 Obtenu",
            desc: "Libère le 3ème fragment de clé du Gigalodon."
          }
        ],
        strategy: [
          "Utilisez le pad de note ci-dessous pour mémoriser les 4 formes en 1 clic pendant le combat.",
          "Écartez le boss de ses glyphes protecteurs.",
          "Dès sa sortie de carapace, envoyez l'érosion et le burst maximal."
        ],
        proTips: [
          "Après la victoire, rendez-vous immédiatement aux statues sous le lac pour débloquer le raccourci vers l'étage -5.",
          "Activer les statues dans le bon ordre fait gagner un temps précieux."
        ],
        hasExecrabePad: true
      },
      {
        id: "step-5",
        floor: "Étage -1",
        title: "Dépôt Stratégique au Coffre",
        bossName: "Vérification des 10 000 pts",
        coords: "[3, 2]",
        travelCommand: "/travel 3 2",
        primaryImage: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        summary: "Retour rapide au coffre pour déposer les fragments 2 et 3 et consolider le palier 10K.",
        keyMechanics: [
          {
            label: "Validation du boost 20% de drop",
            desc: "Assurez-vous que le score dépasse 10 000 pts. Les monstres Krak'Haine de l'étage -5 dropperont alors le dernier fragment en 1 à 2 combats seulement au lieu de 15+ !",
            danger: true
          }
        ],
        strategy: [
          "Envoyez 1 ou 2 coureurs déposer les ressources collectées.",
          "Ravitaillez-vous en consommables chez la marchande."
        ],
        proTips: [
          "Ne sautez JAMAIS cette étape sous peine de devoir farmer les Krak'Haine pendant 30 minutes inutilement."
        ]
      },
      {
        id: "step-6",
        floor: "Étage -5",
        title: "Ossuaire Abyssal & Krak'Haine",
        bossName: "Monstres Krak'Haine",
        coords: "[10, 14]",
        travelCommand: "/travel 10 14",
        primaryImage: "/images/guides/gigalodon/95-ouverture-raccourci.jpg",
        summary: "Zone d'ossements géants. Grâce au raccourci des statues, accédez directement aux groupes.",
        keyMechanics: [
          {
            label: "Drop Accéléré du Fragment 4",
            desc: "Avec le palier 10 000 points actif, chaque combat contre un Krak'Haine a 20% de chance de lâcher le fragment."
          },
          {
            label: "Entraves et tacle",
            desc: "Les Krak'Haine retirent des PM et attirent en ligne."
          }
        ],
        strategy: [
          "Engagez 2 combats simultanés avec vos équipes de 4.",
          "Dès que le fragment 4 tombe, cessez le farm et foncez vers Willorque à l'étage -6."
        ],
        proTips: [
          "Le raccourci ouvert par les statues d'Exécrabe évite 4 maps de labyrinthe."
        ]
      },
      {
        id: "step-7",
        floor: "Étage -6",
        title: "Boss : Willorque des Profondeurs",
        bossName: "Willorque (Étage -6)",
        coords: "[11, 16]",
        travelCommand: "/travel 11 16",
        primaryImage: "/images/guides/gigalodon/103-boss-willorque.jpg",
        secondaryImages: [
          { label: "Cheese Pandawa coin", src: "/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" }
        ],
        summary: "Combat ultime des profondeurs dans le noir complet. Discipline tactique absolue.",
        keyMechanics: [
          {
            label: "NOIR TOTAL (Vision Réduite)",
            desc: "Portée de vue drastiquement réduite sur toute la carte. Impossible de cibler ou soigner des alliés éloignés !",
            danger: true
          },
          {
            label: "Invocations d'Orques Spectres",
            desc: "Invoque des orques spectres causant de lourds dégâts en pourcentage d'érosion à chaque tour.",
            danger: true
          },
          {
            label: "+10 000 Points & Fragment Final",
            desc: "Valide le 4ème et dernier fragment pour affronter le Gigalodon."
          }
        ],
        strategy: [
          "Cheese Pandawa : Bloquez Willorque dans un angle avec un Pandawa tank et des invocations statiques.",
          "Restez groupés à mi-distance (4-6 PO) pour garder vos lignes de vue malgré l'obscurité.",
          "Éliminez immédiatement les orques spectres dès leur apparition pour ne pas accumuler d'érosion mortelle."
        ],
        proTips: [
          "Les sorts sans ligne de vue et les sorts de zone sont indispensables.",
          "Une fois Willorque vaincu, retournez au coffre (-1) pour lancer le Gigalodon !"
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
          { label: "Zone Hitbox & Mort", src: "/images/guides/gigalodon/125-glyphe-hitbox-gigalodon.jpg" },
          { label: "Zone d'attrapage", src: "/images/guides/gigalodon/127-zone-attrapage-gigalodon.jpg" },
          { label: "Exemple zone Gigarâle", src: "/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" }
        ],
        summary: "Phase de burst chronométrée en 3 tours pour infliger un maximum de dégâts et scorer.",
        keyMechanics: [
          {
            label: "NE JAMAIS ÊTRE DEVANT LA GUEULE",
            desc: "Les 3 cases face à sa gueule déclenchent l'engloutissement immédiat : mort définitive sans réanimation !",
            danger: true
          },
          {
            label: "ESPACEMENT DE 3 CASES ENTRE ALLIÉS",
            desc: "Le sort Gigarâle se propage par rebond et inflige 700 dégâts par allié à portée de 2 cases.",
            danger: true
          },
          {
            label: "PLACEMENT STRICT DANS LES DIAGONALES",
            desc: "Positionnez-vous dans ses diagonales pour éviter les cônes de souffle Ultrasplash et Tournageoire."
          }
        ],
        strategy: [
          "Tour 1 : Placement rigoureux en diagonales, application des buffs de puissance et vulnérabilités.",
          "Tour 2 : Déchaînement du burst maximal (armes, sorts à gros dégâts, érosion).",
          "Tour 3 : Dernier round de frappes avant la fin automatique du combat."
        ],
        proTips: [
          "100K dmg = +5 000 pts · 250K = +9 000 pts · 500K = +12 000 pts · 1M dmg = +15 000 pts (Score Parfait).",
          "Maximisez les multiplicateurs de dégâts de groupe (Vulnérabilité Panda, Masque Zobal, etc.)."
        ],
        hasBurstGuide: true
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
