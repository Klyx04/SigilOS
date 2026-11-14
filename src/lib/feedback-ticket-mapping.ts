// Logique pure de la fusion « signalements » → `SupportTicket`.
//
// Ce module ne touche ni Prisma ni le réseau : il est utilisé par les server
// actions, le backfill d'exploitation et les tests. Une seule source de vérité
// pour les correspondances, l'anonymisation et les bornes de pagination.

import { FEEDBACK_TYPES, type FeedbackType } from "./feedback-types";

export const TICKET_ORIGINS = ["SUPPORT", "FEEDBACK", "INTERNAL"] as const;
export type TicketOriginValue = (typeof TICKET_ORIGINS)[number];

export const TRACKER_STATUSES = ["A_FAIRE", "A_INVESTIGUER", "EN_COURS", "TERMINE", "IGNORE"] as const;
export type TrackerStatusValue = (typeof TRACKER_STATUSES)[number];

export const TRACKER_CATEGORIES = ["BUG_REPORT", "FEATURE_REQUEST", "OTHER"] as const;
export type TrackerCategoryValue = (typeof TRACKER_CATEGORIES)[number];

export type TrackerTicketStatusValue = "OPEN" | "IN_PROGRESS" | "CLOSED";

export const TRACKER_STATUS_LABELS: Record<TrackerStatusValue, string> = {
  A_FAIRE: "À faire",
  A_INVESTIGUER: "À investiguer",
  EN_COURS: "En cours",
  TERMINE: "Résolu",
  IGNORE: "Ignoré",
};

const BUG_FEEDBACK_TYPES: ReadonlySet<string> = new Set([
  "BUG_TECHNIQUE",
  "ERREUR_DONNEES",
]);

const MAX_SEARCH_LENGTH = 100;
const MAX_GUILD_LENGTH = 100;
const MAX_FEEDBACK_TYPE_LENGTH = 40;
const MAX_REF_LENGTH = 32;

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === "string" && (FEEDBACK_TYPES as readonly string[]).includes(value);
}

export function isTrackerStatus(value: unknown): value is TrackerStatusValue {
  return typeof value === "string" && (TRACKER_STATUSES as readonly string[]).includes(value);
}

export function isTrackerOrigin(value: unknown): value is TicketOriginValue {
  return typeof value === "string" && (TICKET_ORIGINS as readonly string[]).includes(value);
}

/** Type de feedback → catégorie de ticket (comportement historique conservé). */
export function feedbackTypeToCategory(feedbackType: string): TrackerCategoryValue {
  return BUG_FEEDBACK_TYPES.has(feedbackType) ? "BUG_REPORT" : "FEATURE_REQUEST";
}

/** Ancien `SystemIssue.type` → catégorie de ticket (script de reprise). */
export function legacyTypeToCategory(type: string): TrackerCategoryValue {
  return type === "BUG" ? "BUG_REPORT" : "FEATURE_REQUEST";
}

/** Statut du tracker → statut du ticket support (le détail reste dans `trackerStatus`). */
export function trackerStatusToTicketStatus(status: TrackerStatusValue): TrackerTicketStatusValue {
  if (status === "A_FAIRE") return "OPEN";
  if (status === "A_INVESTIGUER" || status === "EN_COURS") return "IN_PROGRESS";
  return "CLOSED";
}

/** Un ancien ticket sans type de feedback est une note interne God, jamais un signalement public. */
export function legacyIssueOrigin(issue: { feedbackType?: string | null }): "FEEDBACK" | "INTERNAL" {
  return typeof issue.feedbackType === "string" && issue.feedbackType.trim().length > 0
    ? "FEEDBACK"
    : "INTERNAL";
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} invalide`);
  }
}

/** Référence historique : les liens `SIG-<id>` existants continuent de fonctionner. */
export function buildLegacyPublicRef(legacyId: number): string {
  assertPositiveInteger(legacyId, "legacyId");
  return `SIG-${legacyId}`;
}

/** Référence publique d'un nouveau ticket : jamais l'id cuid interne. */
export function buildTicketPublicRef(ticketNumber: number): string {
  assertPositiveInteger(ticketNumber, "ticketNumber");
  return `SIG-${ticketNumber}`;
}

/** Sujet court et lisible ; la description complète reste dans `description`. */
export function buildFeedbackSubject(feedbackType: string, description: string): string {
  const prefix = `[${feedbackType.slice(0, 40)}]`;
  const available = Math.max(8, 120 - prefix.length - 1);
  const oneLine = description.replace(/\s+/g, " ").trim();
  const body = oneLine.length > 0 ? oneLine.slice(0, available) : "Signalement";
  return `${prefix} ${body}`;
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export interface TrackerFilters {
  status?: string | null;
  feedbackType?: string | null;
  guild?: string | null;
  search?: string | null;
  ref?: string | null;
}

/**
 * Filtres Prisma bornés. L'origine est toujours imposée par l'appelant :
 * un membre ne peut lire que `FEEDBACK`, jamais `INTERNAL` ni `SUPPORT`.
 */
export function buildTrackerWhere(
  filters: TrackerFilters | null | undefined,
  origin: TicketOriginValue | TicketOriginValue[],
): Record<string, unknown> {
  const where: Record<string, unknown> = Array.isArray(origin)
    ? { origin: { in: [...origin] } }
    : { origin };

  if (isTrackerStatus(filters?.status)) where.trackerStatus = filters.status;

  const feedbackType = cleanString(filters?.feedbackType, MAX_FEEDBACK_TYPE_LENGTH);
  if (feedbackType) where.feedbackType = feedbackType;

  const guild = cleanString(filters?.guild, MAX_GUILD_LENGTH);
  if (guild) where.memberGuildName = { contains: guild, mode: "insensitive" };

  const ref = cleanString(filters?.ref, MAX_REF_LENGTH);
  if (ref) where.publicRef = ref;

  const search = cleanString(filters?.search, MAX_SEARCH_LENGTH);
  if (search) {
    where.OR = [
      { publicRef: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { creatorDiscordName: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface TrackerTicketRecord {
  publicRef: string | null;
  category: string;
  trackerStatus: TrackerStatusValue | null;
  feedbackType: string | null;
  description: string;
  sourcePage: string | null;
  targetSlug: string | null;
  forumLink: string | null;
  createdAt: Date | string;
  creatorDiscordName: string;
  memberGuildName: string | null;
  guildId: string | null;
  transcript: unknown;
}

export interface MemberTrackerReply {
  message: string;
  at: string;
  emoji: string | null;
}

export interface MemberTrackerTicket {
  ref: string;
  category: string;
  trackerStatus: TrackerStatusValue;
  feedbackType: string | null;
  description: string;
  sourcePage: string | null;
  targetSlug: string | null;
  forumLink: string | null;
  createdAt: string;
  memberName: string | null;
  memberGuildName: string | null;
  replies: MemberTrackerReply[];
}

/** Réponses publiques uniquement : jamais l'auteur interne ni les notes God. */
export function publicRepliesFromTranscript(transcript: unknown): MemberTrackerReply[] {
  const entries = Array.isArray(transcript)
    ? transcript
    : transcript && typeof transcript === "object" && Array.isArray((transcript as { replies?: unknown }).replies)
      ? ((transcript as { replies: unknown[] }).replies)
      : [];

  return entries
    .filter((entry): entry is { kind: string; message: string; at?: unknown; emoji?: unknown } => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as { kind?: unknown; message?: unknown };
      return candidate.kind === "member_reply" && typeof candidate.message === "string" && candidate.message.trim().length > 0;
    })
    .slice(-20)
    .map((entry) => ({
      message: entry.message.trim().slice(0, 1000),
      at: typeof entry.at === "string" ? entry.at : "",
      emoji: typeof entry.emoji === "string" && entry.emoji.trim() ? entry.emoji.trim().slice(0, 8) : null,
    }));
}

/**
 * Projection membre : la pseudo n'est visible que dans sa propre guilde.
 * Aucun identifiant interne (cuid, Discord, user id), aucun user-agent.
 */
export function projectMemberTrackerTicket(
  ticket: TrackerTicketRecord,
  readerGuildId: string,
): MemberTrackerTicket {
  const sameGuild = Boolean(ticket.guildId) && ticket.guildId === readerGuildId;
  return {
    ref: ticket.publicRef ?? "",
    category: ticket.category,
    trackerStatus: ticket.trackerStatus ?? "A_FAIRE",
    feedbackType: ticket.feedbackType,
    description: ticket.description,
    sourcePage: ticket.sourcePage,
    targetSlug: ticket.targetSlug,
    forumLink: ticket.forumLink,
    createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : String(ticket.createdAt),
    memberName: sameGuild ? ticket.creatorDiscordName : null,
    memberGuildName: ticket.memberGuildName,
    replies: publicRepliesFromTranscript(ticket.transcript),
  };
}

/** Libellé d'anonymisation : jamais de fallback qui laisserait fuiter la pseudo. */
export function anonymousMemberLabel(memberGuildName: string | null | undefined): string {
  const guild = memberGuildName?.trim();
  return guild ? `Membre de la guilde ${guild}` : "Membre d'une autre guilde";
}


export function buildMemberReplyEntry(
  message: string,
  emoji: string,
  byUserId: string,
  at: Date = new Date(),
): { kind: "member_reply"; message: string; emoji: string; byUserId: string; at: string } {
  return {
    kind: "member_reply",
    message: message.trim().slice(0, 1000),
    emoji: emoji.trim().slice(0, 8),
    byUserId,
    at: at.toISOString(),
  };
}

/** Journalise une réponse sans écraser un transcript support existant. */
export function appendMemberReplyToTranscript(
  transcript: unknown,
  entry: ReturnType<typeof buildMemberReplyEntry>,
): unknown[] | Record<string, unknown> {
  if (Array.isArray(transcript)) {
    return [...transcript, entry].slice(-50);
  }
  if (transcript && typeof transcript === "object") {
    const record = transcript as Record<string, unknown>;
    const replies = Array.isArray(record.replies) ? record.replies : [];
    return { ...record, replies: [...replies, entry].slice(-50) };
  }
  return [entry];
}


export function buildLegacySubject(issue: { type: string; feedbackType?: string | null; description: string }): string {
  const prefix = issue.feedbackType?.trim() || issue.type;
  return buildFeedbackSubject(prefix, issue.description);
}

export function normalizePagination(input?: { page?: number; perPage?: number } | null): {
  page: number;
  perPage: number;
  skip: number;
  take: number;
} {
  const page = clampInt(input?.page, 1, 1000, 1);
  const perPage = clampInt(input?.perPage, 1, 100, 20);
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
