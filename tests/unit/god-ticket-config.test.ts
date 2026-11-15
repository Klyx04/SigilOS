import { describe, expect, it } from "vitest";
import {
    GOD_TICKET_DEFAULT_CATEGORIES,
    buildSupportThreadName,
    categoryColorToInt,
    resolveEnabledGodTicketCategories,
    resolveGodTicketCategories,
    resolveGodTicketCategory,
    resolveGodTicketConfig,
    toLegacyTicketCategory,
} from "@/lib/tickets/god-config";

const GUILD = "123456789012345678";
const CHANNEL = "987654321098765432";
const STAFF = "111111111111111111";

describe("configuration God du support — lecture et défauts", () => {
    it("sans ligne en base, retombe exactement sur le comportement historique", () => {
        const config = resolveGodTicketConfig(null);

        expect(config.supportGuildId).toBeNull();
        expect(config.supportChannelId).toBeNull();
        expect(config.staffRoleIds).toEqual([]);
        expect(config.notifyRoleIds).toEqual([]);
        expect(config.namingPattern).toBe("🎫-{num}-{author}");
        expect(config.closePolicy).toBe("STAFF_OR_CREATOR");
        expect(config.archiveOnClose).toBe(true);
        expect(config.csatEnabled).toBe(false);
    });

    it("reprend l'ancien serveur support quand la nouvelle configuration est vide", () => {
        expect(resolveGodTicketConfig(null, { supportGuildId: GUILD }).supportGuildId).toBe(GUILD);
        expect(
            resolveGodTicketConfig({ supportGuildId: null }, { supportGuildId: GUILD }).supportGuildId
        ).toBe(GUILD);
    });

    it("ignore un identifiant Discord invalide et déduplique les rôles", () => {
        const config = resolveGodTicketConfig({
            supportGuildId: "pas-un-snowflake",
            staffRoleIds: [STAFF, STAFF, "abc", GUILD],
        });

        expect(config.supportGuildId).toBeNull();
        expect(config.staffRoleIds).toEqual([STAFF, GUILD]);
    });

    it("retombe sur les rôles staff quand aucun rôle à mentionner n'est réglé", () => {
        const config = resolveGodTicketConfig({ staffRoleIds: [STAFF], notifyRoleIds: [] });
        expect(config.notifyRoleIds).toEqual([STAFF]);
    });

    it("refuse une politique de fermeture inconnue", () => {
        expect(resolveGodTicketConfig({ closePolicy: "N_IMPORTE_QUOI" }).closePolicy).toBe(
            "STAFF_OR_CREATOR"
        );
        expect(resolveGodTicketConfig({ closePolicy: "STAFF_ONLY" }).closePolicy).toBe("STAFF_ONLY");
    });

    it("borne le modèle de nom et conserve le salon support", () => {
        const config = resolveGodTicketConfig({
            supportChannelId: CHANNEL,
            namingPattern: "   ",
        });
        expect(config.supportChannelId).toBe(CHANNEL);
        expect(config.namingPattern).toBe("🎫-{num}-{author}");
    });
});

describe("catégories God du support — ordre, bornes et repli", () => {
    it("table vide : les quatre catégories historiques, dans l'ordre", () => {
        const categories = resolveGodTicketCategories([]);
        expect(categories.map((c) => c.key)).toEqual(["acces", "bug", "idee", "autre"]);
        expect(categories.map((c) => c.legacyCategory)).toEqual([
            "ACCESS_REQUEST",
            "BUG_REPORT",
            "FEATURE_REQUEST",
            "OTHER",
        ]);
    });

    it("ordonne les catégories et borne libellé, emoji et couleur", () => {
        const categories = resolveGodTicketCategories([
            {
                id: "b",
                key: "partenariat",
                label: "  Partenariat  ",
                emoji: "",
                color: "rouge",
                legacyCategory: null,
                order: 20,
                isEnabled: true,
            },
            {
                id: "a",
                key: "bug",
                label: "Bug",
                emoji: "🐛",
                color: "#ef4444",
                legacyCategory: "BUG_REPORT",
                order: 10,
                isEnabled: false,
            },
        ]);

        expect(categories.map((c) => c.key)).toEqual(["bug", "partenariat"]);
        expect(categories[1].label).toBe("Partenariat");
        expect(categories[1].emoji).toBe("🎫");
        expect(categories[1].color).toBe("#6366f1");
        expect(categories[1].legacyCategory).toBeNull();
    });

    it("ne retient que les catégories actives", () => {
        const categories = resolveEnabledGodTicketCategories([
            { ...GOD_TICKET_DEFAULT_CATEGORIES[0], isEnabled: false },
            { ...GOD_TICKET_DEFAULT_CATEGORIES[1], isEnabled: true },
        ]);
        expect(categories.map((c) => c.key)).toEqual(["bug"]);
    });

    it("refuse une clé inconnue ou désactivée (fail-closed)", () => {
        const categories = resolveGodTicketCategories([
            { ...GOD_TICKET_DEFAULT_CATEGORIES[0], isEnabled: false },
        ]);

        expect(resolveGodTicketCategory("acces", categories)).toBeNull();
        expect(resolveGodTicketCategory("inconnue", categories)).toBeNull();
        expect(resolveGodTicketCategory(null, categories)).toBeNull();
        expect(resolveGodTicketCategory("bug", resolveGodTicketCategories([]))?.label).toBe(
            "Signaler un bug"
        );
    });

    it("mappe une catégorie personnalisée sur OTHER", () => {
        const [custom] = resolveGodTicketCategories([
            {
                id: "x",
                key: "partenariat",
                label: "Partenariat",
                emoji: "🤝",
                color: "#10b981",
                legacyCategory: null,
                order: 1,
                isEnabled: true,
            },
        ]);
        expect(toLegacyTicketCategory(custom)).toBe("OTHER");
        expect(toLegacyTicketCategory(GOD_TICKET_DEFAULT_CATEGORIES[0])).toBe("ACCESS_REQUEST");
    });
});

describe("nom du fil et couleur d'embed", () => {
    it("remplace {num} et {author}, aplatit les sauts de ligne et borne à 100", () => {
        const name = buildSupportThreadName("{author}\n  #{num}", { num: 42, author: "Klyx" });
        expect(name).toBe("Klyx #42");

        const long = buildSupportThreadName("{author}", { num: 1, author: "a".repeat(300) });
        expect(long.length).toBeLessThanOrEqual(100);
    });

    it("conserve un modèle sans jeton et remplit les jetons par défaut", () => {
        expect(buildSupportThreadName("{inconnu}", { num: 7, author: "" })).toBe("{inconnu}");
        expect(buildSupportThreadName("", { num: 7, author: "Membre" })).toBe("🎫-7-Membre");
    });

    it("convertit une couleur valide, repli indigo sinon", () => {
        expect(categoryColorToInt("#10b981")).toBe(0x10b981);
        expect(categoryColorToInt("rouge")).toBe(0x6366f1);
        expect(categoryColorToInt(null)).toBe(0x6366f1);
    });
});
