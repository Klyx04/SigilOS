/**
 * Garde — les badges d'activité ne débordent jamais de la fiche/modal.
 *
 * 🎯 Défaut mesuré (02/11/2026) : dans la fiche de quête, un badge de condition
 * long (« Aide 3 personnes Monologue du vaccin pour ouvrir la bête Mini Donjon… »)
 * sortait de la modale. Cause : `inline-flex` sans `min-w-0`/`max-w-full` — un flex
 * item refuse de descendre sous son contenu, donc le `truncate` du libellé était
 * inopérant.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · le badge est borné (`max-w-full`), peut rétrécir (`min-w-0`) et tronque son libellé ;
 *  · les niveaux/quantités ne sont pas écrasés (`shrink-0`) ;
 *  · le détail du badge casse les mots longs (`break-words`) ;
 *  · les trois conteneurs de tags sont bornés (`min-w-0 max-w-full`).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { RushTagBadge } from "@/components/dofus-quests/rush/RushTagBadge";

const LONG = "Aide 3 personnes Monologue du vaccin pour ouvrir la bête Mini Donjon de la mort qui tue";

const html = renderToStaticMarkup(
    React.createElement(RushTagBadge, {
        tag: { type: "condition", name: LONG, count: 3, level: 42 },
        size: "sm",
    } as never)
);

describe("RushTagBadge — aucun débordement horizontal", () => {
    it("le badge est borné, peut rétrécir et tronque son libellé", () => {
        expect(html).toContain("max-w-full");
        expect(html).toContain("min-w-0");
        expect(html).toContain("truncate");
        expect(html).toContain(LONG);
    });

    it("les métadonnées (niveau, quantité) ne sont jamais écrasées", () => {
        expect(html).toContain("shrink-0 text-[10px] font-semibold tabular-nums text-warning");
        expect(html).toContain("shrink-0 text-[10px] tabular-nums text-muted-foreground");
    });

    it("le détail du badge casse les mots longs", () => {
        const src = readFileSync("src/components/dofus-quests/rush/RushTagBadge.tsx", "utf8");
        expect(src).toMatch(/<h3 className="mt-0\.5 break-words/);
        expect(src).toMatch(/<p className="break-words font-semibold/);
    });

    it("les trois conteneurs de tags sont bornés", () => {
        const src = readFileSync(
            "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayTagSection.tsx",
            "utf8"
        );
        expect(src.match(/flex min-w-0 max-w-full flex-wrap gap-1/g)?.length).toBe(3);
    });
});
