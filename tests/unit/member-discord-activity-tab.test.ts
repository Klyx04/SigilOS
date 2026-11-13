import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * Fiche membre — onglet « Activité Discord » (demande user : les datas Discord
 * complètes du ladder dans la fiche modale du module gestion membre).
 *
 * 🛡️ Ce que ce test verrouille : ① l'action serveur (lecture staff,
 * cloisonnement guilde, hors-dashboard honnête, profils + notes via la règle
 * partagée) ; ② le panneau (badges, stats vocales/écrites, dernières
 * activités, transparence, état non-mesuré) ; ③ l'onglet dans la modale
 * (fiche par défaut, chargement paresseux, jamais un blâme).
 * Lecture seule (fichiers), aucune base.
 */

const ACTIONS = "src/server/actions/member-lifecycle-actions.ts";
const PANEL = "src/components/admin/members/member-discord-activity.tsx";
const DIALOG = "src/components/admin/members/member-detail-dialog.tsx";

const read = (p: string) => readFileSync(p, "utf8");

describe("fiche membre — action de présence Discord", () => {
    it("lecture staff cloisonnée (isAdmin ou Gérer les membres), sujet validé", () => {
        const src = read(ACTIONS);
        expect(src).toContain("export async function getMemberDiscordPresence");
        expect(src).toContain("!ctx.isAdmin && !ctx.canManageMembers");
        expect(src).toContain("subjectSchema.safeParse(subject)");
        expect(src).toContain("Cible invalide pour cette guilde");
    });

    it("hors dashboard = non mesuré (jamais un zéro accusateur), dashboard = profils + notes", () => {
        const src = read(ACTIONS);
        expect(src).toContain("UNTRACKED_PRESENCE");
        expect(src).toContain("tracked: false");
        expect(src).toContain("resolveDiscordPresenceProfile(counters, ");
        expect(src).toContain("describePresenceProfile(");
        expect(src).toContain("discordVoiceTimeMonthly: true");
        expect(src).toContain("lastDiscordReactionAt: true");
    });
});

describe("fiche membre — panneau d'activité Discord", () => {
    it("fichier dédié : badges, stats complètes, dernières activités, transparence", () => {
        expect(existsSync(PANEL)).toBe(true);
        const src = read(PANEL);
        expect(src).toContain("getMemberDiscordPresence(guildId, parsed)");
        expect(src).toContain("DISCORD_PRESENCE_LABELS[data.profileWeekly]");
        expect(src).toContain("Vocal · sem.");
        expect(src).toContain("Vocal · mois");
        expect(src).toContain("Vocal · total");
        expect(src).toContain("Réactions reçues");
        expect(src).toContain("Dernier message");
        expect(src).toContain("Dernier vocal");
        expect(src).toContain("jamais un blâme");
    });

    it("état non-mesuré honnête + chargement paresseux au sujet près", () => {
        const src = read(PANEL);
        expect(src).toContain("Non mesuré");
        expect(src).toContain("jamais connecté au dashboard");
        expect(src).toContain("subjectKey");
    });

    it("jamais un blâme : ni Mauvais Élève, ni rouge punitif", () => {
        const src = read(PANEL);
        expect(src).not.toContain("Mauvais Élève");
        expect(src).not.toContain("text-danger");
        expect(src).not.toContain("bg-danger");
    });
});

describe("fiche membre — onglet dans la modale", () => {
    it("barre d'onglets Fiche / Activité Discord / Présences, fiche par défaut", () => {
        const src = read(DIALOG);
        expect(src).toContain('role="tablist"');
        expect(src).toContain('role="tab"');
        expect(src).toContain("Activité Discord");
        // R1 (31/10/2026) : un troisième onglet « Présences » s'ajoute — le type reste borné.
        expect(src).toContain('"fiche" | "discord" | "presences"');
        expect(src).toContain('useState<"fiche" | "discord" | "presences">("fiche")');
    });

    it("panneau monté seulement sur l'onglet (sujet de la fiche transmis)", () => {
        const src = read(DIALOG);
        expect(src).toContain("MemberDiscordActivity");
        expect(src).toContain('detailTab === "discord"');
        expect(src).toContain("subject={subject}");
    });
});
