import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const powershell = (process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"]).find(
    (command) => spawnSync(command, ["-NoProfile", "-Command", "exit 0"], { encoding: "utf8" }).status === 0,
);

const runHook = (name: string, payload: unknown) => {
    expect(powershell, "PowerShell introuvable").toBeTruthy();
    const result = spawnSync(powershell!, ["-NoProfile", "-File", path.join(root, ".clinerules/hooks", name)], {
        input: JSON.stringify(payload),
        encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout.replace(/^\uFEFF/, "").trim()) as {
        cancel: boolean;
        errorMessage: string;
        contextModification?: string;
    };
};

/**
 * Garde du harnais agentique.
 *
 * Vérifie que la mémoire chaude reste petite, qu'il n'y a qu'une zone temp,
 * que les anciennes sources d'ordre sont archivées, et que les skills, règles
 * et hooks sont exploitables (frontmatter valide, aucun secret).
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
        const dir = path.join(root, ".cline/skills");
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
        const dir = path.join(root, ".cline/skills");
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
        const dir = path.join(root, ".clinerules");
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
        const dir = path.join(root, ".clinerules");
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

    it("les trois hooks Windows existent et ne contiennent aucun secret", () => {
        for (const hook of ["PreToolUse.ps1", "TaskStart.ps1", "TaskComplete.ps1"]) {
            const file = path.join(root, ".clinerules/hooks", hook);
            expect(fs.existsSync(file), hook).toBe(true);

            const body = fs.readFileSync(file, "utf8");
            expect(body, hook).toMatch(/ConvertTo-Json/);
            expect(body, hook).not.toMatch(/(DISCORD_TOKEN|CLIENT_SECRET|ghp_|sk-[A-Za-z0-9]{10,})/);
        }
    });

    it("les hooks forcent une sortie UTF-8", () => {
        for (const hook of ["PreToolUse.ps1", "TaskStart.ps1", "TaskComplete.ps1"]) {
            const body = fs.readFileSync(path.join(root, ".clinerules/hooks", hook), "utf8");
            expect(body, hook).toMatch(/\[Console\]::OutputEncoding\s*=\s*\[System\.Text\.Encoding\]::UTF8/);
        }
    });
    it(".clineignore sort les binaires de l'index", () => {
        const ignore = read(".clineignore");
        expect(ignore).toMatch(/public\/assets\//);
        expect(ignore).toMatch(/node_modules\//);
    });

    it("la configuration OpenCode branche les skills et les garde-fous", () => {
        const config = JSON.parse(read("opencode.json")) as {
            skills: string[];
            permissions: Array<{ action: string; resource: string; effect: string }>;
            watcher: { ignore: string[] };
            worktree: { directory: string };
            mcp: { servers: Record<string, { type: string; url: string }> };
        };

        expect(config.skills).toContain(".cline/skills");
        expect(config.permissions).toEqual(
            expect.arrayContaining([
                { action: "edit", resource: "*.env", effect: "deny" },
                { action: "edit", resource: "*prisma/migrations/*", effect: "ask" },
                { action: "shell", resource: "*--no-verify*", effect: "deny" },
            ]),
        );
        expect(config.watcher.ignore).toContain("public/assets/**");
        expect(config.worktree.directory).toBe("../sigilos-worktrees");
        expect(config.mcp.servers.sentry.url).toContain("mcp.sentry.dev");
    });

    it("les commandes OpenCode et les routeurs de zone existent", () => {
        for (const file of [
            ".opencode/commands/reprise.md",
            ".opencode/commands/fin.md",
            "src/AGENTS.md",
            "tests/AGENTS.md",
            "docs/AGENTS.md",
            "services/AGENTS.md",
        ]) {
            expect(fs.existsSync(path.join(root, file)), file).toBe(true);
        }

        const agents = read("AGENTS.md");
        const rules = fs
            .readdirSync(path.join(root, ".clinerules"))
            .filter((file) => file.endsWith(".md"));
        for (const rule of rules) {
            expect(agents, rule).toContain(`.clinerules/${rule}`);
        }
    });

    it("le journal archive est présent et ne contient aucun ID Discord", () => {
        const journal = read("docs/agents/journal-sessions-2026.md");
        expect(journal.length).toBeGreaterThan(100_000);
        expect(journal).not.toMatch(/\b\d{15,21}\b/);
    });
});

describe("hooks Cline — comportement", () => {
    const block = (payload: unknown) => expect(runHook("PreToolUse.ps1", payload).cancel).toBe(true);
    const allow = (payload: unknown) => expect(runHook("PreToolUse.ps1", payload).cancel).toBe(false);

    it("PreToolUse bloque les gestes dangereux et laisse passer le reste", () => {
        block({ tool_call: { name: "write_to_file", input: { path: ".env" } } });
        allow({ tool_call: { name: "write_to_file", input: { path: ".env.example" } } });
        block({ tool_call: { name: "write_to_file", input: { path: "prisma/migrations/2026/migration.sql" } } });
        block({ tool_call: { name: "execute_command", input: { command: "npx prisma migrate dev" } } });
        block({ tool_call: { name: "execute_command", input: { command: "npx prisma db push" } } });
        block({ tool_call: { name: "execute_command", input: { command: "git push --force origin dev" } } });
        block({ tool_call: { name: "execute_command", input: { command: "git commit --no-verify -m x" } } });
        block({ tool_call: { name: "execute_command", input: { command: "Set-Content .env foo" } } });
        allow({ tool_call: { name: "write_to_file", input: { path: "src/lib/foo.ts" } } });
        allow({ tool_call: { name: "execute_command", input: { command: "npm run test:run" } } });
    }, 30_000);

    it("TaskStart renvoie le SHA et une étape lisible", () => {
        const result = runHook("TaskStart.ps1", { taskId: "test" });
        expect(result.cancel).toBe(false);
        expect(result.contextModification).toMatch(/Reprise SigilOS — dev [0-9a-f]{7,}/);
        expect(result.contextModification).not.toContain("introuvable");
    });

    it("TaskComplete rappelle la DoD et l'état git", () => {
        const result = runHook("TaskComplete.ps1", {});
        expect(result.cancel).toBe(false);
        expect(result.contextModification).toContain("DoD");
        expect(result.contextModification).toMatch(/arbre propre|fichier\(s\)/);
    });
});