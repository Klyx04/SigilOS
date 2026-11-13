/**
 * Les **salons forum** doivent être proposés partout où un module publie dans un forum.
 *
 * 🐛 Bug mesuré le 15/10/2026 : `Donjons & Quêtes` et `Services` n'apparaissaient qu'avec les
 * salons textuels/vocaux, alors que le `Marché` proposait bien les forums. Cause racine :
 * `DiscordChannelPicker` a un défaut **textuel** (`DISCORD_TEXT_CHANNEL_TYPES = [0, 5]`) ; un écran
 * qui n'écrit pas `allowedTypes` ne voit jamais le type **15** (forum).
 *
 * 🛡️ Ce que ce test protège : le type 15 reste celui des forums, et les écrans concernés passent
 * **explicitement** la liste forum (donc plus de silence si quelqu'un retire la prop).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

const PICKER = "src/components/shared/DiscordChannelPicker.tsx";
const SETTINGS = "src/app/dashboard/[guildId]/admin/_components";

describe("salons forum dans les sélecteurs", () => {
    it("le type 15 est celui des forums, et il est absent du défaut textuel", () => {
        const picker = source(PICKER);
        expect(picker).toContain("export const DISCORD_TEXT_CHANNEL_TYPES = [0, 5];");
        expect(picker).toContain("export const DISCORD_FORUM_CHANNEL_TYPES = [0, 5, 15];");
    });

    it("Donjons & Quêtes, Services et Marché passent explicitement les forums", () => {
        for (const file of ["dj-settings-client.tsx", "services-settings-client.tsx", "market-settings-client.tsx"]) {
            const code = source(`${SETTINGS}/${file}`);
            expect(code).toContain("DISCORD_FORUM_CHANNEL_TYPES");
            expect(code).toContain("allowedTypes={DISCORD_FORUM_CHANNEL_TYPES}");
        }
    });
});
