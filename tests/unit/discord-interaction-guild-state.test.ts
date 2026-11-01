/**
 * Garde d'interactions Discord : une guilde désactivée ou supprimée n'écrit plus, sur **aucun**
 * bouton, commande, modale ou autocomplete déjà posté.
 *
 * 🐛 Mesure du 01/11/2026 : le soft-delete fermait le site mais pas Discord — les embeds et leurs
 * boutons survivent au retrait, et la résolution par `discordGuildId` (comme
 * `internalCheckPermission`) ne regarde ni `isActive` ni `deletedAt`.
 *
 * Ce que ce verrou protège, dans l'ordre :
 * 1. le garde est **après** la vérification de signature et **avant** le premier dispatch ;
 * 2. il couvre tous les types d'interaction (2 commande, 3 bouton, 4 autocomplete, 5 modale) ;
 * 3. une guilde **absente** de la base garde son comportement d'avant (pas de régression au
 *    déploiement) ;
 * 4. une lecture impossible **refuse** (fail-closed), elle ne laisse pas passer ;
 * 5. God n'est **pas** exempté : il réactive d'abord, il n'écrit pas sur des données archivées.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveGuildActivityState } from "@/lib/discord-guild-state";

const REPO_ROOT = path.resolve(__dirname, "../..");
const ROUTE = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/api/discord/interactions/route.ts"),
    "utf8",
);

describe("resolveGuildActivityState — la décision, une seule fois", () => {
    it("une guilde active et non supprimée passe", () => {
        expect(resolveGuildActivityState({ isActive: true, deletedAt: null })).toBe("active");
    });

    it("désactivée par God (`isActive=false`) refuse", () => {
        expect(resolveGuildActivityState({ isActive: false, deletedAt: null })).toBe("inactive");
    });

    it("supprimée (`deletedAt` posé) refuse, même si `isActive` traîne à true", () => {
        expect(
            resolveGuildActivityState({ isActive: true, deletedAt: new Date("2026-11-01") }),
        ).toBe("inactive");
    });

    it("guilde jamais déployée : aucune régression", () => {
        expect(resolveGuildActivityState(null)).toBe("absent");
    });
});

describe("garde d'interactions — câblage et ordre", () => {
    it("le garde est un helper unique, branché sur `discordGuildId`", () => {
        expect(ROUTE).toContain("await readGuildActivityState(interactionGuildId)");
        expect(ROUTE).toContain("where: { discordGuildId }");
        expect(ROUTE).toContain("select: { isActive: true, deletedAt: true }");
    });

    it("il s'exécute après la signature et avant le premier dispatch", () => {
        const signature = ROUTE.indexOf("verifyDiscordSignature(request, bodyText)");
        const garde = ROUTE.indexOf("await readGuildActivityState(interactionGuildId)");
        const bouton = ROUTE.indexOf("// 2. Handle Component Interaction (Button click)");
        const modale = ROUTE.indexOf("if (payload.type === 5) {");
        const commande = ROUTE.indexOf("if (payload.type === 2) {");

        expect(signature).toBeGreaterThan(-1);
        expect(garde).toBeGreaterThan(-1);
        expect(garde).toBeGreaterThan(signature);
        expect(bouton).toBeGreaterThan(-1);
        expect(modale).toBeGreaterThan(-1);
        expect(commande).toBeGreaterThan(-1);
        expect(garde).toBeLessThan(bouton);
        expect(garde).toBeLessThan(modale);
        expect(garde).toBeLessThan(commande);
    });

    it("une lecture impossible refuse (fail-closed)", () => {
        expect(ROUTE).toContain('return "error";');
        expect(ROUTE).toContain('guildState === "inactive" || guildState === "error"');
    });

    it("un autocomplete reçoit des choix vides, jamais un message éphémère", () => {
        expect(ROUTE).toContain("if (payload.type === 4) {");
        expect(ROUTE).toContain("return NextResponse.json({ type: 8, data: { choices: [] } });");
    });

    it("God n'est pas exempté du garde", () => {
        const debut = ROUTE.indexOf("const interactionGuildId");
        const fin = ROUTE.indexOf("// 2. Handle Component Interaction");
        const bloc = ROUTE.slice(debut, fin);

        expect(bloc).not.toContain("isSuperAdmin");
        expect(bloc).not.toContain("SUPER_ADMIN_IDS");
    });
});
