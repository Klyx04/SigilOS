/**
 * Exclusions actives (`GuildMemberBan`) intégrées au roster — **règle pure** (`mergeExclusions`).
 *
 * Ce que la garde protège (mesure du 25/10/2026, cas bêta réel) :
 * - un exclu dont le profil a été **purgé** doit rester visible dans la liste, sinon le compteur
 *   « Exclus » affiche 0 et aucun staff ne peut lever l'exclusion (seul le panneau God la voyait) ;
 * - une ligne de registre qui affiche « Actif » alors que la porte refuse le membre doit basculer
 *   en « Exclu » : deux sources ne doivent plus se contredire ;
 * - aucun doublon, et la règle reste **pure** (le tableau d'entrée n'est jamais muté).
 */
import { describe, expect, it } from "vitest";

import { mergeExclusions, rosterCounts, type RosterExclusion, type RosterRow } from "@/lib/member-roster";

const row = (patch: Partial<RosterRow> = {}): RosterRow => ({
    key: patch.key ?? `discord:${patch.discordId ?? "111"}`,
    profileId: "p1",
    discordId: "111",
    userId: "u1",
    displayName: "Wylan",
    username: "wylan",
    avatar: null,
    status: "ACTIVE",
    dashboard: true,
    roles: [],
    joinedAt: null,
    seniorityDays: null,
    pseudoDofus: null,
    discordNickname: null,
    ankamaId: null,
    trial: null,
    recruiter: null,
    mules: [],
    comments: [],
    vacationStart: null,
    vacationEnd: null,
    ...patch,
});

const exclusion = (patch: Partial<RosterExclusion> = {}): RosterExclusion => ({
    discordId: "999",
    memberName: "Doloke",
    reason: "MEMBER_DELETED",
    createdAt: "2026-08-22T16:57:51.760Z",
    ...patch,
});

describe("mergeExclusions — un exclu sans profil reste visible", () => {
    it("ajoute une ligne « exclu » hors dashboard quand aucune ligne ne porte ce discordId", () => {
        const merged = mergeExclusions([row()], [exclusion()]);

        expect(merged).toHaveLength(2);
        expect(merged[1]).toMatchObject({
            key: "discord:999",
            discordId: "999",
            profileId: null,
            displayName: "Doloke",
            status: "BANNED",
            dashboard: false,
        });
    });

    it("nomme la ligne par défaut quand le pseudo n'a pas été capturé", () => {
        const merged = mergeExclusions([], [exclusion({ memberName: null })]);

        expect(merged[0].displayName).toBe("Membre exclu");
        expect(merged[0].discordNickname).toBeNull();
    });

    it("force le statut à « exclu » sur une ligne existante (registre « Actif » mais porte fermée)", () => {
        const existing = row({ discordId: "999", displayName: "Doloke", status: "ACTIVE" });
        const merged = mergeExclusions([existing], [exclusion()]);

        expect(merged).toHaveLength(1);
        expect(merged[0].status).toBe("BANNED");
        // La fiche reste une fiche dashboard : on ne perd ni le profil ni ses actions.
        expect(merged[0].dashboard).toBe(true);
        expect(merged[0].profileId).toBe("p1");
    });

    it("ne duplique pas une ligne déjà exclue", () => {
        const already = row({ discordId: "999", status: "BANNED" });
        const merged = mergeExclusions([already], [exclusion()]);

        expect(merged).toHaveLength(1);
        expect(merged[0]).toBe(already);
    });

    it("ignore une exclusion sans identifiant Discord", () => {
        const merged = mergeExclusions([row()], [exclusion({ discordId: "" })]);

        expect(merged).toHaveLength(1);
    });

    it("ne mute jamais le roster reçu et retourne un nouveau tableau", () => {
        const rows = [row()];
        const merged = mergeExclusions(rows, [exclusion()]);

        expect(merged).not.toBe(rows);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("ACTIVE");
    });

    it("sans exclusion, rend une copie à l'identique", () => {
        const rows = [row()];
        const merged = mergeExclusions(rows, []);

        expect(merged).toEqual(rows);
        expect(merged).not.toBe(rows);
    });

    it("le compteur « Exclus » additionne les profils bannis et les exclusions sans profil", () => {
        const rows = [row({ key: "discord:111", discordId: "111", status: "ACTIVE" }), row({ key: "p2", profileId: "p2", discordId: "222", status: "BANNED" })];
        const merged = mergeExclusions(rows, [exclusion({ discordId: "999" })]);

        expect(rosterCounts(merged).banned).toBe(2);
        expect(rosterCounts(merged).total).toBe(3);
    });
});
