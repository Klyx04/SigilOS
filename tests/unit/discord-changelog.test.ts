/**
 * Parsing du changelog Discord en **markdown** (`change-log.md`) — module PUR.
 * Verrouille : extraction des entrées `<Update>`, date ISO, tags, détection
 * structurelle des breaking changes et recherche de mots-clés bornée/casse-insensible.
 */

import { describe, it, expect } from "vitest";
import {
    parseDiscordChangelog,
    labelToIso,
    isBreakingEntry,
    matchChangelogKeywords,
    entrySearchText,
    entrySignature,
    type DiscordChangelogEntry,
} from "@/lib/discord-changelog";

const SAMPLE = `
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.discord.com/llms.txt

# Change Log

<Update
  label="September 28, 2026"
  tags={["Docs"]}
  rss={{
title: "Videos in the Documentation",
description: "Videos from the Discord Developers YouTube channel are now embedded."
}}
>
  ## Videos in the Documentation
  Some body text.
</Update>

<Update
  label="November 16, 2026"
  tags={["HTTP API", "Breaking Change"]}
  rss={{
title: "HTTP enforcement obfuscation",
description: "Channels are obfuscated; Webhook Events change."
}}
>
  ## Enforced channel obfuscation
</Update>
`;

function entry(partial: Partial<DiscordChangelogEntry>): DiscordChangelogEntry {
    return { label: "", iso: null, tags: [], title: "", description: "", ...partial };
}

describe("parseDiscordChangelog", () => {
    it("extrait chaque <Update> avec date ISO, tags, titre et description", () => {
        const entries = parseDiscordChangelog(SAMPLE);
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            label: "September 28, 2026",
            iso: "2026-09-28",
            tags: ["Docs"],
            title: "Videos in the Documentation",
        });
        expect(entries[1].tags).toEqual(["HTTP API", "Breaking Change"]);
        expect(entries[1].iso).toBe("2026-11-16");
    });

    it("est tolérant : markdown vide ou sans <Update>", () => {
        expect(parseDiscordChangelog("")).toEqual([]);
        expect(parseDiscordChangelog("# rien du tout")).toEqual([]);
    });
});

describe("labelToIso", () => {
    it("convertit un libellé anglais en ISO", () => {
        expect(labelToIso("November 16, 2026")).toBe("2026-11-16");
        expect(labelToIso("January 3, 2026")).toBe("2026-01-03");
    });
    it("renvoie null si le libellé n'est pas mois-jour-année", () => {
        expect(labelToIso("2026-11-16")).toBeNull();
        expect(labelToIso("Bla 1, 2026")).toBeNull();
        expect(labelToIso("")).toBeNull();
    });
});

describe("isBreakingEntry", () => {
    it("vrai si un tag contient « breaking » (casse-insensible)", () => {
        expect(isBreakingEntry(entry({ tags: ["HTTP API", "Breaking Change"] }))).toBe(true);
        expect(isBreakingEntry(entry({ tags: ["breaking"] }))).toBe(true);
    });
    it("faux sinon", () => {
        expect(isBreakingEntry(entry({ tags: ["Docs", "Gateway"] }))).toBe(false);
    });
});

describe("matchChangelogKeywords", () => {
    it("insensible à la casse (un seul mot-clé suffit pour « Obfuscation »)", () => {
        expect(matchChangelogKeywords("Channel obfuscation enforced", ["Obfuscation"])).toEqual(["Obfuscation"]);
    });
    it("borné : « v11 » ne matche ni « v11x » ni « xv11 »", () => {
        expect(matchChangelogKeywords("proxy v11x", ["v11"])).toEqual([]);
        expect(matchChangelogKeywords("xv11 build", ["v11"])).toEqual([]);
        expect(matchChangelogKeywords("API v11 is here", ["v11"])).toEqual(["v11"]);
    });
    it("pas de doublon même si le mot apparaît plusieurs fois", () => {
        expect(matchChangelogKeywords("v11 v11 v11", ["v11"])).toEqual(["v11"]);
    });
});

describe("entrySignature / entrySearchText", () => {
    it("signature stable (date ISO + titre)", () => {
        expect(entrySignature(entry({ iso: "2026-11-16", title: "T" }))).toBe("2026-11-16|T");
        expect(entrySignature(entry({ label: "X", title: "T" }))).toBe("X|T");
    });
    it("le texte de recherche inclut tags, titre et description", () => {
        const text = entrySearchText(entry({
            label: "November 16, 2026",
            tags: ["Breaking Change"],
            title: "Obfuscation",
            description: "Webhook Events change",
        }));
        expect(text).toContain("Breaking Change");
        expect(text).toContain("Obfuscation");
        expect(text).toContain("Webhook Events");
    });
});
