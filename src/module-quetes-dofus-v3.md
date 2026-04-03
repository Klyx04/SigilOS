Module Dofus Sylvestre & Meta-Dofus – Conception Fonctionnelle et Technique
1. Objectif du module
Ce module a pour but de fournir à ta guilde un suivi structuré, visuel et collaboratif de la progression sur l’ensemble des Dofus du jeu, avec un focus particulier sur le Dofus Sylvestre qui agit comme méta-Dofus (nécessitant une grande partie des autres Dofus et de nombreuses séries de quêtes/donjons).

Contrairement aux Google Docs et aux guides classiques (Dofus pour les Noobs, Ganymède, Next-Stage, etc.), ce module ne vise pas à décrire les quêtes dans le détail, mais à modéliser :

Les Dofus en tant qu’objectifs finaux.

Les étapes majeures nécessaires pour chaque Dofus (quêtes clés, succès, donjons, ressources, prérequis d’alignement, autres Dofus requis, etc.).

La progression individuelle de chaque membre sur ces étapes.

La progression collective de la guilde.

Avec ce module, le Dofus Sylvestre devient un dashboard central qui agrège la progression de tous les autres Dofus pertinents.

2. Vision générale UX
Le module est constitué de trois grandes vues :

Hub Dofus (Vue globale)

Vue d’accueil du module.

Affiche un graphique central pour le Dofus Sylvestre (progression par catégories : prérequis Dofus, arc de quêtes, ressources/donjons).

Autour du Sylvestre, des cartes/bulles pour les Dofus principaux (Cawotte, Ocre, Ivoire, Pourpre, Turquoise, Émeraude, etc.) avec leur progression moyenne de guilde et progression personnelle.

Vue détail Dofus
Pour chaque Dofus :

Résumé compact (bonus, type, lien vers guide externe, statut personnel et guilde).

Sections d’étapes : Pré-requis, Étapes majeures de quêtes, Donjons associés, Ressources importantes.

Interface en listes/accordéons avec checkboxes pour la progression.

Vue progression de guilde (Leaderboard / Heatmap)

Comparaison des membres de la guilde pour un Dofus donné.

Heatmap par étapes ou tableau détaillé avec pourcentages de complétion, étape actuelle, etc.

Utilisé pour organiser des sessions communes et repérer qui est « au même point » que soi.

Le tout doit être sobriété + lisibilité : TU ne réécris pas les guides. Tu offres une vue synthétique, actionable.

3. Modélisation des données
Ton module peut être vu comme un graphe de dépendances entre objets :

Dofus : nœuds principaux.

Steps (Étapes) : nœuds secondaires représentant des gros blocs (pré-requis, séries de quêtes, donjons majeurs, ressources, etc.).

Edges (RequirementEdges) : lient Dofus ⇄ Étapes ⇄ Dofus, etc.

Progress : liaison entre joueurs et steps/Dofus.

3.1 Entité Dofus
Chaque Dofus distingue :

Identité : nom, slug, type (PRIMORDIAL, QUEST, DROP, EVENT, etc.).

Métadonnées : bonus principal, icône, niveau approximatif, difficulté.

Flags :

isSylvestreReq : si le Dofus est un prérequis direct ou indirect du Dofus Sylvestre.

isMeta : pour marquer le Sylvestre comme méta-Dofus.

Propriétés typiques :

id: Int

slug: String (ex: sylvestre, ocre, ivoire)

name: String

type: String (enum logique côté code)

isSylvestreReq: Boolean

isMeta: Boolean (true uniquement pour Sylvestre)

iconUrl: String?

bonusSummary: String (ex: +2 PA, +2 PO, gain de Puissance par PM utilisé, soin si aucun PM)

3.2 Entité Step (Étape)
Une Step représente un gros bloc logique utile à tracker, pas chaque quête individuellement.

Types possibles :

QUEST : un bloc de quêtes, une série, un succès majeur.

DUNGEON : un ou plusieurs donjons nécessaires.

RESOURCE : pack de ressources significatif (ex : X Pépites, Y ressources rares).

ALIGNMENT : niveau ou palier d’alignement, série de quêtes d’alignement.

OTHER_DOFUS : possession d’un autre Dofus.

MISC : tout ce qui ne rentre pas dans le reste (rencontres, combats spéciaux, succès annexes).

Chaque Step :

Est optionnellement rattachée à un Dofus (colonne dofusId).

Possède un weight permettant de pondérer son importance dans le calcul de complétion.

Peut avoir :

label : pour l’affichage.

description : texte court explicatif si nécessaire.

externalRef : lien vers DPLN / Next-Stage / Ganymède pour les détails.

quantity : pertinent pour les ressources.

Exemples pour l’Ocre :

Step type=QUEST label="Vert Émeraude"

Step type=QUEST label="Pourpre profond"

Step type=QUEST label="Bleu Turquoise"

Step type=QUEST label="La fin de l'éternité"

3.3 Entité RequirementEdge
RequirementEdge lie des Dofus et des Steps entre eux.

Cas d’usage :

Sylvia (Sylvestre) requiert Dom de Pin → edge de Dofus Sylvestre vers Dofus Dom de Pin (via type OTHER_DOFUS ou relation directe).

Dom de Pin requiert d’autres Dofus ou prérequis particuliers.

Ivoire requiert les 100 quêtes d’alignement → edge de Ivoire vers Step type=ALIGNMENT label="100 quêtes d’alignement".

Un edge peut pointer :

De Dofus → Dofus

De Dofus → Step

De Step → Step

(Éventuellement) de Step → Dofus (rare).

3.4 Entité GuildMember
Représente un membre de ta guilde au sein du dashboard.

id

discordId

mainCharacterName

server

Métadonnées diverses selon besoins.

3.5 Entités de progression
StepProgress
Paire (member, step) avec :

status: NOT_STARTED | IN_PROGRESS | DONE

doneAt: optionnel.

MemberDofusProgress
Paire (member, dofus) avec :

status: NOT_STARTED | IN_PROGRESS | OBTAINED

completionPercent: cache du % de complétion calculé.

Ce cache est recalculé à chaque modification pertinente (update d’une step, recalcul batch, CRON, etc.), ou à la demande.

4. Schéma Prisma suggéré
text
model Dofus {
  id             Int      @id @default(autoincrement())
  slug           String   @unique
  name           String
  type           String   // PRIMORDIAL | QUEST | DROP | EVENT ...
  isSylvestreReq Boolean  @default(false)
  isMeta         Boolean  @default(false) // true pour le Sylvestre
  iconUrl        String?
  bonusSummary   String?

  steps          Step[]   @relation("DofusSteps")
  prerequisites  RequirementEdge[] @relation("DofusAsTarget")
  dependants     RequirementEdge[] @relation("DofusAsSource")

  progresses     MemberDofusProgress[]
}

model Step {
  id          Int      @id @default(autoincrement())
  dofus       Dofus?   @relation("DofusSteps", fields: [dofusId], references: [id])
  dofusId     Int?
  type        String   // QUEST, DUNGEON, RESOURCE, ALIGNMENT, OTHER_DOFUS, MISC
  label       String
  description String?
  quantity    Int?
  externalRef String?
  weight      Int      @default(1)

  requirements RequirementEdge[] @relation("StepAsSource")
  dependants   RequirementEdge[] @relation("StepAsTarget")
  progresses   StepProgress[]
}

model RequirementEdge {
  id          Int    @id @default(autoincrement())

  fromStep    Step?  @relation("StepAsSource", fields: [fromStepId], references: [id])
  fromStepId  Int?
  fromDofus   Dofus? @relation("DofusAsSource", fields: [fromDofusId], references: [id])
  fromDofusId Int?

  toStep      Step?  @relation("StepAsTarget", fields: [toStepId], references: [id])
  toStepId    Int?
  toDofus     Dofus? @relation("DofusAsTarget", fields: [toDofusId], references: [id])
  toDofusId   Int?
}

model GuildMember {
  id        Int    @id @default(autoincrement())
  discordId String @unique
  name      String
  server    String?

  stepProgresses   StepProgress[]
  dofusProgresses  MemberDofusProgress[]
}

model StepProgress {
  memberId Int
  stepId   Int
  status   String  // NOT_STARTED, IN_PROGRESS, DONE
  doneAt   DateTime?

  member   GuildMember @relation(fields: [memberId], references: [id])
  step     Step        @relation(fields: [stepId], references: [id])

  @@id([memberId, stepId])
}

model MemberDofusProgress {
  memberId          Int
  dofusId           Int
  status            String // NOT_STARTED, IN_PROGRESS, OBTAINED
  completionPercent Int    @default(0)

  member            GuildMember @relation(fields: [memberId], references: [id])
  dofus             Dofus       @relation(fields: [dofusId], references: [id])

  @@id([memberId, dofusId])
}
5. Calculs de complétion
5.1 Complétion d’un Dofus pour un joueur
Principe :

Récupérer toutes les Steps associées à ce Dofus (dofus.steps).

Pour chaque Step, récupérer le StepProgress correspond à (memberId, stepId).

Calculer :

totalWeight = somme(weight de toutes les Steps)

doneWeight = somme(weight pour les Steps avec status = DONE)

completionPercent = floor((doneWeight / totalWeight) * 100).

Ce pourcentage est stocké dans MemberDofusProgress.completionPercent et mis à jour lors des modifications.

5.2 Statut d’un Dofus
NOT_STARTED : 0% et aucune step en IN_PROGRESS ou DONE.

IN_PROGRESS : 0 < % < 100.

OBTAINED : soit completionPercent = 100, soit un flag manuel (ex : joueur coche explicitement “J’ai le Dofus”).

5.3 Complétion moyenne de guilde
Pour un Dofus donné :

avgCompletion = moyenne des completionPercent de tous les membres ayant au moins 1 StepProgress ou un MemberDofusProgress pour ce Dofus.

Ce calcul peut être :

Rafraîchi à chaque update individuelle (éventuellement trop coûteux).

Ou recalculé via une tâche CRON toutes les X minutes.

6. Dofus Sylvestre en tant que méta-Dofus
Le Dofus Sylvestre est particulier : il requiert :

D’autres Dofus (Dom de Pin + potentiellement une grande partie des Dofus primordiaux et/ou de quête).

Un arc de quêtes conséquent (Silvosse, L’arbre qui cache la forêt, Flovoraison, refuge Sylvestre, etc.).

Des donjons et ressources spécifiques.

6.1 Catégorisation interne
Pour le Sylvestre, tu peux définir 3 grandes catégories internes, chacune représentée par un bloc de Steps :

Dofus requis (exemple) :

Dom de Pin

Dofus primordiaux (Ocre, Ivoire, Ébène, etc. – selon les infos exactes)

Éventuellement d’autres Dofus de quête.

Arc de quêtes :

Succès ou steps "L’arbre qui cache la forêt"

Quêtes "Flovoraison"

Quêtes de Silvosse, etc.

Ressources & Donjons :

Packs de ressources clés nécessaires.

Donjons propres à la progression Sylvestre (refuge, boss, etc.).

6.2 Poids et pourcentage
Tu alloues des poids pour que chaque bloc ait un poids global approximatif :

Dofus requis : 35% du poids total.

Arc de quêtes : 30%.

Ressources & Donjons : 35%.

Chaque Step interne se voit attribuer un poids cohérent pour que la somme corresponde (par exemple, avoir le Dom de Pin pèse plus lourd que un donjon isolé).

6.3 Affichage dans le hub
Le hub affiche le Sylvestre avec un graphique circulaire (donut) où :

La progression se décline par catégorie (segments).

Chaque segment est rempli selon la complétion moyenne des Steps de la catégorie.

Cela donne une visualisation claire de :

"On est plutôt en retard sur l’arc de quêtes".

"On a tous (ou presque) les Dofus requis, mais manque les ressources/donjons".

7. JSON de seed (concept)
Avant Prisma, tu peux préparer un fichier JSON/YAML de seed pour une poignée de Dofus clés. Exemple conceptuel pour deux Dofus : Ocre et Sylvestre (simplifié volontairement).

json
{
  "dofus": [
    {
      "slug": "ocre",
      "name": "Dofus Ocre",
      "type": "QUEST",
      "iconUrl": "/icons/dofus/ocre.png",
      "bonusSummary": "+1 PA",
      "isSylvestreReq": true,
      "isMeta": false,
      "steps": [
        {
          "type": "QUEST",
          "label": "Vert Émeraude",
          "weight": 3,
          "externalRef": "https://..."
        },
        {
          "type": "QUEST",
          "label": "Pourpre profond",
          "weight": 3,
          "externalRef": "https://..."
        },
        {
          "type": "QUEST",
          "label": "Bleu Turquoise",
          "weight": 3,
          "externalRef": "https://..."
        },
        {
          "type": "QUEST",
          "label": "La fin de l'éternité",
          "weight": 6,
          "externalRef": "https://..."
        }
      ]
    },
    {
      "slug": "sylvestre",
      "name": "Dofus Sylvestre",
      "type": "QUEST",
      "iconUrl": "/icons/dofus/sylvestre.png",
      "bonusSummary": "+2 PO, gain de Puissance par PM, soin si aucun PM",
      "isSylvestreReq": false,
      "isMeta": true,
      "steps": [
        {
          "type": "OTHER_DOFUS",
          "label": "Posséder le Dom de Pin",
          "weight": 8
        },
        {
          "type": "OTHER_DOFUS",
          "label": "Posséder les Dofus primordiaux",
          "weight": 12
        },
        {
          "type": "QUEST",
          "label": "Arc de quêtes : L'arbre qui cache la forêt",
          "weight": 10,
          "externalRef": "https://..."
        },
        {
          "type": "QUEST",
          "label": "Arc de quêtes : Flovoraison & Silvosse",
          "weight": 10,
          "externalRef": "https://..."
        },
        {
          "type": "DUNGEON",
          "label": "Donjons liés au refuge Sylvestre",
          "weight": 6,
          "externalRef": "https://..."
        },
        {
          "type": "RESOURCE",
          "label": "Ressources clés Sylvestre (packs)",
          "weight": 4
        }
      ]
    }
  ]
}
Ce JSON sera lu par un script de seed qui :

Crée les Dofus.

Crée les Steps associées.

Crée les RequirementEdges nécessaires (par exemple pour lier les Steps OTHER_DOFUS aux Dofus correspondants ou lier le Sylvestre à l’Ocre, etc.).

8. API & endpoints backend
8.1 Endpoints principaux
GET /dofus

Retourne la liste des Dofus, avec les métadonnées de base et, éventuellement, le % de complétion du membre courant (si auth) et la complétion moyenne de guilde.

GET /dofus/:slug

Détails du Dofus, incluant :

les Steps,

le statut et la complétion du joueur courant,

des données de moyenne guilde.

GET /dofus/:slug/guild

Vue agrégée de progression pour tous les membres sur ce Dofus (pour la heatmap / leaderboard).

POST /progress/steps

Permet de mettre à jour en bulk les StepProgress du joueur courant.

Body possible : liste de {stepId, status}.

POST /progress/dofus/:slug/status

Optionnel pour permettre à un joueur de déclarer explicitement qu’il a obtenu un Dofus (utile si ses Steps ne reflètent pas tout – ex : ancien joueur qui a déjà fait les quêtes sans tracking).

8.2 Auth & intégration Discord
Auth basée sur Discord OAuth2 (logique si ton dashboard est déjà pour la guilde).

Mapping discordId → GuildMember.

Optionnel : endpoints spécifiques pour alimenter des slash commands via ton bot.

9. UX détaillée par vue
9.1 Hub Dofus
Composant central :

Donut représentant le Sylvestre avec segments (Dofus requis / Arc de quêtes / Ressources & donjons).

À l’intérieur du donut : % global (guilde) + % perso en plus petit.

Anneau périphérique / grille de cartes :

Pour chaque Dofus majeur (Cawotte, Ocre, Ivoire, etc.) : carte avec icône, nom, type, % perso, % guilde.

Timeline / liste d’étapes Sylvestre (en bas) :

Longue barre avec les grandes étapes du Sylvestre (Dom de Pin, primordiaux, arc quêtes, etc.).

Avatars des joueurs positionnés sur la step où ils en sont.

9.2 Vue détail Dofus
Layout proposé :

Colonne gauche (sticky) :

Icône + nom du Dofus.

Type (badge), bonus, statut perso/guilde.

2 progress bars : perso et guilde.

Boutons :

"Voir la progression guilde"

"Ouvrir le guide" (nouvelle fenêtre vers DPLN / autre guide)

Optionnel : "Marquer comme obtenu".

Colonne droite (scroll) :

Section "Pré-requis" (Steps de type OTHER_DOFUS / ALIGNMENT).

Section "Étapes majeures de quêtes" (Steps de type QUEST).

Section "Ressources" (tableau simple).

Section "Donjons" (liste checkable).

Chaque Step :

Checkbox (Not started / In progress / Done) ou au moins un toggle sur 2–3 états.

Nom.

(Optionnel) icône type (quest/donjon/ressource).

Lien discret vers un guide externe (icône de lien).

9.3 Vue guild/heatmap
Tableau ou heatmap :

Lignes = joueurs.

Colonnes = Steps principales pour ce Dofus.

Cellules colorées selon le statut (gris / orange / vert).

Avatars intégrés.

Sidebar ou header avec :

Filtres (par rang, par pourcentage).

Bouton "Trouver des joueurs au même stade que moi".

10. Gamification
Tu peux enrichir l’engagement avec :

Badges :

Obtenir X Dofus.

Terminer un Dofus en moins de N jours après l’avoir commencé.

Être le premier de la guilde à obtenir un meta-Dofus.

Leaderboards :

Nombre de Dofus obtenus.

Progression la plus rapide sur le Sylvestre.

Annonces Discord (via webhooks ou ton bot) :

Quand quelqu’un marque un Dofus comme obtenu, annonce dans un canal dédié.

11. Roadmap de développement
Phase 1 – Data & setup

Implémenter les modèles Prisma.

Ajouter le JSON de seed pour 3–5 Dofus clés (Cawotte, Ocre, Ivoire, Sylvestre, Dom de Pin).

Scripts de seed.

Implémenter les endpoints GET /dofus et GET /dofus/:slug.

Phase 2 – UI basique

Vue Hub avec liste de Dofus sous forme de cartes (sans encore le donut avancé).

Vue détail Dofus avec sections et checkboxes.

Endpoint POST /progress/steps + mise à jour du % perso.

Phase 3 – Vue guilde

Endpoint GET /dofus/:slug/guild.

Vue heatmap/leaderboard.

Phase 4 – Donut Sylvestre & meta

Mise en place de la logique catégorie interne pour le Sylvestre.

Donut central sur le hub.

Phase 5 – Gamification & Discord

Badges, annonces, commandes Discord.

12. Principes généraux
Ne pas sur-détailler :
Tu restes au niveau « étape majeure », pas au niveau de chaque quête individuelle.

Toujours garder en tête l’usage guilde :
La valeur est dans la comparaison, la coordination et la motivation, plus que dans l’exhaustivité.

Data-driven, mais éditable :
Ton JSON de seed est versionné ; tu peux faire évoluer les Steps/weights à mesure que ta guilde avance et que tu affines la granularité.

Stack alignée avec toi :
Tailwind pour le UI, Prisma pour l’ORM, API Node/TS, intégration Discord afin que l’expérience soit fluide entre le jeu, le bot et le dashboard.