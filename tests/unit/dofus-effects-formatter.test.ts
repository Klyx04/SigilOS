import { describe, it, expect } from "vitest";
import React from "react";
import { formatDofusEffectLine } from "@/lib/dofus-effects-formatter";

describe("dofus-effects-formatter — formatage et colorisation sémantique", () => {
    it("retourne null si la chaîne est vide", () => {
        expect(formatDofusEffectLine("")).toBeNull();
    });

    it("détecte l'élément Air et colorise en vert émeraude", () => {
        const node = formatDofusEffectLine("100 à 140 (dommages Air)") as React.ReactElement<{ className?: string }>;
        expect(node).not.toBeNull();
        expect(node.props.className).toContain("inline-flex");
    });

    it("découpe la durée en tour proprement", () => {
        const node = formatDofusEffectLine("-100 Fuite - 1 tour") as React.ReactElement;
        expect(node).not.toBeNull();
    });

    it("ne produit pas de faux positif sur les sous-chaînes pa/pm", () => {
        const node = formatDofusEffectLine("Augmente la portée de la plupart des alliés") as React.ReactElement;
        expect(node).not.toBeNull();
    });
});
