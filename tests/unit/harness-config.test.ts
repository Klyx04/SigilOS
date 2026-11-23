import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

/**
 * Garde du harnais agentique.
 *
 * Vérifie que la mémoire chaude reste petite, qu'il n'y a qu'une zone temp,
 * que les anciennes sources d'ordre sont archivées, et que les skills, règles
 * et garde-fous sont exploitables (frontmatter valide, aucun secret).
 *
 * Référence : docs/agents/harnais.md.
 */
describe("harnais agentique", () => {
    it("la feuille de route unique reste petite", () => {
        const size = fs.statSync(path.join(root, "docs/ROADMAP.md")).size;
        expect(size).toBeLessThan(60 * 1024);
    });

    it("une seule zone temp : pas de dossier temp/ à la racine", () => {
        expect(fs.existsSync(path.join(root, "temp"))).toBe(false);
    });

    it("les anciens ordres sont archivés, pas actifs", () => {
        expect(fs.existsSync(path.join(root, "docs/plans/FILE-EXECUTION.md"))).toBe(false);
        expect(fs.existsSync(path.join(root, "docs/plans/BRIEF-REPRISE.md"))).toBe(false);
        expect(fs.existsSync(path.join(root, "docs/agents/archive/FILE-EXECUTION-2026-10-15.md"))).toBe(true);
        expect(fs.existsSync(path.join(root, "docs/agents/archive/BRIEF-REPRISE-2026-10-14.md"))).toBe(true);
    });

    it("chaque skill a un frontmatter valide et un nom égal au dossier", () => {
        const dir = path.join(root, ".agents/skills");
        const skills = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
        expect(skills.length).toBeGreaterThanOrEqual(6);

        for (const skill of skills) {
            const markdown = fs.readFileSync(path.join(dir, skill.name, "SKILL.md"), "utf8");
            const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            expect(frontmatter, skill.name).toBeTruthy();

            const body = frontmatter?.[1] ?? "";
            const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim();
            const description = body.match(/^description:\s*(.+)$/m)?.[1]?.trim();

            expect(name, skill.name).toBe(skill.name);
            expect(description?.length ?? 0, skill.name).toBeGreaterThan(20);
            expect(description?.length ?? 0, skill.name).toBeLessThanOrEqual(1024);

            /* YAML : une valeur **non citée** ne peut pas contenir « deux-points
               espace » — le parseur casse et le skill DISPARAÎT du panneau
               Cline, sans erreur visible. Mesuré le 05/11/2026 : c'était la
               seule raison pour laquelle `sentry-triage` (écrit en octobre) et
               `sigilos-da-wakfu` n'apparaissaient pas dans la liste. */
            const quoted = /^(["']).*\1$/.test(description ?? "");
            if (!quoted) {
                expect(description, `${skill.name} : description non citée avec « : »`).not.toMatch(/: /);
            }
        }
    });

    it("l'inventaire des 12 skills est exact", () => {
        const dir = path.join(root, ".agents/skills");
        const skills = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
        expect(skills).toEqual([
            "cron-task",
            "discord-api",
            "doc-session",
            "lot-pr",
            "metamob-api",
            "node-runtime",
            "prisma-change",
            "responsive",
            "route-securite",
            "sentry-triage",
            "sigilos-da-wakfu",
            "vps-ops",
        ]);
    });

    it("les règles conditionnelles déclarent des chemins", () => {
        const dir = path.join(root, "docs/agents/rules");
        const rules = fs.readdirSync(dir).filter((file) => file.endsWith(".md"));
        expect(rules.length).toBeGreaterThanOrEqual(4);

        for (const rule of rules) {
            const markdown = fs.readFileSync(path.join(dir, rule), "utf8");
            const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            expect(frontmatter, rule).toBeTruthy();
            expect(frontmatter?.[1] ?? "", rule).toMatch(/^paths:/m);
            expect(frontmatter?.[1] ?? "", rule).toMatch(/- ".+"/);
        }
    });

    it("chaque règle conditionnelle matche au moins un fichier suivi", () => {
        const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
            .split(/\r?\n/)
            .filter(Boolean);
        const globToRegExp = (glob: string) =>
            new RegExp(
                "^" +
                    glob
                        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                        .replace(/\*\*\//g, "@@DIR@@")
                        .replace(/\*\*/g, "@@ANY@@")
                        .replace(/\*/g, "[^/]*")
                        .replace(/@@DIR@@/g, "(?:.*/)?")
                        .replace(/@@ANY@@/g, ".*") +
                    "$",
            );
        const dir = path.join(root, "docs/agents/rules");
        const rules = fs.readdirSync(dir).filter((file) => file.endsWith(".md"));

        for (const rule of rules) {
            const markdown = fs.readFileSync(path.join(dir, rule), "utf8");
            const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const content = frontmatter?.[1] ?? "";
            const paths = [...content.matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map((match) => match[1]);

            expect(paths.length, rule).toBeGreaterThan(0);
            for (const glob of paths) {
                const regex = globToRegExp(glob);
                expect(files.some((file) => regex.test(file)), `${rule} → ${glob}`).toBe(true);
            }
        }
    });

    it("la sortie de Cline ne laisse aucun vestige dans le dépôt", () => {
        for (const gone of [".clinerules", ".clineignore"]) {
            expect(fs.existsSync(path.join(root, gone)), gone).toBe(false);
        }
        const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" });
        expect(tracked).not.toMatch(/^\.clinerules\//m);
        expect(tracked).not.toMatch(/^\.clineignore$/m);
        expect(tracked).not.toMatch(/^\.cline\//m);
    });

    it("les garde-fous OpenCode bloquent les gestes dangereux et laissent passer le reste", () => {
        const config = JSON.parse(read("opencode.json")) as {
            permissions: Array<{ action: string; resource: string; effect: string }>;
        };

        /* OpenCode applique la DERNIÈRE règle dont le glob matche la valeur entière. */
        const globToRegExp = (glob: string) =>
            new RegExp(
                "^" +
                    glob
                        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                        .replace(/\*/g, ".*")
                        .replace(/\?/g, ".") +
                    "$",
            );
        const effectOf = (action: string, resource: string) => {
            const matches = config.permissions.filter(
                (rule) => rule.action === action && globToRegExp(rule.resource).test(resource),
            );
            return matches.length > 0 ? matches[matches.length - 1].effect : undefined;
        };
        const expectEffect = (action: string, resource: string, effect: string | undefined) =>
            expect(effectOf(action, resource), `${action} ${resource}`).toBe(effect);

        /* Secrets : `.env` bloqué à l'édition comme par commande, `.env.example` éditable. */
        expectEffect("edit", ".env", "deny");
        expectEffect("edit", "src/.env.local", "deny");
        expectEffect("edit", ".env.example", "allow");
        for (const command of [
            "Set-Content .env foo",
            "Set-Content -Path .env foo",
            "Out-File -FilePath .env foo",
            "Add-Content -Path .env foo",
            "echo x > .env",
            "echo x >> .env.local",
        ]) {
            expectEffect("shell", command, "deny");
        }

        /* Contournement des hooks git. */
        expectEffect("shell", "git commit --no-verify -m x", "deny");
        expectEffect("shell", "git push --force origin dev", "deny");
        expectEffect("shell", "git push -f origin dev", "deny");

        /* Migrations et gestes destructifs : accord explicite. */
        expectEffect("edit", "prisma/migrations/2026/migration.sql", "ask");
        for (const command of [
            "npx prisma migrate dev",
            "npx prisma db push",
            "npx prisma migrate reset",
            "git reset --hard HEAD~1",
            "drop database sigilos",
            "rm -rf node_modules",
            "Remove-Item -Path node_modules -Recurse",
        ]) {
            expectEffect("shell", command, "ask");
        }

        /* Ce qui doit passer sans garde : lecture, tests, build, push normal. */
        for (const command of ["npm run test:run", "git status --short", "git push origin dev", "npm run build"]) {
            expectEffect("shell", command, undefined);
        }

        /* Une `allow` fourre-tout neutraliserait tous les deny : on n'en veut qu'une. */
        expect(config.permissions.filter((rule) => rule.effect === "allow")).toEqual([
            { action: "edit", resource: "*.env.example", effect: "allow" },
        ]);
    });

    it("la configuration OpenCode branche les skills et les garde-fous", () => {
        const config = JSON.parse(read("opencode.json")) as {
            skills: string[];
            permissions: Array<{ action: string; resource: string; effect: string }>;
            watcher: { ignore: string[] };
            worktree: { directory: string };
            mcp: { servers: Record<string, { type: string; url: string }> };
        };

        expect(config.skills).toContain(".agents/skills");
        expect(config.watcher.ignore).toEqual(
            expect.arrayContaining([
                "node_modules/**",
                ".next/**",
                "public/assets/**",
                "public/uploads/**",
                "private_uploads/**",
                "docs/audits/**",
                "src/temp/**",
            ]),
        );
        expect(config.permissions).toEqual(
            expect.arrayContaining([
                { action: "edit", resource: "*.env", effect: "deny" },
                { action: "edit", resource: "*prisma/migrations/*", effect: "ask" },
                { action: "shell", resource: "*--no-verify*", effect: "deny" },
            ]),
        );
        expect(config.worktree.directory).toBe("../sigilos-worktrees");
        expect(config.mcp.servers.sentry.url).toContain("mcp.sentry.dev");
    });

    it("les commandes OpenCode et les routeurs de zone existent", () => {
        for (const file of [
            ".opencode/commands/reprise.md",
            ".opencode/commands/fin.md",
            ".opencode/agents/reviewer.md",
            "src/AGENTS.md",
            "tests/AGENTS.md",
            "docs/AGENTS.md",
            "services/AGENTS.md",
        ]) {
            expect(fs.existsSync(path.join(root, file)), file).toBe(true);
        }

        const agents = read("AGENTS.md");
        const rules = fs.readdirSync(path.join(root, "docs/agents/rules")).filter((file) => file.endsWith(".md"));
        for (const rule of rules) {
            expect(agents, rule).toContain(`docs/agents/rules/${rule}`);
        }
    });

    it("le template de PR force le pourquoi et le critère de réussite", () => {
        const template = read(".github/pull_request_template.md");
        for (const section of ["Pourquoi", "Réussi si", "Ce qui change", "Preuve", "Risque", "Côté mainteneur"]) {
            expect(template, section).toContain(`## ${section}`);
        }
        /* Un template trop long n'est pas lu : il doit tenir en une page. */
        expect(template.length).toBeLessThan(2500);
    });

    it("le sous-agent reviewer est read-only et limité à git", () => {
        const reviewer = read(".opencode/agents/reviewer.md");
        expect(reviewer).toContain("mode: subagent");
        expect(reviewer).toMatch(/action: edit\s+resource: "\*"\s+effect: deny/);
        expect(reviewer).toContain("git diff *");
        expect(reviewer).toContain("--no-index");
        expect(reviewer).toContain("--output");
        expect(reviewer).toContain("--ext-diff");
        expect(reviewer).toContain("--textconv");
        expect(reviewer).toContain('resource: "*>*"');
        expect(reviewer).toContain('resource: "*<*"');
    });

    it("le harnais expose les liens de portabilité", () => {
        const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
        expect(pkg.scripts["harness:links"]).toBe("node scripts/harness-links.mjs");
        expect(fs.existsSync(path.join(root, "scripts/harness-links.mjs"))).toBe(true);

        const ignore = read(".gitignore");
        expect(ignore).toContain("/.claude/skills");
        expect(ignore).not.toContain("/.agents/skills");
        expect(ignore).not.toContain("/.cline");
        expect(ignore).toContain("/.claude/settings.local.json");
        expect(ignore).toContain("/.claude/commands/");
        expect(ignore).toContain("/.claude/agents/");

        const fin = read(".opencode/commands/fin.md");
        expect(fin).toContain("reviewer");
        expect(fin).toContain("origin/dev...HEAD");
        expect(read(".opencode/agents/reviewer.md")).toContain("origin/dev...HEAD");
    });

    it("la source des skills est versionnée et les liens hôtes ignorés", () => {
        const isIgnored = (relative: string) => {
            const result = spawnSync("git", ["check-ignore", "-q", relative], { cwd: root });
            return result.status === 0;
        };

        /* La source doit rester un vrai dossier suivi : un lien à sa place casserait
           un clone neuf (la cible n'existerait pas). C'était le sens de la migration
           du 23/11/2026, du dossier Cline vers un emplacement neutre. */
        expect(fs.lstatSync(path.join(root, ".agents/skills")).isSymbolicLink()).toBe(false);
        expect(isIgnored(".agents/skills")).toBe(false);
        expect(isIgnored(".claude/skills")).toBe(true);
    });

    it("harness:links remplace un dossier vide, refuse un dossier plein et vérifie sans écrire", () => {
        const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "sigilos-harness-"));
        const run = (...args: string[]) =>
            spawnSync(process.execPath, [path.join(root, "scripts/harness-links.mjs"), ...args], {
                cwd: sandbox,
                encoding: "utf8",
                env: { ...process.env, HARNESS_LINKS_ROOT: sandbox },
            });

        try {
            const source = path.join(sandbox, ".agents/skills/demo");
            const link = path.join(sandbox, ".claude/skills");
            fs.mkdirSync(source, { recursive: true });
            fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: demo\n---\n");

            /* Lien absent : `--check` échoue sans rien créer. */
            expect(run("--check").status).toBe(1);
            expect(fs.existsSync(link)).toBe(false);

            /* Dossier vide : remplacé par le lien, puis idempotent. */
            fs.mkdirSync(link, { recursive: true });
            expect(run().status).toBe(0);
            expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
            expect(run("--check").status).toBe(0);
            expect(run().status).toBe(0);

            /* Dossier réel non vide : jamais remplacé, et le script le signale. */
            fs.rmSync(link, { recursive: true, force: true });
            fs.mkdirSync(link, { recursive: true });
            fs.writeFileSync(path.join(link, "keep.md"), "x");
            expect(run().status).toBe(1);
            expect(fs.existsSync(path.join(link, "keep.md"))).toBe(true);
        } finally {
            fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });

    it("le journal archive est présent et ne contient aucun ID Discord", () => {
        const journal = read("docs/agents/journal-sessions-2026.md");
        expect(journal.length).toBeGreaterThan(100_000);
        expect(journal).not.toMatch(/\b\d{15,21}\b/);
    });
});