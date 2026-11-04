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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
    CALENDAR_FALLBACK_IMAGE,
    EVENT_IMAGES,
    KRALAMOURE_IMAGE_PATH,
    RAID_IMAGES,
    eventIllustrationRef,
    isKralamoureEvent,
    raidImagePath,
    resolveEventImageFile,
    resolveEventImagePath,
} from "@/lib/calendar-event-images";

const ASSETS_DIR = "public/assets/calendar";
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

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

describe("calendar-event-images — illustration réelle (donjon / titan)", () => {
    it("résout le donjon nommé par le miroir DJ", () => {
        expect(
            eventIllustrationRef({ source: { mode: "DONJON" }, mirror: { names: ["Antre du Kralamoure Géant"] } })
        ).toEqual({ kind: "dungeon", name: "Antre du Kralamoure Géant" });
    });

    it("résout le titan nommé par le miroir DJ", () => {
        expect(
            eventIllustrationRef({ source: { mode: "TITAN" }, mirror: { names: ["Gargandyas"] } })
        ).toEqual({ kind: "titan", name: "Gargandyas" });
    });

    it("résout aussi le titre normalisé produit par djMirrorTitle (metadata perdue)", () => {
        expect(eventIllustrationRef(undefined, "[Titan] Gargandyas")).toEqual({ kind: "titan", name: "Gargandyas" });
        expect(eventIllustrationRef(null, "[DJ] Donjon des Squelettes")).toEqual({
            kind: "dungeon",
            name: "Donjon des Squelettes",
        });
    });

    it("ne devine jamais une fiche hors du format de l'app", () => {
        expect(eventIllustrationRef(undefined)).toBeNull();
        expect(eventIllustrationRef(null)).toBeNull();
        expect(eventIllustrationRef(undefined, "Gargandyas")).toBeNull();
        expect(eventIllustrationRef(undefined, "[Tournée] 3 donjons")).toBeNull();
        expect(eventIllustrationRef({ source: { mode: "QUETE" }, mirror: { names: ["Gargandyas"] } })).toBeNull();
        expect(eventIllustrationRef({ source: { mode: "DEFI" }, mirror: { names: ["Gargandyas"] } })).toBeNull();
    });

    it("la metadata prime sur le titre (autorité du miroir)", () => {
        expect(
            eventIllustrationRef({ source: { mode: "TITAN" }, mirror: { names: ["Gargandyas"] } }, "[DJ] Autre donjon")
        ).toEqual({ kind: "titan", name: "Gargandyas" });
    });

    it("ignore un miroir sans nom exploitable", () => {
        expect(eventIllustrationRef({ source: { mode: "DONJON" }, mirror: { names: [] } })).toBeNull();
        expect(eventIllustrationRef({ source: { mode: "DONJON" }, mirror: { names: ["   "] } })).toBeNull();
        expect(eventIllustrationRef({ source: { mode: "DONJON" }, mirror: { names: [42] } })).toBeNull();
    });

    it("borne le nom lu dans le miroir (jamais une valeur aberrante en requête)", () => {
        const ref = eventIllustrationRef({ source: { mode: "DONJON" }, mirror: { names: ["x".repeat(200)] } });
        expect(ref?.name).toHaveLength(80);
    });

    it("reconnaît un Kralamoure par son type ou son import Metamob", () => {
        expect(isKralamoureEvent("KRALAMOURE")).toBe(true);
        expect(isKralamoureEvent("DUNGEON_FARM", { isKralamoure: true })).toBe(true);
        expect(isKralamoureEvent("DUNGEON_FARM", { isKralamoure: false })).toBe(false);
        expect(isKralamoureEvent("EVENT_GUILD")).toBe(false);
    });

    it("sert l'illustration réelle du donjon Kralamoure (pas le visuel générique)", () => {
        expect(KRALAMOURE_IMAGE_PATH).toBe("/game-data/dungeons/antre-du-kralamoure-g-ant.webp");
        expect(existsSync(path.join(ROOT, `public${KRALAMOURE_IMAGE_PATH}`))).toBe(true);
    });
});

describe("event-actions — câblage de l'illustration dans le header", () => {
    it("résout donjon et titan en base, puis retombe sur le visuel du type", () => {
        const source = read("src/server/actions/event-actions.ts");
        expect(source).toContain("eventIllustrationRef(event.metadata, event.title)");
        expect(source).toContain("db.dungeon.findMany");
        expect(source).toContain("db.titan.findMany");
        expect(source).toContain("resolveEventImagePath(event.type, event.metadata)");
        expect(source).toContain("await withIllustrations(allEvents.slice(0, limit))");
    });

    it("le bouton affiche l'image servie et retombe sur le picto si l'asset manque", () => {
        const chip = read("src/components/layout/header-event-chip.tsx");
        expect(chip).toContain("event.imageUrl");
        expect(chip).toContain("onError={() => setFailed(true)}");
        expect(chip).toContain("calendarEventTheme(event.type)");
        // Le mapping local de couleurs ne doit pas revenir (source unique).
        expect(chip).not.toContain("TYPE_COLOR");
    });
});

