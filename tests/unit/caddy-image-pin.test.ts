/**
 * Garde — **l'image du proxy exposé est épinglée, et son plugin suit le `Caddyfile`**.
 *
 * 🎯 Mesure du 04/11/2026 (`docker exec sigilos-gateway caddy build-info`) : `go1.23.8`
 * et `mod caddy (devel)`. Le `FROM caddy:2.9.1-*` datait de mars 2025 **et** `xcaddy build`
 * sans version compilait `master` : le seul service exposé à Internet tournait sur une pile
 * Go de janvier 2025, sans aucun correctif Go/Caddy depuis (ni `net/http`, ni `crypto/tls`).
 *
 * 🛡️ Ce que ce test verrouille :
 *  - builder et runtime portent la **même** version pinnée (ni `latest`, ni tag flottant) ;
 *  - `xcaddy build` compile **cette** version, jamais `master` (sinon `mod caddy (devel)`) ;
 *  - le module ratelimit est compilé **si et seulement si** le `Caddyfile` l'utilise.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DOCKERFILE = readFileSync("Dockerfile.caddy", "utf8");
const CADDYFILE = readFileSync("Caddyfile", "utf8");

const froms = [...DOCKERFILE.matchAll(/FROM caddy:([0-9][^\s]*)/g)].map((m) => m[1]);
// "2.11.8-builder-alpine" -> "2.11.8"
const versionOf = (tag: string) => tag.split("-")[0];

describe("Image Caddy — version épinglée et plugin aligné", () => {
  it("les deux étapes portent une version numérique, aucun tag flottant", () => {
    expect(froms.length, "Dockerfile.caddy ne construit pas d'image Caddy").toBeGreaterThanOrEqual(2);
    for (const tag of froms) {
      expect(tag, `tag flottant interdit : ${tag}`).toMatch(/^\d+\.\d+\.\d+/);
      expect(tag).not.toContain("latest");
    }
  });

  it("builder et runtime sont la MÊME version", () => {
    const versions = [...new Set(froms.map(versionOf))];
    expect(versions, `versions divergentes : ${versions.join(", ")}`).toHaveLength(1);
  });

  it("xcaddy compile la version épinglée, jamais master", () => {
    const build = DOCKERFILE.match(/RUN xcaddy build ([^\s]+)/);
    expect(build, "xcaddy build introuvable dans Dockerfile.caddy").not.toBeNull();
    expect(build![1], "xcaddy doit compiler une version taggée, pas master").toBe(
      `v${versionOf(froms[0])}`,
    );
  });

  it("le module ratelimit est compilé si et seulement si le Caddyfile l'utilise", () => {
    const usesRateLimit = /\brate_limit\b/.test(CADDYFILE);
    const compiled = DOCKERFILE.includes("--with github.com/mholt/caddy-ratelimit");
    expect(
      compiled,
      "Caddyfile et Dockerfile.caddy divergent : un `rate_limit` sans module compile tue le proxy au démarrage",
    ).toBe(usesRateLimit);
  });
});
