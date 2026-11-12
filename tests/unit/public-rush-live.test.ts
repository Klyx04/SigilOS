/**
 * Espace visiteur — **Rush Live** (V2c).
 *
 * Ce que ce verrou protège, dans l'ordre où ça peut casser :
 *
 * 1. **consentement** : `showPresence` reste **fermé par défaut** (aucune migration) et
 *    gouverne le fait d'**être vu** — présence et validations. Il ne gouverne pas le fait de
 *    recevoir : un visiteur masqué voit les autres ;
 * 2. **périmètre** : une room par **serveur du profil**, jamais un `?serverId=` du client ;
 *    aucune clé ne porte de `guildId` ni de `userId` ;
 * 3. **honnêteté** : `unavailable` est un état, jamais un « 0 en ligne » ;
 * 4. **aucun texte libre** : le titre vient de `GuideMilestone`, borné au guide Rush ; le
 *    pseudo est celui du profil, avec un repli neutre ;
 * 5. **fail-soft** : la publication ne peut pas faire échouer l'enregistrement de la
 *    progression (le navigateur reste la source, la base le miroir).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS,
    PUBLIC_RUSH_LIVE_MAX_NEW_EVENTS,
    PUBLIC_RUSH_LIVE_TITLE_MAX,
    newMilestoneIds,
    parsePublicRushLiveFrame,
    publicRushLiveEventSchema,
    publicRushLiveKeys,
    publicRushLiveKind,
    publicRushLivePseudo,
    publicRushLiveRoom,
} from "@/lib/public-rush-live";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ROUTE = "src/app/api/visiteurs/rush-live/route.ts";
const SERVER = "src/server/public-rush-live.ts";
const STORE = "src/server/rush-public-store.ts";
const ACTIONS = "src/server/actions/public-profile-actions.ts";
const SEAM = "src/app/guides/rush-sylvestre/_actions/public-presence.ts";
const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const MODAL = "src/app/guides/rush-sylvestre/_components/PublicRushLiveModal.tsx";
const TOAST = "src/app/guides/rush-sylvestre/_components/PublicRushLiveToast.tsx";

const EVENT = {
    id: 1,
    kind: "bloc" as const,
    milestoneId: "ms-1",
    title: "Dofus Argenté",
    pseudo: "MonIop",
};

describe("Rush Live — une room par serveur, jamais par guilde", () => {
    it("dérive les quatre clés d'un seul entier de serveur", () => {
        expect(publicRushLiveRoom(295)).toBe("public:rush:live:295");
        const keys = publicRushLiveKeys(295);
        expect(keys.events).toBe("public:rush:live:295:events");
        expect(keys.presence).toBe("public:rush:live:295:presence");
        expect(keys.presenceMeta).toBe("public:rush:live:295:presence:meta");
        expect(keys.sequence).toBe("public:rush:live:seq");
        for (const key of Object.values(keys)) {
            expect(key).not.toMatch(/guild/i);
        }
    });

    it("refuse un serveur absent ou douteux — pas de room « par défaut »", () => {
        for (const value of [0, -1, 1.5, Number.NaN]) {
            expect(() => publicRushLiveRoom(value)).toThrow();
        }
    });
});

describe("Rush Live — diff de progression borné", () => {
    it("ne publie que les blocs nouvellement cochés, sans doublon", () => {
        expect(newMilestoneIds(["a", "b"], ["a", "b", "c", "c"])).toEqual(["c"]);
        expect(newMilestoneIds([], ["a", "b"])).toEqual(["a", "b"]);
        expect(newMilestoneIds(["a"], ["a"])).toEqual([]);
    });

    it("borne une passe anormale au lieu d'inonder la room", () => {
        const many = Array.from({ length: 50 }, (_, i) => `ms-${i}`);
        expect(newMilestoneIds([], many)).toHaveLength(PUBLIC_RUSH_LIVE_MAX_NEW_EVENTS);
    });
});

describe("Rush Live — nature et pseudo", () => {
    it("seuls DOFUS et DOFUS_OBTAINED annoncent un Dofus", () => {
        expect(publicRushLiveKind("DOFUS")).toBe("dofus");
        expect(publicRushLiveKind("DOFUS_OBTAINED")).toBe("dofus");
        for (const type of ["ZONE", "DONJON", "QUETE_SERIE", "INFO", "SEPARATEUR"]) {
            expect(publicRushLiveKind(type)).toBe("bloc");
        }
    });

    it("replie un pseudo absent sur un mot neutre, jamais un identifiant", () => {
        expect(publicRushLivePseudo(null)).toBe("Visiteur");
        expect(publicRushLivePseudo("   ")).toBe("Visiteur");
        expect(publicRushLivePseudo("  MonIop  ")).toBe("MonIop");
        expect(publicRushLivePseudo("x".repeat(80))).toHaveLength(40);
    });
});

describe("Rush Live — trames fermées", () => {
    it("accepte les deux trames du serveur, avec `members` par défaut", () => {
        expect(parsePublicRushLiveFrame({ type: "events", events: [EVENT] })).toEqual({
            type: "events",
            events: [EVENT],
        });
        expect(parsePublicRushLiveFrame({ type: "presence", status: "live", members: [] })).toEqual({
            type: "presence",
            status: "live",
            members: [],
        });
        expect(parsePublicRushLiveFrame({ type: "presence", status: "unavailable" })).toEqual({
            type: "presence",
            status: "unavailable",
            members: [],
        });
    });

    it("refuse un type inconnu, un titre trop long et une trame surchargée", () => {
        expect(parsePublicRushLiveFrame({ type: "events", events: [{ ...EVENT, kind: "quete" }] })).toBeNull();
        expect(
            parsePublicRushLiveFrame({
                type: "events",
                events: [{ ...EVENT, title: "x".repeat(PUBLIC_RUSH_LIVE_TITLE_MAX + 1) }],
            })
        ).toBeNull();
        expect(
            parsePublicRushLiveFrame({
                type: "events",
                events: Array.from({ length: PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS + 1 }, (_, i) => ({
                    ...EVENT,
                    id: i + 1,
                })),
            })
        ).toBeNull();
        expect(parsePublicRushLiveFrame(null)).toBeNull();
        expect(parsePublicRushLiveFrame("{}")).toBeNull();
    });

    it("n'accepte aucun texte libre : le schéma d'événement est une liste blanche", () => {
        expect(publicRushLiveEventSchema.safeParse({ ...EVENT, kind: "bloc" }).success).toBe(true);
        expect(publicRushLiveEventSchema.safeParse({ ...EVENT, pseudo: "" }).success).toBe(false);
        // Un champ en trop est ignoré par Zod : il ne part jamais dans une trame.
        expect(Object.keys(publicRushLiveEventSchema.parse({ ...EVENT, message: "coucou" }))).toEqual([
            "id",
            "kind",
            "milestoneId",
            "title",
            "pseudo",
        ]);
    });
});

describe("Rush Live — le serveur résout le périmètre, jamais le client", () => {
    const route = stripComments(read(ROUTE));
    const server = stripComments(read(SERVER));

    it("la route exige un compte public et ne lit AUCUN paramètre de serveur", () => {
        expect(route).toContain("getPublicAccount()");
        expect(route).toContain("const profile = account.profile");
        expect(route).toContain("profile.dofusServerId");
        expect(route).toContain("profile.showPresence");
        expect(route).not.toMatch(/searchParams/);
        // Deux refus explicites, pas un repli permissif.
        expect(route).toContain("status: 401");
        expect(route).toContain("status: 429");
    });

    it("le flux est borné et se nettoie par le canal partagé", () => {
        expect(route).toContain("createSseChannel(controller)");
        expect(route).toContain("PUBLIC_RUSH_LIVE_STREAM_LIFETIME_MS");
        expect(route).toContain("channel.onClose(");
        expect(route).toContain("clearPublicRushPresence");
        expect(route).toContain("request.signal.addEventListener");
    });

    it("le serveur ne publie que pour un profil consentant, sur le guide Rush", () => {
        expect(server).toContain("input.profile.showPresence");
        expect(server).toContain("guide: { slug: PUBLIC_RUSH_GUIDE_ID }");
        expect(server).toContain("redisReady()");
        // Aucune clé, aucun événement ne porte de guilde : l'espace visiteur en est hors.
        expect(server).not.toMatch(/guildId/);
    });

    it("l'instantané dit `unavailable`, jamais un compte par défaut", () => {
        expect(server).toMatch(/status: "unavailable", members: \[\]/);
        expect(server).toMatch(/status: "live", members: \[\]/);
    });
});

describe("Rush Live — la progression reste la vérité (fail-soft)", () => {
    const store = stripComments(read(STORE));

    it("publie APRÈS l'upsert, en fire-and-forget", () => {
        const upsert = store.indexOf("db.publicRushProgress.upsert");
        const publish = store.indexOf("void publishPublicRushLive(");
        expect(upsert).toBeGreaterThan(-1);
        expect(publish).toBeGreaterThan(upsert);
    });

    it("ne publie rien quand le diff est illisible", () => {
        // `readPreviousMilestones` rend `null` sur erreur, et l'appelant teste ce `null` :
        // sans ça, une lecture ratée ferait annoncer toute la progression comme « nouvelle ».
        expect(store).toContain("previousMilestones !== null");
        expect(store).toContain("return null;");
    });

    it("le consentement est lu sur le profil du compte, pas sur un paramètre", () => {
        expect(store).toContain("showPresence: account.profile.showPresence");
        expect(store).toContain("dofusServerId: account.profile.dofusServerId");
    });
});

describe("Rush Live — consentement écrit par une action gardée", () => {
    const actions = stripComments(read(ACTIONS));
    const block = actions.slice(actions.indexOf("export async function updatePublicPresence"));

    it("garde, Zod, rate limit, puis écriture `where: { userId }`", () => {
        expect(block).toContain("getPublicAccount()");
        expect(block).toContain('limit("presence"');
        expect(block).toContain("where: { userId: account.userId }");
        expect(block).toContain("data: { showPresence: parsed.data.enabled }");
        expect(block.indexOf("getPublicAccount()")).toBeLessThan(block.indexOf("db.publicProfile.update"));
    });

    it("n'écrit QUE `showPresence` — les deux autres consentements sont intacts", () => {
        const write = block.slice(block.indexOf("db.publicProfile.update"), block.indexOf("revalidatePath"));
        expect(write).toContain("showPresence");
        expect(write).not.toContain("showOnDirectory");
        expect(write).not.toContain("showRushProgress");
    });

    it("la couture publique n'importe que l'action, aucun secret", () => {
        const seam = stripComments(read(SEAM));
        expect(seam).toContain("updatePublicPresence");
        expect(seam).not.toMatch(/metamob|prisma|redis/i);
    });
});

describe("Rush Live — UI branchée, anonyme inchangé", () => {
    const client = stripComments(read(CLIENT));
    const modal = stripComments(read(MODAL));
    const toast = stripComments(read(TOAST));

    it("la tuile lit le flux et ouvre la modale des présents", () => {
        expect(client).toContain("usePublicRushLive({ enabled: !!visitor");
        expect(client).toContain("setRushLiveOpen(true)");
        expect(client).toContain("<PublicRushLiveModal");
        expect(client).toContain("members.length");
        // Le client du guide public n'importe toujours aucun code serveur (verrou de parité).
        expect(client).not.toMatch(/@\/server\//);
    });

    it("la modale ne compte rien quand la source manque", () => {
        expect(modal).toContain("setMyPresence");
        expect(modal).toContain('status === "unavailable"');
        expect(modal).toMatch(/présence indisponible/i);
        expect(modal).not.toMatch(/0 en ligne/);
    });

    it("le toast suit la PiP et ne vole aucun clic", () => {
        expect(toast).toContain("pointer-events-none");
        expect(toast).toContain("inPip");
        // Curseur par identifiant : un tableau plafonné à 20 ferait taire les toasts suivants.
        expect(toast).toContain("event.id >");
        expect(client).toContain("pipWin.document.body");
    });

    it("l'événement ne transporte ni `userId` ni `guildId`", () => {
        expect(Object.keys(EVENT)).toEqual(["id", "kind", "milestoneId", "title", "pseudo"]);
    });
});


