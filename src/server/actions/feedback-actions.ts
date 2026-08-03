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
 * Soumet un feedback depuis les pages « Les Dofus Dofus » (Hub, Détail Dofus, Rush Sylvestre).
 *
 * SECURITY (fail-closed) :
 * - auth() obligatoire
 * - getUserContext(guildId) → refuse si non membre ACTIVE de la guilde
 * - rateLimit Redis (panic → échec, jamais de passage ouvert)
 * - Zod sur toutes les entrées
 * - logger (jamais de console.log en prod)
 *
 * Stockage : SystemIssue (tracker god) + notif web God + (optionnel) embed Discord.
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
      },
    });

    // — Notif web God (dashboard + tracker)
    await notifyGod({
      title: "🎫 Nouveau feedback Dofus",
      message: `#SIG-${created.id} — ${category}`,
      type: "USER_FEEDBACK",
      success: true,
    }).catch((e: any) => logger.error("[Feedback] notifyGod failed", { error: e?.message }));

    // — Embed Discord (canal dédié → fallback godNotify)
    try {
      const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
      const targetChannel = (platformConfig as any)?.questFeedbackChannelId || (platformConfig as any)?.godNotifyChannelId;

      if (targetChannel) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const memberName = userCtx.name || userCtx.pseudoDofus || session.user.name || "Membre";
        const guildName = userCtx.guildName || "Guilde inconnue";

        await sendChannelMessage(
          targetChannel,
          "",
          {
            embedTitle: `${label?.emoji ?? "💬"} Feedback — ${category}`,
            embedDescription: data.description,
            embedColor: isBug ? 0xef4444 : 0x10b981,
            embedFooter: `SigilOS • ${guildName} • par ${memberName}`,
            embedUrl: `${appUrl}/god/bugs`,
            fields: [
              { name: "Type", value: data.feedbackType, inline: true },
              { name: "Page", value: data.sourcePage, inline: true },
              ...(data.targetSlug ? [{ name: "Cible", value: data.targetSlug, inline: true }] : []),
              { name: "Ticket", value: `#SIG-${created.id}`, inline: true },
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