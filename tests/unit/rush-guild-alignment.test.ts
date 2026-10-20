/**
 * Gardes — **Lot 1** : la modale « Alignement de la guilde ».
 *
 * 🎯 Demande user (20/10/2026, verbatim) : « on a un bloc avec son alignement, le clic
 * nous renvoie sur notre profil perso → on vire cette mécanique et on ouvre une modale
 * qui liste par alignement bontarien / brakmarien / neutre et par ordre qui est quel
 * alignement / quel ordre avec son vrai niveau ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  • le panneau regroupe par camp, puis par Ordre, avec la tranche réelle ;
 *  • le clic du guide interne n'ouvre PLUS la page profil ;
 *  • les données viennent de `guildProgress` (zéro requête ajoutée).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GuildAlignmentPanel,
  type AlignmentMember,
} from "@/components/dofus-quests/rush/GuildAlignmentPanel";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const MEMBERS: AlignmentMember[] = [
  { profileId: "p1", userName: "Kaelis", alignment: "bontarien", alignmentOrder: "vaillant", alignmentLevel: 42 },
  { profileId: "p2", userName: "Wylan", alignment: "bontarien", alignmentOrder: "attentif", alignmentLevel: 12, isSelf: true },
  { profileId: "p3", userName: "Drakha", alignment: "brakmarien", alignmentOrder: "putride", alignmentLevel: 37 },
  { profileId: "p4", userName: "Nina", alignment: null, alignmentOrder: null, alignmentLevel: 0 },
];

const render = () =>
  renderToStaticMarkup(React.createElement(GuildAlignmentPanel, { members: MEMBERS }));

describe("panneau « Alignement de la guilde »", () => {
  it("affiche les trois camps avec leurs compteurs", () => {
    const html = render();
    expect(html).toContain("Bontariens");
    expect(html).toContain("Brâkmariens");
    expect(html).toContain("Neutres");
  });

  it("liste chaque membre dans son camp, avec sa tranche réelle", () => {
    const html = render();
    expect(html).toContain("Kaelis");
    expect(html).toContain("Drakha");
    expect(html).toContain("T42");
    expect(html).toContain("T37");
    // Le neutre est listé à part, il n'est pas inventé dans un camp.
    expect(html).toContain("Nina");
  });

  it("marque le membre courant", () => {
    expect(render()).toContain("toi");
  });

  it("propose de choisir son alignement quand le membre courant est neutre", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuildAlignmentPanel, {
        members: [{ profileId: "x", userName: "Sans", alignment: null, isSelf: true }],
        onChangeAlignment: () => {},
      })
    );
    expect(html).toContain("Choisir mon alignement");
  });

  it("ne rend rien d'inventé pour un membre sans alignement", () => {
    const html = renderToStaticMarkup(
      React.createElement(GuildAlignmentPanel, {
        members: [{ profileId: "x", userName: "Sans", alignment: null }],
      })
    );
    expect(html).toContain("Neutres");
    expect(html).toContain("Sans");
    // Les compteurs des deux camps restent à 0, mais AUCUNE section d'Ordre n'est rendue.
    expect(html).not.toContain("/ordres/bontarien/");
    expect(html).not.toContain("/ordres/brakmarien/");
  });
});

describe("câblage du Lot 1 — le clic n'ouvre plus le profil", () => {
  const CLIENT = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

  it("le bloc d'alignement ouvre la modale de guilde", () => {
    const code = read(CLIENT);
    expect(code).toContain("setGuildAlignmentOpen(true)");
    expect(code).toContain("<GuildAlignmentModal");
    // La mécanique supprimée : renvoi vers la page profil personnel.
    expect(code).not.toMatch(/onClick=\{\(\)=>router\.push\(`\/dashboard\/\$\{guildId\}\/profile`\)\}/);
  });

  it("les membres sont dédupliqués depuis guildProgress (aucune requête en plus)", () => {
    const code = read(CLIENT);
    expect(code).toMatch(/const alignmentMembers=useMemo<AlignmentMember\[\]>\(\(\)=>\{/);
    expect(code).toContain("byProfile.has(row.profileId)");
  });

  it("le choix cité / Ordre / tranche se fait dans le rush (Lot 2)", () => {
    const code = read(CLIENT);
    expect(code).toContain("setAlignmentEditOpen(true)");
    expect(code).toContain("<AlignmentModal");
    expect(code).toContain("mulePseudo={selectedCharacter!==\"PRINCIPAL\"?selectedCharacter:undefined}");
  });
});
