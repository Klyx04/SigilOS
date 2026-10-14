/**
 * Retrait de l'onglet « Apparence » (déslop du 14/10/2026) — verrou du lot.
 *
 * 🛡️ Ce que ce test protège :
 * ① l'onglet et **tout son code** ne reviennent pas par mégarde (écran, action, presets) ;
 * ② la lecture de `accentHue` par guilde a disparu du layout — plus aucune requête en base
 *    pour une teinte que personne ne choisit ;
 * ③ **non-régression** : l'accent de base du dashboard est **toujours** posé
 *    (`GuildAccentStyle` + `--guild-hue`) — retirer la fonctionnalité ne devait pas retirer
 *    le style.
 *
 * Note : la colonne `GuildConfig.accentHue` est **conservée** (aucune donnée supprimée,
 * aucune migration) : elle n'est simplement plus écrite ni lue.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { getGuildAccentCssVars } from "@/lib/guild-accent";

const source = (path: string) => readFileSync(path, "utf8");

const CLIENT = "src/app/dashboard/[guildId]/admin/_components/guild-appearance-settings-client.tsx";
const SETTINGS_PAGE = "src/app/dashboard/[guildId]/admin/settings/page.tsx";
const LAYOUT = "src/app/dashboard/[guildId]/layout.tsx";
const ACTIONS = "src/server/actions/admin-actions.ts";
const ACCENT_LIB = "src/lib/guild-accent.ts";

describe("retrait de l'onglet Apparence — zéro code orphelin", () => {
    it("l'écran n'existe plus et la page Paramètres ne le référence plus", () => {
        expect(existsSync(CLIENT)).toBe(false);
        const page = source(SETTINGS_PAGE);
        expect(page).not.toContain("guild-appearance-settings-client");
        expect(page).not.toContain("GuildAppearanceSettingsClient");
        expect(page).not.toContain('id: "apparence"');
    });

    it("les actions de teinte par guilde n'existent plus", () => {
        const actions = source(ACTIONS);
        expect(actions).not.toContain("getGuildAppearance");
        expect(actions).not.toContain("updateGuildAccentHue");
        expect(actions).not.toContain("UPDATE_ACCENT_HUE");
    });

    it("le layout ne lit plus `accentHue` (aucune requête pour une teinte que personne ne choisit)", () => {
        expect(source(LAYOUT)).not.toContain("accentHue");
    });

    it("les presets de teinte (jamais consommés) ont disparu de la lib", () => {
        expect(source(ACCENT_LIB)).not.toContain("GUILD_HUE_PRESETS");
    });

    it("non-régression : l'accent de base est TOUJOURS posé par le dashboard", () => {
        expect(source(LAYOUT)).toContain("<GuildAccentStyle");
        // Teinte par défaut du design system, posée sans paramètre.
        expect(getGuildAccentCssVars(undefined)["--guild-hue"]).toBe("155");
    });

    it("la colonne `accentHue` reste en base (aucune donnée supprimée, pas de migration)", () => {
        expect(source("prisma/schema.prisma")).toContain("accentHue");
    });
});
