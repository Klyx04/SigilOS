import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

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
        }
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

    it("le journal archive est présent et ne contient aucun ID Discord", () => {
        const journal = read("docs/agents/journal-sessions-2026.md");
        expect(journal.length).toBeGreaterThan(100_000);
        expect(journal).not.toMatch(/\b\d{15,21}\b/);
    });
});