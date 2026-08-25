import { describe, it, expect } from "vitest";
import { generateHtmlTranscript } from "@/lib/tickets/transcript-engine";

describe("Ticket Bot — Transcript Engine", () => {
    it("should generate a valid HTML transcript document", () => {
        const meta = {
            ticketNumber: 42,
            categoryName: "Support Technique",
            guildName: "La Guilde des Légendes",
            creatorName: "JoueurTest",
            creatorId: "123456789012345678",
            claimedByName: "StaffAdmin",
            openedAt: new Date("2026-08-25T10:00:00Z"),
            closedAt: new Date("2026-08-25T10:30:00Z"),
            closedByName: "StaffAdmin",
            closedReason: "Résolu avec succès",
            intakeAnswers: {
                "Pseudo Dofus": "Klyx-Sacri",
                "Serveur": "Orukam",
            },
            csatRating: 5,
        };

        const messages = [
            {
                id: "msg-1",
                authorId: "123456789012345678",
                authorName: "JoueurTest",
                isStaff: false,
                content: "Bonjour, j'ai un souci avec mon build.",
                createdAt: new Date("2026-08-25T10:01:00Z"),
            },
            {
                id: "note-1",
                authorId: "987654321098765432",
                authorName: "StaffAdmin",
                isStaff: true,
                isInternalNote: true,
                content: "Vérifié en DB, le stuff est bien validé.",
                createdAt: new Date("2026-08-25T10:05:00Z"),
            },
            {
                id: "msg-2",
                authorId: "987654321098765432",
                authorName: "StaffAdmin",
                isStaff: true,
                isInternalNote: false,
                content: "Problème corrigé, bon jeu à toi !",
                createdAt: new Date("2026-08-25T10:10:00Z"),
            },
        ];

        const html = generateHtmlTranscript(meta, messages);

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<title>Transcript #42 — Support Technique — La Guilde des Légendes</title>");
        expect(html).toContain("Ticket #42 — Support Technique");
        expect(html).toContain("JoueurTest");
        expect(html).toContain("Klyx-Sacri");
        expect(html).toContain("NOTE INTERNE STAFF");
        expect(html).toContain("Vérifié en DB, le stuff est bien validé.");
        expect(html).toContain("Problème corrigé, bon jeu à toi !");
        expect(html).toContain("⭐⭐⭐⭐⭐ (5/5)");
    });

    it("should escape malicious HTML injections", () => {
        const meta = {
            ticketNumber: 1,
            categoryName: "<script>alert('pwn')</script>",
            guildName: "Guild <img src=x onerror=alert(1)>",
            creatorName: "Hacker<b>bold</b>",
            creatorId: "111",
            openedAt: new Date(),
        };

        const messages = [
            {
                id: "msg-1",
                authorId: "111",
                authorName: "<script>",
                content: "<svg onload=alert(2)>",
                createdAt: new Date(),
            },
        ];

        const html = generateHtmlTranscript(meta, messages);

        expect(html).not.toContain("<script>alert('pwn')</script>");
        expect(html).not.toContain("<svg onload=alert(2)>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("&lt;svg onload=alert(2)&gt;");
    });
});
