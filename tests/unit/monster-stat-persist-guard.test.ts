/**
 * 🛡️ Garde anti-dégradation du butin à l'**écriture** (`persistMonsterStat`).
 *
 * Défaut mesuré (30/10/2026) : quand DofusDB répond `429`, `getMonsterStats` retombe sur le
 * bestiaire Unity (`buildMonsterDataFromUnity` ⇒ `drops: []`) et le rend **en succès** ; le cron
 * persistait ce payload par-dessus une fiche complète. Résultat : **106 fiches beta sur 146**
 * affichaient « aucun butin » alors que la donnée existait (ex. `L'Éternel Conflit` : 21 butins
 * en base, `drops: []` servi).
 *
 * Règle verrouillée ici : une ligne qui a un butin n'est **jamais** écrasée par un payload qui
 * n'en a pas. PostgreSQL est entièrement mocké (aucune base en test).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const monsterStatFindUnique = vi.fn();
const monsterStatUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        monsterStat: {
            findUnique: (...args: any[]) => monsterStatFindUnique(...args),
            upsert: (...args: any[]) => monsterStatUpsert(...args),
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/game-data-changelog", () => ({
    diffFields: () => null,
    recordGameDataChanges: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type SyncMod = typeof import("@/lib/dofensive-sync");
let persistMonsterStat: SyncMod["persistMonsterStat"];

beforeAll(async () => {
    // Les écritures locales refusent PostgreSQL quand `VITEST=true` (garde anti-DB) : on lève
    // ce garde-fou EXPLICITEMENT et uniquement dans ce fichier, comme `offline-stale-serve`.
    vi.stubEnv("VITEST", "false");
    vi.resetModules();
    ({ persistMonsterStat } = await import("@/lib/dofensive-sync"));
});

afterAll(() => {
    vi.unstubAllEnvs();
});

beforeEach(() => {
    vi.clearAllMocks();
    monsterStatUpsert.mockResolvedValue({});
});

const DROPS = [{ objectId: 1, name: "Barre Rabmarac au Nougat", percent: 6 }];
/** Repli Unity : aucun butin, origine explicite. */
const UNITY_PAYLOAD = { id: 6792, name: "L'Éternel Conflit", drops: [], source: "unity" };
/** Fiche DofusDB complète. */
const COMPLETE_PAYLOAD = { id: 6792, name: "L'Éternel Conflit", drops: DROPS };

describe("persistMonsterStat — le butin acquis n'est jamais écrasé", () => {
    it("refuse d'écrire un repli Unity vide par-dessus une fiche à 3 butins", async () => {
        monsterStatFindUnique.mockResolvedValue({ versionHash: "v1", stats: { drops: DROPS } });
        await persistMonsterStat(UNITY_PAYLOAD);
        expect(monsterStatUpsert).not.toHaveBeenCalled();
    });

    it("écrit quand la fiche précédente était vide et que le payload est complet", async () => {
        monsterStatFindUnique.mockResolvedValue({ versionHash: "v1", stats: { drops: [] } });
        await persistMonsterStat(COMPLETE_PAYLOAD);
        expect(monsterStatUpsert).toHaveBeenCalledTimes(1);
    });

    it("écrit la première fiche d'un monstre (aucune ligne précédente), même Unity", async () => {
        monsterStatFindUnique.mockResolvedValue(null);
        await persistMonsterStat(UNITY_PAYLOAD);
        expect(monsterStatUpsert).toHaveBeenCalledTimes(1);
    });

    it("écrit une mise à jour normale entre deux fiches complètes", async () => {
        monsterStatFindUnique.mockResolvedValue({ versionHash: "v1", stats: { drops: DROPS } });
        await persistMonsterStat({
            ...COMPLETE_PAYLOAD,
            drops: [...DROPS, { objectId: 2, name: "Dofus Pourpre", percent: 0.1 }],
        });
        expect(monsterStatUpsert).toHaveBeenCalledTimes(1);
    });
});
