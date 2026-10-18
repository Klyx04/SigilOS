/**
 * Fiche membre — **lot 2** : après un enregistrement, la modale affiche l'heure du serveur
 * et **relit** ses valeurs (`applyRosterSnapshot`), au lieu de garder un `row` figé.
 *
 * Ce que ce verrou protège :
 * - la règle pure de fusion : identité de ligne conservée, `null` ne veut pas dire « efface »
 *   (date Discord / nom d'un hors-dashboard), `0` reste une valeur, entrée jamais mutée ;
 * - l'action de relecture : **lecture seule**, RBAC fail-closed, cloisonnée à la guilde,
 *   horodatage **serveur** ;
 * - le câblage : une seule relecture (dans `run()`, branche succès), bandeau honnête, liste
 *   rafraîchie après écriture.
 *
 * Lecture seule (code source + règle pure), aucune base.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    applyRosterSnapshot,
    type MemberRosterSnapshot,
    type RosterRow,
} from "@/lib/member-roster";

const LIFECYCLE = "src/server/actions/member-lifecycle-actions.ts";
const DIALOG = "src/components/admin/members/member-detail-dialog.tsx";
const LIST = "src/components/admin/members/member-roster-list.tsx";

/** Commentaires de LIGNE d'abord (même règle que les autres verrous de source). */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
        .replace(/\/\*[\s\S]*?\*\//g, "");

function functionBody(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}`);
    expect(start, `${name} introuvable`).toBeGreaterThan(-1);
    const next = source.indexOf("export async function", start + 10);
    return source.slice(start, next === -1 ? source.length : next);
}

function row(over: Partial<RosterRow> = {}): RosterRow {
    return {
        key: "profile:p1",
        profileId: "p1",
        discordId: "discord-1",
        userId: "user-1",
        displayName: "Bob",
        username: "bob",
        avatar: null,
        status: "ACTIVE",
        dashboard: true,
        roles: ["role-1"],
        joinedAt: "2026-01-01T00:00:00.000Z",
        seniorityDays: 290,
        pseudoDofus: "Bob",
        discordNickname: "Bobby",
        ankamaId: null,
        trial: { validated: false, endsAt: "2026-02-01T00:00:00.000Z", remainingDays: 5, decision: "non" },
        recruiter: null,
        mules: [],
        comments: [],
        vacationStart: null,
        vacationEnd: null,
        ...over,
    };
}

function snapshot(over: Partial<MemberRosterSnapshot> = {}): MemberRosterSnapshot {
    return {
        dashboard: true,
        displayName: "Robert",
        pseudoDofus: "Robert",
        ankamaId: "Robert#1234",
        status: "ARCHIVED",
        joinedAt: "2026-02-01T00:00:00.000Z",
        seniorityDays: 0,
        trial: { validated: true, endsAt: null, remainingDays: null, decision: "oui" },
        recruiter: { id: "p2", name: "Alice", avatar: null },
        mules: [{ pseudo: "Mule" }],
        comments: [
            {
                id: "c1",
                body: "Premier retour",
                authorName: "Staff",
                authorUserId: "user-2",
                createdAt: "2026-10-18T20:00:00.000Z",
            },
        ],
        vacationStart: null,
        vacationEnd: null,
        readAt: "2026-10-19T12:34:00.000Z",
        ...over,
    };
}

describe("lot 2 — applyRosterSnapshot (règle pure)", () => {
    it("un profil : toutes les valeurs éditables viennent du serveur, l'identité reste", () => {
        const before = row();
        const merged = applyRosterSnapshot(before, snapshot());

        // Photo serveur appliquée.
        expect(merged.displayName).toBe("Robert");
        expect(merged.pseudoDofus).toBe("Robert");
        expect(merged.ankamaId).toBe("Robert#1234");
        expect(merged.status).toBe("ARCHIVED");
        expect(merged.joinedAt).toBe("2026-02-01T00:00:00.000Z");
        expect(merged.seniorityDays).toBe(0); // 0 est une VRAIE valeur (pas un « vide »)
        expect(merged.trial?.validated).toBe(true);
        expect(merged.recruiter?.name).toBe("Alice");
        expect(merged.mules).toHaveLength(1);
        expect(merged.comments).toHaveLength(1);

        // Identité de ligne conservée (la photo ne la porte pas).
        expect(merged.key).toBe(before.key);
        expect(merged.profileId).toBe(before.profileId);
        expect(merged.discordId).toBe(before.discordId);
        expect(merged.userId).toBe(before.userId);
        expect(merged.roles).toEqual(before.roles);
        expect(merged.dashboard).toBe(true);

        // Entrée jamais mutée.
        expect(before.pseudoDofus).toBe("Bob");
        expect(before.status).toBe("ACTIVE");
        expect(before.seniorityDays).toBe(290);
    });

    it("hors dashboard : un champ inconnu du serveur (null) n'efface pas la valeur Discord", () => {
        const before = row({
            key: "discord:discord-9",
            profileId: null,
            discordId: "discord-9",
            status: null,
            joinedAt: "2026-03-03T00:00:00.000Z", // date d'arrivée Discord (absente de la base)
            seniorityDays: 120,
            vacationStart: "2026-08-01T00:00:00.000Z",
        });

        const merged = applyRosterSnapshot(
            before,
            snapshot({
                dashboard: false,
                displayName: null,
                status: null,
                joinedAt: null,
                seniorityDays: null,
                trial: null,
                recruiter: null,
                mules: [],
                comments: [],
                vacationStart: null,
                vacationEnd: null,
            })
        );

        expect(merged.displayName).toBe(before.displayName);
        expect(merged.joinedAt).toBe(before.joinedAt);
        expect(merged.seniorityDays).toBe(before.seniorityDays);
        expect(merged.vacationStart).toBe(before.vacationStart);
        expect(merged.status).toBeNull();
        expect(merged.trial).toBeNull();
        expect(merged.comments).toEqual([]);
    });

    it("un profil dashboard peut EFFACER ses vacances (la photo fait foi)", () => {
        const before = row({ vacationStart: "2026-08-01T00:00:00.000Z" });
        const merged = applyRosterSnapshot(before, snapshot({ vacationStart: null }));
        expect(merged.vacationStart).toBeNull();
    });
});

describe("lot 2 — action de relecture", () => {
    it("est une lecture seule, gardée et cloisonnée", () => {
        const body = functionBody(codeOnly(LIFECYCLE), "getMemberRegistrySnapshot");
        expect(body).toContain("auth()");
        expect(body).toContain("getUserContext(guildId)");
        expect(body).toContain("!ctx.isAdmin && !ctx.canManageMembers");
        expect(body).toContain("subjectSchema.safeParse(subject)");
        // Isolation de guilde : la cible est filtrée sur la guilde résolue côté serveur.
        expect(body).toContain("where: { id: target.profileId, guildId: guild.id }");
        expect(body).toContain("guildId_discordId: { guildId: guild.id, discordId: target.discordId }");
        // Horloge serveur (jamais l'horloge du poste).
        expect(body).toContain("readAt");
        // Aucune écriture dans cette action.
        expect(body).not.toContain("db.userProfile.update");
        expect(body).not.toContain("db.memberRegistryEntry.upsert");
        expect(body).not.toContain("db.memberRegistryComment.create");
        expect(body).not.toContain("db.memberRegistryComment.delete");
    });

    it("réutilise les règles existantes (essai, ancienneté) au lieu de les réécrire", () => {
        const body = functionBody(codeOnly(LIFECYCLE), "getMemberRegistrySnapshot");
        expect(body).toContain("getTrialDecision(");
        expect(body).toContain("computeSeniorityDays(");
        expect(body).toContain("normalizeMules(");
    });
});

describe("lot 2/4 — câblage de la modale", () => {
    it("la relecture n'a lieu qu'après un succès confirmé", () => {
        const src = codeOnly(DIALOG);
        expect(src).toContain("getMemberRegistrySnapshot(guildId, subject)");
        // Le chemin unique : `if (!result.success) { … return; }` AVANT la relecture.
        const failIndex = src.indexOf("if (!result.success)");
        const rereadIndex = src.indexOf("await getMemberRegistrySnapshot");
        expect(failIndex).toBeGreaterThan(-1);
        expect(rereadIndex).toBeGreaterThan(failIndex);
        // Une seule occurrence : les sept handlers ne rappellent pas la lecture.
        expect(src.split("getMemberRegistrySnapshot(").length - 1).toBe(1);
    });

    it("la fiche affiche la ligne relue (`current`), pas le prop figé", () => {
        const src = codeOnly(DIALOG);
        expect(src).toContain("applyRosterSnapshot(row, snapshot)");
        expect(src).toContain('isDashboard && (current.status === "ARCHIVED"');
        expect(src).toContain("current.comments");
        expect(src).toContain("trialBadge(current.trial)");
    });

    it("le bandeau dit l'heure du serveur et ne ment pas sur une relecture ratée", () => {
        const src = codeOnly(DIALOG);
        expect(src).toContain('role="status"');
        expect(src).toContain("Enregistré à");
        expect(src).toContain('format(date, "HH:mm"');
        expect(src).toContain("valeurs relues du serveur");
        expect(src).toContain("relecture impossible");
        // Jamais de bandeau sans écriture confirmée.
        expect(src).toContain("{saveStamp && (");
    });

    it("la liste se rafraîchit après une écriture (le parent passe `onChanged`)", () => {
        const list = codeOnly(LIST);
        expect(list).toContain("onChanged={() => router.refresh()}");
        expect(list).toContain("useRouter()");
    });
});

describe("lot 4 — le journal du staff est édité/supprimé avec trace", () => {
    it("édition et suppression sont gardées et périmétrées (guilde + membre)", () => {
        const src = codeOnly(LIFECYCLE);
        for (const name of ["updateMemberRegistryComment", "deleteMemberRegistryComment"]) {
            const body = functionBody(src, name);
            expect(body, name).toContain("!ctx.isAdmin && !ctx.canManageMembers");
            expect(body, name).toContain("subjectSchema.safeParse(subject)");
            expect(body, name).toContain("commentScope(guild.id, target)");
            expect(body, name).toContain("Commentaire introuvable sur cette fiche");
            expect(body, name).toContain("createAuditLog(");
        }
        const update = functionBody(src, "updateMemberRegistryComment");
        expect(update).toContain('action: "MEMBER_COMMENT_UPDATED"');
        expect(update).toContain("oldValue: { body: previous.body }");
        const remove = functionBody(src, "deleteMemberRegistryComment");
        expect(remove).toContain('action: "MEMBER_COMMENT_DELETED"');
        expect(remove).toContain("oldValue: { body: previous.body }");
    });

    it("l'audit du registre reçoit l'ID Discord de la guilde (jamais l'ID interne)", () => {
        // `createAuditLog` résout la guilde par `discordGuildId` : lui passer `guild.id`
        // n'écrivait… rien (retour « Guild not found » avalé). Ce verrou interdit la rechute.
        const src = codeOnly(LIFECYCLE);
        expect(src).not.toMatch(/createAuditLog\(\{[\s\S]{0,120}?guildId:\s*guild\.id/);
    });

    it("la modale affiche n/20 et n'ajoute plus au-delà du plafond", () => {
        const src = codeOnly(DIALOG);
        expect(src).toContain("{current.comments.length}/{MAX_REGISTRY_COMMENTS}");
        expect(src).toContain("canAddRegistryComment(current.comments.length)");
        expect(src).toContain("Plafond atteint");
    });
});



