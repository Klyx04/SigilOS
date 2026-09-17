import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasGuestCharacter,
  guestCharacterSlot,
  guestProgressPrefix,
  readGuestCharacter,
  writeGuestCharacter,
  guestProgressExists,
  adoptAnonymousGuestProgress,
  readGuestProgress,
  type GuestCharacter,
} from "@/lib/guest-progress";

// localStorage minimal en mémoire : l'environnement de test est `node`.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
});

const SLUG = "rush-sylvestre";
const IOP: GuestCharacter = { classId: "iop", pseudo: "MonIop", serverId: 295 };

describe("guest-progress", () => {
  beforeEach(() => store.clear());

  describe("hasGuestCharacter", () => {
    it("refuse null et un personnage vide", () => {
      expect(hasGuestCharacter(null)).toBe(false);
      expect(hasGuestCharacter({ classId: null, pseudo: null, serverId: null })).toBe(false);
    });

    it("accepte dès qu'un seul champ est renseigné", () => {
      expect(hasGuestCharacter({ classId: "iop", pseudo: null, serverId: null })).toBe(true);
      expect(hasGuestCharacter({ classId: null, pseudo: "  ", serverId: null })).toBe(false);
      expect(hasGuestCharacter({ classId: null, pseudo: null, serverId: 295 })).toBe(true);
    });
  });

  describe("guestCharacterSlot / guestProgressPrefix", () => {
    it("sans personnage : préfixe historique (rétro-compatible)", () => {
      expect(guestCharacterSlot(null)).toBeNull();
      expect(guestProgressPrefix(SLUG, null)).toBe(`sigil_guest_${SLUG}_`);
      expect(guestProgressPrefix(SLUG)).toBe(`sigil_guest_${SLUG}_`);
    });

    it("pseudo + serveur : emplacement dédié, accents et casse neutralisés", () => {
      expect(guestCharacterSlot(IOP)).toBe("moniop-295");
      expect(guestProgressPrefix(SLUG, IOP)).toBe(`sigil_guest_${SLUG}_c_moniop-295_`);
      expect(guestCharacterSlot({ classId: "eliotrope", pseudo: "Éliø Trö", serverId: 290 })).toBe("eli-tro-290");
    });

    it("sans pseudo : la classe fait l'emplacement", () => {
      expect(guestCharacterSlot({ classId: "cra", pseudo: null, serverId: 354 })).toBe("cra-354");
      expect(guestCharacterSlot({ classId: "cra", pseudo: null, serverId: null })).toBe("cra");
    });

    it("changer de classe ne change PAS l'emplacement si le pseudo reste", () => {
      const before = guestProgressPrefix(SLUG, { classId: "iop", pseudo: "MonIop", serverId: 295 });
      const after = guestProgressPrefix(SLUG, { classId: "cra", pseudo: "MonIop", serverId: 295 });
      expect(after).toBe(before);
    });

    it("serveurs différents : deux progressions distinctes", () => {
      const draconiros = guestProgressPrefix(SLUG, { classId: "iop", pseudo: "MonIop", serverId: 295 });
      const orukam = guestProgressPrefix(SLUG, { classId: "iop", pseudo: "MonIop", serverId: 292 });
      expect(draconiros).not.toBe(orukam);
    });
  });

  describe("personnage stocké", () => {
    it("écrit puis relit le personnage, en nettoyant le pseudo", () => {
      writeGuestCharacter(SLUG, { classId: "iop", pseudo: "  MonIop  ", serverId: 295 });
      expect(readGuestCharacter(SLUG)).toEqual({ classId: "iop", pseudo: "MonIop", serverId: 295 });
    });

    it("retire la clé quand le personnage est vidé", () => {
      writeGuestCharacter(SLUG, IOP);
      writeGuestCharacter(SLUG, { classId: null, pseudo: null, serverId: null });
      expect(readGuestCharacter(SLUG)).toBeNull();
      expect(store.has(`sigil_guest_${SLUG}_character`)).toBe(false);
    });

    it("ignore un JSON corrompu au lieu de planter", () => {
      store.set(`sigil_guest_${SLUG}_character`, "{pas du json");
      expect(readGuestCharacter(SLUG)).toBeNull();
    });
  });

  describe("progression par personnage", () => {
    it("adopte la progression anonyme quand le personnage est vierge", () => {
      store.set(`sigil_guest_${SLUG}_completed_ms`, JSON.stringify(["ms-1"]));
      store.set(`sigil_guest_${SLUG}_steps`, JSON.stringify({ "ms-1": ["seq-1", "seq-2"] }));
      store.set(`sigil_guest_${SLUG}_bookmarks`, JSON.stringify({ "ms-1": "seq-2" }));

      expect(adoptAnonymousGuestProgress(SLUG, IOP)).toBe(true);

      const snapshot = readGuestProgress(SLUG, IOP);
      expect(Array.from(snapshot.completedIds)).toEqual(["ms-1"]);
      expect(Array.from(snapshot.completedStepsByMs.get("ms-1") ?? [])).toEqual(["seq-1", "seq-2"]);
      expect(snapshot.bookmarksByMs.get("ms-1")).toBe("seq-2");
      // Les clés d'origine sont CONSERVÉES (copie, jamais déplacement).
      expect(store.has(`sigil_guest_${SLUG}_completed_ms`)).toBe(true);
    });

    it("n'écrase jamais un personnage qui a déjà sa progression", () => {
      store.set(`sigil_guest_${SLUG}_completed_ms`, JSON.stringify(["anonyme"]));
      store.set(`sigil_guest_${SLUG}_c_moniop-295_completed_ms`, JSON.stringify(["perso"]));

      expect(adoptAnonymousGuestProgress(SLUG, IOP)).toBe(false);
      expect(Array.from(readGuestProgress(SLUG, IOP).completedIds)).toEqual(["perso"]);
    });

    it("ne fait rien sans personnage déclaré", () => {
      store.set(`sigil_guest_${SLUG}_completed_ms`, JSON.stringify(["ms-1"]));
      expect(adoptAnonymousGuestProgress(SLUG, null)).toBe(false);
      expect(guestProgressExists(SLUG, null)).toBe(true);
    });

    it("deux personnages gardent des progressions séparées", () => {
      store.set(`sigil_guest_${SLUG}_c_moniop-295_completed_ms`, JSON.stringify(["a"]));
      expect(Array.from(readGuestProgress(SLUG, IOP).completedIds)).toEqual(["a"]);
      expect(readGuestProgress(SLUG, { classId: "cra", pseudo: "MonCra", serverId: 295 }).completedIds.size).toBe(0);
    });

    it("lit un emplacement vide ou corrompu sans jeter", () => {
      expect(readGuestProgress(SLUG, IOP).completedIds.size).toBe(0);
      store.set(`sigil_guest_${SLUG}_c_moniop-295_steps`, "pas du json");
      expect(readGuestProgress(SLUG, IOP).completedStepsByMs.size).toBe(0);
    });
  });
});
