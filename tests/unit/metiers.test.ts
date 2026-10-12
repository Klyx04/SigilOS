import { describe, it, expect } from "vitest";
import { normalizeMetiers, metierNames, metierIds } from "@/lib/metiers";

describe("metiers.normalizeMetiers", () => {
  it("legacy string[] d'ids → niveau 200 (convention)", () => {
    const res = normalizeMetiers(["faconneur", "forgeron"]);
    expect(res).toEqual([
      { id: "faconneur", name: "Façonneur", level: 200 },
      { id: "forgeron", name: "Forgeron", level: 200 },
    ]);
  });

  it("legacy string[] de noms → niveau 200", () => {
    const res = normalizeMetiers(["Façonneur"]);
    expect(res[0]).toMatchObject({ id: "faconneur", name: "Façonneur", level: 200 });
  });

  it("format enrichi {name, level} conservé", () => {
    const res = normalizeMetiers([{ name: "Tailleur", level: 180 }]);
    expect(res).toEqual([{ id: "tailleur", name: "Tailleur", level: 180 }]);
  });

  it("null / non-tableau → []", () => {
    expect(normalizeMetiers(null)).toEqual([]);
    expect(normalizeMetiers("x")).toEqual([]);
  });

  it("clamp le niveau à [1,200]", () => {
    const res = normalizeMetiers([{ name: "Forgeron", level: 999 }]);
    expect(res[0].level).toBe(200);
  });

  it("déduplique par id", () => {
    const res = normalizeMetiers(["faconneur", { name: "Façonneur", level: 150 }]);
    expect(res.length).toBe(1);
  });

  it("helpers metierNames/metierIds", () => {
    expect(metierNames(["faconneur"])).toEqual(["Façonneur"]);
    expect(metierIds([{ name: "Forgeron", level: 200 }])).toEqual(["forgeron"]);
  });
});
