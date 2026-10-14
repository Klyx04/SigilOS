/**
 * Registre Membres — **B-2** : les membres Discord **hors dashboard** sont éditables.
 *
 * Ce que ce verrou protège :
 * - les cinq écritures du registre prennent un **sujet** (`profileId` **xor** `discordId`) au lieu
 *   d'un `profileId` obligatoire — jamais les deux, jamais aucun ;
 * - chaque écriture écrit bien dans la **bonne étagère** (`userProfile` pour un inscrit,
 *   `memberRegistryEntry` pour un membre Discord sans profil) ;
 * - la migration est **additive** (colonne rendue nullable + nouvelle table), donc sans réécriture
 *   de données ;
 * - la modale branche le sujet et reste éditable pour les deux natures de lignes.
 *
 * Lecture seule : code source + migration.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const LIFECYCLE = "src/server/actions/member-lifecycle-actions.ts";
const USER_ACTIONS = "src/server/actions/user-actions.ts";
const INTERACTIONS = "src/app/api/discord/interactions/route.ts";
const ALERT_DIALOG_UI = "src/components/ui/alert-dialog.tsx";
const DIALOG_UI = "src/components/ui/dialog.tsx";
const DIALOG = "src/components/admin/members/member-detail-dialog.tsx";
const SCHEMA = "prisma/schema.prisma";
const MIGRATION =
    "prisma/migrations/20270105000000_add_member_registry_entry/migration.sql";

/** Commentaires de LIGNE d'abord (un `// … /* …` avalerait tout le code suivant). */
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

const SUBJECT_ACTIONS = [
    "setMemberTrialState",
    "updateMemberRecruiter",
    "updateMemberAlts",
    "addMemberRegistryComment",
    "updateMemberRegistryIdentity",
];

describe("B-2 — le registre accepte un sujet polymorphe (profil XOR membre Discord)", () => {
    it("les cinq écritures prennent un `RegistrySubject`, pas un `profileId` obligatoire", () => {
        const actions = codeOnly(LIFECYCLE);
        for (const name of SUBJECT_ACTIONS) {
            const body = functionBody(actions, name);
            expect(body, name).toContain("subject: RegistrySubject");
            expect(body, name).not.toMatch(/profileId: string,\n\s+input/);
        }
    });

    it("le sujet est validé par un union (xor) et la cible est normalisée", () => {
        const actions = codeOnly(LIFECYCLE);
        expect(actions).toContain("const subjectSchema = z.union([");
        expect(actions).toContain("z.object({ profileId: z.string().min(1) })");
        expect(actions).toContain("z.object({ discordId: z.string().min(1) })");
        expect(actions).toContain("function resolveRegistryTarget");
    });

    it("chaque écriture vise la bonne étagère (profil, ligne de registre ou commentaire)", () => {
        const actions = codeOnly(LIFECYCLE);
        // Les quatre écritures « fiche » alimentent le profil OU la ligne de registre.
        for (const name of SUBJECT_ACTIONS.filter((action) => action !== "addMemberRegistryComment")) {
            const body = functionBody(actions, name);
            expect(body, name).toContain('target.kind === "profile"');
            expect(body, name).toContain("db.memberRegistryEntry.upsert(");
        }

        // Le journal du staff vise le profil OU le couple guilde/discordId.
        const comments = functionBody(actions, "addMemberRegistryComment");
        expect(comments).toContain("db.memberRegistryComment.create(");
        expect(comments).toContain("discordId: target.discordId");
        expect(comments).toContain("profileId: profile.id");
    });

    it("la migration est additive et la table dédiée est unique par guilde", () => {
        expect(existsSync(MIGRATION)).toBe(true);
        const migration = readFileSync(MIGRATION, "utf8");
        expect(migration).toContain('ALTER COLUMN "profileId" DROP NOT NULL');
        expect(migration).toContain('CREATE TABLE "MemberRegistryEntry"');
        expect(migration).toContain("MemberRegistryEntry_guildId_discordId_key");

        const schema = readFileSync(SCHEMA, "utf8");
        expect(schema).toContain("model MemberRegistryEntry {");
        expect(schema).toContain("@@unique([guildId, discordId])");
        expect(schema).toContain("discordId    String?");
    });

    it("la modale branche le sujet et reste éditable pour les deux natures", () => {
        const dialog = codeOnly(DIALOG);
        expect(dialog).toContain("const subject: RegistrySubject");
        expect(dialog).toContain("{ profileId: row.profileId }");
        expect(dialog).toContain("{ discordId: row.discordId ?? \"\" }");
        // Éditable pour un profil dashboard **ou** un membre Discord.
        expect(dialog).toContain("canManageMembers && (isDashboard || !!row.discordId)");
        // Les actions de cycle de vie (archivage/exclusion/vacances) restent réservées aux profils.
        expect(dialog).toContain("isDashboard && (row.status === \"ARCHIVED\"");
    });

    it("reprend la ligne de registre sur le profil à la première connexion (aucune saisie perdue)", () => {
        const actions = codeOnly(USER_ACTIONS);
        // La ligne est relue juste avant la création du profil…
        expect(actions).toContain("db.memberRegistryEntry.findUnique(");
        expect(actions).toContain("guildId_discordId: { guildId: guildConfig.id, discordId: discordUserId }");

        // …ses champs sont reportés sur le profil…
        for (const field of [
            "pseudoDofus",
            "ankamaId",
            "guildJoinedAt",
            "recruitedById",
            "trialValidated",
            "trialEndsAt",
            "altPseudos",
        ]) {
            expect(actions, field).toContain(`registryEntry.${field}`);
        }

        // …les commentaires du staff suivent la fiche, puis la ligne est libérée (jamais deux sources).
        expect(actions).toContain("db.memberRegistryComment.updateMany(");
        expect(actions).toContain("data: { profileId: profile.id, discordId: null }");
        expect(actions).toContain("db.memberRegistryEntry.delete(");
    });

    it("/valider-recrue complète aussi un membre hors dashboard (plus de refus)", () => {
        const route = codeOnly(INTERACTIONS);

        // Le refus « il doit se connecter au dashboard » ne doit plus exister.
        expect(route).not.toContain("n'a pas encore de profil SigilOS dans cette guilde");

        // La commande écrit sur la bonne étagère selon la nature de la recrue.
        expect(route).toContain("db.memberRegistryEntry.upsert(");
        expect(route).toContain("guildId_discordId: { guildId: guildConfig.id, discordId: targetId }");

        // L'état d'essai se lit sur les deux étagères (profil **ou** ligne de registre).
        expect(route).toContain("profile?.trialValidated ?? registryEntry?.trialValidated");
        expect(route).toContain("profile?.trialEndsAt ?? registryEntry?.trialEndsAt");
    });

    it("la confirmation de suppression passe AU-DESSUS de la modale membre (sinon modale figée)", () => {
        // z-index réel : un `AlertDialog` ouvert depuis un `Dialog` doit être au-dessus de lui,
        // sinon il s'affiche derrière (clic sans effet) tout en rendant la page inerte.
        const zIndexAfter = (file: string, slot: string) => {
            const source = readFileSync(file, "utf8");
            const index = source.indexOf(slot);
            expect(index, slot).toBeGreaterThan(-1);
            const match = source.slice(index).match(/z-\[(\d+)\]/);
            expect(match, `z-index après ${slot}`).not.toBeNull();
            return Number(match![1]);
        };

        const dialogZ = zIndexAfter(DIALOG_UI, 'data-slot="dialog-content"');
        const alertZ = zIndexAfter(ALERT_DIALOG_UI, 'data-slot="alert-dialog-content"');
        expect(alertZ).toBeGreaterThan(dialogZ);
    });
});
