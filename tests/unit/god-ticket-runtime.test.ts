import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/prisma", () => ({
    db: {
        godTicketConfig: { findUnique: vi.fn() },
        godTicketCategory: { findMany: vi.fn() },
        platformConfig: { findUnique: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { loadGodTicketRuntime } from "@/server/god-ticket-config";
import { GOD_TICKET_DEFAULT_CATEGORIES } from "@/lib/tickets/god-config";
import {
    buildSupportPanelContent,
    buildSupportSelectOptions,
} from "@/lib/tickets/god-panel";
import {
    buildSupportModalComponents,
    buildSupportModalTitle,
} from "@/lib/tickets/god-modals";

const mockDb = db as any;
const GUILD = "123456789012345678";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("panneau Discord construit depuis les catégories God", () => {
    it("liste les catégories actives, dans l'ordre fourni", () => {
        const content = buildSupportPanelContent(GOD_TICKET_DEFAULT_CATEGORIES);
        expect(content.embedDescription).toContain("🔑 **Demande d'accès**");
        expect(content.embedDescription).toContain("🐛 **Signaler un bug**");
        expect(content.embedDescription).toContain("📩 **Autre demande**");
        expect(content.embedFooter).toBe("SigilOS · Support");
    });

    it("dit honnêtement qu'aucune catégorie n'est active", () => {
        const content = buildSupportPanelContent([]);
        expect(content.embedDescription).toContain("Aucune catégorie active");
    });

    it("utilise la clé stable comme valeur du menu, jamais le libellé", () => {
        const options = buildSupportSelectOptions(GOD_TICKET_DEFAULT_CATEGORIES);
        expect(options.map((option) => option.value)).toEqual(["acces", "bug", "idee", "autre"]);
        expect(options[0].emoji).toEqual({ name: "🔑" });
    });
});

describe("formulaires Discord par catégorie", () => {
    it("garde le formulaire dédié des quatre catégories historiques", () => {
        const [acces, bug, idee, autre] = GOD_TICKET_DEFAULT_CATEGORIES;
        expect(buildSupportModalComponents(acces)).toHaveLength(5);
        expect(buildSupportModalComponents(bug).map((row) => row.components[0].custom_id)).toEqual([
            "subject",
            "page",
            "description",
        ]);
        expect(buildSupportModalComponents(idee)).toHaveLength(2);
        expect(buildSupportModalComponents(autre).map((row) => row.components[0].custom_id)).toEqual([
            "subject",
            "description",
        ]);
    });

    it("utilise le formulaire générique pour une catégorie créée par le God", () => {
        const custom = {
            id: "x",
            key: "partenariat",
            label: "Partenariat",
            emoji: "🤝",
            color: "#10b981",
            legacyCategory: null,
            order: 40,
            isEnabled: true,
        };
        expect(buildSupportModalComponents(custom).map((row) => row.components[0].custom_id)).toEqual([
            "subject",
            "description",
        ]);
    });

    it("borne le titre de modale à 45 caractères", () => {
        const long = {
            ...GOD_TICKET_DEFAULT_CATEGORIES[0],
            label: "Un libellé vraiment très long qui dépasse la limite Discord",
        };
        expect(buildSupportModalTitle(long).length).toBeLessThanOrEqual(45);
    });
});

describe("lecture runtime de la configuration God", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.godTicketConfig.findUnique.mockResolvedValue(null);
        mockDb.platformConfig.findUnique.mockResolvedValue({ ticketSupportGuildId: GUILD });
        mockDb.godTicketCategory.findMany.mockResolvedValue([]);
    });

    it("sans configuration, garde les quatre catégories et reprend l'ancien serveur", async () => {
        const runtime = await loadGodTicketRuntime();
        expect(runtime.config.supportGuildId).toBe(GUILD);
        expect(runtime.config.supportChannelId).toBeNull();
        expect(runtime.config.namingPattern).toBe("🎫-{num}-{author}");
        expect(runtime.categories).toHaveLength(4);
        expect(runtime.enabledCategories).toHaveLength(4);
    });

    it("ne propose que les catégories actives au menu", async () => {
        mockDb.godTicketCategory.findMany.mockResolvedValue([
            { ...GOD_TICKET_DEFAULT_CATEGORIES[0], isEnabled: false },
            { ...GOD_TICKET_DEFAULT_CATEGORIES[1], isEnabled: true },
        ]);

        const runtime = await loadGodTicketRuntime();
        expect(runtime.categories).toHaveLength(2);
        expect(runtime.enabledCategories.map((category) => category.key)).toEqual(["bug"]);
    });

    it("propage une panne de lecture (l'appelant refuse, jamais de défaut inventé)", async () => {
        mockDb.godTicketCategory.findMany.mockRejectedValue(new Error("db down"));
        await expect(loadGodTicketRuntime()).rejects.toThrow("db down");
    });
});

describe("gardes anti-retour — plus de catégories en dur", () => {
    it("la création lit la clé God et le nom du fil réglé", () => {
        const source = read("src/server/actions/ticket-actions.ts");
        expect(source).toContain("resolveGodTicketCategory(data.categoryKey");
        expect(source).toContain("categoryKey: category.key");
        expect(source).toContain("buildSupportThreadName(runtime.config.namingPattern");
        expect(source).toContain("runtime.config.closePolicy");
        expect(source).toContain("runtime.config.csatEnabled");
        expect(source).toContain("support:csat:${ticket.id}:${star}");
        expect(source).not.toContain("TICKET_CATEGORY_LABELS");
    });

    it("la route Discord construit le menu et les modales depuis la configuration", () => {
        const source = read("src/app/api/discord/interactions/route.ts");
        expect(source).toContain("buildSupportSelectOptions(runtime.enabledCategories)");
        expect(source).toContain("buildSupportModalComponents(category)");
        expect(source).toContain('prefix === "support" && action === "csat"');
        expect(source).toContain("where: { id: ticketId, csatRating: null }");
        expect(source).not.toContain('value: "ACCESS_REQUEST"');
    });

    it("le panneau publié lit les catégories actives", () => {
        const source = read("src/server/actions/ticket-actions.ts");
        expect(source).toContain("buildSupportPanelContent(categories)");
        expect(source).toContain("runtime.enabledCategories");
    });
});

describe("nettoyage G4-4 — un seul endroit pour régler le support", () => {
    it("le panneau est publié depuis la configuration, sans salon fourni par l'appelant", () => {
        const source = read("src/server/actions/ticket-actions.ts");
        expect(source).toContain("export async function postTicketPanel()");
        expect(source).not.toContain("export async function postTicketPanel(channelId");
        expect(source).not.toContain("export async function getBotGuilds");
        expect(source).not.toContain("export async function getChannelsForGuild");
    });

    it("la console God lit les catégories réglées, plus de table en dur", () => {
        const source = read("src/app/god/components/ticket-dashboard.tsx");
        expect(source).toContain("resolveCategoryMeta(ticket, categories)");
        expect(source).toContain("categories.map((category)");
        expect(source).not.toContain("CATEGORY_CONFIG");
        expect(source).not.toContain("Poster le panel (Discord)");
    });

    it("la page God passe les catégories à la console Support", () => {
        const source = read("src/app/god/page.tsx");
        expect(source).toContain("loadGodTicketCategories()");
        expect(source).toContain("categories={categories}");
    });
});

