/**
 * Guide public du Rush — **identité du visiteur connecté** (V2a, étendue en V2a-3).
 *
 * Trois règles, et une seule façon de les casser :
 *
 * 1. **DTO étanche** : sept scalaires (pseudo, classe, serveur, niveau, points de succès,
 *    pseudo Metamob, vérification Metamob) — jamais les mules, jamais la **clé** Metamob,
 *    jamais `userId`. Le test n'interdit pas le mot « Metamob » (la tuile V2a-3 existe) :
 *    il liste les identifiants autorisés et refuse **tout autre** `metamob*` ;
 * 2. **anonyme = inchangé** : la page ne lit le profil que s'il y a une session, et rien de
 *    l'identité n'est rendu si elle manque. Un visiteur non connecté ne voit ni la tuile
 *    enrichie, ni une requête en plus ;
 * 3. **état Metamob** : trois cas seulement (rien / lié / vérifié), décidés par une règle
 *    pure — la tuile ne raconte pas ce qu'elle veut.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { metamobState, toPublicGuideVisitor } from "@/lib/public-guide-visitor";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PAGE = "src/app/guides/rush-sylvestre/page.tsx";
const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const LIB = "src/lib/public-guide-visitor.ts";

/** Les SEULS identifiants `metamob*` autorisés dans la surface publique. */
const METAMOB_ALLOWED = [
    "metamob",
    "metamobpseudo",
    "metamobverified",
    "metamobstate",
    // Libellé affiché par la tuile (« lié · vérifié »), dérivé de la règle pure.
    "metamoblabel",
    // 08/11/2026 — noms d'**UI** seulement : le composant voisin qui porte le formulaire et
    // l'état d'ouverture de sa modale. Aucune donnée : une clé, un slug, un serveur ou un
    // horodatage Metamob ajouté demain fait toujours échouer ce test.
    "metamobmodal",
    "metamobopen",
];

describe("Tuile du guide — sept scalaires, rien d'autre", () => {
    it("recopie exactement les sept champs publics", () => {
        const visitor = toPublicGuideVisitor({
            pseudoDofus: "MonIop",
            classe: "iop",
            dofusServerId: 295,
            dofusLevel: 200,
            successPoints: 12_345,
            metamobPseudo: "MonMetamob",
            metamobVerified: true,
            alignment: "bontarien",
            alignmentOrder: "vaillant",
            altPseudos: [{ pseudo: "MaMule", classe: "cra" }],
        });
        expect(visitor).toEqual({
            pseudo: "MonIop",
            classe: "iop",
            serverId: 295,
            level: 200,
            successPoints: 12_345,
            metamobPseudo: "MonMetamob",
            metamobVerified: true,
            alignment: "bontarien",
            alignmentOrder: "vaillant",
            mules: [{ pseudo: "MaMule", classe: "cra" }],
        });
        expect(Object.keys(visitor).sort()).toEqual([
            "alignment",
            "alignmentOrder",
            "classe",
            "level",
            "metamobPseudo",
            "metamobVerified",
            "mules",
            "pseudo",
            "serverId",
            "successPoints",
        ]);
    });

    it("accepte un profil incomplet sans inventer de valeur", () => {
        const visitor = toPublicGuideVisitor({
            pseudoDofus: null,
            classe: null,
            dofusServerId: 295,
            dofusLevel: null,
            successPoints: null,
            metamobPseudo: null,
            metamobVerified: false,
            alignment: null,
            alignmentOrder: null,
            altPseudos: [],
        });
        expect(visitor.pseudo).toBeNull();
        expect(visitor.classe).toBeNull();
        expect(visitor.level).toBeNull();
        expect(visitor.metamobPseudo).toBeNull();
        expect(visitor.alignment).toBeNull();
        expect(visitor.mules).toEqual([]);
    });

    it("n'a AUCUN chemin pour recopier la clé Metamob, même si on la lui passe", () => {
        // L'objet d'entrée porte la clé : la recopie est champ par champ, donc elle meurt ici.
        const leaky = {
            pseudoDofus: "MonIop",
            classe: "iop",
            dofusServerId: 295,
            dofusLevel: 200,
            successPoints: 1,
            metamobPseudo: "MonMetamob",
            metamobVerified: true,
            alignment: "brakmarien",
            alignmentOrder: "destructeur",
            altPseudos: [{ pseudo: "MaMule", classe: "cra", level: 200 }],
            metamobApiKey: "cle-secrete-qui-ne-doit-pas-sortir",
        };
        const visitor = toPublicGuideVisitor(leaky);
        expect(JSON.stringify(visitor)).not.toContain("cle-secrete");
        expect(Object.keys(visitor)).not.toContain("metamobApiKey");
        // Les mules sont PUBLIQUES (fiche `/visiteurs/<id>`) et n'emportent que pseudo + classe :
        // ni niveau, ni alignement, ni quoi que ce soit d'autre ne fuit par ce chemin.
        expect(Object.keys(visitor.mules[0]).sort()).toEqual(["classe", "pseudo"]);
    });
});


describe("État Metamob — trois cas, décidés par une règle pure", () => {
    it("rien de lié quand le pseudo manque, vérifié ou non", () => {
        expect(metamobState({ metamobPseudo: null, metamobVerified: true })).toBe("none");
        expect(metamobState(null)).toBe("none");
        expect(metamobState(undefined)).toBe("none");
    });

    it("lié mais non vérifié quand le pseudo existe sans vérification", () => {
        expect(metamobState({ metamobPseudo: "MonMetamob", metamobVerified: false })).toBe("linked");
    });

    it("vérifié seulement quand l'API a confirmé le lien", () => {
        expect(metamobState({ metamobPseudo: "MonMetamob", metamobVerified: true })).toBe("verified");
    });
});

describe("Tuile du guide — jamais de données privées, jamais pour un anonyme", () => {
    const page = stripComments(read(PAGE));
    const client = stripComments(read(CLIENT));

    it("la page ne lit le profil que s'il y a une session", () => {
        expect(page).toContain("session?.user ? await getPublicAccount() : null");
        expect(page).toContain("visitor={guideVisitor}");
    });

    it("l'identité n'est rendue que si elle existe", () => {
        // La tuile garde ce garde : un anonyme ne voit ni pseudo, ni serveur du compte, ni
        // niveau, ni points de succès, ni porte vers l'espace visiteur.
        expect(client).toContain("{visitor ? (");
        expect(client).toContain("visitor?: PublicGuideVisitor | null");
    });

    it("aucune donnée privée dans la tuile ni dans le DTO", () => {
        const lib = stripComments(read(LIB));
        for (const [name, code] of [["client", client], ["lib", lib]] as const) {
            // Toute occurrence `metamob*` doit être dans la liste blanche : une clé, un slug,
            // un serveur ou un horodatage Metamob ajouté demain casse ce test.
            const found = code.match(/metamob[\w]*/gi) ?? [];
            const unknown = [...new Set(found.map((m) => m.toLowerCase()))].filter(
                (m) => !METAMOB_ALLOWED.includes(m)
            );
            expect(unknown, `${name} expose un identifiant Metamob inattendu`).toEqual([]);
            // Le CLIENT ne touche jamais la ligne de profil : il ne voit que le DTO (`mules`,
            // `alignment`…). Le lib, lui, lit `altPseudos` — c'est la source unique des mules.
            if (name === "client") expect(code).not.toMatch(/altPseudos/);
            expect(code).not.toMatch(/userId/);
        }
    });

    it("le client continue de n'importer aucun code serveur (verrou de parité)", () => {
        expect(client).not.toMatch(/@\/server\//);
    });
});
