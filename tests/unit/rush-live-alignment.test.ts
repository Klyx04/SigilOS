/**
 * Gardes — **Lot 3** : l'alignement dans la présence temps réel.
 *
 * 🎯 Demande user : « les gens entrevoient qui est quel alignement / ordre en temps réel ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  • l'alignement est lu **côté serveur** (requête du join) et recopié dans Redis ;
 *  • il n'est **jamais** envoyé par le client (anti-usurpation) ;
 *  • la projection publique ne fuit pas `lastSeen` ;
 *  • les bulles « en ligne » composent « cité · Ordre · tranche ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const SERVER = "src/server/websocket/guide-presence.ts";
const HOOK = "src/hooks/use-guide-presence.ts";
const CLIENT = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

describe("présence serveur — alignement joint à l'identité", () => {
  it("la requête du join lit les trois champs d'alignement", () => {
    const code = read(SERVER);
    expect(code).toMatch(/alignment:\s*true/);
    expect(code).toMatch(/alignmentOrder:\s*true/);
    expect(code).toMatch(/alignmentLevel:\s*true/);
  });

  it("le heartbeat recopie l'alignement mémorisé au join (aucune requête en plus)", () => {
    const code = read(SERVER);
    expect(code).toMatch(/alignment:\s*identity\?\.alignment\s*\?\?\s*null/);
    expect(code).toMatch(/alignmentLevel:\s*identity\?\.alignmentLevel\s*\?\?\s*0/);
  });

  it("la projection publique est unique et ne divulgue pas lastSeen", () => {
    const code = read(SERVER);
    expect(code).toMatch(/function publicPresenceMember\(entry: PresenceEntry\)/);
    expect(code.match(/members\.map\(publicPresenceMember\)/g)?.length).toBe(2);
    const start = code.indexOf("function publicPresenceMember");
    const block = code.slice(start, start + 500);
    expect(block).not.toContain("lastSeen");
  });
});

describe("présence client — type et libellé", () => {
  it("le type client porte l'alignement", () => {
    const code = read(HOOK);
    expect(code).toMatch(/alignment\?: string \| null/);
    expect(code).toMatch(/alignmentOrder\?: string \| null/);
    expect(code).toMatch(/alignmentLevel\?: number \| null/);
  });

  it("le heartbeat du client n'envoie JAMAIS d'alignement (source = serveur)", () => {
    const code = read(HOOK);
    const start = code.indexOf('socketRef.current?.emit("guide:heartbeat"');
    expect(start).toBeGreaterThan(-1);
    const emit = code.slice(start, start + 260);
    expect(emit).not.toContain("alignment");
  });

  it("les bulles « en ligne » affichent cité · Ordre (sans tranche)", () => {
    const code = read(CLIENT);
    expect(code).toContain("alignmentSummary(m.alignment, m.alignmentOrder)");
    expect(code).toMatch(/function alignmentSummary\(/);
    expect(code).not.toMatch(/T\$\{level\}/);
  });
});
