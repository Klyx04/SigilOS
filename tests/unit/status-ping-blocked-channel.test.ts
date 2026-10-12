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
import { readFileSync } from "node:fs";

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

    it("salon en pause ⇒ résultat HONNÊTE : `delivered: false` + `warning`, jamais un faux succès", async () => {
        mockSendChannelMessage.mockResolvedValue(null);

        const res = await sendGlobalStatusPingCore({ source: "manual" });

        // `success` = « la passe a tourné » (le site et /status ne dépendent pas de Discord).
        // Il reste `true` pour que `/api/cron/status-ping` — sonde d'UptimeRobot — ne
        // réponde pas 500 pour un salon Discord mal configuré…
        expect(res.success).toBe(true);
        // … mais `delivered` dit la vérité : AUCUN message n'est parti. Sans ce champ,
        // le bouton « Test Ping » annonçait « envoyé avec succès » et le cron restait vert.
        expect(res.delivered).toBe(false);
        expect(res.warning).toBeTruthy();
        expect(res.messageId).toBeNull();
    });

    it("envoi confié à la file ⇒ `delivered: true` et aucun avertissement", async () => {
        mockSendChannelMessage.mockResolvedValue("outbox:job-abc");

        const res = await sendGlobalStatusPingCore({ source: "test" });

        expect(res.delivered).toBe(true);
        expect(res.warning).toBeUndefined();
    });

    it("aucun salon configuré ⇒ `delivered: false` (pas de 500 pour le monitoring)", async () => {
        mockPlatformConfigFindUnique.mockResolvedValue({
            serviceStatusChannelId: null,
            statusIsLite: false,
            statusMode: "living",
            statusMention: "none",
            statusFrequency: 60,
        });

        const res = await sendGlobalStatusPingCore({ source: "cron:status-ping" });

        expect(res.success).toBe(true);
        expect(res.delivered).toBe(false);
        expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });
});

describe("gardes de source — l'interface God ne ment plus sur ce qui est parti", () => {
    const changelogActions = readFileSync("src/server/actions/changelog-actions.ts", "utf8");
    const panel = readFileSync("src/app/god/components/platform-config-panel.tsx", "utf8");

    it("« Test Ping » / « Test Alerte » lèvent la pause d'écriture avant d'essayer", () => {
        // Un test est un geste EXPLICITE de l'opérateur : sans ce `clear`, un salon en
        // pause faisait échouer le test en silence (mesure du 26/09/2026 : « le test ping
        // ne part pas », alors que la cause était le disjoncteur, pas les permissions).
        expect(changelogActions).toMatch(/clearDiscordChannelBlock\(channelId\)/);
    });

    it("les deux tests rapportent l'ÉCHEC quand rien n'est parti (fin du faux succès)", () => {
        expect(changelogActions).toMatch(/res\.delivered === false/);
        expect(changelogActions).toMatch(/res\.discordMessageId === null/);
    });

    it("le rapport de diagnostic affiche POURQUOI un salon est rouge (403 ≠ 404)", () => {
        // La pastille seule ne permet pas d'agir : cette soirée a été passée à deviner.
        expect(panel).toMatch(/\{k\} · \{v\.status\} — \{v\.message\}/);
    });
});
