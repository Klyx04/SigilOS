/**
 * Lot B « contenu fantôme & reprise de lead » (30/10/2026) — **gardes de source**.
 *
 * Le défaut mesuré : le cron de synchro et le bot archivaient un partant **sans fermer son
 * contenu** (post DJ `OPEN`, run `RECRUITING`, raid `PUBLISHED`) ; la fonction qui savait le
 * faire (`closeMemberPublishedContent`) n'était appelée que par les actions humaines et par
 * une **seconde implémentation de la synchro sans aucun appelant**. Résultat : le H-1
 * continuait de pinger un groupe fantôme, et personne ne reprenait le lead.
 *
 * Ces gardes verrouillent : ① le filet idempotent branché sur **la** synchro ; ② la
 * fermeture des événements calendrier (jamais couverte) ; ③ la reprise de lead DJ/Songes ;
 * ④ la dérogation admin sur une run orpheline ; ⑤ la disparition du code mort.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const read = (path: string) => codeOnly(readFileSync(path, "utf8"));

const LIFECYCLE = read("src/server/actions/lifecycle-actions.ts");
const SYNC = read("src/server/actions/sync-actions.ts");
const DJ = read("src/server/actions/dungeon-finder-actions.ts");
const RUNS = read("src/server/actions/songes/dream-run-actions.ts");

describe("Filet « contenu fantôme »", () => {
    it("la synchro (cron + API + bouton) applique la passe, pas seulement le cron", () => {
        expect(SYNC).toMatch(/await closeOrphanContentForGuild\(discordGuildId, \{ limit: 25 \}\)/);
        expect(SYNC).toMatch(/orphans\?: \{ profiles: number/);
        // Placée dans la fonction interne : les 3 appelants en héritent.
        expect(SYNC.indexOf("closeOrphanContentForGuild(discordGuildId")).toBeGreaterThan(
            SYNC.indexOf("async function syncMembershipStatusInternal")
        );
    });

    it("la passe ne relit QUE les profils exclus qui portent encore du contenu ouvert", () => {
        expect(LIFECYCLE).toMatch(/export async function closeOrphanContentForGuild/);
        expect(LIFECYCLE).toMatch(/status: \{ in: \["ARCHIVED", "BANNED"\] \}/);
        // Les quatre familles de contenu vivant.
        expect(LIFECYCLE).toMatch(/djSearchPosts: \{ some: \{ status: \{ in: \["OPEN", "FULL"\] \} \} \}/);
        expect(LIFECYCLE).toMatch(/dreamRuns:[\s\S]{0,140}status: \{ in: \["RECRUITING", "IN_PROGRESS"\] \}/);
        expect(LIFECYCLE).toMatch(/guildEvents: \{ some: \{ guildId: guild\.id, status: \{ in: \["DRAFT", "PUBLISHED"\] \} \} \}/);
        expect(LIFECYCLE).toMatch(/marketListings: \{ some: \{ status: \{ in: \["ACTIVE", "RESERVED"\] \} \} \}/);
    });

    it("bornée et best-effort : jamais un balayage complet, jamais une casse de la synchro", () => {
        expect(LIFECYCLE).toMatch(/take: Math\.min\(200, Math\.max\(1, opts\.limit \?\? 50\)\)/);
        expect(LIFECYCLE).toMatch(/\[OrphanContent\] passe impossible/);
        // Elle délègue : une seule cascade, pas une deuxième implémentation.
        expect(LIFECYCLE).toMatch(/await closeMemberPublishedContent\(\s*discordGuildId,\s*profile\.id,\s*profile\.userId,\s*"ORPHAN_SWEEP"/);
    });
});

describe("Événements calendrier — la famille qui n'était jamais fermée", () => {
    // `codeOnly` supprime les commentaires : on découpe sur des repères **de code**.
    const EVENTS_BLOCK = LIFECYCLE.slice(
        LIFECYCLE.indexOf("const ownEvents = await db.guildEvent.findMany"),
        LIFECYCLE.indexOf("for (const post of djPosts)")
    );

    it("les events ouverts du membre passent en CANCELLED, avec garde d'état", () => {
        expect(EVENTS_BLOCK).toMatch(/status: \{ in: \["DRAFT", "PUBLISHED"\] \}/);
        expect(EVENTS_BLOCK).toMatch(/data: \{ status: "CANCELLED" \}/);
        // Deux fois : la lecture ET la garde du WHERE de l'écriture.
        expect(EVENTS_BLOCK.match(/status: \{ in: \["DRAFT", "PUBLISHED"\] \}/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it("un miroir agenda n'est pas annulé à la main (il suit sa source)", () => {
        expect(EVENTS_BLOCK).toMatch(/isAgendaMirror\(event\.metadata\)/);
        expect(EVENTS_BLOCK).toMatch(/const directEvents = ownEvents\.filter/);
    });

    it("purge les rappels et l'embed, puis recopie le miroir DJ/Songes", () => {
        expect(EVENTS_BLOCK).toMatch(/deleteReminderMessageRefs\(refs\)/);
        expect(EVENTS_BLOCK).toMatch(/deleteEventDiscordMessage\(/);
        expect(LIFECYCLE).toMatch(/for \(const post of djPosts\) \{[\s\S]{0,140}syncDjMirror\(guildId, post\.id\)/);
        expect(LIFECYCLE).toMatch(/for \(const run of dreamRuns\) \{[\s\S]{0,140}syncSongesMirror\(guildId, run\.id\)/);
    });

    it("le compteur d'événements est remonté (observabilité)", () => {
        expect(LIFECYCLE).toMatch(/events: number; market: number \}/);
        expect(LIFECYCLE).toMatch(/événement\(s\) annulé\(s\)/);
    });
});

describe("Reprise de lead — DJ / quêtes", () => {
    it("créateur ou admin, cible inscrite et acceptée, jamais un tiers", () => {
        expect(DJ).toMatch(/export async function transferDjLead/);
        expect(DJ).toMatch(/canToggleStandBy\(\{ isCreator: post\.profileId === user\.profileId, isAdmin: Boolean\(user\.isAdmin\) \}\)/);
        expect(DJ).toMatch(/where: \{ postId, profileId: targetProfileId, status: "ACCEPTED" \}/);
        expect(DJ).toMatch(/where: \{ id: targetProfileId, guildId: guildConfig\.id \}/);
        expect(DJ).toMatch(/La cible doit être inscrite et acceptée sur ce post/);
    });

    it("la place de la cible est libérée : le créateur compte déjà +1 par donjon", () => {
        // Invariant de capacité : le transfert passe par la **transaction sérialisable**
        // (jamais un `$transaction` nu — verrou `dj-serialisation-capacite`).
        expect(DJ).toMatch(/withDjSerializableTransaction\(async \(tx: any\) => \{/);
        expect(DJ).toMatch(/tx\.djSearchParticipant\.deleteMany\(\{ where: \{ postId, profileId: targetProfileId \} \}\)/);
        expect(DJ).toMatch(/profileId: targetProfileId/);
        expect(DJ).toMatch(/withDjCreatorClass\(post\.dungeonsJson, nextCreatorClass\)/);
    });

    it("trace, notifie, rafraîchit l'embed et le miroir", () => {
        expect(DJ).toMatch(/FINDER_LEAD_TRANSFERRED/);
        expect(DJ).toMatch(/updateDjDiscordEmbed\(guildId, postId\)/);
        expect(DJ).toMatch(/syncDjMirror\(guildId, postId\)/);
        expect(DJ).toMatch(/Tu es désormais lead d'un groupe/);
    });
});

describe("Reprise de lead — Songes", () => {
    const RUNS_TRANSFER = RUNS.slice(RUNS.indexOf("transferRunLead"), RUNS.indexOf("setDreamRunStandBy"));

    it("leader ou admin, cible membre de la run, `leaderId` seul change", () => {
        expect(RUNS).toMatch(/export async function transferRunLead/);
        expect(RUNS).toMatch(/canToggleStandBy\(\{ isCreator: run\.leaderId === ctx\.userId, isAdmin: Boolean\(ctx\.isAdmin\) \}\)/);
        expect(RUNS).toMatch(/dreamRunMember\.findFirst\(\{\s*where: \{ runId, userId: targetUserId \}/);
        expect(RUNS).toMatch(/data: \{ leaderId: targetUserId \}/);
        // Aucune suppression de membre : le leader occupe le slot 1.
        expect(RUNS_TRANSFER).not.toMatch(/dreamRunMember\.delete/);
    });

    it("trace, notifie, rafraîchit l'embed et le miroir", () => {
        expect(RUNS).toMatch(/SONGES_LEAD_TRANSFERRED/);
        expect(RUNS).toMatch(/updateDiscordRunEmbed\(ctx\.guildId, runId\)/);
        expect(RUNS).toMatch(/syncSongesMirror\(guildId, runId\)/);
        expect(RUNS).toMatch(/Tu es désormais leader d'une run Songes/);
    });

    it("une run orpheline est clôturable / réouvrable par un administrateur", () => {
        expect(RUNS).toMatch(/if \(run\.leaderId !== ctx\.userId && !ctx\.isAdmin\) \{\s*return \{ success: false, error: "Seul le leader ou un administrateur peut clôturer la run" \}/);
        expect(RUNS).toMatch(/if \(run\.leaderId !== ctx\.userId && !ctx\.isAdmin\) \{\s*return \{ success: false, error: "Seul le leader ou un administrateur peut réouvrir la run" \}/);
    });
});

describe("Rétention des comptes — l'événement survit au compte (option C)", () => {
    const RETENTION = read("src/server/account-retention-core.ts");
    const DELETED = read("src/server/deleted-member.ts");

    it("le compte n'est plus retenu en otage par ses événements", () => {
        // Avant : `if (user._count.guildEvents > 0) { skipped++; continue; }` ⇒ compte à vie.
        expect(RETENTION).not.toMatch(/_count\.guildEvents/);
        expect(RETENTION).toMatch(/if \(isDeletedMemberUser\(user\.id\)\) \{ skipped\+\+; continue; \}/);
    });

    it("les événements sont ré-attribués AVANT la suppression du compte", () => {
        expect(RETENTION).toMatch(/await reattributeGuildEvents\(user\.id\)/);
        expect(RETENTION.indexOf("reattributeGuildEvents(user.id)")).toBeLessThan(
            RETENTION.indexOf("db.user.delete({ where: { id: user.id } })")
        );
    });

    it("le contenu publié est refermé (embeds + rappels) avant la purge", () => {
        expect(RETENTION).toMatch(/closeMemberPublishedContent\(\s*profile\.guild\.discordGuildId,\s*profile\.id,\s*user\.id,\s*"ORPHAN_RETENTION"/);
    });

    it("le compte technique porte un id fixe et n'est jamais connectable", () => {
        expect(DELETED).toMatch(/export const DELETED_MEMBER_USER_ID = "system-deleted-member"/);
        expect(DELETED).toMatch(/export const DELETED_MEMBER_NAME = "Ancien membre"/);
        expect(DELETED).toMatch(/create: \{ id: DELETED_MEMBER_USER_ID, name: DELETED_MEMBER_NAME \}/);
        expect(DELETED).toMatch(/export function isDeletedMemberUser/);
    });
});

describe("Code mort et surfaces", () => {
    it("la seconde implémentation de la synchro a disparu", () => {
        expect(LIFECYCLE).not.toMatch(/export async function syncGuildMembers/);
    });

    it("le dashboard expose la reprise de lead (DJ + Songes), sans nouvelle surface Discord", () => {
        const modal = read("src/components/dungeon-finder/DjPostDetailModal.tsx");
        expect(modal).toMatch(/transferDjLead/);
        expect(modal).toMatch(/aria-label="Nouveau lead du groupe"/);
        const card = read("src/components/songes/RunCard.tsx");
        expect(card).toMatch(/RunLeadTransfer/);
        expect(card).toMatch(/transferCandidates=\{transferCandidates\}/);
        const leader = read("src/components/songes/RunLeaderActions.tsx");
        expect(leader).toMatch(/export function RunLeadTransfer/);
    });
});
