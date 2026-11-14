"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { FEEDBACK_TYPES, FEEDBACK_LABELS } from "@/lib/feedback-types";
import {
  buildFeedbackSubject,
  buildMemberReplyEntry,
  feedbackTypeToCategory,
  publicRepliesFromTranscript,
  type TrackerStatusValue,
} from "@/lib/feedback-ticket-mapping";
import { appendMemberReply, ensurePublicRef, sendFeedbackEmbed } from "@/server/feedback-ticket-service";
import {
  resolveFeedbackScreenshotChannel,
  validateFeedbackScreenshotChannel,
} from "@/server/feedback-screenshot-channel";
import { isDiscordSnowflake } from "@/lib/feedback-screenshot-channel";
import { getUserContext, type ActionResponse } from "./user-actions";
import { notifyGod } from "@/server/god-notifications";

const feedbackSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  description: z.string().trim().min(1, "Décris brièvement ton retour").max(2000, "Maximum 2000 caractères"),
  // Contexte de page (déjà renseigné côté serveur via la page, mais validé)
  sourcePage: z.string().trim().min(1).max(100),
  targetSlug: z.string().trim().max(100).optional().nullable(),
  guildId: z.string().trim().min(1).max(64),
  userAgent: z.string().trim().max(500).optional().nullable(),
  // Étape/position calculée (overlay) — facultative, ajoutée en tête du retour.
  context: z.string().trim().max(300).optional().nullable(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

const visitorFeedbackSchema = feedbackSchema.omit({ guildId: true });
export type VisitorFeedbackInput = z.infer<typeof visitorFeedbackSchema>;

const WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT = 5; // 5 feedbacks/heure/utilisateur

/**
 * Soumet un feedback depuis les pages « Les Dofus Dofus » (Hub, Détail Dofus, Rush Sylvestre, Ganymède, Guilde).
 *
 * SECURITY (fail-closed) :
 * - auth() obligatoire
 * - getUserContext(guildId) → refuse si non membre ACTIVE de la guilde
 * - rateLimit Redis (panic → échec, jamais de passage ouvert)
 * - Zod sur toutes les entrées
 * - logger (jamais de console.log en prod)
 *
 * Stockage : SupportTicket (origin FEEDBACK) + notif web God + (optionnel) embed Discord.
 * Du pseudo Discord (nickname) et du nom de guilde du signaleur dans le bug + l'embed.
 */
export async function submitQuestFeedbackAction(input: FeedbackInput) {
  const start = Date.now();

  // — Validation Zod (fail-closed si invalide)
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    logger.warn("[Feedback] Validation échouée", { errors: parsed.error.flatten().fieldErrors });
    return { success: false, error: "Données invalides. Merci de remplir tous les champs requis." };
  }
  const data = parsed.data;

  // — Contexte d'étape (overlay) : ajouté en tête du retour pour être visible
  //   côté God (tracker + Discord notif).
  const description = data.context?.trim()
    ? `📍 ${data.context.trim()}\n\n${data.description}`
    : data.description;

  // — Auth
  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("[Feedback] Non authentifié");
    return { success: false, error: "Authentification requise." };
  }

  // — Membership (fail-closed, isolation multi-tenant)
  const userCtx = await getUserContext(data.guildId);
  if (!userCtx.isMember) {
    logger.warn(`[Feedback] Accès refusé — non membre de la guilde ${data.guildId}`);
    return { success: false, error: "Vous devez être membre de la guilde pour envoyer un retour." };
  }

  // — Rate limit (5/heure/utilisateur, fail-closed)
  const rl = await rateLimit(`feedback:${session.user.id}:${data.guildId}`, RATE_LIMIT, WINDOW_MS);
  if (!rl.success) {
    logger.warn(`[Feedback] Rate limit atteint — user ${session.user.id}`);
    return { success: false, error: "Trop de retours envoyés. Réessaie dans une heure." };
  }

  // — Résolution du guildId interne (isolation)
  let internalGuildId: string | null = null;
  try {
    const guildConfig = await db.guildConfig.findUnique({
      where: { discordGuildId: data.guildId },
      select: { id: true, name: true },
    });
    internalGuildId = guildConfig?.id ?? null;
  } catch (e: any) {
    logger.error("[Feedback] Guild config lookup failed", { error: e?.message });
  }

  // — Fail-closed : sans guilde interne, ni isolation ni notification fiables
  if (!internalGuildId) {
    logger.error("[Feedback] Guilde interne introuvable — envoi refusé");
    return { success: false, error: "Guilde introuvable. Réessaie dans un instant." };
  }

  // — Type de retour (couleur d'embed uniquement : le stockage est un ticket)
  const isBug = data.feedbackType === "BUG_TECHNIQUE" || data.feedbackType === "ERREUR_DONNEES";

  // — Catégorie lisible
  const label = FEEDBACK_LABELS[data.feedbackType];
  const category = label?.label ?? "Feedback";

  // — Pseudo Discord (nickname) du signaleur + nom de guilde (avec tag à côté)
  const memberName = userCtx.name || session.user.name || "Membre";
  const memberGuildName = userCtx.guildName || "Guilde inconnue";

  try {
    // — Compte Discord lié (facultatif) : la référence reste le user interne
    const discordAccount = await db.account.findFirst({
      where: { userId: session.user.id, provider: "discord" },
      select: { providerAccountId: true },
    });

    const created = await db.supportTicket.create({
      data: {
        origin: "FEEDBACK",
        category: feedbackTypeToCategory(data.feedbackType),
        status: "OPEN",
        trackerStatus: "A_FAIRE",
        priority: "Normal",
        subject: buildFeedbackSubject(data.feedbackType, description),
        description: `[${data.feedbackType}] ${description}`,
        creatorDiscordId: discordAccount?.providerAccountId ?? "WEB",
        creatorDiscordName: memberName,
        creatorUserId: session.user.id,
        discordGuildId: data.guildId,
        targetGuildId: data.guildId,
        targetGuildName: memberGuildName,
        guildId: internalGuildId,
        feedbackType: data.feedbackType,
        sourcePage: data.sourcePage,
        targetSlug: data.targetSlug || null,
        userAgent: data.userAgent || null,
        memberGuildName,
        forumLink: null,
      },
    });
    const publicRef = await ensurePublicRef(created);

    // — Notif web God (dashboard + tracker)
    await notifyGod({
      title: "🎫 Nouveau feedback Dofus",
      message: `#${publicRef} — ${category} — par ${memberName}`,
      type: "USER_FEEDBACK",
      success: true,
      metadata: { ticketId: created.id, ticketRef: publicRef, memberName, guild: memberGuildName, type: data.feedbackType },
    }).catch((e: any) => logger.error("[Feedback] notifyGod failed", { error: e?.message }));

    // — Embed Discord (canal dédié → fallback godNotify)
    await sendFeedbackEmbed({
      publicRef,
      category,
      description,
      feedbackType: data.feedbackType,
      sourcePage: data.sourcePage,
      targetSlug: data.targetSlug || null,
      memberName,
      memberGuildName,
      emoji: label?.emoji ?? "💬",
      isBug,
    });

    logger.info(`[Feedback] Créé #${publicRef} (${data.sourcePage})`);
    return { success: true, ticketId: publicRef };
  } catch (e: any) {
    logger.error("[Feedback] Create failed", { error: e?.message });
    return { success: false, error: "Une erreur est survenue lors de l'envoi. Réessaie." };
  } finally {
    logger.debug(`[PERF] submitQuestFeedbackAction took ${Date.now() - start}ms`);
  }
}

/**
 * Signalement d'un **visiteur connecté** (profil visiteur, élevage, guide public,
 * en-tête public). Aucune appartenance à une guilde n'est exigée : le ticket est
 * rattaché à la première guilde active du compte si elle existe (pour la
 * notification et l'anonymisation), sinon il reste plateforme.
 *
 * SECURITY (fail-closed) :
 * - auth() obligatoire (pas de retour anonyme par ce chemin)
 * - rateLimit Redis 5/h/utilisateur
 * - Zod borné sur toutes les entrées
 * - jamais de `guildId` fourni par le client
 */
export async function submitVisitorFeedbackAction(input: VisitorFeedbackInput) {
  const start = Date.now();

  const parsed = visitorFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    logger.warn("[Feedback Visiteur] Validation échouée", { errors: parsed.error.flatten().fieldErrors });
    return { success: false, error: "Données invalides. Merci de remplir tous les champs requis." };
  }
  const data = parsed.data;

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Connecte-toi pour envoyer un retour." };
  }

  const rl = await rateLimit(`visitor-feedback:${session.user.id}`, RATE_LIMIT, WINDOW_MS);
  if (!rl.success) {
    return { success: false, error: "Trop de retours envoyés. Réessaie dans une heure." };
  }

  const description = data.context?.trim()
    ? `📍 ${data.context.trim()}\n\n${data.description}`
    : data.description;
  const isBug = data.feedbackType === "BUG_TECHNIQUE" || data.feedbackType === "ERREUR_DONNEES";
  const label = FEEDBACK_LABELS[data.feedbackType];
  const category = label?.label ?? "Feedback";

  try {
    const discordAccount = await db.account.findFirst({
      where: { userId: session.user.id, provider: "discord" },
      select: { providerAccountId: true },
    });

    // Guilde d'accueil : première guilde active du compte, si elle existe.
    const homeProfile = await db.userProfile.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        guildId: true,
        guild: { select: { discordGuildId: true, name: true } },
      },
    });

    const memberName = session.user.name?.trim() || "Visiteur";
    const homeGuildName = homeProfile?.guild?.name ?? "Visiteur indépendant";

    const created = await db.supportTicket.create({
      data: {
        origin: "FEEDBACK",
        category: feedbackTypeToCategory(data.feedbackType),
        status: "OPEN",
        trackerStatus: "A_FAIRE",
        priority: "Normal",
        subject: buildFeedbackSubject(data.feedbackType, description),
        description: `[${data.feedbackType}] ${description}`,
        creatorDiscordId: discordAccount?.providerAccountId ?? "WEB",
        creatorDiscordName: memberName,
        creatorUserId: session.user.id,
        // Un visiteur non membre ne doit pas exposer sa pseudo à la guilde visitée :
        // on rattache à sa guilde d'accueil (s'il en a une), sinon à la plateforme.
        discordGuildId: homeProfile?.guild?.discordGuildId ?? null,
        guildId: homeProfile?.guildId ?? null,
        targetGuildId: null,
        targetGuildName: "Plateforme SigilOS",
        feedbackType: data.feedbackType,
        sourcePage: data.sourcePage,
        targetSlug: data.targetSlug || null,
        userAgent: data.userAgent || null,
        memberGuildName: homeProfile?.guild?.name ?? null,
        forumLink: null,
      },
    });
    const publicRef = await ensurePublicRef(created);

    await notifyGod({
      title: "🎫 Nouveau feedback visiteur",
      message: `#${publicRef} — ${category} — par ${memberName}`,
      type: "USER_FEEDBACK",
      success: true,
      metadata: {
        ticketId: created.id,
        ticketRef: publicRef,
        memberName,
        guild: homeGuildName,
        type: data.feedbackType,
        source: "visitor",
      },
    }).catch((e: any) => logger.error("[Feedback Visiteur] notifyGod failed", { error: e?.message }));

    await sendFeedbackEmbed({
      publicRef,
      category,
      description,
      feedbackType: data.feedbackType,
      sourcePage: data.sourcePage,
      targetSlug: data.targetSlug || null,
      memberName,
      memberGuildName: homeGuildName,
      emoji: label?.emoji ?? "💬",
      isBug,
    });

    logger.info(`[Feedback Visiteur] Créé #${publicRef} (${data.sourcePage})`);
    return { success: true, ticketId: publicRef };
  } catch (e: any) {
    logger.error("[Feedback Visiteur] Create failed", { error: e?.message });
    return { success: false, error: "Une erreur est survenue lors de l'envoi. Réessaie." };
  } finally {
    logger.debug(`[PERF] submitVisitorFeedbackAction took ${Date.now() - start}ms`);
  }
}

/**
 * Envoie une notification Dashboard (cloche) à la personne qui a trouvé le bug.
 * Réservé aux super-admins (God). Le God choisit un message + un émoji.
 *
 * SECURITY (fail-closed) :
 * - isSuperAdmin() obligatoire
 * - Zod sur les entrées
 * - Vérifie que le signalement existe (`SupportTicket` FEEDBACK/INTERNAL)
 * - Journalise la réponse dans `transcript` (visible par le membre)
 * - Crée une Notification scopée par guilde du membre
 */
const notifyMemberSchema = z.object({
  ticketRef: z.string().trim().min(3).max(32).regex(/^SIG-[0-9A-Za-z-]+$/),
  memberName: z.string().trim().min(1).max(100),
  emoji: z.string().trim().min(1).max(8),
  message: z.string().trim().min(1).max(1000),
});

export async function notifyMemberFeedbackAction(input: {
  ticketRef: string;
  memberName: string;
  emoji: string;
  message: string;
}) {
  const start = Date.now();

  // — Validation Zod
  const parsed = notifyMemberSchema.safeParse(input);
  if (!parsed.success) {
    logger.warn("[Feedback Notify] Validation échouée", { errors: parsed.error.flatten().fieldErrors });
    return { success: false, error: "Données invalides." };
  }
  const data = parsed.data;

  // — Auth + God check
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Authentification requise." };
  const { isSuperAdmin } = await import("./super-admin-actions");
  const isGod = await isSuperAdmin();
  if (!isGod) return { success: false, error: "Accès réservé aux administrateurs." };

  try {
    // — Retrouver le signalement par sa référence publique stable
    const ticket = await db.supportTicket.findUnique({
      where: { publicRef: data.ticketRef },
      select: {
        id: true,
        publicRef: true,
        origin: true,
        creatorUserId: true,
        guildId: true,
        discordGuildId: true,
        description: true,
        transcript: true,
      },
    });
    if (!ticket?.creatorUserId || (ticket.origin !== "FEEDBACK" && ticket.origin !== "INTERNAL")) {
      return { success: false, error: "Signalement introuvable." };
    }

    // — Titre lisible du feedback (on retire le préfixe "[TYPE] " si présent)
    const feedbackTitle = (ticket.description || "Signalement")
      .replace(/^\[[A-Z_]+\]\s*/i, "")
      .trim()
      .slice(0, 120)
      || "Signalement";

    const dashboardGuildId = ticket.discordGuildId ?? undefined;
    // Sans guilde identifiable, `createNotification` est fail-closed et n'écrit rien.
    const guildIdForNotif = dashboardGuildId || ticket.guildId || undefined;
    const publicRef = ticket.publicRef ?? data.ticketRef;

    // — Journal interne : la réponse devient visible dans le tracker du membre
    await db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        transcript: appendMemberReply(
          ticket.transcript,
          buildMemberReplyEntry(data.message, data.emoji, session.user.id),
        ),
      },
    });

    const { createNotification } = await import("./notification-actions");
    await createNotification(
      ticket.creatorUserId,
      "SYSTEM_INFO",
      `${data.emoji} Ton signalement a été remarqué !`,
      `📝 Signalement : ${feedbackTitle}\n\n${data.message}\n\n— Wylan Dev de SigilOS`,
      dashboardGuildId ? `/dashboard/${dashboardGuildId}/tracker?bug=${encodeURIComponent(publicRef)}` : undefined,
      guildIdForNotif,
      "SYSTEM"
    );

    logger.info(`[Feedback Notify] Réponse enregistrée pour ${publicRef}`);
    return { success: true };
  } catch (e: any) {
    logger.error("[Feedback Notify] Échec", { error: e?.message });
    return { success: false, error: "Erreur lors de l'envoi de la notification." };
  } finally {
    logger.debug(`[PERF] notifyMemberFeedbackAction took ${Date.now() - start}ms`);
  }
}

export type MyVisitorFeedbackItem = {
  ref: string;
  description: string;
  status: TrackerStatusValue;
  createdAt: string;
  replies: ReturnType<typeof publicRepliesFromTranscript>;
};

export type MyVisitorFeedbackResult =
  | { success: true; data: MyVisitorFeedbackItem[] }
  | { success: false; error: string };

/**
 * Historique **personnel** d'un visiteur connecté : ses propres signalements,
 * jamais ceux d'un autre compte. Aucune guilde requise.
 */
export async function getMyVisitorFeedbackAction(): Promise<MyVisitorFeedbackResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  try {
    const tickets = await db.supportTicket.findMany({
      where: {
        origin: "FEEDBACK",
        creatorUserId: session.user.id,
        publicRef: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        publicRef: true,
        description: true,
        trackerStatus: true,
        createdAt: true,
        transcript: true,
      },
    });

    return {
      success: true,
      data: tickets.map((ticket) => ({
        ref: ticket.publicRef ?? "",
        description: ticket.description,
        status: ticket.trackerStatus ?? "A_FAIRE",
        createdAt: ticket.createdAt.toISOString(),
        replies: publicRepliesFromTranscript(ticket.transcript),
      })),
    };
  } catch (e: any) {
    logger.error("[Feedback Visiteur] Historique impossible", { error: e?.message });
    return { success: false, error: "Impossible de charger tes signalements." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Salon des captures d'écran — paramétrable côté God (`/god/bugs`)
// ─────────────────────────────────────────────────────────────────────────────

const screenshotChannelSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => value === "" || isDiscordSnowflake(value), {
    message: "Identifiant de salon invalide",
  });

/**
 * Lien public vers le salon des captures — **lecture seule**, aucune session
 * exigée (les surfaces publiques en ont besoin). `null` = aucun salon
 * configuré ou Discord indisponible : l'UI n'affiche alors aucun lien.
 */
export async function getFeedbackScreenshotChannelAction(): Promise<
  ActionResponse<{ url: string | null }>
> {
  const resolved = await resolveFeedbackScreenshotChannel();
  return { success: true, data: { url: resolved?.url ?? null } };
}

/**
 * Enregistre le salon des captures (God uniquement).
 *
 * Fail-closed : le salon doit exister, être un salon textuel et appartenir à
 * un serveur identifiable — sinon rien n'est écrit. Une chaîne vide efface le
 * réglage (l'UI cesse alors d'afficher un lien, jamais une invitation en dur).
 */
export async function setFeedbackScreenshotChannelAction(
  channelId: string
): Promise<ActionResponse<{ url: string | null }>> {
  const { isSuperAdmin } = await import("./super-admin-actions");
  if (!(await isSuperAdmin())) {
    return { success: false, error: "Non autorisé." };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié." };
  }

  const rate = await rateLimit(`feedback:screenshot-channel:${session.user.id}`, 10, 60_000);
  if (!rate.success) {
    return { success: false, error: "Trop de modifications — réessaie dans une minute." };
  }

  const parsed = screenshotChannelSchema.safeParse(channelId);
  if (!parsed.success) {
    return { success: false, error: "Identifiant de salon invalide." };
  }
  const value = parsed.data;

  try {
    if (!value) {
      await db.platformConfig.upsert({
        where: { id: "singleton" },
        update: { questFeedbackChannelId: null },
        create: { id: "singleton", questFeedbackChannelId: null },
      });
      return { success: true, data: { url: null } };
    }

    const validation = await validateFeedbackScreenshotChannel(value);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    await db.platformConfig.upsert({
      where: { id: "singleton" },
      update: { questFeedbackChannelId: value },
      create: { id: "singleton", questFeedbackChannelId: value },
    });

    logger.info("[Feedback] salon des captures enregistré", { actorId: session.user.id });
    return { success: true, data: { url: validation.url } };
  } catch (e: any) {
    logger.error("[Feedback] salon des captures non enregistré", { error: e?.message });
    return { success: false, error: "Enregistrement impossible." };
  }
}