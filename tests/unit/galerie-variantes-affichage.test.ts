/**
 * Variantes de stuff — **affichage au clic** et **lecture seule** des stuffs d'autrui.
 *
 * 🎯 Constats user du 25/10/2026 (profil perso + galerie) :
 *   1. cliquer « Variante » sur la miniature ne changeait **que les stats** : la grille
 *      d'icônes lisait `data.items` en dur ⇒ il fallait ouvrir la fiche pour voir les objets ;
 *   2. un visiteur pouvait **modifier** la variante d'un autre membre depuis la galerie
 *      (éditeur de slot + brouillon local), alors que l'écriture serveur est déjà réservée
 *      à l'auteur ;
 *   3. le bouton « Copier le lien du build » utilisait la variante `default` du `Button`
 *      (fond d'accent plein) — hors norme anti-slop.
 *
 * Les cas ci-dessous verrouillent la **règle pure** (`describeSavedVariants`) puis les
 * surfaces (miniature, galerie, profil) par lecture de source — jamais le rendu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describeSavedVariants } from "@/lib/dofus-variant-utils";
import type { DofusbookItem } from "@/lib/dofusbook-utils";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const PREVIEW = "src/components/dofus/dofusbook-preview.tsx";
const GALLERY = "src/app/dashboard/[guildId]/galerie-stuff/gallery-client.tsx";
const BUILDS_CARD = "src/components/profile/builds-card.tsx";

const item = (id: number, name: string, typeName = "Dofus"): DofusbookItem => ({
    id,
    name,
    picture: id,
    official: id,
    level: 200,
    typeName,
    effects: [],
});

describe("describeSavedVariants — récapitulatif affichable", () => {
    it("décrit les objets remplacés dans l'ordre d'équipement, avec le nom d'origine", () => {
        const descriptions = describeSavedVariants(
            {
                d1: item(1, "Dofus Turquoise"),
                ch: item(2, "Coiffe du Ouich", "Chapeau"),
            },
            {
                ch: item(9, "Coiffe d'origine", "Chapeau"),
                d1: item(8, "Dofus d'origine"),
            },
        );

        expect(descriptions.map((d) => d.slot)).toEqual(["ch", "d1"]);
        expect(descriptions[0]).toEqual({
            slot: "ch",
            slotLabel: "Coiffe",
            name: "Coiffe du Ouich",
            originalName: "Coiffe d'origine",
        });
        expect(descriptions[1].slotLabel).toBe("Dofus / Trophée");
        expect(descriptions[1].originalName).toBe("Dofus d'origine");
    });

    it("accepte une variante sans objet d'origine (aucun nom inventé)", () => {
        const [entry] = describeSavedVariants({ a1: item(3, "Anneau") });

        expect(entry.originalName).toBeNull();
        expect(entry.slotLabel).toBe("Anneau");
    });

    it("tolère une variante vide ou absente", () => {
        expect(describeSavedVariants(null)).toEqual([]);
        expect(describeSavedVariants(undefined)).toEqual([]);
        expect(describeSavedVariants({})).toEqual([]);
    });
});

describe("miniature — la variante s'affiche au clic", () => {
    const preview = read(PREVIEW);

    it("la grille d'icônes lit les objets de la variante quand la bascule est active", () => {
        expect(preview).toContain("const cardItems = variantShown && effectiveData ? effectiveData.items : data?.items;");
        expect(preview).toContain("const source = cardItems ?? data.items;");
        // L'ancien chemin (grille figée sur le stuff d'origine) ne doit pas revenir.
        expect(preview).not.toContain("const item = slot.s === 'fa' ? (data.items?.['fa'] || data.items?.['mo']) : data.items?.[slot.s];");
    });

    it("les slots variés sont signalés et le récapitulatif est visible sans ouvrir la fiche", () => {
        expect(preview).toContain("const isVariantSlot = variantShown && !!variants[slot.s];");
        expect(preview).toContain("variantDescriptions.slice(0, 6)");
        expect(preview).toContain("au lieu de {originalItem.name}");
        expect(preview).toContain("Variante ({Object.keys(variants).length})");
    });

    it("le bandeau de statistiques de la miniature suit la variante (critique inclus)", () => {
        // En galerie, l'affichage est piloté par la carte : `variantShown`, jamais `showVariant`.
        expect(preview).toContain("const cardStats = (variantShown && effectiveData ? effectiveData.stats : null)");
        expect(preview).toContain("{cardStats?.cc ?? 0}%");
        expect(preview).not.toContain("{data.stats?.cc}%");
    });
});

describe("galerie — variante visible au clic", () => {
    const gallery = read(GALLERY);

    it("les statistiques de la carte suivent la bascule", () => {
        expect(gallery).toContain("applyVariantsToBuild(build.previewData, build.variants ?? {})");
        expect(gallery).toContain("variantViews.has(build.id) && build.variants");
    });

    it("le bouton annonce le nombre d'objets variés", () => {
        expect(gallery).toContain("Variante ({Object.keys(build.variants).length})");
    });
});

describe("lecture seule — on ne modifie pas la variante d'un autre membre", () => {
    const preview = read(PREVIEW);

    it("l'éditeur de slot et sa modale sont réservés à l'auteur", () => {
        expect(preview).toContain("onOpenVariant={canPersistVariant ? setVariantModalSlot : undefined}");
        expect(preview).toMatch(/\{canPersistVariant && \(\r?\n\s*<ItemVariantModal/);
        // « Réinitialiser » n'est pas proposé au visiteur d'un stuff d'autrui.
        expect(preview).toMatch(/\{canPersistVariant && \(\r?\n\s*<Button/);
    });

    it("aucun brouillon local n'est lu ni écrit pour un stuff d'autrui", () => {
        expect(preview).toContain("const draft = canPersistVariant ? readLocalVariant(variantBuildId) : {};");
        expect(preview).toContain("if (!canPersistVariant) return;");
    });

    it("le profil consulté transmet la lecture seule au composant de build", () => {
        expect(read(BUILDS_CARD)).toContain("canPersistVariant={!readOnly}");
    });
});

describe("déslop — actions de la variante et lien de partage", () => {
    const preview = read(PREVIEW);

    it("un seul état lisible : plus de couple « Enregistré / Enregistrer »", () => {
        expect(preview).toContain('? "Publiée dans la galerie"');
        expect(preview).toContain("Publier la variante");
        expect(preview).not.toContain('{savingVariant ? "Enregistrement…" : "Enregistrer"}');
        expect(preview).not.toContain("(Réinitialiser)");
    });

    it("« Copier le lien du build » n'utilise plus le fond d'accent plein", () => {
        const anchor = preview.indexOf('aria-label="Copier le lien du build"');
        expect(anchor).toBeGreaterThan(-1);
        const block = preview.slice(Math.max(0, anchor - 600), anchor + 600);
        expect(block).toContain('variant="outline"');
        expect(block).toContain("bg-surface/80");
    });
});
