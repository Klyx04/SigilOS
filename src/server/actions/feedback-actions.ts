"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { FEEDBACK_TYPES, FEEDBACK_LABELS } from "@/lib/feedback-types";
import { getUserContext } from "./user-actions";
import { notifyGod } from "./god-notif-actions";
import { sendChannelMessage } from "@/server/discord";

const feedbackSchema = z.object({
  feedbackType: z.enum(FEEDBACK_TYPES),
  description: z.string().trim().min(1, "Décris brièvement ton retour").max(2000, "Maximum 2000 caractères"),
  // Contexte de page (déjà renseigné côté serveur via la page, mais validé)
  sourcePage: z.string().trim().min(1).max(100),
  targetSlug: z.string().trim().max(100).optional().nullable(),
  guildId: z.string().trim().min(1).max(64),
  userAgent: z.string().trim().max(500).optional().nullable(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

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
 * Stockage : SystemIssue (tracker god) + notif web God + (optionnel) embed Discord.
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

  // — Mapper le feedbackType → SystemIssueType
  const isBug = data.feedbackType === "BUG_TECHNIQUE" || data.feedbackType === "ERREUR_DONNEES";
  const type = isBug ? "BUG" : "AMELIORATION";

  // — Catégorie lisible
  const label = FEEDBACK_LABELS[data.feedbackType];
  const category = label?.label ?? "Feedback";

  // — Pseudo Discord (nickname) du signaleur + nom de guilde (avec tag à côté)
  const memberName = userCtx.name || session.user.name || "Membre";
  const memberGuildName = userCtx.guildName || "Guilde inconnue";

  try {
    const created = await db.systemIssue.create({
      data: {
        type: type as any,
        category,
        priority: "Normal",
        description: `[${data.feedbackType}] ${data.description}`,
        creatorId: session.user.id,
        feedbackType: data.feedbackType,
        sourcePage: data.sourcePage,
        targetSlug: data.targetSlug || null,
        guildId: internalGuildId,
        userAgent: data.userAgent || null,
        memberName,
        memberGuildName,
      },
    });

    // — Notif web God (dashboard + tracker)
    await notifyGod({
      title: "🎫 Nouveau feedback Dofus",
      message: `#SIG-${created.id} — ${category} — par ${memberName}`,
      type: "USER_FEEDBACK",
      success: true,
      metadata: { ticketId: created.id, memberName, guild: memberGuildName, type: data.feedbackType },
    }).catch((e: any) => logger.error("[Feedback] notifyGod failed", { error: e?.message }));

    // — Embed Discord (canal dédié → fallback godNotify)
    try {
      const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
      const targetChannel = (platformConfig as any)?.questFeedbackChannelId || (platformConfig as any)?.godNotifyChannelId;

      if (targetChannel) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        await sendChannelMessage(
          targetChannel,
          "",
          {
            embedTitle: `${label?.emoji ?? "💬"} Feedback — ${category}`,
            embedDescription: data.description,
            embedColor: isBug ? 0xef4444 : 0x10b981,
            embedFooter: `${memberName} 🏷️ ${memberGuildName} • SigilOS`,
            embedUrl: `${appUrl}/god/bugs?ticket=${created.id}`,
            fields: [
              { name: "Type", value: data.feedbackType, inline: true },
              { name: "Page", value: data.sourcePage, inline: true },
              ...(data.targetSlug ? [{ name: "Cible", value: data.targetSlug, inline: true }] : []),
              { name: "Ticket", value: `#SIG-${created.id}`, inline: true },
              { name: "Signalé par", value: `${memberName} (${memberGuildName})`, inline: false },
            ],
          }
        ).catch((e: any) => logger.error("[Feedback] Discord embed failed", { error: e?.message }));
      }
    } catch (e: any) {
      logger.error("[Feedback] Discord dispatch failed", { error: e?.message });
    }

    logger.info(`[Feedback] Créé #SIG-${created.id} par ${session.user.id} (${data.sourcePage})`);
    return { success: true, ticketId: created.id };
  } catch (e: any) {
    logger.error("[Feedback] Create failed", { error: e?.message });
    return { success: false, error: "Une erreur est survenue lors de l'envoi. Réessaie." };
  } finally {
    logger.debug(`[PERF] submitQuestFeedbackAction took ${Date.now() - start}ms`);
  }
}

/**
 * Envoie une notification Dashboard (cloche) à la personne qui a trouvé le bug.
 * Réservé aux super-admins (God). Le God choisit un message + un émoji.
 *
 * SECURITY (fail-closed) :
 * - isSuperAdmin() obligatoire
 * - Zod sur les entrées
 * - Vérifie que le SystemIssue existe
 * - Crée une Notification scopée par guilde du membre
 */
const notifyMemberSchema = z.object({
  issueId: z.number().int().positive(),
  memberName: z.string().trim().min(1).max(100),
  emoji: z.string().trim().min(1).max(8),
  message: z.string().trim().min(1).max(1000),
});

export async function notifyMemberFeedbackAction(input: {
  issueId: number;
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
    // — Trouver l'issue + son guildId (guilde d'origine du membre)
    const issue = await db.systemIssue.findUnique({
      where: { id: data.issueId },
      select: { creatorId: true, guildId: true, id: true, memberName: true, memberGuildName: true, description: true, feedbackType: true },
    });
    if (!issue?.creatorId) return { success: false, error: "Bug introuvable." };

    // — Titre lisible du feedback (on retire le préfixe "[TYPE] " si présent)
    const feedbackTitle = (issue.description || "Feedback")
      .replace(/^\[[A-Z_]+\]\s*/i, "")
      .trim()
      .slice(0, 120)
      || "Feedback";

    // — Résoudre le discordGuildId à partir de l'ID interne (pour le lien)
    let discordGuildId: string | undefined;
    if (issue.guildId) {
      const guildConfig = await db.guildConfig.findUnique({
        where: { id: issue.guildId },
        select: { discordGuildId: true },
      });
      discordGuildId = guildConfig?.discordGuildId;
    }

    const { createNotification } = await import("./notification-actions");
    const guildIdForNotif = discordGuildId || issue.guildId || undefined;

    // — Créer la notification Dashboard (scopée par guilde du membre)
    await createNotification(
      issue.creatorId,
      "SYSTEM_INFO",
      `${data.emoji} Ton feedback a été remarqué !`,
      `📝 Feedback :  ${feedbackTitle}\n\n${data.message}\n\n— Wylan Dev de SigilOS`,
      guildIdForNotif ? `/dashboard/${guildIdForNotif}/tracker?bug=SIG-${issue.id}` : undefined,
      guildIdForNotif,
      "SYSTEM"
    );

    logger.info(`[Feedback Notify] God ${session.user.id} a notifié ${issue.creatorId} pour SIG-${issue.id}`);
    return { success: true };
  } catch (e: any) {
    logger.error("[Feedback Notify] Échec", { error: e?.message });
    return { success: false, error: "Erreur lors de l'envoi de la notification." };
  } finally {
    logger.debug(`[PERF] notifyMemberFeedbackAction took ${Date.now() - start}ms`);
  }
}