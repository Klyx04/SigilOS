import { describe, expect, it } from "vitest";
import { parseBlockTips } from "@/lib/rush-block-tips";

describe("parseBlockTips — le programme d un bloc, une ligne par puce", () => {
  it("retire la puce de source et decoupe en lignes", () => {
    expect(parseBlockTips("* Donjons — A, B\n* Dofusdex officiel")).toEqual([
      "Donjons — A, B",
      "Dofusdex officiel",
    ]);
  });

  it("accepte les puces rondes et les tirets", () => {
    expect(parseBlockTips("• Un\n- Deux")).toEqual(["Un", "Deux"]);
  });

  it("ne touche pas une coordonnee negative", () => {
    expect(parseBlockTips("[-22, -24]")).toEqual(["[-22, -24]"]);
  });

  it("ignore le vide", () => {
    expect(parseBlockTips(null)).toEqual([]);
    expect(parseBlockTips("  \n \n")).toEqual([]);
  });
});