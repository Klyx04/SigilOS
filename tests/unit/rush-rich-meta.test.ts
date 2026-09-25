import { describe, it, expect } from "vitest";
import {
  parseBlockMeta,
  formatBlockMeta,
  validateCoordinate,
} from "@/lib/rush-rich-meta";

describe("rush-rich-meta — extraction et formatage des métadonnées de bloc", () => {
  it("extrait correctement une coordonnée et un lien nommé inversés (cas utilisateur beta)", () => {
    // Cas rencontré sur beta : l'utilisateur a tapé le lien en premier, puis la position
    const raw = `[Chaque chose en son temps](https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html)\n[2,1]`;
    const meta = parseBlockMeta(raw);

    expect(meta.coord).toBe("2, 1");
    expect(meta.linkUrl).toBe("https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html");
    expect(meta.linkLabel).toBe("Chaque chose en son temps");
    expect(meta.text).toBe("");
  });

  it("extrait correctement une coordonnée en premier et un lien nommé en second", () => {
    const raw = `[-55,15]\n[Eternelle Moisson](https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html)`;
    const meta = parseBlockMeta(raw);

    expect(meta.coord).toBe("-55, 15");
    expect(meta.linkUrl).toBe("https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html");
    expect(meta.linkLabel).toBe("Eternelle Moisson");
    expect(meta.text).toBe("");
  });

  it("extrait coordonnée, lien et conserve le texte descriptif restant", () => {
    const raw = `Lancer la quête dès qu'une anomalie ouvre !\n[Chaque chose en son temps](https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html)\n[2, 1]`;
    const meta = parseBlockMeta(raw);

    expect(meta.coord).toBe("2, 1");
    expect(meta.linkUrl).toBe("https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html");
    expect(meta.linkLabel).toBe("Chaque chose en son temps");
    expect(meta.text).toBe("Lancer la quête dès qu'une anomalie ouvre !");
  });

  it("gère les commandes /w x,y", () => {
    const raw = `/w -55, 15\nhttps://dofusdb.fr/fr/quest/123`;
    const meta = parseBlockMeta(raw);

    expect(meta.coord).toBe("-55, 15");
    expect(meta.linkUrl).toBe("https://dofusdb.fr/fr/quest/123");
    expect(meta.linkLabel).toBe("");
  });

  it("formate de façon standardisée (position d'abord, lien ensuite, texte en dernier)", () => {
    const formatted = formatBlockMeta({
      coord: "2, 1",
      linkUrl: "https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html",
      linkLabel: "Chaque chose en son temps",
      text: "Lancer la quête dès que possible.",
    });

    expect(formatted).toBe(
      `[2, 1]\n[Chaque chose en son temps](https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html)\nLancer la quête dès que possible.`
    );
  });

  it("valide les coordonnées Dofus sous différents formats", () => {
    expect(validateCoordinate("-55, 15")).toEqual({ x: -55, y: 15, formatted: "-55, 15" });
    expect(validateCoordinate("[-55,15]")).toEqual({ x: -55, y: 15, formatted: "-55, 15" });
    expect(validateCoordinate("/w 2, 1")).toEqual({ x: 2, y: 1, formatted: "2, 1" });
    expect(validateCoordinate("texte invalide")).toBeNull();
    expect(validateCoordinate("")).toBeNull();
  });
});
