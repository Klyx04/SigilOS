/**
 * Garde de câblage — visuels des événements du calendrier.
 *
 * Constat du 18/09/2026 : les embeds Discord des raids affichaient **le même**
 * visuel générique (`calendar_raid_official.png`) pour « Gouffre du Gigalodon »
 * et « Sanctuaire des Jardins Éternels ». Chaque raid a désormais son
 * illustration, choisie via `GuildEvent.metadata.raidType`, et une **source
 * unique** sert l'embed Discord *et* la carte du dashboard.
 *
 * Le second test est un filet anti-404 : `EVENT_IMAGES` contenait
 * `calendar_guild_mission.png`, un fichier **absent** de `public/assets/calendar/`
 * (image cassée côté Discord). Toute entrée de la carte doit exister sur disque.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
    CALENDAR_FALLBACK_IMAGE,
    EVENT_IMAGES,
    RAID_IMAGES,
    raidImagePath,
    resolveEventImageFile,
    resolveEventImagePath,
} from "@/lib/calendar-event-images";

const ASSETS_DIR = "public/assets/calendar";

describe("calendar-event-images — visuel d'un raid", () => {
    it("sert l'illustration dédiée au Gigalodon", () => {
        expect(resolveEventImageFile("RAID_OFFICIAL", { raidType: "gigalodon" })).toBe("calendar_raid_gigalodon.jpg");
    });

    it("sert l'illustration dédiée aux Jardins Éternels", () => {
        expect(resolveEventImageFile("RAID_OFFICIAL", { raidType: "jardin" })).toBe("calendar_raid_sanctuaire.jpg");
    });

    it("retombe sur le visuel générique sans type de raid (données historiques)", () => {
        expect(resolveEventImageFile("RAID_OFFICIAL")).toBe("calendar_raid_official.png");
        expect(resolveEventImageFile("RAID_OFFICIAL", null)).toBe("calendar_raid_official.png");
        expect(resolveEventImageFile("RAID_OFFICIAL", { raidType: "kralamoure" })).toBe("calendar_raid_official.png");
    });

    it("n'applique jamais un visuel de raid à un autre type d'événement", () => {
        expect(resolveEventImageFile("EVENT_GUILD", { raidType: "gigalodon" })).toBe("calendar_event_guild.png");
        expect(resolveEventImageFile("SONGES_RUN", { raidType: "jardin" })).toBe("calendar_songes_run.png");
    });

    it("expose le chemin public attendu par le dashboard", () => {
        expect(resolveEventImagePath("RAID_OFFICIAL", { raidType: "jardin" })).toBe("/assets/calendar/calendar_raid_sanctuaire.jpg");
        expect(resolveEventImagePath("TYPE_INCONNU", {})).toBe(`/assets/calendar/${CALENDAR_FALLBACK_IMAGE}`);
    });

    it("expose le chemin dédié du sélecteur « Type de Raid » du formulaire", () => {
        expect(raidImagePath("jardin")).toBe("/assets/calendar/calendar_raid_sanctuaire.jpg");
        expect(raidImagePath("gigalodon")).toBe("/assets/calendar/calendar_raid_gigalodon.jpg");
        // Même visuel que celui de l'embed Discord : une seule source de vérité.
        expect(raidImagePath("jardin")).toBe(resolveEventImagePath("RAID_OFFICIAL", { raidType: "jardin" }));
    });
});

describe("calendar-event-images — les fichiers existent vraiment", () => {
    it("chaque visuel référencé est présent dans public/assets/calendar", () => {
        const files = [...Object.values(EVENT_IMAGES), ...Object.values(RAID_IMAGES), CALENDAR_FALLBACK_IMAGE];
        const missing = [...new Set(files)].filter(file => !existsSync(`${ASSETS_DIR}/${file}`));
        expect(missing, `visuel(s) introuvable(s) : ${missing.join(", ")}`).toEqual([]);
    });
});
