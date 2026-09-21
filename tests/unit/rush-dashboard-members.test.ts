/**
 * Garde — le repère « Je suis ici » sert à VOIR les autres : les bulles de membres
 * s'affichent sur la QUÊTE où chacun a posé son repère, en interne comme dans l'overlay.
 *
 * 🎯 Défauts mesurés (user, 21/09/2026) :
 *   1. `setRushBookmark` stocke l'id de séquence BRUT (`"abc"`), mais la map du dashboard
 *      (`guildProgressBySeq`) ne gardait que les clés préfixées `seq:` ⇒ `seqMembers`
 *      toujours vide : **aucune bulle sous une quête**, alors que l'overlay — qui
 *      normalise les deux formes — les affichait bien ;
 *   2. l'affichage était en plus réservé à MON repère (`isThisBookmarked`) : le repère
 *      d'un coéquipier restait invisible ;
 *   3. le bouton « Ouvrir Overlay » vivait dans la barre du haut, loin du geste réel
 *      (« je regarde qui est là, puis j'ouvre l'overlay »).
 *
 * 🛡️ On verrouille le CÂBLAGE (lecture des sources, commentaires retirés) : la prose
 * ne doit pas faire passer le test. Lecture seule : aucun rendu, aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

/** Retire les commentaires : on verrouille le code, pas la prose. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const code = codeOnly(readFileSync(DASHBOARD, "utf8"));

/** Bloc source d'un `const` (de sa déclaration jusqu'à la fermeture de son `useMemo`). */
function blockOf(name: string): string {
  const start = code.indexOf(name);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  return code.slice(start, start + 700);
}

describe("Dashboard Rush — repères de guilde visibles sur chaque quête", () => {
  it("normalise le préfixe `seq:` des repères guilde (sinon aucun repère réel n'est indexé)", () => {
    const block = blockOf("const guildProgressBySeq=useMemo");
    expect(block).toMatch(/startsWith\("seq:"\)/);
    expect(block).toMatch(/slice\(4\)/);
  });

  it("n'indexe que des ids de séquence qui EXISTENT dans le guide", () => {
    const block = blockOf("const guildProgressBySeq=useMemo");
    // Les séquences du guide font foi : un step-key Ganymède legacy ne crée pas de bulle.
    expect(block).toMatch(/const knownSeqIds=new Set<string>\(\)/);
    expect(block).toMatch(/knownSeqIds\.has\(seqId\)/);
    // Une quête validée par ce membre n'est plus « ici ».
    expect(block).toMatch(/p\.isCompleted/);
  });

  it("affiche les bulles dès qu'un membre est sur la quête — pas seulement mon repère", () => {
    expect(code).not.toMatch(/isThisBookmarked && !isSeqCompleted && seqMembers\.length > 0/);
    expect(code).toMatch(/!isSeqCompleted && seqMembers\.length > 0 && \(/);
  });

  it("les bulles restent cliquables : la rangée ouvre la liste des membres", () => {
    const idx = code.indexOf("!isSeqCompleted && seqMembers.length > 0");
    expect(idx).toBeGreaterThan(-1);
    // Le bouton des bulles, juste après la condition, ouvre la modale des membres.
    expect(code.slice(idx, idx + 600)).toMatch(/setMembersModalOpen\(true\)/);
  });

  it("« Ouvrir Overlay » est rendu dans la carte Rush Live, plus dans la barre du haut", () => {
    const rushLive = code.indexOf("Rush Live");
    const openOverlay = code.indexOf("Ouvrir Overlay");
    const headerBar = code.indexOf("Pense-bête");
    expect(rushLive).toBeGreaterThan(-1);
    expect(headerBar).toBeGreaterThan(-1);
    // Il a quitté la barre du haut : là-bas il PRÉCÉDAIT le bouton « Pense-bête ».
    expect(openOverlay).toBeGreaterThan(headerBar);
    // …et il se lit après la carte « Rush Live » (même rangée).
    expect(openOverlay).toBeGreaterThan(rushLive);
  });
});
