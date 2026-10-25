/**
 * Module **Services** — cible Discord des messages.
 *
 * Bug mesuré le 25/10/2026 : le salon configuré (`servicesNotifyChannelId`) peut être un
 * **forum** (le sélecteur accepte `15`), or un forum n'accepte aucun message direct
 * (`discord-api-types` : `GuildForum = 15` « A channel that can only contain threads »).
 * La carte d'annonce créait bien un fil, la **demande client** non : `POST /messages`
 * répondait une erreur avalée, la demande restait en base et rien n'apparaissait sur
 * Discord — l'écran annonçait pourtant un succès.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockFetchChannel = vi.fn();
const mockPostChannelMessage = vi.fn();
const mockCreateForumThread = vi.fn();
const mockPatchChannelMessage = vi.fn();
const mockDeleteChannelMessage = vi.fn();

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/server/discord", () => ({
    fetchChannel: (...args: any[]) => mockFetchChannel(...args),
    postChannelMessage: (...args: any[]) => mockPostChannelMessage(...args),
    createForumThread: (...args: any[]) => mockCreateForumThread(...args),
    patchChannelMessage: (...args: any[]) => mockPatchChannelMessage(...args),
    deleteChannelMessage: (...args: any[]) => mockDeleteChannelMessage(...args),
}));

import {
    isForumOnlyChannelType,
    resolveServiceMessageTarget,
    serviceThreadName,
} from "@/lib/service-discord";
import {
    deleteServiceMessage,
    patchServiceMessage,
    postServiceMessage,
    postServiceThreadMessage,
} from "@/server/discord-services";

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── Règle pure ──────────────────────────────────────────────────────────

describe("règle : type de salon qui ne contient que des fils", () => {
    it("reconnaît forum (15) et média (16)", () => {
        expect(isForumOnlyChannelType(15)).toBe(true);
        expect(isForumOnlyChannelType(16)).toBe(true);
    });

    it("ne confond pas un salon texte (0), une annonce (5), un fil (11) ou un vocal (13)", () => {
        expect(isForumOnlyChannelType(0)).toBe(false);
        expect(isForumOnlyChannelType(5)).toBe(false);
        expect(isForumOnlyChannelType(11)).toBe(false);
        expect(isForumOnlyChannelType(13)).toBe(false);
    });

    it("répond non quand le type est inconnu — on ne devine jamais un forum", () => {
        expect(isForumOnlyChannelType(null)).toBe(false);
        expect(isForumOnlyChannelType(undefined)).toBe(false);
    });
});

describe("nom de sujet de forum", () => {
    it("compacte les espaces et garde un nom lisible", () => {
        expect(serviceThreadName("  📩   Demande   de service  ")).toBe("📩 Demande de service");
    });

    it("borne à 100 caractères (limite Discord, refus au-delà)", () => {
        expect(serviceThreadName("x".repeat(150))).toHaveLength(100);
    });

    it("retombe sur un libellé par défaut plutôt qu'un nom vide", () => {
        expect(serviceThreadName("   ")).toBe("Service");
        expect(serviceThreadName(null, "Demande")).toBe("Demande");
    });
});

describe("cible réelle d'un message de service", () => {
    it("forum : le message vit dans le fil, dont l'id est celui du message d'amorçage", () => {
        expect(
            resolveServiceMessageTarget({
                configuredChannelId: "forum-1",
                configuredChannelType: 15,
                storedMessageId: "fil-42",
            })
        ).toEqual({ channelId: "fil-42", messageId: "fil-42" });
    });

    it("salon texte : le message vit dans le salon configuré", () => {
        expect(
            resolveServiceMessageTarget({
                configuredChannelId: "salon-1",
                configuredChannelType: 0,
                storedMessageId: "msg-42",
            })
        ).toEqual({ channelId: "salon-1", messageId: "msg-42" });
    });
});


// ─── Comportement de publication ─────────────────────────────────────────

describe("publication dans un forum", () => {
    beforeEach(() => {
        mockFetchChannel.mockResolvedValue({
            id: "forum-1",
            type: 15,
            name: "services",
            available_tags: [
                { id: "tag-modere", name: "Officiel", moderated: true },
                { id: "tag-libre", name: "Demandes" },
            ],
        });
        mockCreateForumThread.mockResolvedValue({ id: "fil-42" });
    });

    it("crée un fil (jamais un message direct, impossible dans un forum)", async () => {
        const target = await postServiceMessage(
            "forum-1",
            { embeds: [{ title: "Demande" }] },
            "📩 Demande — Antichambre"
        );

        expect(mockPostChannelMessage).not.toHaveBeenCalled();
        expect(mockCreateForumThread).toHaveBeenCalledTimes(1);
        expect(mockCreateForumThread.mock.calls[0][0]).toBe("forum-1");
        expect(mockCreateForumThread.mock.calls[0][1]).toMatchObject({
            name: "📩 Demande — Antichambre",
            message: { embeds: [{ title: "Demande" }] },
        });
        expect(target).toEqual({ channelId: "fil-42", messageId: "fil-42" });
    });

    it("applique la première étiquette non modérée (un forum qui l'exige refuserait sinon)", async () => {
        await postServiceMessage("forum-1", { content: "x" }, "Demande");

        expect(mockCreateForumThread.mock.calls[0][1].applied_tags).toEqual(["tag-libre"]);
    });

    it("retourne null si Discord refuse la création du fil — jamais un faux succès", async () => {
        mockCreateForumThread.mockResolvedValue(null);

        await expect(postServiceMessage("forum-1", { content: "x" }, "Demande")).resolves.toBeNull();
    });
});

describe("publication dans un salon classique", () => {
    it("envoie un message et retourne la cible réelle", async () => {
        mockFetchChannel.mockResolvedValue({ id: "salon-1", type: 0, name: "services" });
        mockPostChannelMessage.mockResolvedValue("msg-42");

        const target = await postServiceMessage("salon-1", { content: "x" }, "Demande");

        expect(mockCreateForumThread).not.toHaveBeenCalled();
        expect(target).toEqual({ channelId: "salon-1", messageId: "msg-42" });
    });

    it("retourne null quand Discord rejette l'envoi", async () => {
        mockFetchChannel.mockResolvedValue({ id: "salon-1", type: 0, name: "services" });
        mockPostChannelMessage.mockRejectedValue(new Error("Discord 403"));

        await expect(postServiceMessage("salon-1", { content: "x" }, "Demande")).resolves.toBeNull();
    });


// ─── Dialogue (réponse passeur ⇄ client) ─────────────────────────────────

describe("réponse dans le fil de la demande", () => {
    it("forum : écrit dans le fil existant, jamais un nouveau sujet par réponse", async () => {
        mockFetchChannel.mockResolvedValue({ id: "forum-1", type: 15, name: "services" });
        mockPostChannelMessage.mockResolvedValue("msg-reply");

        const target = await postServiceThreadMessage(
            "forum-1",
            "fil-42",
            { content: "dispo ce soir" },
            "💬 Antichambre"
        );

        expect(mockCreateForumThread).not.toHaveBeenCalled();
        expect(mockPostChannelMessage).toHaveBeenCalledWith("fil-42", { content: "dispo ce soir" });
        expect(target).toEqual({ channelId: "fil-42", messageId: "msg-reply" });
    });

    it("salon texte : la réponse va dans le salon de service", async () => {
        mockFetchChannel.mockResolvedValue({ id: "salon-1", type: 0, name: "services" });
        mockPostChannelMessage.mockResolvedValue("msg-reply");

        const target = await postServiceThreadMessage("salon-1", "msg-42", { content: "ok" }, "💬 Antichambre");

        expect(mockPostChannelMessage).toHaveBeenCalledWith("salon-1", { content: "ok" });
        expect(target).toEqual({ channelId: "salon-1", messageId: "msg-reply" });
    });

    it("sans demande publiée : retombe sur une publication normale (fil créé dans un forum)", async () => {
        mockFetchChannel.mockResolvedValue({ id: "forum-1", type: 15, name: "services" });
        mockCreateForumThread.mockResolvedValue({ id: "fil-99" });

        const target = await postServiceThreadMessage("forum-1", null, { content: "ok" }, "💬 Antichambre");

        expect(mockCreateForumThread).toHaveBeenCalledTimes(1);
        expect(target).toEqual({ channelId: "fil-99", messageId: "fil-99" });
    });
});

    it("n'écrit rien quand le type du salon est illisible (fail-closed)", async () => {
        mockFetchChannel.mockRejectedValue(new Error("502"));

        await expect(postServiceMessage("salon-1", { content: "x" }, "Demande")).resolves.toBeNull();
        expect(mockPostChannelMessage).not.toHaveBeenCalled();
        expect(mockCreateForumThread).not.toHaveBeenCalled();
    });
});

describe("mise à jour et suppression d'un message déjà publié", () => {
    it("patche dans le fil quand le salon configuré est un forum", async () => {
        mockFetchChannel.mockResolvedValue({ id: "forum-1", type: 15, name: "services" });
        mockPatchChannelMessage.mockResolvedValue(true);

        await expect(patchServiceMessage("forum-1", "fil-42", { content: "clos" })).resolves.toBe(true);
        expect(mockPatchChannelMessage).toHaveBeenCalledWith("fil-42", "fil-42", { content: "clos" });
    });

    it("supprime dans le salon configuré quand c'est un salon texte", async () => {
        mockFetchChannel.mockResolvedValue({ id: "salon-1", type: 0, name: "services" });
        mockDeleteChannelMessage.mockResolvedValue(true);

        await expect(deleteServiceMessage("salon-1", "msg-42")).resolves.toBe(true);
        expect(mockDeleteChannelMessage).toHaveBeenCalledWith("salon-1", "msg-42");
    });

    it("ne touche à rien si le salon est introuvable", async () => {
        mockFetchChannel.mockResolvedValue(null);

        await expect(deleteServiceMessage("salon-1", "msg-42")).resolves.toBe(false);
        expect(mockDeleteChannelMessage).not.toHaveBeenCalled();
    });
});
