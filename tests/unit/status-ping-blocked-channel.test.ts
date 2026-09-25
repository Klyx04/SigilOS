/**
 * Living status & salon inaccessible — le défaut MESURÉ du 25/09/2026.
 *
 * Relevé en bêta : le salon `1468401237186707588` recevait une écriture ratée
 * **exactement à `:10:00` de chaque heure** (18:10:00.87 puis 19:10:00.447), parce
 * que `sendChannelMessage` renvoie `outbox:<jobId>` dès l'acceptation en file —
 * `finalMessageId` était donc *truthy* et le garde-fou de fréquence horodatait un
 * « envoi » qui n'avait jamais eu lieu. Le tick suivant réessayait une heure plus
 * tard, indéfiniment, en produisant une alerte à chaque fois.
 *
 * Ce test verrouille le contrat qui casse ce cercle : un salon en pause fait
 * renvoyer `null` (et non un ID) ⇒ **aucun horodatage** ⇒ le salon reste sondé
 * sans bruit, et un salon sain conserve exactement l'ancien comportement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPlatformConfigFindUnique = vi.fn();
const mockQueryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        platformConfig: { findUnique: (...args: any[]) => mockPlatformConfigFindUnique(...args) },
        $queryRaw: (...args: any[]) => mockQueryRaw(...args),
    },
}));

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock("@/lib/redis", () => ({
    redis: {
        status: "ready",
        get: (...args: any[]) => mockRedisGet(...args),
        set: (...args: any[]) => mockRedisSet(...args),
        del: vi.fn(),
        ping: vi.fn(async () => "PONG"),
    },
    default: {},
}));

const mockSendChannelMessage = vi.fn();
const mockUpdateChannelMessage = vi.fn();
vi.mock("@/server/discord", () => ({
    sendChannelMessage: (...args: any[]) => mockSendChannelMessage(...args),
    updateChannelMessage: (...args: any[]) => mockUpdateChannelMessage(...args),
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { sendGlobalStatusPingCore } from "@/server/status-ping-core";

/** Les écritures d'horodatage portent ce fragment de clé (jamais un nom en dur). */
const LAST_TS_FRAGMENT = "discord_status_last_ts";

function lastTsWrites(): unknown[] {
    return mockRedisSet.mock.calls.filter((call) => String(call[0]).includes(LAST_TS_FRAGMENT));
}

beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformConfigFindUnique.mockResolvedValue({
        serviceStatusChannelId: "1468401237186707588",
        statusIsLite: false,
        statusMode: "living",
        statusMention: "none",
        statusFrequency: 60,
    });
    mockQueryRaw.mockResolvedValue([{ ok: 1 }]);
    // Aucun message « vivant » ancré, aucun envoi précédent enregistré.
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockUpdateChannelMessage.mockResolvedValue(false);
});

describe("sendGlobalStatusPingCore — salon en pause d'écriture", () => {
    it("`sendChannelMessage` renvoie null (salon en pause) ⇒ AUCUN horodatage de « dernier envoi »", async () => {
        mockSendChannelMessage.mockResolvedValue(null);

        await sendGlobalStatusPingCore({ source: "test" });

        expect(mockSendChannelMessage).toHaveBeenCalledTimes(1);
        // Sans cet invariant, le garde-fou horodatait un échec et réessayait une fois
        // par heure — la source de bruit mesurée (1 alerte/heure/salon, à vie).
        expect(lastTsWrites()).toHaveLength(0);
    });

    it("non-régression : un envoi confié à la file (`outbox:…`) horodate bien l'envoi", async () => {
        mockSendChannelMessage.mockResolvedValue("outbox:job-abc");

        await sendGlobalStatusPingCore({ source: "test" });

        expect(lastTsWrites()).toHaveLength(1);
    });
});
