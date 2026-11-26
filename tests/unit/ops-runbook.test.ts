import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Runbook d'ops VPS — verrouille la réponse à l'incident du 20/11/2026 :
 * un outil d'administration ne tourne pas dans l'image applicative, il tourne
 * dans le conteneur `ops-*` (stage `ops`), en dry-run par défaut, avec une
 * sauvegarde et une preuve. Le skill route l'agent, le script exécute.
 */

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

const DOCKERFILE = read("Dockerfile");
const COMPOSE = read("docker-compose.prod.yml");
const SCRIPT = read("scripts/ops/vps.sh");
const SKILL = read(".agents/skills/vps-ops/SKILL.md");
const DOC = read("docs/agents/vps-ops.md");

describe("ops-runbook — image et services", () => {
  it("le Dockerfile expose un stage ops qui régénère le client Prisma", () => {
    expect(DOCKERFILE).toContain("FROM base AS ops");
    expect(DOCKERFILE).toContain("RUN npx prisma generate");
  });

  it("le compose cible ce stage et ne démarre jamais les ops avec `up`", () => {
    expect(COMPOSE).toContain("ops-beta:");
    expect(COMPOSE).toContain("ops-prod:");
    expect(COMPOSE).toContain("target: ops");
    expect(COMPOSE).toMatch(/profiles: \["ops"\]/);
  });

  it("les services ops n'ont pas de container_name (compatible avec run --rm)", () => {
    const start = COMPOSE.indexOf("ops-beta:");
    const end = COMPOSE.indexOf("discord-bot-beta:");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(COMPOSE.slice(start, end)).not.toContain("container_name");
  });
});

describe("ops-runbook — script", () => {
  it("est strict et dry-run par défaut", () => {
    expect(SCRIPT).toContain("set -euo pipefail");
    expect(SCRIPT).toContain('printf \'%s\' "--dry-run"');
    expect(SCRIPT).toContain("--apply");
  });

  it("refuse toute suppression hors archive", () => {
    expect(SCRIPT).toContain('readonly ARCHIVE_PREFIX="rush-sylvestre-archive-"');
    expect(SCRIPT).toContain("refus :");
    expect(SCRIPT).toContain('"$ARCHIVE_PREFIX"*)');
  });

  it("passe par ops-* et jamais par l'image applicative", () => {
    expect(SCRIPT).toContain('run --rm -T --no-deps "ops-$env"');
    expect(SCRIPT).not.toMatch(/exec app-(beta|prod)/);
    expect(SCRIPT).not.toContain("npm pack");
    expect(SCRIPT).not.toContain("npm install");
  });

  it("refuse un dump vide et journalise le verbe", () => {
    expect(SCRIPT).toContain('[ -s "$out" ]');
    expect(SCRIPT).toContain("ops.log");
  });

  it("n'utilise pas eval (aucune commande construite depuis une entrée)", () => {
    expect(SCRIPT).not.toMatch(/\beval\b/);
  });
});

describe("ops-runbook — harnais", () => {
  it("le skill interdit l'image applicative et impose le dry-run", () => {
    expect(SKILL).toContain("name: vps-ops");
    expect(SKILL).toContain("ops-beta");
    expect(SKILL).toContain("docker compose exec app-*");
    expect(SKILL).toContain("--apply");
  });

  it("expose la mesure combats en lecture seule", () => {
    expect(SCRIPT).toContain("rush-combats");
    expect(SCRIPT).toContain("combats_constraints");
    expect(SCRIPT).toContain("monstres_sans_image");
    expect(SCRIPT).toContain("sequences_tags_sans_combats");
    expect(SCRIPT).toContain("tags_combat_activity");
  });

  it("la doc décrit la matrice et le rollback", () => {
    expect(DOC).toContain("rush-archive");
    expect(DOC).toContain("rush-verify");
    expect(DOC).toContain("rush-combats");
    expect(DOC).toContain("Rollback");
    expect(DOC).toContain("stage `ops`");
  });
});
