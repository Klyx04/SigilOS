/**
 * Plan de synchro des emojis d'application Discord.
 *
 * Régression verrouillée : `public/assets/missions/songes.png` (1,3 Mo) et
 * `anomalie.png` (693 Ko) dépassent la limite Discord de 256 Ko par emoji. Sans ce
 * contrôle, la synchro envoyait le lot entier et **échouait sur ces deux fichiers**
 * (400 Bad Request) — ou pire, on croyait la synchro réussie alors qu'une partie
 * du catalogue manquait. Ici : refus AVANT tout appel réseau, et le reste du lot
 * part quand même.
 */
import { describe, it, expect } from "vitest";
import { statSync, existsSync } from "node:fs";
import path from "node:path";

import {
    planAppEmojiSync,
    MAX_APP_EMOJI_BYTES,
    MAX_APP_EMOJI_NAME_LENGTH,
    appEmojiMarkup,
} from "@/lib/discord-app-emoji-plan";
import { DISCORD_EMOJI_LIST } from "@/lib/discord-emoji-catalog";

const realFileSize = (file: string): number | null => {
    const abs = path.join(process.cwd(), "public", file);
    if (!existsSync(abs)) return null;
    return statSync(abs).size;
};

const entry = (name: string, file = "assets/dofus/icons/success.png") => ({ name, file, fallback: "🏆" });
const sizeOf = (bytes: number) => () => bytes;

describe("planAppEmojiSync", () => {
    it("cree seulement les manquants (idempotence)", () => {
        const entries = [entry("a"), entry("b"), entry("c")];
        const plan = planAppEmojiSync(["a", "c"], sizeOf(1024), entries);
        expect(plan.toCreate.map((e) => e.name)).toEqual(["b"]);
        expect(plan.alreadyThere.map((e) => e.name)).toEqual(["a", "c"]);
        expect(plan.rejected).toEqual([]);
    });

    it("refuse un fichier > 256 Ko sans casser le reste du lot", () => {
        const entries = [entry("petit"), entry("enorme")];
        const plan = planAppEmojiSync([], (file) => (file.includes("enorme") ? MAX_APP_EMOJI_BYTES + 1 : 1024),
            [entry("petit", "petit.png"), entry("enorme", "enorme.png")]);
        expect(plan.toCreate.map((e) => e.name)).toEqual(["petit"]);
        expect(plan.rejected).toHaveLength(1);
        expect(plan.rejected[0].reason).toContain("trop lourd");
    });

    it("refuse un fichier manquant et un nom non conforme", () => {
        const plan = planAppEmojiSync(
            [],
            () => null,
            [entry("dofus_cra"), entry("Dofus-Bad")]
        );
        expect(plan.toCreate).toEqual([]);
        expect(plan.rejected.map((r) => r.reason.split(" ")[0])).toEqual(["fichier", "nom"]);
        expect(MAX_APP_EMOJI_NAME_LENGTH).toBe(32);
    });

    it("le catalogue RÉEL passe la synchro (aucun refus) — garde-fou des assets", () => {
        const plan = planAppEmojiSync([], realFileSize);
        expect(plan.rejected, `refusés : ${plan.rejected.map((r) => `${r.entry.name} (${r.reason})`).join(", ")}`).toEqual([]);
        expect(plan.toCreate).toHaveLength(DISCORD_EMOJI_LIST.length);
        expect(plan.toCreate.length).toBeGreaterThan(30);
    });

    it("markup d'emoji custom", () => {
        expect(appEmojiMarkup("dofus_success", "123456789")).toBe("<:dofus_success:123456789>");
    });
});
