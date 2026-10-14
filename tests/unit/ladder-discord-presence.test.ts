import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    HABITUE_VOICE_MINUTES_WEEKLY,
    computeDiscordPresenceStats,
    hasNoInteraction,
    matchPresenceFilter,
    neverVoiced,
    resolveDiscordPresenceProfile,
    type PresenceCounters,
} from "@/lib/ladder-presence";

/**
 * Ladder Discord — présence (demande user : « nb de gens en voc cette semaine /
 * qui s'y retrouve souvent / jamais / jamais d'interaction Discord — pas en
 * mode punition, pour voir qui interagit et est réellement actif »).
 *
 * 🛡️ Ce que ce test verrouille : ① la règle pure (seuil habitué affiché en UI,
 * jamais = total + aucune venue, silencieux = zéro mesuré partout) ; ② le
 * câblage serveur (filtre + stats sur les compteurs existants, compteurs
 * retirés avant envoi, cache versionné) ; ③ l'UI (filtre, stats cliquables,
 * badge neutre qui remplace le blâme sur l'onglet Discord).
 * Lecture seule (lib pure + fichiers), aucune base, aucune migration.
 */

const ACTIONS = "src/server/actions/ladder-actions.ts";
const CLIENT =
    "src/app/dashboard/[guildId]/ladder/_components/ladder-client.tsx";
const CARD =
    "src/app/dashboard/[guildId]/ladder/_components/leaderboard-card.tsx";

const counters = (over: Partial<PresenceCounters> = {}): PresenceCounters => ({
    voiceWeekly: 0,
    voiceTotal: 0,
    messagesTotal: 0,
    charactersTotal: 0,
    repliesTotal: 0,
    reactionsReceivedTotal: 0,
    streamTotal: 0,
    lastMessageAt: null,
    lastVoiceAt: null,
    lastReactionAt: null,
    ...over,
});

describe("présence Discord — règle pure", () => {
    it("seuil habitue public : 60 min de vocal/semaine", () => {
        expect(HABITUE_VOICE_MINUTES_WEEKLY).toBe(60);
        const justeSousSeuil = resolveDiscordPresenceProfile(counters({ voiceWeekly: 59, voiceTotal: 59 }));
        const auSeuil = resolveDiscordPresenceProfile(counters({ voiceWeekly: 60, voiceTotal: 60 }));
        expect(justeSousSeuil).toBe("present");
        expect(auSeuil).toBe("habitue");
    });

    it("silencieux prioritaire : zero mesure partout + aucun horodatage", () => {
        expect(resolveDiscordPresenceProfile(counters())).toBe("silencieux");
        expect(hasNoInteraction(counters())).toBe(true);
        // Un seul message suffit a ne plus etre silencieux.
        expect(hasNoInteraction(counters({ messagesTotal: 1 }))).toBe(false);
        // …mais sans vocal hebdo on reste discret, pas habitué.
        expect(
            resolveDiscordPresenceProfile(counters({ messagesTotal: 12, lastMessageAt: "2026-10-01T00:00:00Z" }))
        ).toBe("discret");
    });

    it("jamais en vocal = aucun total ET aucune venue (le passé compte)", () => {
        expect(neverVoiced(counters())).toBe(true);
        // Venu jadis, même à zéro total : ce n'est plus « jamais ».
        expect(neverVoiced(counters({ lastVoiceAt: "2026-09-01T00:00:00Z" }))).toBe(false);
        expect(neverVoiced(counters({ voiceTotal: 5 }))).toBe(false);
    });

    it("filtre : chaque profil tombe dans sa case, inconnu → tout", () => {
        const habitue = counters({ voiceWeekly: 120, voiceTotal: 500, lastVoiceAt: "x" });
        const present = counters({ voiceWeekly: 12, voiceTotal: 12, lastVoiceAt: "x" });
        const discret = counters({ messagesTotal: 3, lastMessageAt: "x" });
        const silencieux = counters();
        expect(matchPresenceFilter(habitue, "habitue")).toBe(true);
        expect(matchPresenceFilter(present, "habitue")).toBe(false);
        expect(matchPresenceFilter(habitue, "enVocal")).toBe(true);
        expect(matchPresenceFilter(present, "enVocal")).toBe(true);
        expect(matchPresenceFilter(discret, "enVocal")).toBe(false);
        expect(matchPresenceFilter(discret, "sansVocal")).toBe(true);
        expect(matchPresenceFilter(silencieux, "sansVocal")).toBe(true);
        expect(matchPresenceFilter(silencieux, "jamaisEnVocal")).toBe(true);
        expect(matchPresenceFilter(discret, "jamaisEnVocal")).toBe(true);
        expect(matchPresenceFilter(present, "jamaisEnVocal")).toBe(false);
        expect(matchPresenceFilter(silencieux, "sansInteraction")).toBe(true);
        expect(matchPresenceFilter(discret, "sansInteraction")).toBe(false);
        expect(matchPresenceFilter(silencieux, "all")).toBe(true);
        expect(matchPresenceFilter(silencieux, "nimporte-quoi")).toBe(true);
        expect(matchPresenceFilter(silencieux, undefined)).toBe(true);
    });

    it("stats : agrégation sans hypothèse (zéro = zéro)", () => {
        const stats = computeDiscordPresenceStats([
            counters({ voiceWeekly: 120, voiceTotal: 500, lastVoiceAt: "x" }),
            counters({ voiceWeekly: 12, voiceTotal: 12, lastVoiceAt: "x" }),
            counters({ messagesTotal: 3, lastMessageAt: "x" }),
            counters(),
        ]);
        expect(stats).toEqual({ total: 4, enVocal: 2, habitues: 1, jamaisEnVocal: 2, sansInteraction: 1 });
        expect(computeDiscordPresenceStats([])).toEqual({
            total: 0,
            enVocal: 0,
            habitues: 0,
            jamaisEnVocal: 0,
            sansInteraction: 0,
        });
    });
});

describe("présence Discord — câblage serveur", () => {
    it("getPresenceLadder accepte le filtre et projette le profil (compteurs retirés avant envoi)", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain('presence: string = "all"');
        expect(src).toContain("discordVoiceTimeWeekly: true");
        expect(src).toContain("lastDiscordVoiceAt: true");
        expect(src).toContain("presenceProfile: resolveDiscordPresenceProfile(counters)");
        expect(src).toContain("presenceCounters: counters");
        expect(src).toContain("presenceCounters: _omit");
        expect(src).toContain("matchPresenceFilter(");
    });

    it("cache versionné (l'ancien sans profil ne fausse pas le filtre après déploiement)", () => {
        expect(readFileSync(ACTIONS, "utf8")).toContain("ladder:presence:v2:");
    });

    it("stats dédiées : membres ACTIFS de la guilde, cache propre", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain("export async function getDiscordPresenceStats");
        expect(src).toContain('status: "ACTIVE"');
        expect(src).toContain("ladder:presence-stats:v1:");
        expect(src).toContain("computeDiscordPresenceStats(");
    });
});

describe("présence Discord — interface (jamais un blâme)", () => {
    it("client : filtre + stats cliquables branchés sur l'onglet Discord", () => {
        const src = readFileSync(CLIENT, "utf8");
        expect(src).toContain("presenceFilter");
        expect(src).toContain("getDiscordPresenceStats");
        expect(src).toContain("Filtrer par présence");
        expect(src).toContain("DISCORD_PRESENCE_FILTER_LABELS");
        expect(src).toContain("HABITUE_VOICE_MINUTES_WEEKLY");
        expect(src).toContain("jamais pour blâmer");
        expect(src).toContain("debouncedSearch, presenceFilter]");
    });

    it("carte : badge neutre du profil, blâme « Mauvais Élève » effacé sur l'onglet Discord", () => {
        const src = readFileSync(CARD, "utf8");
        expect(src).toContain("DISCORD_PRESENCE_LABELS[presenceProfile]");
        expect(src).toContain("showTourist");
        expect(src).toContain("border-border bg-surface text-muted-foreground");
    });
});
