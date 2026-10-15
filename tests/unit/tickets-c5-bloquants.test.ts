/**
 * 🎫 Tickets — lot C-5 « bugs bloquants » (revue bot ticket §2-3 + §7).
 *
 * Verrouille ce que la revue reprochait :
 *   · le compteur « Tickets ouverts » du motif ne compte plus l'historique ;
 *   · la suppression d'un motif n'est bloquée que par des tickets ouverts ;
 *   · le quota guilde a un exécutant (v1 + v2) ;
 *   · la boîte de réception dit quand le salon Discord a disparu ;
 *   · le clamp God des quotas est annoncé au dashboard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TICKET_OPEN_STATUSES, clampTicketGuildQuotas } from "@/lib/tickets/platform-limits";

const ACTIONS = "src/server/actions/ticket-bot-actions.ts";
const MOTIFS_TAB =
    "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-motifs-tab.tsx";
const INBOX_TAB =
    "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-inbox-tab.tsx";
const SETTINGS_TAB =
    "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-settings-tab.tsx";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("tickets C-5 — statuts ouverts (pur)", () => {
    it("compte les files actives, jamais l'historique fermé/refusé", () => {
        expect(TICKET_OPEN_STATUSES).toContain("OPEN");
        expect(TICKET_OPEN_STATUSES).toContain("CLAIMED");
        expect(TICKET_OPEN_STATUSES).toContain("PENDING_USER");
        expect(TICKET_OPEN_STATUSES).toContain("REQUESTED");
        expect(TICKET_OPEN_STATUSES).not.toContain("CLOSED");
        expect(TICKET_OPEN_STATUSES).not.toContain("REFUSED");
    });

    it("le clamp God plafonne sans jamais lever", () => {
        const limits = {
            transcriptsEnabled: true,
            retentionArchivesDays: 90,
            retentionNotesDays: 90,
            retentionAuditDays: 180,
            maxPerUserCap: 5,
            maxGuildCap: 100,
        };
        expect(
            clampTicketGuildQuotas({ maxActiveTicketsPerUser: 10, maxTicketsTotalGuild: 500 }, limits)
        ).toEqual({ maxActiveTicketsPerUser: 5, maxTicketsTotalGuild: 100 });
        expect(
            clampTicketGuildQuotas({ maxActiveTicketsPerUser: 2, maxTicketsTotalGuild: 40 }, limits)
        ).toEqual({ maxActiveTicketsPerUser: 2, maxTicketsTotalGuild: 40 });
    });
});

describe("tickets C-5 — garde de suppression du motif", () => {
    it("ne compte que les statuts ouverts", () => {
        const code = read(ACTIONS);
        const idx = code.indexOf("export async function deleteTicketJourneyAction");
        expect(idx).toBeGreaterThan(-1);
        const body = code.slice(idx, idx + 1500);
        expect(body).toContain("REQUESTED");
        expect(body).toContain("ARCHIVE_FAILED");
        expect(body).not.toContain("_count");
        expect(body).toContain("ouvert(s)");
    });
});

describe("tickets C-5 — compteur du motif", () => {
    it("la liste serveur expose `openTickets` et l'UI le lit", () => {
        expect(read(ACTIONS)).toContain("openTickets");
        expect(read(MOTIFS_TAB)).toContain("journey.openTickets");
    });
});

describe("tickets C-5 — quotas exécutés", () => {
    it("la création v1 et v2 refuse quand la guilde est pleine", () => {
        const code = read(ACTIONS);
        expect(code).toContain("activeGuildTickets >= ");
        expect(code).toContain("maxTicketsTotalGuild");
    });

    it("le dashboard prévient quand le clamp God s'applique", () => {
        expect(read(ACTIONS)).toContain("clamped");
        expect(read(SETTINGS_TAB)).toContain("clamped");
    });
});

describe("tickets C-5 — salon supprimé visible en inbox", () => {
    it("l'entrée reste pour l'historique mais dit que le salon a disparu", () => {
        expect(read(INBOX_TAB)).toContain("Salon supprimé");
        expect(read(INBOX_TAB)).toContain("!ticket.discordChannelId");
    });
});
