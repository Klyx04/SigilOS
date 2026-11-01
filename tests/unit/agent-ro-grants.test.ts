/**
 * Garde du rôle Postgres « lecture seule » de l'assistant au VPS.
 *
 * 🔎 Mesures du 01/11/2026 (avant toute installation) : la première version du
 * runbook accordait `GRANT SELECT ON ALL TABLES` **et** `ALTER DEFAULT
 * PRIVILEGES`. Or le schéma porte `Account.access_token` / `refresh_token` /
 * `id_token` (jetons OAuth Discord) et `Session.sessionToken` : un poste
 * compromis exfiltrait des jetons. Et `DEFAULT PRIVILEGES` rendait lisible toute
 * table FUTURE — l'inverse de « fail-closed ». Mesuré aussi : ni `db-prod` ni
 * `db-beta` ne publient de port, et `restrict` seul ne coupe pas l'exécution de
 * commande (d'où le shell `nologin` + `ForceCommand` côté sshd).
 *
 * 🔒 Verrouillé ici : allowlist de données de référence seulement, aucune
 * écriture, ni mot de passe ni empreinte en dur, durcissements présents, et la
 * doc d'installation qui pointe vers ce fichier (un chemin cité doit exister).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const SQL = read("scripts/sql/agent-ro.sql");
const SCHEMA = read("prisma/schema.prisma");
const COMPOSE = read("docker-compose.prod.yml");
const DOC = read("docs/agents/acces-lecture-seule.md");

/** Le fichier SQL sans ses commentaires `--` : les gardes ne jugent que les ordres. */
const SQL_CODE = SQL.split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/** Corps du modèle Prisma `name`, ou `null` s'il n'existe pas. */
function modelBlock(name: string): string | null {
  const match = new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA);
  return match?.[1] ?? null;
}

/** Bloc YAML d'un service du compose (indentation de 2 espaces). */
function serviceBlock(name: string): string | null {
  const lines = COMPOSE.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `  ${name}:`);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^ {3,}\S|^ {2}#/.test(lines[end]))) {
    end++;
  }
  return lines.slice(start + 1, end).join("\n");
}

/** Tables de l'unique `GRANT SELECT ON … TO cline_ro` du fichier SQL. */
function grantedTables(): string[] {
  const grant = /GRANT SELECT ON([\s\S]*?)TO cline_ro;/.exec(SQL_CODE);
  expect(grant, "le fichier doit porter un seul GRANT SELECT … TO cline_ro").not.toBeNull();
  return [...grant![1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
}

/** Champs Prisma qui rattachent une ligne à une guilde ou à une personne. */
const IDENTITY_FIELD =
  /^\s{2}(guildId|userId|discordId|providerAccountId|sessionToken|email|emailBackup|password|creatorId|ownerId|authorId|memberId)\s/m;

describe("rôle Postgres lecture seule — allowlist", () => {
  const tables = grantedTables();

  it("n'accorde aucune table absente du schéma Prisma", () => {
    expect(tables.length).toBeGreaterThan(10);
    const missing = tables.filter((table) => modelBlock(table) === null);
    expect(missing, "table citée par le SQL mais absente de prisma/schema.prisma").toEqual([]);
  });

  it("n'accorde que des tables de référence, jamais une table d'identité", () => {
    const scoped = tables.filter((table) => IDENTITY_FIELD.test(modelBlock(table) ?? ""));
    expect(scoped, "tables rattachées à une guilde ou à une personne").toEqual([]);
  });

  it("n'accorde jamais les jetons OAuth ni les sessions", () => {
    for (const forbidden of ["Account", "Session", "VerificationToken", "User", "UserProfile"]) {
      expect(tables).not.toContain(forbidden);
    }
  });
});

describe("rôle Postgres lecture seule — privilèges", () => {
  it("n'utilise aucun grant large ni aucun défaut de privilège", () => {
    expect(SQL_CODE).not.toMatch(/GRANT[^;]*ON\s+ALL\s+TABLES/i);
    expect(SQL_CODE).not.toMatch(/\bALL\s+PRIVILEGES\b/i);
    expect(SQL_CODE).not.toMatch(/ALTER\s+DEFAULT\s+PRIVILEGES/i);
  });

  it("n'accorde aucun droit d'écriture", () => {
    expect(SQL_CODE).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/);
  });

  it("n'élève jamais le rôle", () => {
    expect(SQL_CODE).not.toMatch(/(?<!NO)(SUPERUSER|CREATEDB|CREATEROLE|BYPASSRLS|REPLICATION)\b/);
    expect(SQL_CODE).toContain("NOSUPERUSER");
    expect(SQL_CODE).toContain("NOBYPASSRLS");
  });

  it("ne contient aucun mot de passe en dur", () => {
    expect(SQL_CODE).not.toMatch(/PASSWORD\s+'/i);
  });

  it("porte les durcissements serveur (expiration, connexions, timeouts, lecture seule)", () => {
    expect(SQL_CODE).toMatch(/VALID\s+UNTIL/i);
    expect(SQL_CODE).toMatch(/CONNECTION\s+LIMIT\s+\d/i);
    expect(SQL_CODE).toMatch(/default_transaction_read_only\s*=\s*on/i);
    expect(SQL_CODE).toMatch(/statement_timeout/i);
    expect(SQL_CODE).toMatch(/lock_timeout/i);
    expect(SQL_CODE).toMatch(/idle_in_transaction_session_timeout/i);
  });
});

describe("accès à la base — surface réseau", () => {
  it("ne publie jamais la base de production", () => {
    const prod = serviceBlock("db-prod");
    expect(prod, "le service db-prod doit exister dans docker-compose.prod.yml").not.toBeNull();
    expect(prod).not.toMatch(/^ {4}ports:/m);
  });

  it("ne publie aucune base sur toutes les interfaces", () => {
    expect(COMPOSE).not.toMatch(/^\s*-\s*"?(?:0\.0\.0\.0:)?5432:5432"?\s*$/m);
  });

  it("publie la base bêta en boucle locale, pour l'accès lecture seule", () => {
    const beta = serviceBlock("db-beta");
    expect(beta, "le service db-beta doit exister dans docker-compose.prod.yml").not.toBeNull();
    expect(beta).toMatch(/^ {4}ports:/m);
    expect(beta).toMatch(/^\s+- "127\.0\.0\.1:5432:5432"$/m);
  });
});

describe("doc d'installation — la procédure reste celle qui a été durcie", () => {
  it("pointe vers le fichier SQL unique", () => {
    expect(DOC).toContain("scripts/sql/agent-ro.sql");
  });

  it("garde les options SSH qui ferment le shell et le transfert inverse", () => {
    expect(DOC).toContain('command="/bin/false"');
    expect(DOC).toContain('permitlisten="none"');
    expect(DOC).toContain("/usr/sbin/nologin");
  });

  it("ne publie aucune empreinte de clé (dépôt public)", () => {
    expect(DOC).not.toMatch(/ssh-(ed25519|rsa)\s+AAAA/);
  });

  it("ne prescrit aucune écriture sur la base, et pose le mot de passe en interactif", () => {
    expect(DOC).not.toMatch(/GRANT\s+SELECT\s+ON\s+ALL\s+TABLES/i);
    expect(DOC).toMatch(/\\password/);
  });
});
