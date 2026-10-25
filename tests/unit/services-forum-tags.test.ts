/**
 * Module **Services** — mapping des tags de forum par catégorie (25/10/2026).
 *
 * Même modèle que le Marché : SigilOS ne crée **aucun** tag, il applique ceux que
 * l'admin a créés dans Discord (`available_tags`) et revalide tout id reçu.
 */

import { describe, it, expect } from "vitest";
import {
    SERVICE_FORUM_TAG_KEYS,
    SERVICE_FORUM_TAG_LABELS,
    normalizeServiceForumTags,
    resolveServiceForumTags,
    restrictServiceForumTags,
} from "@/lib/services/forum-tags";

describe("clés de tag du module Services", () => {
    it("couvre exactement les catégories de service (une catégorie ajoutée doit être tranchée ici)", () => {
        expect([...SERVICE_FORUM_TAG_KEYS].sort()).toEqual(
            ["AUTRE", "FORGEMAGIE", "METIER", "OCRE", "PASSAGE_DONJON", "QUETE", "TUTORAT"]
        );
    });

    it("affiche un libellé français pour chaque catégorie", () => {
        for (const key of SERVICE_FORUM_TAG_KEYS) {
            expect(SERVICE_FORUM_TAG_LABELS[key].length).toBeGreaterThan(2);
        }
    });
});

describe("normalisation d'un mapping enregistré", () => {
    it("ne garde que les catégories connues et les ids exploitables", () => {
        expect(
            normalizeServiceForumTags({
                PASSAGE_DONJON: " 123456789 ",
                FORGEMAGIE: "",
                INCONNUE: "999",
                METIER: 42,
            })
        ).toEqual({ PASSAGE_DONJON: "123456789" });
    });

    it("supprime les doublons d'id (un tag ne peut pas désigner deux catégories)", () => {
        expect(
            normalizeServiceForumTags({ PASSAGE_DONJON: "111", FORGEMAGIE: "111" })
        ).toEqual({ PASSAGE_DONJON: "111" });
    });

    it("ignore une valeur qui n'est pas un objet (jamais d'exception)", () => {
        expect(normalizeServiceForumTags(null)).toEqual({});
        expect(normalizeServiceForumTags("PASSAGE_DONJON")).toEqual({});
        expect(normalizeServiceForumTags(["111"])).toEqual({});
    });
});

describe("revalidation contre les tags réellement présents dans le forum", () => {
    it("écarte un id inventé par le client (fail-closed)", () => {
        expect(
            restrictServiceForumTags(
                { PASSAGE_DONJON: "invente", FORGEMAGIE: "reel-1" },
                ["reel-1", "reel-2"]
            )
        ).toEqual({ FORGEMAGIE: "reel-1" });
    });

    it("vide tout le mapping quand le forum n'expose aucun tag", () => {
        expect(restrictServiceForumTags({ PASSAGE_DONJON: "111" }, [])).toEqual({});
    });
});

describe("tag appliqué au sujet d'une annonce", () => {
    const mapping = { PASSAGE_DONJON: "tag-donjon", FORGEMAGIE: "tag-fm" };

    it("applique le tag de la catégorie de l'annonce", () => {
        expect(resolveServiceForumTags(mapping, "PASSAGE_DONJON")).toEqual(["tag-donjon"]);
        expect(resolveServiceForumTags(mapping, "FORGEMAGIE")).toEqual(["tag-fm"]);
    });

    it("n'applique rien pour une catégorie non mappée ou inconnue", () => {
        expect(resolveServiceForumTags(mapping, "METIER")).toEqual([]);
        expect(resolveServiceForumTags(mapping, "N_IMPORTE_QUOI")).toEqual([]);
        expect(resolveServiceForumTags(null, "PASSAGE_DONJON")).toEqual([]);
    });
});
