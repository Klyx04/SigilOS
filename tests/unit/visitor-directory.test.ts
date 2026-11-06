/**
 * Espace visiteur (rang 57) — verrou de l'**annuaire des visiteurs** (V2e).
 *
 * Deux familles d'assertions, chacune protège une règle déjà payée :
 *
 * 1. **Comportement des règles pures** : les filtres sont bornés et un filtre inconnu ne fait
 *    pas perdre les autres ; le DTO ne contient **aucun** champ privé (mules, Metamob, `userId`) ;
 *    la liste plafonne les métiers, la fiche les montre tous.
 * 2. **Verrou de source** : chaque requête porte `showOnDirectory` **et** le serveur du lecteur ;
 *    les pages privées appellent la garde et restent en `noindex` ; la fiche répond `notFound()`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    PUBLIC_DIRECTORY_JOBS_ON_CARD,
    PUBLIC_DIRECTORY_PAGE_SIZE,
    PUBLIC_DIRECTORY_SEARCH_MAX,
    buildVisitorDirectoryHref,
    buildVisitorDirectoryWhere,
    isPublicProfileId,
    parseVisitorDirectoryFilters,
    toVisitorDirectoryEntry,
    toVisitorProfile,
    type VisitorDirectoryRow,
} from "@/lib/public-directory";

const read = (path: string) => readFileSync(path, "utf8");
const SERVER = "src/server/public-directory.ts";
const LIST_PAGE = "src/app/visiteurs/page.tsx";
const PROFILE_PAGE = "src/app/visiteurs/[id]/page.tsx";

/** Les verrous lisent le **code**, pas la prose (le fichier cite `guildId` dans un commentaire). */
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ROW: VisitorDirectoryRow = {
    id: "clx1234567890abcdefghij",
    pseudoDofus: "MonIop",
    classe: "iop",
    dofusServerId: 295,
    declaredGuildName: "Les Veilleurs",
    dofusLevel: 200,
    successPoints: 12_345,
    updatedAt: new Date("2026-11-06T10:00:00Z"),
    professions: [
        { metierId: "forgeron", level: 100 },
        { metierId: "bijoutier", level: 90 },
        { metierId: "inconnu", level: 85 },
        { metierId: "mineur", level: 80 },
        { metierId: "pecheur", level: 70 },
        { metierId: "alchimiste", level: 60 },
    ],
    _count: { achievements: 42 },
};

describe("Annuaire des visiteurs — filtres bornés, jamais bloquants", () => {
    it("garde un filtre connu et normalise la classe", () => {
        expect(
            parseVisitorDirectoryFilters({ q: "  iop ", classe: "Feca", metier: "forgeron" })
        ).toEqual({ q: "iop", classe: "feca", metier: "forgeron" });
    });

    it("ignore un filtre inconnu au lieu de casser la page", () => {
        expect(
            parseVisitorDirectoryFilters({ classe: "wow", metier: "astronaute", cursor: "../../etc" })
        ).toEqual({});
    });

    it("borne la recherche sans perdre les autres filtres", () => {
        const parsed = parseVisitorDirectoryFilters({
            q: "x".repeat(5_000),
            classe: "iop",
        });
        expect(parsed.q).toHaveLength(PUBLIC_DIRECTORY_SEARCH_MAX);
        expect(parsed.classe).toBe("iop");
    });

    it("garde la première valeur quand un paramètre est répété", () => {
        expect(parseVisitorDirectoryFilters({ classe: ["iop", "feca"] }).classe).toBe("iop");
    });

    it("recalcule l'URL complète et n'oublie jamais un filtre actif", () => {
        expect(buildVisitorDirectoryHref({ q: "ta kasha", classe: "iop" })).toBe(
            "/visiteurs?q=ta+kasha&classe=iop"
        );
        expect(buildVisitorDirectoryHref({})).toBe("/visiteurs");
    });
});

describe("Annuaire des visiteurs — le périmètre est dans la requête", () => {
    it("impose le consentement et le serveur du lecteur", () => {
        const where = buildVisitorDirectoryWhere(295, {});
        expect(where.showOnDirectory).toBe(true);
        expect(where.dofusServerId).toBe(295);
        expect(where).not.toHaveProperty("guildId");
    });

    it("filtre le métier comme sous-relation du profil", () => {
        expect(buildVisitorDirectoryWhere(295, { metier: "forgeron" }).professions).toEqual({
            some: { metierId: "forgeron" },
        });
    });

    it("une recherche ne cherche que dans le pseudo et la guilde déclarée", () => {
        const where = buildVisitorDirectoryWhere(295, { q: "iop" });
        expect(where.OR).toEqual([
            { pseudoDofus: { contains: "iop", mode: "insensitive" } },
            { declaredGuildName: { contains: "iop", mode: "insensitive" } },
        ]);
    });

    it("refuse un identifiant de fiche qui n'est pas un cuid borné", () => {
        expect(isPublicProfileId("clx1234567890abcdefghij")).toBe(true);
        expect(isPublicProfileId("../etc/passwd")).toBe(false);
        expect(isPublicProfileId("court")).toBe(false);
        expect(isPublicProfileId(42)).toBe(false);
    });

    it("une page d'annuaire reste bornée", () => {
        expect(PUBLIC_DIRECTORY_PAGE_SIZE).toBeGreaterThan(0);
        expect(PUBLIC_DIRECTORY_PAGE_SIZE).toBeLessThanOrEqual(50);
    });
});

describe("Annuaire des visiteurs — aucun champ privé ne sort", () => {
    it("la liste n'expose que la liste blanche", () => {
        const entry = toVisitorDirectoryEntry(ROW);
        expect(Object.keys(entry).sort()).toEqual([
            "achievements",
            "classe",
            "guildName",
            "id",
            "jobs",
            "level",
            "pseudo",
            "server",
            "successPoints",
        ]);
        expect(entry).not.toHaveProperty("userId");
        expect(entry).not.toHaveProperty("altPseudos");
        expect(JSON.stringify(entry).toLowerCase()).not.toContain("metamob");
    });

    it("plafonne les métiers de la liste et écarte un identifiant inconnu", () => {
        const entry = toVisitorDirectoryEntry(ROW);
        expect(entry.jobs).toHaveLength(PUBLIC_DIRECTORY_JOBS_ON_CARD);
        expect(entry.jobs.map((job) => job.id)).not.toContain("inconnu");
    });

    it("résout la classe et le serveur par leurs référentiels", () => {
        const entry = toVisitorDirectoryEntry(ROW);
        expect(entry.classe?.name).toBe("Iop");
        expect(entry.server?.name).toBe("Draconiros");
    });

    it("la fiche ajoute la présentation sans élargir la liste blanche", () => {
        const profile = toVisitorProfile({
            ...ROW,
            introduction: "Salut",
            objectifs: "Finir le Sylvestre",
        });
        expect(profile.introduction).toBe("Salut");
        expect(profile.objectifs).toBe("Finir le Sylvestre");
        expect(profile.jobs.length).toBeGreaterThan(PUBLIC_DIRECTORY_JOBS_ON_CARD);
        expect(Object.keys(profile).sort()).toEqual([
            "achievements",
            "classe",
            "guildName",
            "id",
            "introduction",
            "jobs",
            "level",
            "objectifs",
            "pseudo",
            "server",
            "successPoints",
            "updatedAt",
        ]);
    });
});

describe("Verrou de source — l'annuaire ne lit pas hors périmètre", () => {
    const server = stripComments(read(SERVER));

    it("consentement + serveur du lecteur dans chaque requête", () => {
        expect(server).toContain("showOnDirectory: true");
        expect(server).toContain("dofusServerId: viewer.serverId");
        expect(server).toContain("getPublicSession()");
        expect(server.match(/buildVisitorDirectoryWhere\(viewer\.serverId/g)).toHaveLength(2);
    });

    it("aucune donnée de guilde, aucun champ privé", () => {
        expect(server).not.toMatch(/guildId/);
        expect(server).not.toContain("metamobApiKey");
        expect(server).not.toContain("altPseudos");
        expect(server).not.toContain("userId: true");
    });

    it("la liste est gardée, non indexée et bornée à une page", () => {
        const page = stripComments(read(LIST_PAGE));
        expect(page).toContain("resolveDirectoryViewer()");
        expect(page).toContain("index: false");
        expect(server).toContain("PUBLIC_DIRECTORY_PAGE_SIZE + 1");
    });

    it("la fiche répond 404 hors périmètre, sans dire pourquoi", () => {
        const page = stripComments(read(PROFILE_PAGE));
        expect(page).toContain("resolveDirectoryViewer()");
        expect(page).toContain("if (!profile) notFound()");
        expect(page).toContain("index: false");
    });

    it("les menus de filtre sont exclusifs et refermables (bug du 06/11)", () => {
        const menu = stripComments(read("src/app/visiteurs/_components/filter-menu.tsx"));
        // `name` = accordéon natif : ouvrir un menu ferme les autres du même groupe.
        expect(menu).toContain('name="visiteurs-filtres"');
        // Clic hors du menu et Échap : sans ça, un panneau restait ouvert sur la liste.
        expect(menu).toContain("contains(event.target");
        expect(menu).toContain('event.key !== "Escape"');
        // Le panneau s'ancre à droite sur grand écran (il débordait de la fenêtre).
        expect(menu).toContain("lg:left-auto lg:right-0");
        // Les deux filtres passent par ce composant, aucun `<details>` en double.
        const filters = stripComments(read("src/app/visiteurs/_components/visitor-filters.tsx"));
        expect((filters.match(/<FilterMenu/g) ?? []).length).toBe(2);
        expect(filters).not.toContain("<details");
    });
});
