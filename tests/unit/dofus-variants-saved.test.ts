/**
 * Variantes **proposées par le joueur** — affichées dans la galerie.
 *
 * Chaîne vérifiée :
 *  · règle pure `normalizeSavedVariants` (bornée, slots connus, fail-closed) ;
 *  · action `saveBuildVariant` (auth + membre, build du profil courant, rate limit) ;
 *  · écriture dans `dofusBookLinks[].variants` **sans toucher** à `url`/`previewData` ;
 *  · bascule `Stuff ⇄ Variante` dans la miniature **et** la modale (`aria-pressed`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    normalizeSavedVariants,
    hasSavedVariant,
    sameSavedVariant,
    SAVED_VARIANT_MAX_SLOTS,
} from "@/lib/dofus-variant-utils";
import type { DofusbookItem } from "@/lib/dofusbook-utils";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const item = (id: number, name = `Objet ${id}`): DofusbookItem => ({
    id,
    name,
    picture: id,
    official: id,
    level: 200,
    typeName: "Dofus",
    effects: [{ code: "vi", min: 100, max: 100, value: 100 }],
});

describe("normalizeSavedVariants — entrée non fiable", () => {
    it("garde un slot connu et son objet complet", () => {
        const clean = normalizeSavedVariants({ d1: item(1234, "Dofus Turquoise") });

        expect(clean.d1).toMatchObject({ id: 1234, name: "Dofus Turquoise", level: 200 });
        expect(clean.d1.effects?.[0]).toEqual({ code: "vi", min: 100, max: 100, value: 100 });
    });

    it("écarte un slot inconnu, un objet sans id ou sans nom", () => {
        const clean = normalizeSavedVariants({
            slotInconnu: item(1),
            ch: { ...item(0), id: 0 },
            ca: { ...item(2), name: "   " },
        });

        expect(clean).toEqual({});
    });

    it("borne les textes, le niveau et les valeurs", () => {
        const clean = normalizeSavedVariants({
            ch: {
                id: 5,
                name: "x".repeat(400),
                picture: 5,
                official: 5,
                level: 999,
                effects: [{ code: "fo", min: -9_999_999, max: 9_999_999, value: 0 }],
            },
        });

        expect(clean.ch?.name.length).toBe(120);
        expect(clean.ch?.level).toBe(200);
        expect(clean.ch?.effects?.[0].min).toBe(-1_000_000);
        expect(clean.ch?.effects?.[0].max).toBe(1_000_000);
    });

    it("ne retient jamais plus de slots que le maximum", () => {
        const raw: Record<string, DofusbookItem> = {};
        const slots = ["ch", "ca", "ce", "bo", "am", "a1", "a2", "br", "ar", "fa", "mo", "d1", "d2", "d3", "d4", "d5", "d6"];
        for (const slot of slots) raw[slot] = item(100);
        expect(Object.keys(normalizeSavedVariants(raw)).length).toBe(SAVED_VARIANT_MAX_SLOTS);
    });

    it("tolère null / tableau / chaîne (aucune exception)", () => {
        expect(normalizeSavedVariants(null)).toEqual({});
        expect(normalizeSavedVariants([])).toEqual({});
        expect(normalizeSavedVariants("variante")).toEqual({});
    });
});

describe("comparaison de variantes", () => {
    it("détecte une variante vide", () => {
        expect(hasSavedVariant({})).toBe(false);
        expect(hasSavedVariant(undefined)).toBe(false);
        expect(hasSavedVariant({ d1: item(1) })).toBe(true);
    });

    it("compare objet par objet (écriture inutile évitée)", () => {
        expect(sameSavedVariant({ d1: item(1) }, { d1: item(1) })).toBe(true);
        expect(sameSavedVariant({ d1: item(1) }, { d1: item(2) })).toBe(false);
        expect(sameSavedVariant({ d1: item(1) }, {})).toBe(false);
    });
});

describe("chaîne serveur → galerie (verrous de source)", () => {
    const actions = read("src/server/actions/gallery-actions.ts");
    const preview = read("src/components/dofus/dofusbook-preview.tsx");
    const gallery = read("src/app/dashboard/[guildId]/galerie-stuff/gallery-client.tsx");

    it("l'action est protégée, rate-limitée et limitée au profil courant", () => {
        expect(actions).toContain("export async function saveBuildVariant");
        expect(actions).toContain("await getUserContext(guildId)");
        expect(actions).toContain("rateLimit(`gallery-variant:");
        expect(actions).toContain("where: { id: user.profileId, guildId: guildConfig.id }");
    });

    it("l'écriture ajoute `variants` sans réécrire l'URL ni l'aperçu", () => {
        const start = actions.indexOf("export async function saveBuildVariant");
        const body = actions.slice(start, start + 2600);
        expect(body).toContain("{ ...link, variants, updatedAt: now }");
        expect(body).toContain("normalizeSavedVariants");
        expect(body).not.toContain("previewData:");
    });

    it("la galerie transmet la variante et n'autorise l'écriture qu'à l'auteur", () => {
        expect(gallery).toContain("savedVariants={build.variants}");
        expect(gallery).toContain("canPersistVariant={currentProfileId === build.author.id}");
    });

    it("la bascule Stuff ⇄ Variante existe dans la miniature ET la modale", () => {
        expect(preview).toContain("aria-pressed={showVariant}");
        expect(preview).toContain("applyVariantsToBuild(data, variants)");
        expect(preview).toContain("saveBuildVariant(guildId, variantBuildId, variants)");
        expect(preview).toContain("Stuff");
        expect(preview).toContain("Variante");
    });
});
