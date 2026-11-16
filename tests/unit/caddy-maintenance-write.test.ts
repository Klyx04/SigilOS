import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde — **les écritures reçoivent un 503 pendant la maintenance**.
 *
 * Mesure du 16/10/2026 : un POST envoyé pendant la maintenance recevait le HTML de la page
 * d'attente en `200` (rewrite + file_server), donc le client pouvait croire que l'action
 * avait réussi. Règle : les GET voient la page de maintenance, les méthodes d'écriture
 * reçoivent un `503 text/plain` explicite.
 */
const CADDYFILE = readFileSync("Caddyfile", "utf8");

describe("Caddy — écritures pendant la maintenance", () => {
  it("la vitrine prod répond 503 aux méthodes d'écriture", () => {
    expect(CADDYFILE).toMatch(/@vitrineWrite method POST PUT PATCH DELETE/);
    expect(CADDYFILE).toMatch(/respond @vitrineWrite "[^"]+" 503/);
  });

  it("la bêta répond 503 aux écritures quand le drapeau de maintenance existe", () => {
    const block = CADDYFILE.match(/@maintenanceWrite \{[\s\S]*?\n {4}\}/);
    expect(block, "matcher @maintenanceWrite absent").not.toBeNull();
    expect(block![0]).toMatch(/method POST PUT PATCH DELETE/);
    expect(block![0]).toContain(`file("/srv/maintenance-beta-on")`);
    expect(CADDYFILE).toMatch(/respond @maintenanceWrite "[^"]+" 503/);
  });

  it("les GET ne sont jamais coupés : la page de maintenance reste visible", () => {
    expect(CADDYFILE).not.toMatch(/@vitrineWrite[^\n]*\bGET\b/);
    expect(CADDYFILE).not.toMatch(/method[^\n]*\bGET\b[^\n]*\bPOST\b/);
    // La page reste servie par le rewrite existant.
    expect(CADDYFILE).toMatch(/rewrite \* \/maintenance\.html/);
    expect(CADDYFILE).toMatch(/rewrite \* \/maintenance-beta\.html/);
  });
});
