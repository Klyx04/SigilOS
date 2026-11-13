/**
 * Garde — **une seule version de Node, écrite et vérifiée**.
 *
 * 🎯 Mesure du 21/10/2026 (avis de sécurité nodejs.org, versions corrigées **22.23.4**,
 * 24.22.1, 26.12.1 ; 4 CVE HIGH dont une RCE Brotli et deux contournements TLS) :
 * le poste tournait en **22.14.0**, la CI prenait `'22'` (donc la dernière), et les images
 * Docker portaient `node:22-alpine` — un tag **flottant** qui n'est mis à jour qu'au build.
 * Résultat : le conteneur de prod datait de **8 mois**, et rien dans le dépôt ne disait
 * quelle version était attendue (`engines` absent, pas de `.nvmrc`).
 *
 * 🛡️ Ce que ce test verrouille : `.nvmrc` est la SEULE source, et les quatre consommateurs
 * la suivent — `engines.node`, les `FROM node:` des images, et la CI (`node-version-file`).
 * Il échoue dès qu'un correctif de sécurité n'est appliqué qu'à moitié.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const VERSION = readFileSync(".nvmrc", "utf8").trim();
const PKG = JSON.parse(readFileSync("package.json", "utf8")) as {
  engines?: { node?: string };
};
const CI = readFileSync(".github/workflows/verify.yml", "utf8");
const DOCKERFILES = ["Dockerfile", "services/discord-bot/Dockerfile"];

const major = Number(VERSION.split(".")[0]);

describe("Runtime Node — version unique et alignée", () => {
  it(".nvmrc porte une version EXACTE (pas un flottant)", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("engines.node exige au moins cette version, sans changer de majeure", () => {
    expect(PKG.engines?.node).toBe(`>=${VERSION} <${major + 1}`);
  });

  it("toutes les images Docker épinglent CETTE version (aucun tag flottant)", () => {
    for (const file of DOCKERFILES) {
      const froms = readFileSync(file, "utf8").match(/FROM node:[^\s]+/g) ?? [];
      expect(froms.length, `${file} ne construit pas d'image node`).toBeGreaterThan(0);
      for (const from of froms) {
        expect(from, `${file} n'est pas aligné sur .nvmrc`).toBe(`FROM node:${VERSION}-alpine`);
      }
    }
  });

  it("la CI lit .nvmrc (une seule source), pas un `'22'` recopié", () => {
    const fileRef = CI.match(/node-version-file: '\.nvmrc'/g)?.length ?? 0;
    expect(fileRef).toBeGreaterThanOrEqual(2);
    expect(CI).not.toMatch(/node-version: '?\d/);
  });
});
