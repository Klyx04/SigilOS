import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const caddyfile = readFileSync(path.join(root, "Caddyfile"), "utf8");
const nextConfig = readFileSync(path.join(root, "next.config.ts"), "utf8");

function siteBlock(host: string): string {
    const escaped = host.replace(/\./g, "\\.");
    const match = caddyfile.match(new RegExp(`^${escaped} \\{[\\s\\S]*?^\\}`, "m"));
    return match?.[0] ?? "";
}

describe("compression web (P0)", () => {
    it("active zstd/gzip dans Caddy pour la production et la bêta", () => {
        expect(caddyfile).toMatch(/\(compression\)\s*\{\s*encode zstd gzip\s*\}/);
        expect(siteBlock("sigilos.fr")).toContain("import compression");
        expect(siteBlock("beta.sigilos.fr")).toContain("import compression");
    });

    it("désactive la compression Node pour ne pas doubler le travail", () => {
        expect(nextConfig).toMatch(/compress:\s*false/);
    });
});
