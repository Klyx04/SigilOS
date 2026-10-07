/**
 * Sous-système « chat » retiré (07/10/2026) — garde de non-retour.
 *
 * 🐛 Mesures qui ont motivé le retrait (mesuré, jamais supposé) :
 *  - `chat-helpers.ts` définissait les clés Redis `chat:history|pubsub|online|run:*`, et
 *    **aucun** autre fichier du dépôt ne les lisait ni ne les écrivait ;
 *  - la présence affichée pour de vrai (facepile du dashboard, `smart-bar`) vient de
 *    `PresenceManager` (`src/lib/presence.ts`), alimenté par `getUserContext`
 *    (`user-actions.ts:1048`) et `<PresenceHeartbeat>` — **pas** par le chat ;
 *  - `PresenceProvider` était **importé** (layout du dashboard) mais **jamais rendu**
 *    (`<PresenceProvider` : zéro occurrence) et ses contexts (`usePresence`, `useChatMessage`,
 *    `usePresenceLegacy`) n'avaient **aucun consommateur** ;
 *  - il n'existait **aucune** route pour envoyer un message (pas de POST) : le « chat » avait
 *    perdu son interface depuis longtemps. Le tout reste récupérable via `git log`.
 *
 * 🔒 Ce que ce test verrouille : le sous-système ne revient pas par morceaux (fichiers morts,
 * identifiants fantômes, provider remonté dans le layout).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** Les 5 fichiers du sous-système retiré. */
const FICHIERS_RETIRES = [
    "src/app/api/chat/guild/[guildId]/presence/route.ts",
    "src/app/api/chat/guild/[guildId]/stream/route.ts",
    "src/app/api/chat/run/[runId]/stream/route.ts",
    "src/lib/chat-helpers.ts",
    "src/components/providers/PresenceProvider.tsx",
];

/** Aucune source ne doit plus citer ces identifiants. */
const IDENTIFIANTS_INTERDITS = [
    "PresenceProvider",
    "chat-helpers",
    "/api/chat/",
    "useChatMessage",
    "usePresenceLegacy",
    "chatOnlineUsersKey",
];

function fichiersSource(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...fichiersSource(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

describe("sous-système chat — retiré proprement (code mort, aucun consommateur)", () => {
    it("① les 5 fichiers du sous-système n'existent plus", () => {
        for (const rel of FICHIERS_RETIRES) {
            expect(existsSync(path.join(ROOT, rel)), `${rel} est toujours là`).toBe(false);
        }
    });

    it("② plus aucune source ne référence le provider ni les endpoints /api/chat", () => {
        const fautifs: string[] = [];
        for (const file of fichiersSource(path.join(ROOT, "src"))) {
            const src = readFileSync(file, "utf8");
            for (const mot of IDENTIFIANTS_INTERDITS) {
                if (src.includes(mot)) fautifs.push(`${path.relative(ROOT, file)} → ${mot}`);
            }
        }
        expect(fautifs).toEqual([]);
    });

    it("③ le layout du dashboard garde le heartbeat de présence, sans provider de chat", () => {
        const layout = readFileSync(path.join(ROOT, "src/app/dashboard/[guildId]/layout.tsx"), "utf8");
        expect(layout).toContain("PresenceHeartbeat");
        expect(layout).not.toContain("PresenceProvider");
        // La présence réelle vient de PresenceManager (Redis), pas du chat.
        expect(readFileSync(path.join(ROOT, "src/server/actions/presence-actions.ts"), "utf8")).toContain(
            "PresenceManager"
        );
    });
});
