/**
 * Catalogue des Sorts Communs de Dofus (sorts universels débloqués par tous les personnages).
 *
 * ⚠️ Fichier PUR (aucun IO / aucun fetch) : utilisable côté client et serveur.
 * Intégrable dans l'onglet Sorts et la Simulation tactique.
 *
 * 🧨 **Correction du 26/10/2026 — les carrés verts et les données inventées.**
 *
 * Les `imageUrl` valaient `/api/assets-dofus/spells/371`, `370`, `373`… : des nombres qui ne sont
 * ni l'id du sort ni son `iconId`. Le proxy n'accepte que l'**URL amont officielle**
 * (`img/spells/sort_<iconId>.png`, transmise en `?url=`) ; sans elle il tentait
 * `img/spells/371.png`, recevait 404 et renvoyait son placeholder — un pixel vert (mesuré
 * `RGBA(0, 254, 0, 127)`) étiré en aplat. D'où les 10 vignettes vertes de l'onglet Sorts.
 *
 * Chaque entrée porte donc désormais l'**URL amont officielle** (mesurée sur
 * `GET /spells?name.fr=<nom>`), et la description officielle quand DofusDB en fournit une
 * (Flamiche tape « dans le meilleur élément du lanceur », pas « Feu »).
 *
 * Mesures du 26/10/2026 (`api.dofusdb.fr/spells`) — id officiel → `iconId` :
 *   · Flamiche `350` → `11763`      · Libération `368` → `13847`
 *   · Cawotte `6708` → `12460`      · Invocation de Chaferfu `373` → `12452`
 *   · Invocation d'Arakne `214` → `214`   · Marteau de Moon `293` → `15562`
 *   · Boomerang Perfide `364` → `11765`   · Maîtrise d'Arme `3506` → `12449`
 *   · Nécronyx `9348` → `11780`
 *
 * ⚠️ « Foudroiement » a été **retiré** : `GET /spells?name.fr=Foudroiement` renvoie **0**
 * résultat (nom erroné ou sort absent du catalogue). On ne garde pas une entrée inventée.
 *
 * ⚪ **Reste connu** : les jets (dégâts/PA/portée) restent écrits à la main — ils ne sont pas
 * siphonnés comme ceux des 19 classes (`ClassSpellbook`). C'est un chantier séparé, tracé dans
 * `docs/ROADMAP.md` ; l'icône, l'id officiel et la description sont, eux, mesurés.
 *
 * ⚠️ `id` reste un identifiant **local stable** (clé d'état React pour les grades/paliers) :
 * il ne doit jamais entrer en collision avec un id de sort de classe dans la liste fusionnée.
 * L'id officiel est rappelé en commentaire, à côté de chaque entrée.
 */

import type { ClassSpellDamage } from "@/lib/class-spells-siphon";

export const COMMON_SPELLS: ClassSpellDamage[] = [
    {
        // DofusDB 350 · iconId 11763
        id: 99001,
        name: "Flamiche",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_11763.png",
        description: "Occasionne des dommages dans le meilleur élément du lanceur.",
        apCost: 2,
        minRange: 1,
        maxRange: 6,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 3,
        maxCastPerTarget: 2,
        minCastInterval: 0,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [
            { min: 9, max: 11, element: "feu", grade: 1 }
        ],
        critDamages: [
            { min: 12, max: 14, element: "feu", grade: 1 }
        ],
    },
    {
        // DofusDB 368 · iconId 13847
        id: 99003,
        name: "Libération",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_13847.png",
        description: "Repousse les cibles en zone.",
        apCost: 3,
        minRange: 0,
        maxRange: 0,
        criticalChance: 0,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 2,
        castTestLos: false,
        castInLine: false,
        castInDiagonal: false,
        zone: { shape: "Croix", size: 1, range: 0 },
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [],
    },
    {
        // DofusDB 6708 · iconId 12460
        id: 99004,
        name: "Cawotte",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_12460.png",
        description: "Invoque une Cawotte statique qui soigne en zone à chaque tour.",
        apCost: 2,
        minRange: 1,
        maxRange: 6,
        criticalChance: 0,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 3,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [],
    },
    {
        // DofusDB 373 · iconId 12452
        id: 99005,
        name: "Invocation de Chaferfu",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_12452.png",
        description: "Invoque un Chaferfu qui occasionne des dommages Terre, aléatoirement aux alliés ou aux ennemis.",
        apCost: 3,
        minRange: 1,
        maxRange: 4,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 4,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [],
    },
    {
        // DofusDB 214 · iconId 214
        id: 99006,
        name: "Invocation d'Arakne",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_214.png",
        description: "Invoque une Arakne qui tacle et retire des PM.",
        apCost: 3,
        minRange: 1,
        maxRange: 4,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 4,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [],
    },
    {
        // DofusDB 293 · iconId 15562
        id: 99007,
        name: "Marteau de Moon",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_15562.png",
        description: "Occasionne des dommages Air à portée et retire de la Portée.",
        apCost: 4,
        minRange: 1,
        maxRange: 6,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 2,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [
            { min: 34, max: 38, element: "air", grade: 1 }
        ],
        critDamages: [
            { min: 41, max: 45, element: "air", grade: 1 }
        ],
    },
    {
        // DofusDB 364 · iconId 11765
        id: 99008,
        name: "Boomerang Perfide",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_11765.png",
        description: "Vole de la vie et augmente une caractéristique du lanceur dans un élément aléatoire.",
        apCost: 4,
        minRange: 1,
        maxRange: 8,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 1,
        castTestLos: false,
        castInLine: true,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [
            { min: 24, max: 28, element: "air", grade: 1 }
        ],
        critDamages: [
            { min: 29, max: 33, element: "air", grade: 1 }
        ],
    },
    {
        // DofusDB 3506 · iconId 12449
        id: 99009,
        name: "Maîtrise d'Arme",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_12449.png",
        description: "Augmente la Puissance de l'arme du lanceur.",
        apCost: 2,
        minRange: 0,
        maxRange: 0,
        criticalChance: 0,
        critMult: 1.5,
        maxCastPerTurn: 1,
        maxCastPerTarget: 1,
        minCastInterval: 3,
        castTestLos: false,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [],
    },
    {
        // DofusDB 9348 · iconId 11780
        id: 99010,
        name: "Nécronyx",
        imageUrl: "https://api.dofusdb.fr/img/spells/sort_11780.png",
        description: "Applique l'état Nécronyx sur la cible.",
        apCost: 2,
        minRange: 1,
        maxRange: 4,
        criticalChance: 5,
        critMult: 1.5,
        maxCastPerTurn: 2,
        maxCastPerTarget: 1,
        minCastInterval: 0,
        castTestLos: true,
        castInLine: false,
        castInDiagonal: false,
        zone: null,
        grade: 1,
        minPlayerLevel: 1,
        isVariant: false,
        damages: [
            { min: 14, max: 17, element: "neutre", grade: 1 }
        ],
        critDamages: [
            { min: 18, max: 21, element: "neutre", grade: 1 }
        ],
    },
];
