/**
 * Espace visiteur (rang 57) — verrou des **assets** (D-V14).
 *
 * `GameIcon` ne valide pas les chemins : un asset absent est servi en 404 par
 * `/_next/image` (issue Sentry documentée sur `game-icons/ladder.png`). Comme les six
 * onglets, les sélecteurs (serveurs, classes) et les listes (activités, métiers) affichent
 * désormais des pictos, ce test vérifie que **chaque chemin existe sur disque**.
 */

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { DOFUS_CLASSES, DOFUS_JOBS } from "@/lib/dofus-assets";
import { ACTIVITY_ASSETS, ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";

const onDisk = (icon: string) => `public${icon}`;

describe("Assets visiteur — aucun chemin mort servi par `/_next/image`", () => {
    it("les treize serveurs portent une icône existante", () => {
        expect(ALL_DOFUS_SERVER_ENTRIES).toHaveLength(13);
        for (const server of ALL_DOFUS_SERVER_ENTRIES) {
            expect(existsSync(onDisk(server.icon)), onDisk(server.icon)).toBe(true);
        }
    });

    it("chaque activité préférée porte son asset existant", () => {
        for (const [id, icon] of Object.entries(ACTIVITY_ASSETS)) {
            expect(existsSync(onDisk(icon)), `${id} → ${icon}`).toBe(true);
        }
    });

    it("chaque classe porte son icône existante", () => {
        for (const entry of DOFUS_CLASSES) {
            expect(existsSync(onDisk(entry.icon)), onDisk(entry.icon)).toBe(true);
        }
    });

    it("chaque métier porte son icône existante", () => {
        for (const jobs of Object.values(DOFUS_JOBS)) {
            for (const job of jobs) {
                expect(existsSync(onDisk(job.icon)), onDisk(job.icon)).toBe(true);
            }
        }
    });
});
