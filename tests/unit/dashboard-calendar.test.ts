/**
 * `dashboard-calendar` — dérivation pure des trois besoins du calendrier d'accueil.
 *
 * Une seule requête `GuildEvent` doit produire : les événements de la semaine, le raid
 * actif (le plus récent si plusieurs se chevauchent) et l'événement focal des 24 h.
 */
import { describe, expect, it } from "vitest";

import { deriveDashboardCalendar } from "@/lib/dashboard-calendar";

// Mercredi 18/11/2026 12:00 — semaine du lundi 16 au dimanche 22.
const NOW = new Date("2026-11-18T12:00:00");
const at = (iso: string) => new Date(iso);

function event(id: string, type: string, start: string, end: string, status = "PUBLISHED") {
    return { id, type, status, startDate: at(start), endDate: at(end) };
}

describe("deriveDashboardCalendar", () => {
    it("garde la semaine en cours, écarte passé, terminé et semaine suivante", () => {
        const events = [
            event("week2", "SESSION_MISSIONS", "2026-11-20T18:00:00", "2026-11-20T20:00:00"),
            event("week1", "EVENT_GUILD", "2026-11-18T18:00:00", "2026-11-18T19:00:00"),
            event("nextWeek", "EVENT_GUILD", "2026-11-24T18:00:00", "2026-11-24T19:00:00"),
            event("ended", "EVENT_GUILD", "2026-11-17T10:00:00", "2026-11-17T11:00:00"),
            event("completed", "EVENT_GUILD", "2026-11-18T18:00:00", "2026-11-18T19:00:00", "COMPLETED"),
            event("weekMonday", "EVENT_GUILD", "2026-11-16T10:00:00", "2026-11-22T10:00:00"),
        ];

        const { weekEvents } = deriveDashboardCalendar(events, NOW);

        expect(weekEvents.map((e) => e.id)).toEqual(["weekMonday", "week1", "week2"]);
    });

    it("retient le raid actif le plus récent, même démarré avant la semaine", () => {
        const events = [
            event("raidOlder", "RAID_OFFICIAL", "2026-11-05T10:00:00", "2026-11-25T10:00:00"),
            event("raidOld", "RAID_OFFICIAL", "2026-11-10T10:00:00", "2026-11-25T10:00:00"),
            event("raidEnded", "RAID_OFFICIAL", "2026-11-10T10:00:00", "2026-11-17T10:00:00"),
        ];

        const { activeRaid } = deriveDashboardCalendar(events, NOW);

        expect(activeRaid?.id).toBe("raidOld");
    });

    it("choisit l'événement majeur le plus proche dans les 24 h", () => {
        const events = [
            event("missions", "SESSION_MISSIONS", "2026-11-18T18:00:00", "2026-11-18T19:00:00"),
            event("focus", "EVENT_GUILD", "2026-11-19T00:00:00", "2026-11-19T02:00:00"),
            event("later", "EVENT_GUILD", "2026-11-19T18:00:00", "2026-11-19T20:00:00"),
        ];

        const { focusEvent } = deriveDashboardCalendar(events, NOW);

        expect(focusEvent?.id).toBe("focus");
    });

    it("borne le widget à 20 événements de la semaine", () => {
        const events = Array.from({ length: 25 }, (_, index) =>
            event(`event-${index}`, "EVENT_GUILD", "2026-11-19T10:00:00", "2026-11-19T11:00:00"),
        );

        const { weekEvents } = deriveDashboardCalendar(events, NOW);

        expect(weekEvents).toHaveLength(20);
    });
});
