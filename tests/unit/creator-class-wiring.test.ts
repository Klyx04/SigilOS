/**
 * Classe du créateur — **une seule règle, partout**.
 *
 * 🔒 Ce que ce verrou interdit :
 *  ① un sélecteur qui proposerait les 19 classes (une classe non possédée ne doit pas être
 *    choisissable : le membre verrait une classe qu'il n'a pas) ;
 *  ② un écran qui oublie d'envoyer la classe (création DJ simple/multi, édition DJ, création
 *    et édition Songes, création et édition calendrier) ;
 *  ③ un service qui écrirait la classe sans revalider le roster (`resolveOwnedClass`) ;
 *  ④ le retour du blocage « Tu es l'organisateur / le leader » quand le CRÉATEUR change sa
 *    propre classe depuis le menu Discord.
 *
 * 📏 Mesure du 23/10/2026 : le menu Discord affichait déjà la classe au créateur, mais le
 * serveur la refusait (`updateDjParticipantClass`, `updateRunCandidateClass`) et aucun écran
 * ne permettait de la choisir — d'où ce chantier.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

describe("Classe du créateur — règle unique et câblage complet", () => {
    it("le sélecteur ne propose QUE le roster du profil (jamais les 19 classes)", () => {
        const source = read("src/components/shared/creator-class-selector.tsx");
        // Aucune liste statique de classes dans le composant.
        expect(source).not.toMatch(/DOFUS_CLASSES/);
        // La source est le roster du membre connecté…
        expect(source).toContain("getMyPlayableCharacters");
        // …et le défaut est le personnage principal (une seule fois, jamais écrasé).
        expect(source).toMatch(/roster\[0\]\.classe/);
        expect(source).toContain("autoSelected.current");
    });

    it("les cinq écrans envoient la classe du créateur — et seulement si elle change", () => {
        expect(read("src/components/dungeon-finder/DjPostCreateModal.tsx")).toMatch(/creatorClass: creatorClass \?\? undefined/);
        expect(read("src/components/dungeon-finder/DjEditModal.tsx")).toMatch(/creatorClass !== initialCreatorClass/);
        expect(read("src/components/songes/CreateRunButton.tsx")).toMatch(/leaderClass: leaderClass \|\| undefined/);
        expect(read("src/components/songes/RunEditModal.tsx")).toMatch(/leaderClass !== initialLeaderClass/);
        expect(read("src/components/calendar/event-form.tsx")).toMatch(/creatorClass !== initialCreatorClass/);
    });

    it("les services revalident la classe contre le roster (fail-closed)", () => {
        const services = {
            "Donjons & Quêtes": read("src/server/actions/dungeon-finder-actions.ts"),
            Songes: read("src/server/songes-service.ts"),
            "Création Songes": read("src/server/actions/songes/dream-run-actions.ts"),
            Calendrier: read("src/server/calendar-service.ts"),
        };
        for (const [name, source] of Object.entries(services)) {
            expect(source, name).toContain("resolveOwnedClass(");
        }
    });

    it("le créateur n'est plus bloqué sur sa propre classe (menu Discord)", () => {
        const dj = read("src/server/actions/dungeon-finder-actions.ts");
        const songes = read("src/server/songes-service.ts");
        // On ignore les commentaires : le chantier les cite pour expliquer l'ancien refus.
        const codeOnly = (source: string) =>
            source
                .split(/\r?\n/)
                .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
                .join("\n");
        // DJ : le refus « organisateur » a disparu ; le créateur écrit `_creatorClass`.
        expect(codeOnly(dj)).not.toContain("Tu es l'organisateur de ce groupe");
        expect(dj).toContain("withDjCreatorClass(post.dungeonsJson, ownedClass.classe)");
        // Songes : le refus ne subsiste QUE sur le chemin « rejoindre sa propre run ».
        expect((codeOnly(songes).match(/Tu es le leader de cette run !/g) ?? []).length).toBe(1);
        expect(songes).toContain("Meneur de la run");
    });

    it("le calendrier inscrit d'office le créateur sur TOUS les événements (option B)", () => {
        const calendar = read("src/server/actions/calendar-actions.ts");
        expect(calendar).toMatch(/Option B[\s\S]{0,600}db\.eventParticipant\.create/);
        // La classe du créateur est posée sur cette inscription.
        expect(calendar).toMatch(/db\.eventParticipant\.create\(\{[\s\S]{0,400}ownedCreatorClass\.classe/);
    });

    it("la classe du créateur DJ ne perd jamais l'enveloppe (donjons, messages, rappels)", () => {
        const utils = read("src/lib/dungeon-finder-utils.ts");
        expect(utils).toMatch(/export function withDjCreatorClass/);
        expect(utils).toMatch(/delete env\._creatorClass/);
        // Elle est lue AVANT la classe du profil, sur les DEUX embeds (simple et multi).
        const dj = read("src/server/actions/dungeon-finder-actions.ts");
        expect((dj.match(/getDjCreatorClass\(post\.dungeonsJson\) \?\? post\.profile\?\.classe/g) ?? []).length).toBe(2);
    });
});
