/**
 * Gardes — **Panneau « Quête Ocre » de l'overlay interne** (bouton archimonstre).
 *
 * 🎯 Demande user (21/09/2026, verbatim) : « un bouton avec l'icone archimonstre
 * `public/assets/dofus/icons/archimonster.png` qui affichera l'avancée si l'utilisateur a
 * lié son compte metamob, avec les archimonstres et les boss qu'il a ou pas, le nombre de
 * pierre nécessaire pour faire la quete ocre … inutile d'afficher la recette » +
 * « tout dois provenir de chez nous, aucune dépendance à dofusdb pour les images ».
 *
 * 🔍 Mesures (DofusDB, articles 9686 → 9690) : seuils de capture 50 / 100 / 150 / 190 /
 * 1000 → 5 paliers. Les 5 WebP sont déjà siphonnés chez nous.
 *
 * 🛡️ Ce que ce test verrouille : les seuils (bornes exactes), la règle « encore à
 * capturer » (identique au dashboard), le comptage des pierres par palier, la surface
 * (overlay INTERNE uniquement — jamais le guide public), et **l'absence totale d'URL
 * DofusDB** pour les images.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SOUL_STONES,
  applyOcreQuantity,
  buildOcrePlan,
  isOcreMonsterNeeded,
  isOcreTarget,
  metamobProfileUrl,
  nextOcreQuantity,
  ocreLocalState,
  ocreMonsterIcon,
  ocreMonsterImage,
  ocreStateLabel,
  soulStoneForLevel,
  soulStoneLevelLabel,
  toOcrePanelData,
  unavailableOcrePanelData,
  type OcreMonsterLite,
} from "@/lib/ocre-soul-stones";
import { computeMonsterState } from "@/lib/metamob-client";
import { RushOverlayOcreModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayOcreModal";
import { OcreSoulStonesCard } from "@/components/ocre/OcreSoulStonesPanel";
import { OcreTargetStepper } from "@/components/ocre/OcreTargetBits";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

const monster = (over: Partial<OcreMonsterLite> = {}): OcreMonsterLite => ({
  id: 1,
  nameFr: "Monstre",
  type: "archimonstre",
  owned: 0,
  state: "MANQUANT",
  levelMin: 60,
  levelMax: 60,
  step: 3,
  zone: "Amakna",
  ...over,
});

describe("pierres d'âme — seuils mesurés (DofusDB 9686-9690)", () => {
  it("couvre les bornes exactes des 4 premiers paliers", () => {
    expect(soulStoneForLevel(50).id).toBe(9686);
    expect(soulStoneForLevel(51).id).toBe(9687);
    expect(soulStoneForLevel(100).id).toBe(9687);
    expect(soulStoneForLevel(101).id).toBe(9688);
    expect(soulStoneForLevel(150).id).toBe(9688);
    expect(soulStoneForLevel(151).id).toBe(9689);
    expect(soulStoneForLevel(190).id).toBe(9689);
    expect(soulStoneForLevel(191).id).toBe(9690);
    expect(soulStoneForLevel(200).id).toBe(9690);
  });

  it("ne promet rien sur un niveau inconnu (0 → plus petite pierre)", () => {
    expect(soulStoneForLevel(0).id).toBe(9686);
    expect(soulStoneForLevel(Number.NaN).id).toBe(9686);
  });

  it("les 5 pierres sont ordonnées et étiquetées", () => {
    expect(SOUL_STONES.map((s) => s.id)).toEqual([9686, 9687, 9688, 9689, 9690]);
    expect(SOUL_STONES.map((s) => s.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(soulStoneLevelLabel(SOUL_STONES[1])).toBe("Niv. ≤ 100");
    expect(soulStoneLevelLabel(SOUL_STONES[4])).toBe("Niv. 191 et +");
  });

  it("chaque pierre a son WebP LOCAL (aucune dépendance externe)", () => {
    for (const stone of SOUL_STONES) {
      expect(stone.imageUrl.startsWith("/uploads/assets-dofus/items/")).toBe(true);
      expect(existsSync(path.join(ROOT, "public", stone.imageUrl.replace(/^\//, "")))).toBe(true);
    }
  });
});

describe("cibles encore à capturer — même règle que getMyOcreProgress", () => {
  it("un MANQUANT est à faire, un POSSEDE ou DOUBLON non", () => {
    expect(isOcreMonsterNeeded(monster(), 0)).toBe(true);
    expect(isOcreMonsterNeeded(monster({ state: "POSSEDE" }), 0)).toBe(false);
    expect(isOcreMonsterNeeded(monster({ state: "DOUBLON" }), 0)).toBe(false);
  });

  it("une étape déjà passée ne compte plus (l'étape est derrière nous)", () => {
    expect(isOcreMonsterNeeded(monster({ step: 3 }), 5)).toBe(false);
    expect(isOcreMonsterNeeded(monster({ step: 5 }), 5)).toBe(true);
    expect(isOcreMonsterNeeded(monster({ step: 7 }), 5)).toBe(true);
  });

  it("seuls les archimonstres et les gardiens sont des cibles", () => {
    expect(isOcreTarget({ type: "archimonstre" })).toBe(true);
    expect(isOcreTarget({ type: "boss" })).toBe(true);
    expect(isOcreTarget({ type: "monstre" })).toBe(false);
  });
});

describe("plan complet — pierres à prévoir, compteurs archis / gardiens", () => {
  const data = {
    currentStep: 3,
    monsters: [
      monster({ id: 301, nameFr: "Blop Coco Royal", type: "boss", levelMin: 60, levelMax: 60 }),
      monster({ id: 302, nameFr: "Abraknyde Ancestral", levelMin: 90, levelMax: 90 }),
      monster({ id: 303, nameFr: "Bouftou Royal", type: "boss", levelMin: 30, levelMax: 30, state: "POSSEDE", owned: 1 }),
      monster({ id: 304, nameFr: "Gelée Royale Bleuet", type: "boss", levelMin: 200, levelMax: 200 }),
      monster({ id: 305, nameFr: "Monstre Simple", type: "monstre", levelMin: 10, levelMax: 10 }),
      monster({ id: 306, nameFr: "Etape trop vieille", levelMin: 10, levelMax: 10, step: 2 }),
    ],
  };
  const plan = buildOcrePlan(data);

  it("ignore les monstres simples et les étapes passées", () => {
    expect(plan.targets.map((t) => t.nameFr)).not.toContain("Monstre Simple");
    expect(plan.targets.find((t) => t.nameFr === "Etape trop vieille")!.needed).toBe(false);
  });

  it("compte une pierre par cible restante, par palier", () => {
    const byId = Object.fromEntries(plan.stones.map((s) => [s.stone.id, s.count]));
    expect(byId[9686]).toBe(0); // palier vide : renvoyé quand même (l'UI décide)
    expect(byId[9687]).toBe(2); // 60 et 90 → Moyenne
    expect(byId[9690]).toBe(1); // 200 → Gigantesque
    expect(plan.stoneTotal).toBe(3);
  });

  it("sépare archimonstres et gardiens, avec la progression du dashboard", () => {
    expect(plan.archis).toEqual({ total: 2, owned: 1, missing: 1 });
    expect(plan.bosses).toEqual({ total: 3, owned: 1, missing: 2 });
    expect(plan.progress).toEqual({ total: 5, owned: 2, missing: 3, percent: 40 });
  });

  it("présente les manquants d'abord", () => {
    expect(plan.targets[0].needed).toBe(true);
    expect(plan.targets[plan.targets.length - 1].needed).toBe(false);
  });
});

describe("pont serveur → overlay", () => {
  it("ne garde que l'utile et convertit les dates en ISO", () => {
    const out = toOcrePanelData({
      monsters: [{ id: 301, nameFr: "Blop Coco Royal", type: "boss", owned: 1, state: "POSSEDE", levelMax: 60, step: 2 }],
      questInfo: { currentStep: 12, totalSteps: 34, characterName: "Pseudo", serverName: "Draconiros", parallelQuests: 2 },
      pseudo: "Wylan",
      lastSync: new Date("2026-09-21T10:00:00.000Z"),
    });
    expect(out.currentStep).toBe(12);
    expect(out.totalSteps).toBe(34);
    expect(out.parallelQuests).toBe(2);
    expect(out.pseudo).toBe("Wylan");
    expect(out.lastSync).toBe("2026-09-21T10:00:00.000Z");
    expect(out.monsters[0]).toMatchObject({ id: 301, levelMax: 60, step: 2, state: "POSSEDE" });
  });

  it("retombe sur UNE copie exigée quand la donnée manque (jamais 0)", () => {
    expect(toOcrePanelData({ monsters: [] }).parallelQuests).toBe(1);
    expect(toOcrePanelData({ monsters: [], questInfo: { parallelQuests: 0 } }).parallelQuests).toBe(1);
  });

  it("l'état « indisponible » garde un panneau vide mais utilisable", () => {
    const out = unavailableOcrePanelData();
    expect(out.unavailable).toBe(true);
    expect(out.monsters).toEqual([]);
    expect(buildOcrePlan(out).stoneTotal).toBe(0);
  });
});

describe("écriture en direct — pas ±1, état local, lien profil", () => {
  it("le premier « + » déclare exactement ce que la quête demande", () => {
    expect(nextOcreQuantity(0, 1, 1)).toBe(1);
    expect(nextOcreQuantity(0, 1, 3)).toBe(3);
    expect(nextOcreQuantity(1, 1, 1)).toBe(2);
    expect(nextOcreQuantity(3, 1, 3)).toBe(4);
    expect(nextOcreQuantity(1, -1, 3)).toBe(0);
    expect(nextOcreQuantity(0, -1, 3)).toBe(0);
  });

  it("l'état local suit EXACTEMENT computeMonsterState (metamob-client)", () => {
    for (const pq of [1, 2, 5]) {
      for (const owned of [0, 1, 2, 3, 5, 6, 42, -1]) {
        expect(ocreLocalState(owned, pq), `owned=${owned} pq=${pq}`).toBe(computeMonsterState(owned, pq));
      }
    }
  });

  it("les libellés disent ce qui est réellement déclaré", () => {
    expect(ocreStateLabel(0, 1)).toBe("À capturer");
    expect(ocreStateLabel(0, 3)).toBe("À capturer");
    expect(ocreStateLabel(1, 2)).toBe("À capturer ×1/2");
    expect(ocreStateLabel(2, 2)).toBe("Possédé ×2");
    expect(ocreStateLabel(4, 2)).toBe("Possédé ×4");
  });

  it("appliquer une quantité est immuable et recalcule l'état (et les pierres)", () => {
    const before = [monster({ id: 7, owned: 0, state: "MANQUANT" })];
    const after = applyOcreQuantity(before, 7, 2, 2);
    expect(before[0].owned).toBe(0);
    expect(after[0]).toMatchObject({ owned: 2, state: "POSSEDE" });
    expect(applyOcreQuantity(after, 7, 0, 2)[0].state).toBe("MANQUANT");
    // Une cible validée ne demande plus de pierre : le plan suit l'état local.
    expect(buildOcrePlan({ monsters: after, currentStep: 0 }).stoneTotal).toBe(0);
    expect(buildOcrePlan({ monsters: before, currentStep: 0 }).stoneTotal).toBe(1);
  });

  it("le lien de profil n'existe que si le pseudo est connu", () => {
    expect(metamobProfileUrl("Wylan")).toBe("https://www.metamob.fr/profile/Wylan");
    expect(metamobProfileUrl("Jean Michel")).toBe("https://www.metamob.fr/profile/Jean%20Michel");
    expect(metamobProfileUrl(null)).toBeNull();
    expect(metamobProfileUrl("   ")).toBeNull();
  });
});

describe("images — 100 % chez nous (aucune référence DofusDB)", () => {
  const sources = [
    "src/lib/ocre-soul-stones.ts",
    "src/components/ocre/OcreSoulStonesPanel.tsx",
    "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayOcreModal.tsx",
  ];

  it("aucune URL DofusDB, aucun appel au proxy qui siphonne", () => {
    for (const rel of sources) {
      const src = read(rel);
      // Un hôte « dofusdb » (api.dofusdb.fr, www.dofusdb.fr, static.dofusdb.fr…) = dépendance.
      expect(src, rel).not.toMatch(/dofusdb\.[a-z]{2,}/i);
      expect(src, rel).not.toContain("/api/assets-dofus");
    }
  });

  it("les vignettes viennent du WebP local, le repli de nos pictos du jeu", () => {
    expect(ocreMonsterImage(301)).toBe("/uploads/assets-dofus/monsters/301.webp");
    expect(ocreMonsterIcon("archimonstre")).toBe("/assets/dofus/icons/archimonster.png");
    expect(ocreMonsterIcon("boss")).toBe("/assets/dofus/icons/boss.png");
    expect(ocreMonsterIcon(undefined)).toBe("/assets/dofus/icons/crossedSwords.png");
    for (const icon of ["archimonster.png", "boss.png", "crossedSwords.png"]) {
      expect(existsSync(path.join(ROOT, "public", "assets", "dofus", "icons", icon))).toBe(true);
    }
  });
});


// -----------------------------------------------------------------------------
// Rendu réel
// -----------------------------------------------------------------------------

const PANEL = {
  currentStep: 1,
  totalSteps: 34,
  characterName: "Wylan",
  serverName: "Draconiros",
  pseudo: "Wylan",
  parallelQuests: 2,
  lastSync: "2026-09-21T13:50:00.000Z",
  monsters: [
    // Déclaré 1 sur les 2 copies demandées → encore « À faire », mais partiel.
    monster({ id: 302, nameFr: "Abraknyde Ancestral", levelMin: 76, levelMax: 90, zone: "Amakna", owned: 1, state: "MANQUANT" }),
    monster({ id: 301, nameFr: "Blop Coco Royal", type: "boss", levelMin: 60, levelMax: 60, zone: "Amakna" }),
    // Validé (2/2) : masqué par le filtre « Restants », mais compté comme possédé.
    monster({ id: 303, nameFr: "Bouftou Royal", type: "boss", levelMin: 30, levelMax: 30, state: "POSSEDE", owned: 2 }),
  ],
};

describe("rendu réel — panneau de l'overlay (données fournies, aucun chargement)", () => {
  const html = render(
    React.createElement(RushOverlayOcreModal, {
      guildId: "1290442961380835451",
      isLightMode: false,
      initial: PANEL,
      onClose: () => {},
    })
  );

  it("affiche la quête, les pierres et leurs plages de niveaux — sans le mot « Tier »", () => {
    expect(html).toContain("Quête Ocre");
    expect(html).toContain("Pierres d&#x27;âme à prévoir");
    expect(html).toContain("×2"); // 90 + 60 → Moyenne
    expect(html).toContain("Niv. ≤ 100");
    expect(html).not.toContain("Tier");
  });

  it("sert les vignettes locales (pierres ET monstres) et les états", () => {
    expect(html).toContain("/uploads/assets-dofus/items/9687.webp");
    expect(html).toContain("/uploads/assets-dofus/monsters/302.webp");
    expect(html).toContain("À capturer ×1/2"); // déclaré 1 sur les 2 copies exigées
    expect(html).toContain("Archimonstres");
    expect(html).toContain("Gardiens");
    expect(html).not.toContain("Lecture de"); // données fournies ⇒ pas d'écran de chargement
  });

  it("le seul lien externe est le profil Metamob : aucune image distante", () => {
    expect(html).not.toMatch(/src="https?:\/\//);
    expect(html).not.toContain("dofusdb");
    expect(html).toContain("https://www.metamob.fr/profile/Wylan");
    expect(html).toContain("/assets/brands/metamob.png");
  });

  it("les pas ±1 sont présents et accessibles", () => {
    expect(html).toContain("Ajouter un exemplaire de Blop Coco Royal");
    expect(html).toContain("Retirer un exemplaire de Abraknyde Ancestral");
  });
});

describe("rendu réel — encart du module Quête Ocre", () => {
  const html = render(React.createElement(OcreSoulStonesCard, { data: PANEL }));

  it("résume les pierres, l'avancée et l'astuce", () => {
    expect(html).toContain("Pierres d&#x27;âme à prévoir");
    expect(html).toContain("Niv. ≤ 100");
    expect(html).toContain("/uploads/assets-dofus/items/9687.webp");
    expect(html).toContain("Astuce");
    expect(html).not.toContain("Tier");
    expect(html).not.toMatch(/https:\/\//);
  });
});

// -----------------------------------------------------------------------------
// Câblage des surfaces (le bouton n'existe QUE dans l'overlay interne)
// -----------------------------------------------------------------------------

describe("câblage — overlay interne seulement", () => {
  const header = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx");
  const overlayClient = read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx");
  const overlayPage = read("src/app/overlay/guide/[guildId]/[slug]/page.tsx");
  const publicGuide = read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");

  it("le header porte le picto archimonstre et la pastille du reste à capturer", () => {
    expect(header).toContain('src="/assets/dofus/icons/archimonster.png"');
    expect(header).toContain("onOpenOcre && ocre && (");
    expect(header).toContain("ocre.missing");
    // Le bouton vit dans la rangée d'actions (plus de condition « narrow ») : la place
    // est rendue par le retour bug, déplacé dans le menu « ⋯ » avec l'aide.
    expect(header).not.toContain("onOpenOcre && ocre && !narrow");
    expect(header).toContain("Signaler un bug");
  });

  it("l'overlay conditionne le panneau à un membre connecté et à sa guilde", () => {
    expect(overlayClient).toContain('const ocreEnabled = !isGuest && !!ocre && !!guildId && guildId !== "public"');
    expect(overlayClient).toContain("<RushOverlayOcreModal");
    expect(overlayClient).toContain("initial={ocre}");
  });

  it("la page overlay ne charge les données Ocre que si Metamob est lié", () => {
    expect(overlayPage).toContain("metamobPseudo");
    expect(overlayPage).toContain('await import("@/server/actions/ocre-actions")');
    expect(overlayPage).toContain("toOcrePanelData");
    expect(overlayPage).toContain("ocre={ocre}");
  });

  it("le guide PUBLIC ne reçoit jamais le panneau Ocre", () => {
    expect(publicGuide).not.toContain("ocre={");
    expect(publicGuide).not.toContain("RushOverlayOcreModal");
  });

  it("la page PiP transmet les données figées par le payload", () => {
    expect(read("src/store/rush-overlay-store.ts")).toContain("ocre?: OcrePanelData | null");
    expect(read("src/app/dashboard/[guildId]/_components/rush-overlay-host.tsx")).toContain("ocre={payload.ocre ?? null}");
    expect(read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx")).toContain("toOcrePanelData(");
  });

  it("l'écriture passe par la file partagée, bornée côté serveur (rate limit + pause)", () => {
    const hook = read("src/hooks/use-ocre-write-queue.ts");
    const modal = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayOcreModal.tsx");
    const action = read("src/server/actions/ocre-actions.ts");

    // La modale ne connaît NI l'action NI la file : elle consomme le hook partagé.
    expect(modal).toContain("useOcreWriteQueue");
    expect(modal).toContain("<OcreTargetStepper");
    expect(modal).not.toContain("updateUserMonsterQuantityAction");
    expect(modal).not.toContain("toast."); // le retour s'affiche dans le panneau, pas dans un toast PiP

    expect(hook).toContain("createOcreWriteQueue");
    expect(hook).toContain("updateUserMonsterQuantityAction");
    // 🐞 Régression du 21/09 : la file est créée DANS l'effet (StrictMode-safe). Un drapeau
    // « vivant » posé au nettoyage du montage restait à false et plus rien ne partait.
    expect(hook).toContain("const queue = createOcreWriteQueue({");
    expect(hook).not.toContain("aliveRef");

    // Bornes serveur : 60 écritures/min par membre + délai de reprise transmis au client.
    expect(action).toContain("`ocre:quantity:${session.user.id}`");
    expect(action).toContain("retryAfterMs");
    expect(hook).toContain("error.pauseMs = res.retryAfterMs");
  });

  it("le pseudo Metamob est bien transporté jusqu'au panneau (lien profil)", () => {
    expect(read("src/app/overlay/guide/[guildId]/[slug]/page.tsx")).toContain("pseudo: profile.metamobPseudo");
    expect(read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx")).toContain("parallelQuests: ocreRes.data.questInfo?.parallelQuests ?? 1");
  });
});

// -----------------------------------------------------------------------------
// Garde anti-slop du module Quête Ocre (mêmes exclusions que la charte du dépôt)
// -----------------------------------------------------------------------------

describe("module Quête Ocre — garde anti-slop", () => {
  /** Classes / motifs bannis par la charte (verre dépoli, dégradés, glow, émojis). */
  const SLOP = /backdrop-blur|bg-gradient|hover:scale-\[|shadow-\[0_|blur-3xl|✨|🔴|🟢|🟡|AuroraBackground/;
  /** Le garde porte sur le CODE : les commentaires qui EXPLIQUENT la charte sont légitimes. */
  const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const FILES = [
    "src/app/dashboard/[guildId]/quete-ocre/page.tsx",
    "src/components/ocre/ocre-stats.tsx",
    "src/components/ocre/ocre-monster-card.tsx",
    "src/components/ocre/ocre-filter-bar.tsx",
  ];

  it("aucun motif banni ne subsiste dans les surfaces visibles du module", () => {
    for (const rel of FILES) {
      expect(codeOnly(read(rel)), rel).not.toMatch(SLOP);
    }
  });

  it("l'encart pierres est le seul rendu des pierres (pas de recette dupliquée)", () => {
    expect(read("src/components/ocre/ocre-dashboard.tsx")).not.toContain("Astuce Ocre");
    expect(read("src/app/dashboard/[guildId]/quete-ocre/page.tsx")).toContain("<OcreSoulStonesCard");
  });
});


// -----------------------------------------------------------------------------
// Modale « Mon Ocre » (guide) : même registre, mêmes règles que l'overlay
// -----------------------------------------------------------------------------

describe("rendu réel — pas ±1 d'une cible (brique partagée)", () => {
  const html = render(
    React.createElement(OcreTargetStepper, { owned: 0, requiredCopies: 1, onStep: () => {} })
  );
  const htmlOwned = render(
    React.createElement(OcreTargetStepper, { owned: 2, requiredCopies: 1, onStep: () => {} })
  );
  const htmlPartial = render(
    React.createElement(OcreTargetStepper, { owned: 1, requiredCopies: 2, onStep: () => {} })
  );

  it("nomme l'action réelle : « À capturer » / « Possédé ×N » (jamais « En poche »)", () => {
    expect(html).toContain("À capturer");
    expect(htmlOwned).toContain("Possédé ×2");
    expect(htmlPartial).toContain("À capturer ×1/2");
    for (const markup of [html, htmlOwned, htmlPartial]) {
      expect(markup).not.toContain("En poche");
      expect(markup).not.toContain("Manquant");
    }
  });

  it("n'autorise pas le retrait sous zéro", () => {
    expect(html).toMatch(/<button type="button" disabled="" aria-label="Retirer un exemplaire \(Metamob\)"/);
    expect(htmlOwned).toMatch(/<button type="button" aria-label="Retirer un exemplaire \(Metamob\)"/);
  });
});

describe("modale Mon Ocre (guide) — mêmes briques, zéro CSS dédié", () => {
  const modal = read("src/components/dofus-quests/OcreProgressModal.tsx");
  const bits = read("src/components/ocre/OcreTargetBits.tsx");
  const css = read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/guide-styles.css");

  it("consomme le hook partagé et les briques partagées (aucune écriture directe)", () => {
    expect(modal).toContain("useOcreWriteQueue");
    expect(modal).toContain("<OcreTargetStepper");
    expect(modal).toContain("<OcreMonsterThumb");
    expect(modal).not.toContain("updateUserMonsterQuantityAction");
    expect(modal).not.toContain("toast."); // retour d'écriture DANS la modale
  });

  it("a quitté l'ancien vocabulaire et les classes CSS dédiées", () => {
    // Garde sur le CODE : les commentaires qui EXPLIQUENT le retrait sont légitimes.
    const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(modal).not.toContain("En poche");
    expect(codeOnly(modal)).not.toContain("ocre-row");
    expect(codeOnly(modal)).not.toContain("ocre-tab");
    expect(css).not.toMatch(/\.ocre-(row|tab|state)/);
    expect(codeOnly(modal)).not.toContain("rounded-[2rem]");
  });

  it("n'affiche que nos vignettes locales (aucune image Metamob dans le DOM)", () => {
    expect(modal).not.toContain("src={m.image}");
    expect(bits).toContain("ocreMonsterImage(id)");
    expect(bits).toContain("ocreStateLabel(owned, requiredCopies)"); // libellé : source unique
  });
});

