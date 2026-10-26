/**
 * Placeholder du proxy d'assets — **il doit être invisible**.
 *
 * 🧨 Constat du 26/10/2026 (captures God « Gelée Royale »/« Tynril » et onglet Sorts « Communs »
 * de la modale de stuff : des **carrés verts** partout). Le PNG de repli était commenté
 * « 1×1 transparent » mais son unique pixel valait **RGBA(0, 254, 0, 127)** — un vert vif à 50 %
 * d'opacité, étiré par les vignettes en aplat. Un repli visible est un choix de **composant**
 * (icône), jamais une image servie par le proxy.
 *
 * Ce test **décompresse** l'IDAT du PNG et vérifie le pixel : une régression vers un pixel coloré
 * échoue ici, pas en production.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const ROUTE = "src/app/api/assets-dofus/[type]/[id]/route.ts";

/** Pixels décompressés du PNG (filtre + RGBA). */
function pngPixels(base64: string): number[] {
    const buffer = Buffer.from(base64, "base64");
    let offset = 8; // signature PNG
    const idat: Buffer[] = [];
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        if (type === "IDAT") idat.push(buffer.subarray(offset + 8, offset + 8 + length));
        offset += 12 + length;
    }
    expect(idat.length).toBeGreaterThan(0);
    return [...inflateSync(Buffer.concat(idat))];
}

describe("placeholder /api/assets-dofus — pixel neutre", () => {
    const source = readFileSync(ROUTE, "utf8");

    it("sert un PNG 1×1 réellement transparent (filtre 0 + RGBA 0,0,0,0)", () => {
        const base64 = source.match(/iVBORw0KGgo[A-Za-z0-9+/=]+/)?.[0];
        expect(base64).toBeTruthy();
        // 5 octets = filtre de ligne (0) + un pixel RGBA.
        expect(pngPixels(base64!)).toEqual([0, 0, 0, 0, 0]);
    });

    it("ne contient plus le pixel vert mesuré (RGBA 0,254,0,127)", () => {
        const green = Buffer.from([0, 0, 254, 0, 127]);
        const base64 = source.match(/iVBORw0KGgo[A-Za-z0-9+/=]+/)?.[0];
        expect(base64).toBeTruthy();
        expect(Buffer.from(pngPixels(base64!)).equals(green)).toBe(false);
    });
});
