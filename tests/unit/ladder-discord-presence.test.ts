import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    HABITUE_VOICE_MINUTES_WEEKLY,
    computeDiscordPresenceStats,
    describePresenceFilter,
    describePresenceProfile,
    formatThreshold,
    habitueThreshold,
    hasNoInteraction,
    matchPresenceFilter,
    neverVoiced,
    presenceFilterLabels,
    resolveDiscordPresenceProfile,
    voiceInPeriod,
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
    voiceMonthly: 0,
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

    it("période : le même filtre suit semaine / mois / global (seuils adaptés)", () => {
        // 200 min : habitué en semaine (≥ 60) comme dans le mois (≥ 240) ? non : 200 < 240.
        const membre = counters({ voiceWeekly: 50, voiceMonthly: 200, voiceTotal: 900, lastVoiceAt: "x" });
        expect(voiceInPeriod(membre, "weekly")).toBe(50);
        expect(voiceInPeriod(membre, "monthly")).toBe(200);
        expect(voiceInPeriod(membre, "alltime")).toBe(900);
        expect(habitueThreshold("weekly")).toBe(60);
        expect(habitueThreshold("monthly")).toBe(240);
        expect(habitueThreshold("alltime")).toBe(480);
        expect(formatThreshold(60)).toBe("1 h");
        expect(formatThreshold(240)).toBe("4 h");
        expect(resolveDiscordPresenceProfile(membre, "weekly")).toBe("present");
        expect(resolveDiscordPresenceProfile(membre, "monthly")).toBe("present");
        expect(resolveDiscordPresenceProfile(membre, "alltime")).toBe("habitue");
        // Silence radio ce mois-ci mais passé vocal : discret sur le mois, pas silencieux.
        const discretMois = counters({ voiceWeekly: 0, voiceMonthly: 0, voiceTotal: 90, lastVoiceAt: "x" });
        expect(resolveDiscordPresenceProfile(discretMois, "monthly")).toBe("discret");
        expect(matchPresenceFilter(discretMois, "sansVocal", "monthly")).toBe(true);
        expect(matchPresenceFilter(discretMois, "jamaisEnVocal", "monthly")).toBe(false);
        expect(matchPresenceFilter(membre, "habitue", "monthly")).toBe(false);
        expect(matchPresenceFilter(membre, "habitue", "alltime")).toBe(true);
        expect(matchPresenceFilter(membre, "enVocal", "monthly")).toBe(true);
        const statsMois = computeDiscordPresenceStats([membre, counters()], "monthly");
        expect(statsMois).toEqual({ total: 2, enVocal: 1, habitues: 0, jamaisEnVocal: 1, sansInteraction: 1 });
    });

    it("transparence : chaque règle se dit en une phrase (infobulle = source unique)", () => {
        expect(describePresenceFilter("habitue", "monthly")).toContain("4 h");
        expect(describePresenceFilter("habitue", "monthly")).toContain("ce mois-ci");
        expect(describePresenceFilter("enVocal", "weekly")).toContain("cette semaine");
        expect(describePresenceFilter("jamaisEnVocal", "alltime")).toContain("jamais");
        expect(describePresenceFilter("sansInteraction", "weekly")).toContain("jamais mesurée");
        expect(describePresenceFilter("sansInteraction", "weekly")).toContain("horodatage");
        expect(describePresenceFilter("sansInteraction", "monthly")).toContain("caractère");
        expect(describePresenceProfile("habitue", "weekly")).toContain("1 h");
        expect(describePresenceProfile("silencieux", "monthly")).toContain("pas à punir");
        expect(presenceFilterLabels("monthly").enVocal).toBe("En vocal ce mois-ci");
        expect(presenceFilterLabels("alltime").sansVocal).toBe("Sans vocal au total");
        expect(presenceFilterLabels("weekly").habitue).toBe("Habitués du vocal");
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
    it("getPresenceLadder accepte le filtre et projette le profil sur la période (compteurs retirés avant envoi)", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain('presence: string = "all"');
        expect(src).toContain("discordVoiceTimeWeekly: true");
        expect(src).toContain("discordVoiceTimeMonthly: true");
        expect(src).toContain("lastDiscordVoiceAt: true");
        expect(src).toContain("resolveDiscordPresenceProfile(counters, period)");
        expect(src).toContain("presenceNote: describePresenceProfile(");
        expect(src).toContain("presenceCounters: counters");
        expect(src).toContain("presenceCounters: _omit");
        expect(src).toContain("matchPresenceFilter(");
        expect(src).toContain("view as PresencePeriod");
    });

    it("cache versionné (l'ancien sans profil ne fausse pas le filtre après déploiement)", () => {
        expect(readFileSync(ACTIONS, "utf8")).toContain("ladder:presence:v2:");
    });

    it("stats dédiées : membres ACTIFS de la guilde, périodisées, cache propre", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain("export async function getDiscordPresenceStats");
        expect(src).toContain('status: "ACTIVE"');
        expect(src).toContain("ladder:presence-stats:v1:${guildId}:${view}");
        expect(src).toContain("computeDiscordPresenceStats(");
        expect(src).toContain("period");
    });
});

describe("présence Discord — interface (jamais un blâme)", () => {
    it("client : filtre de présence branché sur l'onglet Discord et la période", () => {
        const src = readFileSync(CLIENT, "utf8");
        expect(src).toContain("presenceFilter");
        expect(src).toContain("Filtrer par présence");
        expect(src).toContain("presenceFilterLabels(activityView)");
        expect(src).toContain("debouncedSearch, presenceFilter]");
    });

    it("client : plus d'encart bilan de présence (retiré le 29/10/2026)", () => {
        const src = readFileSync(CLIENT, "utf8");
        // Demande user : on garde les **filtres** du classement Discord, on retire le
        // bandeau « Qui vit sur le Discord » et toute sa méthodologie.
        expect(src).not.toContain("Qui vit sur le Discord");
        expect(src).not.toContain("D&apos;où viennent ces chiffres");
        expect(src).not.toContain("getDiscordPresenceStats(guildId");
    });

    it("carte : badge neutre du profil, blâme « Mauvais Élève » effacé sur l'onglet Discord", () => {
        const src = readFileSync(CARD, "utf8");
        expect(src).toContain("DISCORD_PRESENCE_LABELS[presenceProfile]");
        expect(src).toContain("entry.presenceNote");
        expect(src).toContain("showTourist");
        expect(src).toContain("border-border bg-surface text-muted-foreground");
    });
});
