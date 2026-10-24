import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature } from "@/server/discord";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl } from "@/lib/utils";
import { DOFUS_JOBS, DAYS_OF_WEEK } from "@/lib/dofus-assets";
import { PREFERRED_ACTIVITIES } from "@/lib/profile-activities";
import { normSearch, parseAlmanaxDateInput, frenchLongDate } from "@/lib/slash-command-helpers";
import { PERMISSIONS as PERMISSION_IDS, type PermissionId } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/module-types";
import { resolveInteractionActor } from "@/lib/tickets/interaction-actor";
import type { TicketAuthorizationContext } from "@/lib/tickets/access";
import {
    buildTicketModalSubmittedReply,
    buildTicketOpenRefusal,
    buildTicketOpenedContent,
    buildTicketTunnelReply,
    type TicketStepReply,
} from "@/lib/tickets/journey-dispatch";
import {
    TICKET_PICK_PREFIX,
    parseTicketCustomId,
    isTicketCustomId,
} from "@/lib/tickets/interaction-routing";

// ============================================
// DOFUS CLASSES for Modal validation
// ============================================
const VALID_CLASSES = [
    "Cra", "Ecaflip", "Eliotrope", "Eniripsa", "Enutrof",
    "Féca", "Forgelance", "Huppermage", "Iop", "Osamodas",
    "Ouginak", "Pandawa", "Roublard", "Sacrieur", "Sadida",
    "Sram", "Steamer", "Xélor", "Zobal",
];

// ============================================
// RATE LIMIT (Redis, par utilisateur Discord)
// ============================================
/**
 * Consomme un jeton et renvoie l'attente en **secondes** (`0` = autorisé).
 *
 * Store **Redis** (`rateLimit`, avec son repli mémoire **borné** et purge) : l'ancienne
 * `Map` locale de cette route grandissait sans purge et repartait de zéro à chaque
 * déploiement — deux instances = deux compteurs (règle `AGENTS.md` §5.8).
 */
async function consumeRateLimit(key: string, maxRequests: number, windowMs: number): Promise<number> {
    const result = await rateLimit(`discord-interaction:${key}`, maxRequests, windowMs);
    if (result.success) return 0;
    return Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
}

// ============================================
// HELPERS
// ============================================

async function findUserByDiscordId(discordId: string) {
    return db.account.findFirst({
        where: { provider: "discord", providerAccountId: discordId },
        select: { userId: true },
    });
}

// ============================================
// RBAC DES INTERACTIONS DISCORD (boutons **et** modales)
// ============================================

/**
 * `prefix` d'un `custom_id` → permission RBAC requise.
 *
 * ⚠️ **Cause racine du constat beta du 14/09/2026** (« bouton Offre de l'embed
 * KO : Aucun profil SigilOS dans cette guilde ») : cette carte vivait **dans** la
 * branche `payload.type === 3` (boutons). La soumission de la **modale d'offre**
 * du Marché (`mkt:offer`, `payload.type === 5`) n'était donc **jamais** filtrée,
 * et surtout elle transmettait le **snowflake Discord** (`member.user.id`) au
 * service du module — qui attend l'`User.id` interne (`resolveMemberContext` lit
 * `UserProfile.userId`) ⇒ refus « aucun profil » alors que l'offre fonctionnait
 * depuis le dashboard (session = `User.id`).
 *
 * Ajouter un module Discord : 1) constante dans `lib/permissions.ts`,
 * 2) entrée **ici**, 3) traitement du prefix dans la branche concernée.
 * Propriétaires et admins Discord passent automatiquement
 * (`internalCheckPermission`). `poll` reste **volontairement** absent (son
 * contrôle vit en aval, via le profil SigilOS).
 */
const DISCORD_PERM_MAP: Record<string, PermissionId> = {
    calendar: PERMISSION_IDS.COMMUNITY_ACCESS,   // Calendrier = participation sociale
    songes: PERMISSION_IDS.GAME_OPERATIONS,      // Songes = organisation d'activités
    dj: PERMISSION_IDS.GAME_OPERATIONS,          // Donjons = organisation d'activités
    svc: PERMISSION_IDS.GAME_OPERATIONS,         // Services = organisation d'activités
    mkt: PERMISSION_IDS.MARKET_TRADE,            // Marché = réserver / offrir / contacter
};

/**
 * `prefix` d'un `custom_id` → module God-verrouillable correspondant.
 *
 * `internalCheckPermission` ne teste QUE le verrou God (jamais le toggle guilde),
 * donc cette table doit rester **exacte** : un préfixe absent ne reçoit aucun
 * contrôle de module (on ne devine jamais).
 */
const DISCORD_MODULE_MAP: Record<string, ModuleKey> = {
    calendar: "calendar",
    songes: "songes",
    dj: "donjons",
    svc: "services",
    mkt: "marche",
};

/** Réponse éphémère standard (type 4, `flags: 64`) — visible du seul cliqueur. */
function ephemeralDiscordMessage(content: string): NextResponse {
    return NextResponse.json({ type: 4, data: { content, flags: 64 } });
}

/** Refus éphémère standard (type 4, `flags: 64` — jamais muet, jamais public). */
function ephemeralDiscordRefusal(content: string): NextResponse {
    return ephemeralDiscordMessage(content);
}

/** Textes de refus partagés par les boutons **et** les modales (une source). */
const DISCORD_ACCOUNT_REQUIRED =
    "❌ Tu dois t'être connecté au moins une fois sur le site pour utiliser ce bouton.";
const DISCORD_PERMISSION_DENIED =
    "🚫 Tes rôles Discord ne t'autorisent pas à utiliser cette fonctionnalité. Contacte un admin de ta guilde.";

/**
 * Gate RBAC **commun** aux deux types d'interaction (3 = bouton, 5 = modale).
 *
 * `true` = autorisé. Un `prefix` absent de la carte n'est **pas** filtré ici : on
 * ne devine jamais un droit (chaque branche garde ses propres refus). La clé est
 * résolue **fail-closed** : une permission absente/renommée refuse l'accès.
 */
async function isDiscordPrefixAuthorized(
    prefix: string,
    discordGuildId: string,
    discordUserId: string
): Promise<boolean> {
    const required = DISCORD_PERM_MAP[prefix];
    if (!required) return true;

    const { internalCheckPermission } = await import("@/server/actions/user-actions");
    try {
        return await internalCheckPermission(discordGuildId, discordUserId, required, {
            module: DISCORD_MODULE_MAP[prefix],
        });
    } catch {
        // Fail-closed : Discord/RBAC injoignable ⇒ refus, jamais un accès par défaut.
        return false;
    }
}

/**
 * 🆕 Tickets v2 — **avance d'une étape dans un parcours** et rend la réponse Discord.
 *
 * La route ne décide rien : elle résout (`advanceTicketJourney` — parcours publié/activé,
 * formulaire **figé**, brouillon), traduit (`journey-dispatch`) et crée le ticket quand il
 * n'y a plus rien à demander (`internalHandleTicketCreate`, qui **revalide** les réponses).
 *
 * `handled: false` = aucun parcours de cet identifiant : l'appelant peut alors retomber sur
 * une **catégorie v1**, ce qui garde les panneaux déjà déployés fonctionnels.
 */
async function ticketJourneyInteraction(input: {
    discordGuildId: string;
    discordUserId: string;
    discordUserName: string;
    discordUserAvatar?: string | null;
    panelId?: string;
    journeyId: string;
    advance?: {
        page?: number;
        submitted?: Array<{ customId: string; value: string }>;
        choice?: { fieldId: string; values: unknown };
        resume?: boolean;
    };
    /** Réponse à une **soumission de modale** : Discord interdit d'en ouvrir une autre. */
    afterModalSubmit?: boolean;
}): Promise<{ handled: false } | { handled: true; response: NextResponse }> {
    const { advanceTicketJourney } = await import("@/server/tickets/journey-open");

    const result = await advanceTicketJourney({
        discordGuildId: input.discordGuildId,
        journeyId: input.journeyId,
        discordUserId: input.discordUserId,
        ...(input.advance ?? {}),
    });

    if (!result.ok) {
        // Un identifiant qui n'est pas un parcours : l'appelant essaiera une catégorie v1.
        if (result.code === "NOT_FOUND") return { handled: false };
        return { handled: true, response: ephemeralDiscordMessage(buildTicketOpenRefusal(result.reason)) };
    }

    const { context, step, answers } = result;

    if (step.kind === "open") {
        const { internalHandleTicketCreate } = await import("@/server/actions/ticket-bot-actions");
        const created = await internalHandleTicketCreate({
            discordGuildId: input.discordGuildId,
            discordUserId: input.discordUserId,
            discordUserName: input.discordUserName,
            discordUserAvatar: input.discordUserAvatar,
            panelId: input.panelId ?? "",
            journeyId: context.journey.id,
            formVersionId: context.formVersionId,
            intakeAnswers: answers,
        });

        return {
            handled: true,
            response: ephemeralDiscordMessage(
                created.success && created.channelId
                    ? buildTicketOpenedContent(created.channelId)
                    : buildTicketOpenRefusal(created.error || "Impossible d'ouvrir le ticket.")
            ),
        };
    }

    const reply: TicketStepReply = input.afterModalSubmit
        ? buildTicketModalSubmittedReply({
              step,
              journeyId: context.journey.id,
              journeyName: context.journey.name,
          })
        : buildTicketTunnelReply({
              step,
              panelId: input.panelId,
              journeyId: context.journey.id,
              journeyName: context.journey.name,
          });

    if (reply.kind === "modal") {
        return {
            handled: true,
            response: NextResponse.json({
                type: 9, // MODAL
                data: { custom_id: reply.customId, title: reply.title, components: reply.components },
            }),
        };
    }

    if (reply.kind === "open") {
        // Branche théoriquement inatteignable (l'ouverture est traitée plus haut) : on
        // n'invente pas de ticket en silence, on demande de recliquer.
        return {
            handled: true,
            response: ephemeralDiscordMessage(
                buildTicketOpenRefusal("Ta demande est complète : reclique sur le motif pour l'ouvrir.")
            ),
        };
    }

    return {
        handled: true,
        response: NextResponse.json({
            type: 4, // réponse éphémère : visible du seul membre
            data: { content: reply.content, components: reply.components, flags: 64 },
        }),
    };
}

export async function POST(request: NextRequest) {
    const interactionStartedAt = Date.now();
    let interactionLabel: string | null = null;
    try {
        const bodyText = await request.text();
        const isValid = await verifyDiscordSignature(request, bodyText);

        if (!isValid) {
            // 🚨 Un refus de signature rend **toutes** les commandes muettes côté Discord
            // (« L'application n'a pas répondu »). On garde une trace avec le contexte
            // (jamais le secret lui-même) pour distinguer clé absente / proxy / rejeu.
            logger.warn("[Discord Interaction] signature refusée", {
                hasPublicKey: Boolean(
                    process.env.DISCORD_APPLICATION_PUBLIC_KEY || process.env.DISCORD_PUBLIC_KEY
                ),
                hasTimestamp: Boolean(request.headers.get("x-signature-timestamp")),
                hasSignature: Boolean(request.headers.get("x-signature-ed25519")),
            });
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(bodyText);

        // Étiquette de diagnostic (jamais de contenu utilisateur) : sert à savoir
        // QUELLE interaction dépasse le budget de 3 s.
        const rawCustomId = typeof payload?.data?.custom_id === "string" ? payload.data.custom_id : "";
        interactionLabel =
            payload?.type === 2
                ? `/${String(payload.data?.name ?? "?")}`
                : payload?.type === 3 || payload?.type === 5
                  ? `${payload.type === 3 ? "button" : "modal"}:${rawCustomId.split(":")[0] || "?"}`
                  : `type:${String(payload?.type ?? "?")}`;

        // 1. Handle Ping
        if (payload.type === 1) {
            return NextResponse.json({ type: 1 });
        }

        // 2. Handle Component Interaction (Button click)
        if (payload.type === 3) {
            const { custom_id } = payload.data;
            const { guild_id } = payload;

            // 🆕 Refonte Tickets v2 — le sondage CSAT arrive par **message privé** : Discord
            // n'envoie alors **pas** `member` (doc : `user` = « *if invoked in a DM* »).
            // L'ancien code lisait `member.user.id` sans repli ⇒ `TypeError` ⇒ HTTP 500.
            // On normalise l'acteur **avant tout usage**, puis on garde un `member` de
            // repli pour le reste de la route (rôles vides, aucune permission devinée).
            const actor = resolveInteractionActor(payload as never);
            if (!actor) {
                return ephemeralDiscordMessage("❌ Interaction non identifiable.");
            }
            const discordUserId = actor.discordUserId;
            const member = payload.member ?? {
                user: {
                    id: actor.discordUserId,
                    username: actor.displayName,
                    global_name: actor.displayName,
                    avatar: actor.avatar,
                },
                roles: [],
                permissions: null,
            };

            // Rate limit: 10 interactions per 60s per discord user
            if ((await consumeRateLimit(`interaction:${discordUserId}`, 10, 60_000)) > 0) {
                return NextResponse.json({
                    type: 4,
                    data: { content: "⏳ Tu fais trop de requêtes. Réessaie dans quelques secondes.", flags: 64 },
                });
            }

            const [prefix, action, entityId, extra] = custom_id.split(":");
            // #26 multi-donjons : custom_id = dj:join:{postId}:{idx} → index du donjon
            const dungeonIndex = extra !== undefined && extra !== "" ? Number(extra) : undefined;

            // Les tickets (v1 `ticket:`, v2 `tb:` et `tb_pick:`) et les rôles-réactions (`rr:`)
            // ne requièrent aucun compte SigilOS (un candidat ou visiteur doit pouvoir postuler/ouvrir un ticket).
            const isTicketInteraction = isTicketCustomId(custom_id) || prefix === "ticket";
            const account = await findUserByDiscordId(member.user.id);
            if (!account && !isTicketInteraction && prefix !== "rr") {
                return ephemeralDiscordRefusal(DISCORD_ACCOUNT_REQUIRED);
            }

            // RBAC Permission Gate — carte **unique** `DISCORD_PERM_MAP` (portée
            // module) partagée avec les soumissions de modale (`type === 5`) :
            // même gate, même texte, aucune règle dupliquée (§13.4).
            if (!(await isDiscordPrefixAuthorized(prefix, guild_id, member.user.id))) {
                return ephemeralDiscordRefusal(DISCORD_PERMISSION_DENIED);
            }

            let result;

            // Menu « Choisir ma classe… » (String Select, component_type 3) — coexiste
            // avec les boutons S'inscrire / Se désinscrire : choisir une classe =
            // s'inscrire avec cette classe, ou mettre à jour la sienne si déjà inscrit.
            // custom_id : dj:class:<postId>[:idx] | songes:class:<runId> | calendar:class:<eventId>
            if (action === "class") {
                const chosen = (payload.data?.values?.[0] || "").toString();
                const matched = VALID_CLASSES.find((c) => c.toLowerCase() === chosen.toLowerCase());
                if (!matched) {
                    return ephemeralDiscordMessage("❌ Classe inconnue. Choisis une classe dans la liste.");
                }

                if (prefix === "dj") {
                    const djKey = `dj:${member.user.id}:${entityId}`;
                    const waitSecs = await consumeRateLimit(djKey, 3, 30_000);
                    if (waitSecs > 0) {
                        return ephemeralDiscordMessage(`⏳ Doucement ! Réessaie dans **${waitSecs}s**.`);
                    }
                    const post = await (db as any).djSearchPost.findUnique({
                        where: { id: entityId },
                        select: { id: true, status: true, guildId: true },
                    });
                    if (!post) return ephemeralDiscordMessage("❌ Ce groupe n'existe plus ou a expiré.");
                    if (post.status !== "OPEN" && post.status !== "FULL") {
                        return ephemeralDiscordMessage("❌ Ce groupe est fermé.");
                    }
                    const profile = await db.userProfile.findFirst({
                        where: { userId: account!.userId, guildId: post.guildId },
                    });
                    if (!profile) {
                        return ephemeralDiscordMessage("❌ Tu n'es pas membre de cette guilde sur SigilOS.");
                    }
                    const { updateDjParticipantClass, internalJoinDjPost } = await import("@/server/actions/dungeon-finder-actions");
                    const upd = await updateDjParticipantClass(guild_id, entityId, profile.id, dungeonIndex, matched);
                    if (!upd.success) return ephemeralDiscordMessage(`❌ ${upd.error || "Impossible de changer de classe."}`);
                    if (upd.data?.updated) {
                        return ephemeralDiscordMessage(`✅ Ta classe est maintenant **${matched}** !`);
                    }
                    const res = await internalJoinDjPost(entityId, profile.id, account!.userId, dungeonIndex, matched, "");
                    if (!res.success) return ephemeralDiscordMessage(`❌ ${res.error || "Impossible de rejoindre le groupe."}`);
                    const wasWaitlisted = (res as any).data?.waitlisted;
                    return ephemeralDiscordMessage(wasWaitlisted
                        ? `⏳ Tu es en **file d'attente** ! Classe : **${matched}**. Le créateur sera notifié.`
                        : `✅ Tu as rejoint le groupe ! Classe : **${matched}**\nRetrouve les détails sur le site.`);
                }

                if (prefix === "songes") {
                    const { updateRunCandidateClass, processRunJoin } = await import("@/server/songes-service");
                    const upd = await updateRunCandidateClass(guild_id, entityId, account!.userId, matched);
                    if (!upd.success) return ephemeralDiscordMessage(`❌ ${upd.error || "Erreur inconnue"}`);
                    if (upd.updated) {
                        return ephemeralDiscordMessage(`✅ Ta classe est maintenant **${matched}** !`);
                    }
                    const res = await processRunJoin(guild_id, entityId, account!.userId, matched, "Inscription via le menu classe Discord");
                    if (res?.success) {
                        return ephemeralDiscordMessage(`✅ Candidature envoyée ! Classe : **${matched}**\n\nLe leader de la run sera notifié.`);
                    }
                    return ephemeralDiscordMessage(`❌ ${res?.error || "Erreur inconnue"}`);
                }

                if (prefix === "calendar") {
                    // Fenêtre « Mes personnages » : le champ est **pré-rempli** avec le
                    // personnage principal du profil, les classes secondaires sont rappelées
                    // juste en dessous. L'application (mise à jour si déjà inscrit, sinon
                    // inscription) suit exactement l'ancien chemin — voir `calendar:class-apply`.
                    // Aucun bouton en plus : le select existant reste le seul point d'entrée.
                    const guildConfig = await db.guildConfig.findUnique({
                        where: { discordGuildId: guild_id },
                        select: { id: true },
                    });
                    const profile = guildConfig
                        ? await db.userProfile.findFirst({
                            where: { userId: account!.userId, guildId: guildConfig.id },
                            select: { classe: true, classeSecondaires: true },
                        })
                        : null;
                    const mainClass = (profile?.classe || "").trim().slice(0, 30);
                    const secondaries = Array.isArray(profile?.classeSecondaires)
                        ? (profile!.classeSecondaires as unknown[])
                            .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
                            .slice(0, 6)
                            .join(", ")
                        : "";
                    const roster = [mainClass, secondaries].filter(Boolean).join(", ").slice(0, 100);

                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `calendar:class-apply:${entityId}`,
                            title: "🎭 Mes personnages",
                            components: [
                                {
                                    type: 1, // Action Row
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "classe",
                                            label: "Ta classe pour cet événement",
                                            style: 1, // Short
                                            placeholder: roster
                                                ? `Mes personnages : ${roster}`.slice(0, 100)
                                                : "Ex: Cra, Iop, Eniripsa...",
                                            required: true,
                                            min_length: 2,
                                            max_length: 30,
                                            ...(mainClass ? { value: mainClass } : {}),
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                }

                return ephemeralDiscordMessage("❌ Menu non pris en charge ici.");
            }

            if (prefix === "calendar") {
                // Inscriptions aux événements. Trois garanties tenues ici :
                //  1. le cliqueur reçoit toujours un message **explicite** — une réponse
                //     visible. L'ancien `type: 6` (ACK muet) laissait un « bien inscrit »
                //     absent, le défer non résolu côté client (« Le message n'a pas pu être
                //     chargé ») et aucun compteur ;
                //  2. le compteur annoncé vient du service, qui a **attendu** le PATCH de
                //     l'embed (borné) avant de répondre : plus d'embed périmé silencieux ;
                //  3. « S'inscrire » ouvre une **modale** (classe facultative + message) :
                //     l'inscription part avec sa classe en UNE fois, au lieu d'un pseudo
                //     « Sans classe » que le menu select complétait après coup (constat
                //     beta du 19/09/2026).
                const { processUnregistration } = await import("@/server/calendar-service");
                const { buildCalendarInteractionFeedback } = await import("@/lib/calendar-interaction-feedback");

                if (action === "join") {
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `calendar:apply:${entityId}`,
                            title: "🎫 Inscription à l'événement",
                            components: [
                                {
                                    type: 1, // Action Row
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "classe",
                                            label: "Ta classe Dofus (facultatif)",
                                            style: 1, // Short
                                            placeholder: "Ex: Cra — laisse vide si peu importe",
                                            required: false,
                                            max_length: 30,
                                        },
                                    ],
                                },
                                {
                                    type: 1, // Action Row
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "message",
                                            label: "Message (facultatif)",
                                            style: 2, // Paragraph
                                            placeholder: "Ex: dispo dès 21h, stuff full stuff",
                                            required: false,
                                            max_length: 200,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                }

                if (action === "leave") {
                    const outcome = await processUnregistration(guild_id, entityId, account!.userId);
                    return ephemeralDiscordMessage(buildCalendarInteractionFeedback("leave", outcome));
                }

                return ephemeralDiscordMessage("❌ Action calendrier inconnue.");
            } else if (prefix === "songes") {
                if (action === "join") {
                    // Open a Modal for class selection + optional message
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `songes:apply:${entityId}`,
                            title: "📩 Candidature Run Songes",
                            components: [
                                {
                                    type: 1, // Action Row
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "classe",
                                            label: "Ta classe Dofus",
                                            style: 1, // Short
                                            placeholder: "Ex: Cra, Iop, Eniripsa...",
                                            required: true,
                                            min_length: 2,
                                            max_length: 30,
                                        },
                                    ],
                                },
                                {
                                    type: 1, // Action Row 
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "message",
                                            label: "Message (optionnel)",
                                            style: 2, // Paragraph
                                            placeholder: "Ex: Cra opti dispo 21h",
                                            required: false,
                                            max_length: 200,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "leave") {
                    const { processRunLeave } = await import("@/server/songes-service");
                    result = await processRunLeave(guild_id, entityId, account!.userId);
                }
            } else if (prefix === "poll") {
                if (action === "vote") {
                    // Find the internal guild config by discordGuildId (guild_id)
                    const { processPollVote } = await import("@/server/actions/poll-actions");
                    const guild = await (db as any).guildConfig.findFirst({
                        where: {
                            OR: [{ id: guild_id }, { discordGuildId: guild_id }],
                        },
                        select: { id: true },
                    });

                    if (!guild) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Guilde introuvable sur SigilOS.", flags: 64 },
                        });
                    }

                    const profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: account!.userId, guildId: guild.id } }
                    });

                    if (!profile) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 },
                        });
                    }

                    result = await processPollVote(guild_id, profile.id, entityId, account!.userId);

                    if (result.success) {
                        const actionLabel = result.data?.action === "voted" ? "enregistré" : "retiré";
                        return NextResponse.json({
                            type: 4,
                            data: { content: `✅ Ton vote a été ${actionLabel} avec succès !`, flags: 64 },
                        });
                    }
                }
            } else if (prefix === "dj") {
                // Rate limit spécifique DJ : 3 actions (join/leave) par post par user / 30s
                const djKey = `dj:${member.user.id}:${entityId}`;
                const waitSecs = await consumeRateLimit(djKey, 3, 30_000);
                if (waitSecs > 0) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `⏳ Doucement ! Réessaie dans **${waitSecs}s**.`, flags: 64 },
                    });
                }

                if (action === "apply") {
                    // #169 — bouton « S'inscrire » : ouvre une modal Discord avec choix de classe.
                    // Le submit reviendra en type 5 avec custom_id dj:join:{postId}[:{idx}].
                    const modalCustomId = `dj:join:${entityId}${dungeonIndex !== undefined ? `:${dungeonIndex}` : ""}`;
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: modalCustomId,
                            title: "⚔️ Inscription au groupe",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4, // Text Input
                                            custom_id: "classe",
                                            label: "Ta classe Dofus",
                                            style: 1, // Short
                                            placeholder: "Ex: Cra, Iop, Eniripsa...",
                                            required: true,
                                            min_length: 2,
                                            max_length: 30,
                                        },
                                    ],
                                },
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "message",
                                            label: "Message (optionnel)",
                                            style: 2, // Paragraph
                                            placeholder: "Ex: Cra opti dispo ce soir",
                                            required: false,
                                            max_length: 200,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                }

                if (action === "join" || action === "leave") {
                    // Récupérer le post pour obtenir le guildId Prisma interne (≠ Discord guild_id snowflake)
                    const post = await (db as any).djSearchPost.findUnique({
                        where: { id: entityId },
                        select: { id: true, status: true, guildId: true },
                    });

                    if (!post) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Ce groupe n'existe plus ou a expiré.", flags: 64 },
                        });
                    }

                    if (post.status !== "OPEN" && post.status !== "FULL") {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Ce groupe est fermé.", flags: 64 },
                        });
                    }

                    // Chercher le profil via post.guildId (CUID Prisma), PAS via guild_id (Discord snowflake)
                    const profile = await db.userProfile.findFirst({
                        where: { userId: account!.userId, guildId: post.guildId },
                    });

                    if (!profile) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 },
                        });
                    }

                if (action === "join") {
                    // Rétro-compatibilité: les anciens embeds avaient dj:join direct.
                    // On ouvre maintenant la modal (comme dj:apply) pour recueillir la classe.
                    const modalCustomId = `dj:join:${entityId}${dungeonIndex !== undefined ? `:${dungeonIndex}` : ""}`;
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: modalCustomId,
                            title: "⚔️ Inscription au groupe",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "classe",
                                            label: "Ta classe Dofus",
                                            style: 1,
                                            placeholder: "Ex: Cra, Iop, Eniripsa...",
                                            required: true,
                                            min_length: 2,
                                            max_length: 30,
                                        },
                                    ],
                                },
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "message",
                                            label: "Message (optionnel)",
                                            style: 2,
                                            placeholder: "Ex: Cra opti dispo ce soir",
                                            required: false,
                                            max_length: 200,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "leave") {
                    const { internalLeaveDjPost } = await import("@/server/actions/dungeon-finder-actions");
                    result = await internalLeaveDjPost(entityId, profile.id);

                    if (result?.success) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "👋 Tu as quitté le groupe.", flags: 64 },
                        });
                    }
                }
            }
            } else if (prefix === "svc") {
                if (action === "contact") {
                    const { internalContactService } = await import("@/server/actions/service-actions");
                    result = await internalContactService(entityId, "", account!.userId);

                    if (result?.success && result.data) {
                        const lines = [`📩 **Prestataire :** ${result.data.pseudo}`];
                        if (result.data.contactMethod) lines.push(`📌 **Contact :** ${result.data.contactMethod}`);
                        lines.push(`\n_Envoie-lui un MP Discord ou en jeu pour organiser le service !_`);
                        return NextResponse.json({
                            type: 4,
                            data: { content: lines.join("\n"), flags: 64 },
                        });
                    }
                } else if (action === "reply") {
                    const parts = custom_id.split(":");
                    const requesterUserId = parts[2];
                    const listingId = parts[3];

                    const listing = await db.serviceListing.findUnique({
                        where: { id: listingId },
                        select: { profile: { select: { userId: true } } }
                    });

                    if (!listing) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Ce service n'existe plus.", flags: 64 },
                        });
                    }

                    if (listing.profile.userId !== account!.userId) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Seul le prestataire de ce service peut répondre à la demande.", flags: 64 },
                        });
                    }

                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `svc:submit_reply:${requesterUserId}:${listingId}`,
                            title: "💬 Répondre au client",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "reply_message",
                                            label: "Votre message",
                                            style: 2, // Paragraph style
                                            placeholder: "Ex: Salut ! C'est d'accord pour ce soir 21h ! MP moi en jeu.",
                                            required: true,
                                            min_length: 5,
                                            max_length: 500,
                                        }
                                    ]
                                }
                            ]
                        }
                    });
                } else if (action === "close") {
                    const requestId = entityId;
                    if (!requestId) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Identifiant de demande manquant.", flags: 64 },
                        });
                    }

                    const { closeServiceRequestAction } = await import("@/server/actions/service-actions");
                    const res = await closeServiceRequestAction(guild_id, requestId);

                    if (res.success) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "✅ **Demande clôturée avec succès !** Une notification et une invitation à évaluer la prestation ont été transmises au client.",
                                flags: 64,
                            },
                        });
                    } else {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ ${res.error || "Impossible de clôturer la demande."}`, flags: 64 },
                        });
                    }
                } else if (action === "cancel") {
                    const requestId = entityId;
                    if (!requestId) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Identifiant de demande manquant.", flags: 64 },
                        });
                    }

                    const { cancelServiceRequestAction } = await import("@/server/actions/service-actions");
                    const res = await cancelServiceRequestAction(guild_id, requestId, member.user.id);

                    if (res.success) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "🗑️ **Demande de service annulée avec succès !** Le message a été retiré.",
                                flags: 64,
                            },
                        });
                    } else {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `❌ ${res.error || "Impossible d'annuler la demande."}`, flags: 64 },
                        });
                    }
                }
            } else if (prefix === "userreq") {
                if (action === "reply") {
                    // Sollicitation : ouvrir une modale de réponse — réservée au membre sollicité.
                    const notificationId = entityId;
                    const notif = await db.notification.findUnique({ where: { id: notificationId } });
                    const gcfg = await db.guildConfig.findUnique({ where: { discordGuildId: guild_id }, select: { id: true } });

                    if (!notif || !gcfg || notif.guildId !== gcfg.id || notif.userId !== account!.userId) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Seul le membre sollicité peut répondre à cette demande.", flags: 64 },
                        });
                    }

                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `userreq:submit_reply:${notificationId}`,
                            title: "💬 Répondre à la sollicitation",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "reply_message",
                                            label: "Votre message",
                                            style: 2, // Paragraph style
                                            placeholder: "Ex: Salut ! Je suis dispo ce soir, envoie-moi un MP en jeu.",
                                            required: true,
                                            min_length: 5,
                                            max_length: 500,
                                        }
                                    ]
                                }
                            ]
                        }
                    });
                }
            } else if (prefix === "validate") {
                // =========================================================
                // VALIDATE / REJECT — Mission, Achievement, KamaDonation
                // custom_id: validate:{type}:{entityId}:{discordGuildId}
                //         or validate:{type}_reject:{entityId}:{discordGuildId}
                // =========================================================
                const isReject = action.endsWith("_reject");
                const entityType = isReject ? action.replace("_reject", "") : action; // "mission" | "achievement" | "kama"
                // custom_id format: validate:{type}[:_reject]:{entityId}:{discordGuildId}
                const parts = custom_id.split(":");
                const entityId = parts[2];
                const targetGuildId = parts[3];

                // Permission check (MISSIONS_VALIDATE required)
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                const isValidator = await internalCheckPermission(targetGuildId, member.user.id, PERMISSIONS.MISSIONS_OFFICER, { module: "missions" });
                if (!isValidator) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "🚫 Tu n'as pas la permission de valider des preuves.", flags: 64 },
                    });
                }

                // ACK immediately (defer update) — gives us 15 min to respond
                // We'll use type 7 (update message) after processing

                const { internalValidateMissionSubmission, internalReviewKamaDonation } =
                    await import("@/server/actions/discord-validation-actions");

                let resultMsg = "";
                const adminTag = `${member.user.username}`;

                if (entityType === "mission") {
                    const status = isReject ? "REJECTED" : "VALIDATED";
                    const res = await internalValidateMissionSubmission(entityId, status, targetGuildId, member.user.id);
                    if (res.success) {
                        resultMsg = isReject
                            ? `❌ Mission **refusée** par ${adminTag} — Membre: **${res.memberName}** — **${res.missionTitle}**`
                            : `✅ Mission **validée** par ${adminTag} — Membre: **${res.memberName}** — **${res.missionTitle}**`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else if (entityType === "kama") {
                    const action_kama = isReject ? "REJECT" : "VALIDATE";
                    const res = await internalReviewKamaDonation(entityId, action_kama, targetGuildId, member.user.id);
                    if (res.success) {
                        const amountStr = res.amount?.toLocaleString("fr-FR") ?? "?";
                        resultMsg = isReject
                            ? `❌ Don **refusé** par ${adminTag} — Membre: **${res.memberName}** — ${amountStr} kamas`
                            : `✅ Don **validé** par ${adminTag} — Membre: **${res.memberName}** — ${amountStr} kamas`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else if (entityType === "reactivation") {
                    // custom_id format: validate:reactivation:{action}:{profileId}:{guildId}
                    // where action is "approve" or "reject"
                    // The standard parts[2] = "approve"|"reject" (not the entity ID)
                    // For reactivation, entityId is at parts[3] and guildId at parts[4]
                    const reactivationProfileId = parts[3];
                    const reactivationGuildId = parts[4];
                    
                    const status = isReject ? "ARCHIVED" : "ACTIVE";
                    const { internalUpdateMemberProfileStatus } = await import("@/server/actions/user-actions");
                    
                    try {
                        await internalUpdateMemberProfileStatus(
                            reactivationProfileId, 
                            status, 
                            isReject ? "REACTIVATION_REJECTED" : "REACTIVATION_APPROVED",
                            undefined,
                            undefined,
                            member.user.id
                        );

                        // Also 🔔 send lifecycle notification if approved
                        if (!isReject) {
                            try {
                                const { reactivateProfileByAdmin } = await import("@/server/actions/lifecycle-actions");
                                await reactivateProfileByAdmin(reactivationGuildId, reactivationProfileId, "Approbation via Discord");
                            } catch (_) { /* notification is best-effort */ }
                        }

                        resultMsg = isReject
                            ? `❌ Demande de **réintégration refusée** par ${adminTag}`
                            : `✅ Demande de **réintégration validée** par ${adminTag}`;
                    } catch (err: any) {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${err.message}`, flags: 64 } });
                    }
                } else if (entityType === "achievement") {
                    const action_ach = isReject ? "REJECT" : "VALIDATE";
                    const { internalReviewAchievementSubmission } = await import("@/server/actions/discord-validation-actions");
                    const res = await internalReviewAchievementSubmission(entityId, action_ach, targetGuildId, member.user.id);
                    if (res.success) {
                        const pointsStr = res.points?.toLocaleString("fr-FR") ?? "?";
                        resultMsg = isReject
                            ? `❌ Succès **refusé** par ${adminTag} — Membre: **${res.memberName}** — ${pointsStr} pts`
                            : `✅ Succès **validé** par ${adminTag} — Membre: **${res.memberName}** — ${pointsStr} pts`;
                    } else {
                        return NextResponse.json({ type: 4, data: { content: `❌ Erreur: ${res.error}`, flags: 64 } });
                    }
                } else {
                    return NextResponse.json({ type: 4, data: { content: "Type de validation inconnu.", flags: 64 } });
                }

                // Réponse éphémère à l'admin (l'embed a été supprimé par internalValidate*)
                // Garantie fail-safe : suppression explicite du message cliqué si présent
                const interactionChannelId = payload.channel_id || payload.message?.channel_id;
                const interactionMessageId = payload.message?.id;
                if (interactionChannelId && interactionMessageId) {
                    try {
                        const { deleteChannelMessage } = await import("@/server/discord");
                        await deleteChannelMessage(interactionChannelId, interactionMessageId);
                    } catch (_) {
                        // Best-effort (peut avoir déjà été supprimé par internalValidate*)
                    }
                }

                return NextResponse.json({
                    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE (éphémère)
                    data: {
                        content: resultMsg,
                        flags: 64, // EPHEMERAL — visible uniquement par l'admin qui a cliqué
                        components: [],
                    },
                });

            } else if (prefix === TICKET_PICK_PREFIX) {
                // =========================================================
                // 🆕 TICKETS v2 — ÉTAPE DES CHOIX (`tb_pick:{parcours}:{champ}[:yes|no]`)
                // Une modale Discord ne transporte que des champs texte : les Oui/Non et les
                // listes se répondent donc **avant**, par des boutons et des menus.
                // =========================================================
                const descriptor = parseTicketCustomId(custom_id);
                if (!descriptor || descriptor.kind !== "pick" || !descriptor.journeyId || !descriptor.fieldId) {
                    return ephemeralDiscordRefusal("❌ Ce bouton n'est plus valide.");
                }

                const choice = await ticketJourneyInteraction({
                    discordGuildId: guild_id,
                    discordUserId: member.user.id,
                    discordUserName: member.user.global_name || member.user.username,
                    discordUserAvatar: member.user.avatar,
                    journeyId: descriptor.journeyId,
                    advance: {
                        choice: {
                            fieldId: descriptor.fieldId,
                            // Bouton Oui/Non = une valeur ; menu = les valeurs sélectionnées.
                            values: descriptor.value ? [descriptor.value] : payload.data?.values ?? [],
                        },
                    },
                });

                if (!choice.handled) return ephemeralDiscordRefusal("❌ Ce parcours n'existe plus.");
                return choice.response;
            } else if (prefix === "ticket") {
                // =========================================================
                // TICKET SYSTEM V2 — 2-step flow: Select Menu → Adapted Modal
                // =========================================================
                if (action === "open") {
                    // RATE LIMIT: 1 ticket every 10 seconds per user
                    const waitSec = await consumeRateLimit(`ticket:${member.user.id}`, 1, 10_000);
                    if (waitSec > 0) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: `⏳ Vous avez atteint la limite. Réessayez dans **${waitSec}s**.`, flags: 64 },
                        });
                    }
                    // Step 1: Send ephemeral message with category Select Menu
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "🎫 **Ouvrir un ticket** — Choisissez la catégorie qui correspond à votre demande :",
                            flags: 64, // EPHEMERAL
                            components: [
                                {
                                    type: 1, // ACTION_ROW
                                    components: [
                                        {
                                            type: 3, // STRING_SELECT
                                            custom_id: `ticket:select:${entityId}`,
                                            placeholder: "Sélectionnez une catégorie...",
                                            min_values: 1,
                                            max_values: 1,
                                            options: [
                                                {
                                                    label: "Demande d'accès",
                                                    value: "ACCESS_REQUEST",
                                                    description: "Rejoindre SigilOS pour votre guilde",
                                                    emoji: { name: "🔑" },
                                                },
                                                {
                                                    label: "Signaler un bug",
                                                    value: "BUG_REPORT",
                                                    description: "Un problème sur le dashboard ou le bot",
                                                    emoji: { name: "🐛" },
                                                },
                                                {
                                                    label: "Proposer une feature",
                                                    value: "FEATURE_REQUEST",
                                                    description: "Suggérer une amélioration",
                                                    emoji: { name: "💡" },
                                                },
                                                {
                                                    label: "Autre / Question",
                                                    value: "OTHER",
                                                    description: "Question générale",
                                                    emoji: { name: "📩" },
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "select") {
                    // Step 2: User selected a category from dropdown → open adapted modal
                    const selectedCategory = payload.data?.values?.[0] || "OTHER";

                    const categoryLabels: Record<string, string> = {
                        ACCESS_REQUEST: "🔑 Demande d'accès",
                        BUG_REPORT: "🐛 Signaler un bug",
                        FEATURE_REQUEST: "💡 Proposer une feature",
                        OTHER: "📩 Autre demande",
                    };

                    // [DUP-CHECK] Verify user doesn't have an active ticket in this category
                    const existingTicket = await db.supportTicket.findFirst({
                        where: {
                            creatorDiscordId: member.user.id,
                            category: selectedCategory as any,
                            status: { not: "CLOSED" },
                        },
                        select: { ticketNumber: true }
                    });

                    if (existingTicket) {
                        return NextResponse.json({
                            type: 4,
                            data: { 
                                content: `⚠️ Tu as déjà un ticket ouvert pour la catégorie **${categoryLabels[selectedCategory] || selectedCategory}**.\n\nFerme ton ticket **#${existingTicket.ticketNumber}** avant d'en ouvrir un nouveau.`, 
                                flags: 64 
                            },
                        });
                    }

                    // Build modal fields based on category
                    const modalComponents: any[] = [];

                    if (selectedCategory === "ACCESS_REQUEST") {
                        // Discord modals allow max 5 action rows
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "discord_guild_id",
                                    label: "ID de votre serveur Discord",
                                    style: 1, placeholder: "Ex: 1234567890123456789 (17-20 chiffres)",
                                    required: true, min_length: 17, max_length: 20,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "guild_name",
                                    label: "Nom de votre guilde Dofus",
                                    style: 1, placeholder: "Uniquement des lettres (Ex: Les Gardiens)",
                                    required: true, min_length: 2, max_length: 50,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "pseudo_dofus",
                                    label: "Votre pseudo Dofus",
                                    style: 1, placeholder: "Uniquement des lettres (Ex: Klyx)",
                                    required: true, min_length: 2, max_length: 30,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "member_count",
                                    label: "Nombre de membres",
                                    style: 1, placeholder: "Entre 1 et 350 (chiffres uniquement)",
                                    required: true, min_length: 1, max_length: 3,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Pourquoi souhaitez-vous utiliser SigilOS ?",
                                    style: 2, placeholder: "Décrivez brièvement votre guilde et vos besoins...",
                                    required: true, min_length: 10, max_length: 1000,
                                }],
                            },
                        );
                    } else if (selectedCategory === "BUG_REPORT") {
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Description courte du bug",
                                    style: 1, placeholder: "Ex: Les missions ne s'affichent plus",
                                    required: true, min_length: 5, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "page",
                                    label: "Page / Fonctionnalité concernée",
                                    style: 1, placeholder: "Ex: Dashboard > Missions, Bot Discord, Landing page...",
                                    required: true, min_length: 3, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Étapes pour reproduire + détails",
                                    style: 2, placeholder: "1. Je clique sur...\n2. Je vois...\n3. Comportement attendu vs réel",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    } else if (selectedCategory === "FEATURE_REQUEST") {
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Titre de la fonctionnalité",
                                    style: 1, placeholder: "Ex: Système de classement PvP",
                                    required: true, min_length: 5, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Description détaillée de votre idée",
                                    style: 2, placeholder: "Décrivez la fonctionnalité, son utilité, et comment vous l'imaginez...",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    } else {
                        // OTHER
                        modalComponents.push(
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "subject",
                                    label: "Sujet",
                                    style: 1, placeholder: "De quoi s'agit-il ?",
                                    required: true, min_length: 3, max_length: 100,
                                }],
                            },
                            {
                                type: 1,
                                components: [{
                                    type: 4, custom_id: "description",
                                    label: "Votre message",
                                    style: 2, placeholder: "Détaillez votre demande...",
                                    required: true, min_length: 10, max_length: 1500,
                                }],
                            },
                        );
                    }

                    const categoryTitles: Record<string, string> = {
                        ACCESS_REQUEST: "🔑 Demande d'accès",
                        BUG_REPORT: "🐛 Signaler un bug",
                        FEATURE_REQUEST: "💡 Proposer une feature",
                        OTHER: "📩 Autre demande",
                    };

                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `ticket:create:${entityId}:${selectedCategory}`,
                            title: categoryTitles[selectedCategory] || "📩 Ticket",
                            components: modalComponents,
                        },
                    });
                } else if (action === "close") {
                    // ACK immediately (Deferred update) — nécessaire dans les 3s
                    const response = NextResponse.json({ type: 6 });

                    const { editInteractionMessage } = await import("@/server/discord");
                    const { closeSupportTicket } = await import("@/server/actions/ticket-actions");

                    // Exécution en arrière-plan MAIS avec follow-up : l'échec n'est plus silencieux,
                    // le cliqueur voit le résultat (fermé et archivé, ou l'erreur).
                    closeSupportTicket(
                        entityId,
                        member.user.id,
                        member.user.global_name || member.user.username
                    )
                        .then((result) => {
                            const content = result?.success
                                ? "✅ Ticket fermé — fil Discord archivé."
                                : `❌ ${result?.error || "Échec de la fermeture du ticket."}`;
                            return editInteractionMessage(payload.application_id, payload.token, content);
                        })
                        .catch(async (err) => {
                            const { logger } = await import("@/lib/logger");
                            logger.error("[Tickets] Discord close error", { error: err, ticketId: entityId });
                            return editInteractionMessage(
                                payload.application_id,
                                payload.token,
                                "❌ Une erreur est survenue lors de la fermeture du ticket."
                            );
                        });

                    return response;
                }
            } else if (prefix === "rr") {
                // =========================================================
                // REACTION ROLES INTERACTION (Buttons or Select Menu)
                // custom_id = rr:btn:{groupId}:{optionId}
                // custom_id = rr:select:{groupId}
                // =========================================================
                const { internalHandleReactionRoleInteraction } = await import("@/server/actions/reaction-role-actions");

                let result;
                if (action === "select") {
                    const selectedRoleIds = payload.data?.values || [];
                    result = await internalHandleReactionRoleInteraction({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        groupId: entityId,
                        selectedRoleIds,
                    });
                } else {
                    // action === "btn" -> entityId is groupId, extra is optionId
                    result = await internalHandleReactionRoleInteraction({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        groupId: entityId,
                        optionId: extra,
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        content: result.message,
                        flags: 64, // EPHEMERAL
                    },
                });
            } else if (prefix === "tb") {
                // =========================================================
                // TICKET BOT INTERACTION (Buttons, Select Menus)
                // custom_id = tb:open:{panelId}:{journeyOuCategorieId}
                // custom_id = tb:select_open:{panelId}
                // custom_id = tb:claim:{ticketId} · tb:note: · tb:rename: · tb:close:
                // custom_id = tb:csat:{ticketId}:{rating}
                //
                // 🆕 Refonte v2 — le préfixe `tb` n'est **pas** dans `DISCORD_PERM_MAP`
                // (une carte par préfixe ne sait pas distinguer « ouvrir » de « fermer ») :
                // l'autorisation est donc construite **ici**, une fois, puis vérifiée par
                // chaque handler via `decideTicketAccess` (fail-closed).
                // =========================================================
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const ticketActorContext = {
                    discordUserId: actor.discordUserId,
                    discordUserName: actor.displayName,
                    discordUserRoleIds: actor.roleIds,
                    discordUserIsAdmin: actor.isGuildAdmin,
                    hasStaffPermission: await internalCheckPermission(
                        guild_id,
                        actor.discordUserId,
                        PERMISSION_IDS.STAFF_TICKETS
                    ),
                };
                const {
                    internalHandleTicketCreate,
                    internalHandleTicketClaim,
                    internalHandleTicketRelease,
                    internalHandleTicketAdd,
                    internalHandleTicketRemove,
                    internalHandleTicketClose,
                    internalHandleTicketReopen,
                    internalHandleTicketTranscript,
                    internalHandleTicketDelete,
                    internalHandleTicketCsat,
                    guardTicketAction,
                } = await import("@/server/actions/ticket-bot-actions");
                const { buildCloseConfirmRows, buildDeleteConfirmRows } = await import(
                    "@/lib/tickets/embeds"
                );

                if (action === "select_open" || action === "open" || action === "select_journey") {
                    const panelId = entityId;
                    const categoryId = action === "select_open" || action === "select_journey" ? payload.data?.values?.[0] : extra;

                    if (!categoryId) {
                        return NextResponse.json({ type: 4, data: { content: "Catégorie non spécifiée", flags: 64 } });
                    }

                    // 🆕 Contrôles préalables immédiats au 1er clic (fail-fast, aucun questionnaire affiché si non éligible)
                    {
                        const { db: blacklistDb } = await import("@/lib/prisma");
                        const { readTicketPermissionSettings, isBlacklisted, isTicketOpenAllowedByRoles } =
                            await import("@/lib/tickets/category-permissions");
                        const guildForBlacklist = await blacklistDb.guildConfig.findUnique({
                            where: { discordGuildId: guild_id },
                            select: {
                                id: true,
                                ticketConfig: {
                                    select: {
                                        isEnabled: true,
                                        settingsJson: true,
                                        maxActiveTicketsPerUser: true,
                                        maxTicketsTotalGuild: true,
                                    },
                                },
                            },
                        });

                        if (!guildForBlacklist?.ticketConfig?.isEnabled) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "🚫 Le module de support n'est pas activé sur ce serveur.",
                                    flags: 64,
                                },
                            });
                        }

                        // Quota actif par membre (vérifié AVANT de proposer un formulaire)
                        const maxActiveUser = guildForBlacklist.ticketConfig.maxActiveTicketsPerUser ?? 1;
                        const activeUserTickets = await blacklistDb.ticketRecord.count({
                            where: {
                                guildId: guildForBlacklist.id,
                                creatorDiscordId: ticketActorContext.discordUserId,
                                status: { in: ["OPEN", "CLAIMED", "PENDING_USER"] },
                            },
                        });
                        if (activeUserTickets >= maxActiveUser) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: `❌ Tu as déjà ${activeUserTickets} ticket(s) ouvert(s). Attends leur résolution avant d'en ouvrir un nouveau.`,
                                    flags: 64,
                                },
                            });
                        }

                        // Quota global du serveur
                        const maxGuildTickets = guildForBlacklist.ticketConfig.maxTicketsTotalGuild ?? 50;
                        const activeGuildTickets = await blacklistDb.ticketRecord.count({
                            where: {
                                guildId: guildForBlacklist.id,
                                status: { in: ["REQUESTED", "OPEN", "CLAIMED", "PENDING_USER", "RESOLVED", "ARCHIVE_FAILED"] },
                            },
                        });
                        if (activeGuildTickets >= maxGuildTickets) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: `❌ Cette guilde a déjà ${activeGuildTickets} ticket(s) ouvert(s) (maximum ${maxGuildTickets}). Réessaie après une clôture.`,
                                    flags: 64,
                                },
                            });
                        }

                        const blacklistSettings = readTicketPermissionSettings(
                            (guildForBlacklist?.ticketConfig as { settingsJson?: unknown } | null)?.settingsJson
                        );
                        if (isBlacklisted(blacklistSettings, ticketActorContext.discordUserRoleIds)) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "🚫 Tu ne peux pas ouvrir de ticket sur ce serveur. / You cannot open a ticket on this server.",
                                    flags: 64,
                                },
                            });
                        }

                        // 🆕 RBAC d'ouverture (16/10/2026) : seuls les rôles choisis pour CE motif
                        // peuvent l'ouvrir. Liste vide = tout le monde (comportement historique) ;
                        // un administrateur Discord passe toujours. Refus **motivé**, jamais muet.
                        if (
                            !isTicketOpenAllowedByRoles({
                                settings: blacklistSettings,
                                motifKey: categoryId,
                                actorRoleIds: ticketActorContext.discordUserRoleIds,
                                actorIsAdmin: ticketActorContext.discordUserIsAdmin,
                            })
                        ) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content:
                                        "🚫 Ton rôle ne permet pas d'ouvrir ce type de demande. / Your role cannot open this request type.",
                                    flags: 64,
                                },
                            });
                        }
                    }

                    // 🆕 Tickets v2 — un **parcours** publié et activé prend la main : c'est lui
                    // qui porte questionnaire, nommage, pings et politique de fermeture. Le
                    // brouillon (30 min) fait reprendre le membre où il s'était arrêté.
                    const journey = await ticketJourneyInteraction({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        discordUserAvatar: member.user.avatar,
                        panelId,
                        journeyId: categoryId,
                        advance: { resume: true },
                    });
                    if (journey.handled) return journey.response;

                    // ⚠️ v1 — panneaux déjà déployés : catégorie + modale. La catégorie est
                    // relue **dans cette guilde** (jamais un identifiant venu d'ailleurs).
                    const { db } = await import("@/lib/prisma");
                    const category = await db.ticketBotCategory.findFirst({
                        where: { id: categoryId, guild: { discordGuildId: guild_id } },
                    });

                    const formSchema = Array.isArray(category?.formSchemaJson) ? (category.formSchemaJson as any[]) : [];

                    if (formSchema.length > 0) {
                        const modalComponents = formSchema.slice(0, 5).map((field, idx) => ({
                            type: 1, // ACTION_ROW
                            components: [
                                {
                                    type: 4, // TEXT_INPUT
                                    custom_id: `field_${idx}`,
                                    label: String(field.label || `Question ${idx + 1}`).slice(0, 45),
                                    style: field.type === "PARAGRAPH" ? 2 : 1,
                                    placeholder: field.placeholder ? String(field.placeholder).slice(0, 100) : undefined,
                                    required: field.required !== false,
                                    min_length: field.minLength || 0,
                                    max_length: field.maxLength || (field.type === "PARAGRAPH" ? 1000 : 100),
                                },
                            ],
                        }));

                        return NextResponse.json({
                            type: 9, // MODAL
                            data: {
                                custom_id: `tb:modal_open:${panelId}:${categoryId}`,
                                title: `Ouvrir un ticket — ${category?.name || "Support"}`.slice(0, 45),
                                components: modalComponents,
                            },
                        });
                    }

                    const res = await internalHandleTicketCreate({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        discordUserAvatar: member.user.avatar,
                        panelId,
                        categoryId,
                        answers: {},
                    });

                    if (res.success && res.channelId) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: `✅ Votre ticket a été créé : <#${res.channelId}>`,
                                flags: 64,
                            },
                        });
                    } else {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: `❌ ${res.error || "Impossible d'ouvrir le ticket"}`,
                                flags: 64,
                            },
                        });
                    }
                } else if (action === "modal_page") {
                    // 🆕 « Continuer » : une modale **soumise** ne peut pas en ouvrir une autre,
                    // c'est donc un clic de bouton qui rouvre la page suivante. Le `custom_id`
                    // est validé par le routeur (page bornée, parcours authentifié).
                    const descriptor = parseTicketCustomId(custom_id);
                    if (!descriptor || descriptor.kind !== "modal_page" || !descriptor.journeyId) {
                        return ephemeralDiscordRefusal("❌ Ce bouton n'est plus valide.");
                    }

                    const page = await ticketJourneyInteraction({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        discordUserAvatar: member.user.avatar,
                        journeyId: descriptor.journeyId,
                        advance: { page: descriptor.page ?? 0 },
                    });

                    if (!page.handled) return ephemeralDiscordRefusal("❌ Ce parcours n'existe plus.");
                    return page.response;
                } else if (action === "claim") {
                    const ticketId = entityId;
                    const res = await internalHandleTicketClaim({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        actor: ticketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "note") {
                    const ticketId = entityId;
                    const guard = await guardTicketAction({
                        ticketId,
                        discordGuildId: guild_id,
                        access: "staff",
                        actor: ticketActorContext,
                    });
                    if (!guard.ok) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: guard.message || "Seul le staff peut ajouter une note.", flags: 64 },
                        });
                    }
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_note:${ticketId}`,
                            title: "Note interne staff",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "note_content",
                                            label: "Contenu de la note (Staff uniquement)",
                                            style: 2,
                                            placeholder: "Notes d'investigation, détails du compte...",
                                            required: true,
                                            max_length: 2000,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "rename") {
                    const ticketId = entityId;
                    const guard = await guardTicketAction({
                        ticketId,
                        discordGuildId: guild_id,
                        access: "staff",
                        actor: ticketActorContext,
                    });
                    if (!guard.ok) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: guard.message || "Seul le staff peut renommer ce ticket.", flags: 64 },
                        });
                    }
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_rename:${ticketId}`,
                            title: "Renommer le ticket",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "new_name",
                                            label: "Nouveau nom du salon",
                                            style: 1,
                                            placeholder: "ex: ticket-urgent-probleme",
                                            required: true,
                                            max_length: 100,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "close") {
                    // 🆕 Two Step : `Fermer` affiche d'abord une confirmation éphémère
                    // (façon TicketTool « Close Ask »), sauf si le motif s'en dispense
                    // (`requireConfirm: false` dans `settingsJson`). Le motif est demandé
                    // à l'étape suivante (`close_confirm` → modale `modal_close`).
                    const ticketId = entityId;
                    const guard = await guardTicketAction({
                        ticketId,
                        discordGuildId: guild_id,
                        access: "staff_or_creator",
                        buttonKey: "close",
                        actor: ticketActorContext,
                    });
                    if (!guard.ok) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: guard.message || "Tu n'as pas l'autorisation de fermer ce ticket.", flags: 64 },
                        });
                    }
                    const { db: closeDb } = await import("@/lib/prisma");
                    const {
                        readTicketPermissionSettings,
                        requireCloseConfirm,
                        readTicketMessagingSettings,
                    } = await import("@/lib/tickets/category-permissions");
                    const { resolveTicketLang, ticketLabel } = await import("@/lib/tickets/ticket-texts");
                    const ticketForClose = await closeDb.ticketRecord.findFirst({
                        where: { id: ticketId, discordGuildId: guild_id },
                        select: {
                            categoryId: true,
                            journeyId: true,
                            guild: { select: { ticketConfig: { select: { settingsJson: true } } } },
                        },
                    });
                    const ticketForCloseSettingsJson =
                        (ticketForClose?.guild?.ticketConfig as { settingsJson?: unknown } | null)
                            ?.settingsJson;
                    const closeLang = resolveTicketLang(
                        readTicketMessagingSettings(ticketForCloseSettingsJson).ticketLanguage
                    );
                    const closeModal = {
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_close:${ticketId}`,
                            title: ticketLabel("close", closeLang),
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "close_reason",
                                            label: ticketLabel("closeNeedsReason", closeLang),
                                            style: 2,
                                            placeholder:
                                                closeLang === "en"
                                                    ? "Solved, inactive, duplicate..."
                                                    : "Problème résolu, inactivité, doublon...",
                                            required: false,
                                            max_length: 500,
                                        },
                                    ],
                                },
                            ],
                        },
                    } as const;
                    {
                        const closeSettings = readTicketPermissionSettings(ticketForCloseSettingsJson);
                        if (!requireCloseConfirm(closeSettings, ticketForClose?.categoryId ?? ticketForClose?.journeyId)) {
                            return NextResponse.json(closeModal);
                        }
                    }
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content:
                                closeLang === "en"
                                    ? `${ticketLabel("closeConfirmTitle", closeLang)}\nThe channel stays visible to the staff.`
                                    : `${ticketLabel("closeConfirmTitle", closeLang)}\nLe salon restera visible par l'équipe.`,
                            flags: 64,
                            components: buildCloseConfirmRows(ticketId, closeLang),
                        },
                    });
                } else if (action === "close_confirm") {
                    const ticketId = entityId;
                    const { db: confirmDb } = await import("@/lib/prisma");
                    const { readTicketMessagingSettings: readConfirmMessaging } = await import(
                        "@/lib/tickets/category-permissions"
                    );
                    const { resolveTicketLang: resolveConfirmLang, ticketLabel: confirmLabel } = await import(
                        "@/lib/tickets/ticket-texts"
                    );
                    const ticketForConfirm = await confirmDb.ticketRecord.findFirst({
                        where: { id: ticketId, discordGuildId: guild_id },
                        select: {
                            guild: { select: { ticketConfig: { select: { settingsJson: true } } } },
                        },
                    });
                    const confirmLang = resolveConfirmLang(
                        readConfirmMessaging(
                            (ticketForConfirm?.guild?.ticketConfig as { settingsJson?: unknown } | null)
                                ?.settingsJson
                        ).ticketLanguage
                    );
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_close:${ticketId}`,
                            title: confirmLabel("close", confirmLang),
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "close_reason",
                                            label: confirmLabel("closeNeedsReason", confirmLang),
                                            style: 2,
                                            placeholder:
                                                confirmLang === "en"
                                                    ? "Solved, inactive, duplicate..."
                                                    : "Problème résolu, inactivité, doublon...",
                                            required: false,
                                            max_length: 500,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "cancel_close" || action === "cancel_delete") {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "Annulé.", flags: 64 },
                    });
                } else if (action === "delete") {
                    // 🆕 La suppression est un geste explicite avec confirmation.
                    const ticketId = entityId;
                    const guard = await guardTicketAction({
                        ticketId,
                        discordGuildId: guild_id,
                        access: "staff",
                        buttonKey: "delete",
                        actor: ticketActorContext,
                    });
                    if (!guard.ok) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: guard.message || "Seul le staff peut supprimer ce ticket.", flags: 64 },
                        });
                    }
                    const { db: deleteDb } = await import("@/lib/prisma");
                    const { readTicketMessagingSettings: readDeleteMessaging } = await import(
                        "@/lib/tickets/category-permissions"
                    );
                    const { resolveTicketLang: resolveDeleteLang, ticketLabel: deleteLabel } = await import(
                        "@/lib/tickets/ticket-texts"
                    );
                    const ticketForDelete = await deleteDb.ticketRecord.findFirst({
                        where: { id: ticketId, discordGuildId: guild_id },
                        select: {
                            guild: { select: { ticketConfig: { select: { settingsJson: true } } } },
                        },
                    });
                    const deleteLang = resolveDeleteLang(
                        readDeleteMessaging(
                            (ticketForDelete?.guild?.ticketConfig as { settingsJson?: unknown } | null)
                                ?.settingsJson
                        ).ticketLanguage
                    );
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content:
                                deleteLang === "en"
                                    ? `${deleteLabel("deleteConfirmTitle", deleteLang)}\nPermanently deletes the channel.`
                                    : `${deleteLabel("deleteConfirmTitle", deleteLang)}\nSuppression définitive. La copie reste dans les archives si activée.`,
                            flags: 64,
                            components: buildDeleteConfirmRows(ticketId, deleteLang),
                        },
                    });
                } else if (action === "delete_confirm") {
                    const ticketId = entityId;
                    const { internalHandleTicketDelete: doDelete } = await import(
                        "@/server/actions/ticket-bot-actions"
                    );
                    // 🆕 Suppression **avec compte à rebours** (4 s) : la réponse part tout de
                    // suite (< 3 s exigées par Discord), le décompte est édité ensuite, et le
                    // salon disparaît à la fin — sauf s'il a été rouvert entre-temps.
                    const res = await doDelete({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        actor: ticketActorContext,
                        applicationId: payload.application_id,
                        interactionToken: payload.token,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "reopen") {
                    const ticketId = entityId;
                    const res = await internalHandleTicketReopen({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        actor: ticketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "transcript") {
                    const ticketId = entityId;
                    const res = await internalHandleTicketTranscript({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        ticketId,
                        actor: ticketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "release") {
                    const ticketId = entityId;
                    const res = await internalHandleTicketRelease({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        actor: ticketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "add") {
                    const ticketId = entityId;
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_add:${ticketId}`,
                            title: "Ajouter / Add",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "target_user",
                                            label: "Membre (ID ou mention) / Member",
                                            style: 1,
                                            placeholder: "123456789012345678 ou @pseudo",
                                            required: true,
                                            max_length: 64,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "remove") {
                    const ticketId = entityId;
                    return NextResponse.json({
                        type: 9, // MODAL
                        data: {
                            custom_id: `tb:modal_remove:${ticketId}`,
                            title: "Retirer / Remove",
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "target_user",
                                            label: "Membre (ID ou mention) / Member",
                                            style: 1,
                                            placeholder: "123456789012345678 ou @pseudo",
                                            required: true,
                                            max_length: 64,
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                } else if (action === "csat") {
                    const ticketId = entityId;
                    const parsed = parseInt(extra, 10);
                    const safeRating = parsed >= 1 && parsed <= 5 ? parsed : 5;
                    const res = await internalHandleTicketCsat({
                        discordUserId: member.user.id,
                        ticketId,
                        rating: safeRating,
                        actor: ticketActorContext,
                    });
                    if (res.success) {
                        const STARS_BY_RATING: Record<number, string> = {
                            1: "⭐",
                            2: "⭐⭐",
                            3: "⭐⭐⭐",
                            4: "⭐⭐⭐⭐",
                            5: "⭐⭐⭐⭐⭐",
                        };
                        const stars = STARS_BY_RATING[safeRating] ?? "⭐⭐⭐⭐⭐";
                        const originalEmbed = (payload.message?.embeds?.[0] as Record<string, unknown>) || {};
                        return NextResponse.json({
                            type: 7, // UPDATE_MESSAGE : met à jour le message et retire définitivement les boutons de vote
                            data: {
                                embeds: [
                                    {
                                        ...originalEmbed,
                                        title: "⭐ Avis enregistré !",
                                        description: `Merci d'avoir pris le temps de donner votre avis !\nVotre note : ${stars} (**${safeRating}/5**) a bien été enregistrée.`,
                                        color: 0x22c55e,
                                    },
                                ],
                                components: [], // Supprime définitivement les boutons pour empêcher le vote multiple
                            },
                        });
                    }
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else {
                    return NextResponse.json({ type: 4, data: { content: "Action ticket inconnue", flags: 64 } });
                }
            } else if (prefix === "mkt") {
                // §13.4 — le Marché délègue TOUTE sa logique métier au service
                // (guilde, module actif, actions du dashboard) : la route ne décide rien.
                const { handleMarketComponentInteraction } = await import("@/server/market/discord-interactions");
                const outcome = await handleMarketComponentInteraction({
                    customId: custom_id,
                    discordGuildId: guild_id ?? null,
                    userId: account!.userId,
                });
                // Union discriminée : `modal` → réponse type 9 (S4.3), sinon
                // message éphémère type 4 (jamais muet, §13.5).
                if (outcome.kind === "modal") {
                    return NextResponse.json({ type: 9, data: outcome.modal });
                }
                return NextResponse.json({
                    type: 4,
                    data: {
                        content: outcome.content,
                        flags: 64,
                        // S4.5 : bouton lien « Ouvrir la fiche SigilOS » (jamais de
                        // `custom_id` : la route ne fait que relayer la réponse).
                        ...(outcome.components ? { components: outcome.components } : {}),
                    },
                });
            } else {
                return NextResponse.json({ type: 4, data: { content: "Interaction inconnue", flags: 64 } });
            }

            if (result?.success) {
                // DJ interactions: give ephemeral feedback
                if (prefix === "dj") {
                    const label = action === "join" ? "✅ Tu as rejoint le groupe !" : "👋 Tu as quitté le groupe.";
                    return ephemeralDiscordMessage(label);
                }
                // Plus aucun module ne répond en silence : `type: 6` (défer d'update) laissait
                // l'interaction sans suite côté client. Seul `songes:leave` arrive encore ici
                // (le Marché, les tickets, le poll et les reaction-roles répondent plus haut).
                if (prefix === "songes") {
                    return ephemeralDiscordMessage("👋 C'est noté — tu ne fais plus partie de cette run Songes.");
                }
                return ephemeralDiscordMessage("✅ Action enregistrée.");
            } else {
                return ephemeralDiscordRefusal(`❌ ${result?.error || "Erreur inconnue"}`);
            }
        }

        // 3. Handle Modal Submit (Songes candidature form)
        if (payload.type === 5) {
            const { custom_id, components } = payload.data;
            const { guild_id } = payload;

            // 🆕 même normalisation que pour les boutons : jamais `member` en aveugle.
            const modalActor = resolveInteractionActor(payload as never);
            if (!modalActor) {
                return ephemeralDiscordMessage("❌ Interaction non identifiable.");
            }
            const member = payload.member ?? {
                user: {
                    id: modalActor.discordUserId,
                    username: modalActor.displayName,
                    global_name: modalActor.displayName,
                    avatar: modalActor.avatar,
                },
                roles: [],
                permissions: null,
            };

            const [prefix, action, entityId, extra] = custom_id.split(":");

            // Rate limit: 5 modal submits per 5min per discord user
            if ((await consumeRateLimit(`modal:${member.user.id}`, 5, 5 * 60_000)) > 0) {
                return NextResponse.json({
                    type: 4,
                    data: { content: "⏳ Trop de candidatures. Réessaie dans quelques minutes.", flags: 64 },
                });
            }

            if (prefix === "songes" && action === "apply") {
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site.", flags: 64 },
                    });
                }

                // RBAC check for modal submits (same gate as button clicks)
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                const canJoinSonges = await internalCheckPermission(guild_id, member.user.id, PERMISSIONS.GAME_OPERATIONS, { module: "songes" });
                if (!canJoinSonges) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "🚫 Tes rôles Discord ne t'autorisent pas à postuler aux Songes. Contacte un admin de ta guilde.",
                            flags: 64,
                        },
                    });
                }

                // Extract modal fields
                let classe = "";
                let message = "";

                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "classe") classe = comp.value?.trim() || "";
                        if (comp.custom_id === "message") message = comp.value?.trim() || "";
                    }
                }

                // Validate class - try to match against known classes (case-insensitive)
                const matchedClass = VALID_CLASSES.find(
                    c => c.toLowerCase() === classe.toLowerCase()
                );

                if (!matchedClass) {
                    const classesList = VALID_CLASSES.join(", ");
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `❌ Classe « ${classe} » non reconnue.\n\n**Classes disponibles :** ${classesList}`,
                            flags: 64,
                        },
                    });
                }

                // Create candidature via service
                const { processRunJoin } = await import("@/server/songes-service");
                const result = await processRunJoin(guild_id, entityId, account.userId, matchedClass, message);

                if (result?.success) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `✅ Candidature envoyée ! Classe: **${matchedClass}**${message ? `\nMessage: *${message}*` : ""}\n\nLe leader de la run sera notifié.`,
                            flags: 64,
                        },
                    });
                } else {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${result?.error || "Erreur inconnue"}`, flags: 64 },
                    });
                }
            } else if (prefix === "calendar" && action === "apply") {
                // ── Retour de la modale ouverte par « S'inscrire » ────────────────
                // Constat beta du 19/09/2026 (raids) : le bouton « S'inscrire » créait un
                // participant « Sans classe », et le menu select ne faisait qu'ajouter la
                // classe APRÈS coup. Ici : classe + message sont enregistrés dans la MÊME
                // écriture que l'inscription.
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return ephemeralDiscordRefusal(DISCORD_ACCOUNT_REQUIRED);
                }

                // RBAC : même carte de permissions que les boutons (une seule source).
                if (!(await isDiscordPrefixAuthorized(prefix, guild_id, member.user.id))) {
                    return ephemeralDiscordRefusal(DISCORD_PERMISSION_DENIED);
                }

                let classe = "";
                let message = "";
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "classe") classe = comp.value?.trim() || "";
                        if (comp.custom_id === "message") message = comp.value?.trim() || "";
                    }
                }

                // Classe FACULTATIVE : les événements non-raid n'ont pas besoin de classe
                // (un raid, oui). Une saisie inconnue reste un refus explicite.
                let matchedClass: string | undefined;
                if (classe) {
                    const { matchDispatchClass } = await import("@/server/discord-class-dispatch");
                    matchedClass = matchDispatchClass(classe) ?? undefined;
                    if (!matchedClass) {
                        return ephemeralDiscordMessage(
                            `❌ Classe « ${classe} » non reconnue.\n\n**Classes disponibles :** ${VALID_CLASSES.join(", ")}`
                        );
                    }
                }

                const { processRegistration } = await import("@/server/calendar-service");
                const { buildCalendarInteractionFeedback } = await import("@/lib/calendar-interaction-feedback");
                const outcome = await processRegistration(guild_id, entityId, account.userId, {
                    classe: matchedClass,
                    comment: message || undefined,
                });
                return ephemeralDiscordMessage(buildCalendarInteractionFeedback("join", outcome));
            } else if (prefix === "calendar" && action === "class-apply") {
                // ── Retour de la fenêtre « Mes personnages » (menu select de classe) ──
                // Même issue que l'ancien select direct : mise à jour si le membre est déjà
                // inscrit, sinon inscription avec la classe choisie (aucune règle nouvelle).
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return ephemeralDiscordRefusal(DISCORD_ACCOUNT_REQUIRED);
                }

                // RBAC : même carte de permissions que les boutons (une seule source).
                if (!(await isDiscordPrefixAuthorized(prefix, guild_id, member.user.id))) {
                    return ephemeralDiscordRefusal(DISCORD_PERMISSION_DENIED);
                }

                let classe = "";
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "classe") classe = comp.value?.trim() || "";
                    }
                }

                const { matchDispatchClass } = await import("@/server/discord-class-dispatch");
                const matchedClass = matchDispatchClass(classe);
                if (!matchedClass) {
                    return ephemeralDiscordMessage(
                        `❌ Classe « ${classe} » non reconnue.\n\n**Classes disponibles :** ${VALID_CLASSES.join(", ")}`
                    );
                }

                const { updateRegistrationClass, processRegistration } = await import("@/server/calendar-service");
                const { buildCalendarInteractionFeedback } = await import("@/lib/calendar-interaction-feedback");
                const upd = await updateRegistrationClass(guild_id, entityId, account.userId, matchedClass);
                if (!upd.success) return ephemeralDiscordMessage(`❌ ${upd.error || "Erreur inconnue"}`);
                if (upd.updated) {
                    return ephemeralDiscordMessage(`✅ Ta classe est maintenant **${matchedClass}** !`);
                }
                const outcome = await processRegistration(guild_id, entityId, account.userId, { classe: matchedClass });
                return ephemeralDiscordMessage(buildCalendarInteractionFeedback("join", outcome));
            } else if (prefix === "dj" && action === "join") {
                // #169 — Submit de la modal d'inscription DJ (choix de classe + message optionnel).
                // custom_id: dj:join:{postId}[:{idx}]
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site.", flags: 64 },
                    });
                }

                // RBAC check identique au bouton (GAME_OPERATIONS pour DJ)
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                const canJoinDj = await internalCheckPermission(guild_id, member.user.id, PERMISSIONS.GAME_OPERATIONS, { module: "donjons" });
                if (!canJoinDj) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "🚫 Tes rôles Discord ne t'autorisent pas à rejoindre ces groupes. Contacte un admin de ta guilde.", flags: 64 },
                    });
                }

                // Extraire les champs de la modal
                let classe = "";
                let message = "";
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "classe") classe = comp.value?.trim() || "";
                        if (comp.custom_id === "message") message = comp.value?.trim() || "";
                    }
                }

                // Valider la classe (case-insensitive)
                const matchedClass = VALID_CLASSES.find((c) => c.toLowerCase() === classe.toLowerCase());
                if (!matchedClass) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Classe « ${classe} » non reconnue.\n\n**Classes disponibles :** ${VALID_CLASSES.join(", ")}`, flags: 64 },
                    });
                }

                const dungeonIndex = extra !== undefined && extra !== "" ? Number(extra) : undefined;

                // Résoudre le post → guildId Prisma interne (≠ guild_id Discord snowflake)
                const post = await (db as any).djSearchPost.findUnique({
                    where: { id: entityId },
                    select: { id: true, status: true, guildId: true },
                });
                if (!post) {
                    return NextResponse.json({ type: 4, data: { content: "❌ Ce groupe n'existe plus ou a expiré.", flags: 64 } });
                }
                if (post.status !== "OPEN" && post.status !== "FULL") {
                    return NextResponse.json({ type: 4, data: { content: "❌ Ce groupe est fermé.", flags: 64 } });
                }

                const profile = await db.userProfile.findFirst({
                    where: { userId: account.userId, guildId: post.guildId },
                });
                if (!profile) {
                    return NextResponse.json({ type: 4, data: { content: "❌ Tu n'es pas membre de cette guilde sur SigilOS.", flags: 64 } });
                }

                const { internalJoinDjPost } = await import("@/server/actions/dungeon-finder-actions");
                const res = await internalJoinDjPost(entityId, profile.id, account.userId, dungeonIndex, matchedClass, message);

                if (res.success) {
                    const wasWaitlisted = (res as any).data?.waitlisted;
                    const replyContent = wasWaitlisted
                        ? `⏳ Tu es en **file d'attente** ! Le créateur sera notifié et pourra t'accepter si une place se libère.${matchedClass ? `\nClasse: **${matchedClass}**` : ""}${message ? `\nMessage: *${message}*` : ""}`
                        : `✅ Tu as rejoint le groupe ! Classe: **${matchedClass}**${message ? `\nMessage: *${message}*` : ""}\nRetrouve les détails sur le site.`;
                    return NextResponse.json({
                        type: 4,
                        data: { content: replyContent, flags: 64 },
                    });
                }
                return NextResponse.json({ type: 4, data: { content: `❌ ${res.error || "Impossible de rejoindre le groupe."}`, flags: 64 } });
            } else if (prefix === "svc" && action === "submit_reply") {
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site.", flags: 64 },
                    });
                }

                const parts = custom_id.split(":");
                const requesterUserId = parts[2];
                const listingId = parts[3];

                let replyMessage = "";
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "reply_message") {
                            replyMessage = comp.value?.trim() || "";
                        }
                    }
                }

                const { internalServiceReply } = await import("@/server/actions/service-actions");
                const res = await internalServiceReply(guild_id, requesterUserId, listingId, replyMessage, account.userId);

                if (res.success) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "✅ Votre réponse a été envoyée au client !", flags: 64 },
                    });
                } else {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${res.error || "Impossible d'envoyer la réponse."}`, flags: 64 },
                    });
                }
            } else if (prefix === "userreq" && action === "submit_reply") {
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Tu dois t'être connecté au moins une fois sur le site.", flags: 64 },
                    });
                }

                let replyMessage = "";
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "reply_message") {
                            replyMessage = comp.value?.trim() || "";
                        }
                    }
                }

                const { replyToUserRequestAction } = await import("@/server/actions/user-request-actions");
                const res = await replyToUserRequestAction(guild_id, entityId, replyMessage);

                if (res.success) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "✅ Votre réponse a été envoyée au demandeur !", flags: 64 },
                    });
                }
                return NextResponse.json({
                    type: 4,
                    data: { content: `❌ ${res.error || "Impossible d'envoyer la réponse."}`, flags: 64 },
                });
            } else if (prefix === "mkt" && action === "offer") {
                // =========================================================
                // MARCHÉ (S4.4) — SOUMISSION DE LA MODALE D'OFFRE
                // custom_id = mkt:offer:{listingId}
                // §13.4 : la route ne décide de RIEN (elle ne lit ni le montant
                // ni la guilde interne) — parsing fail-closed, module, profil et
                // moteur métier partagé vivent dans le service du module. Elle ne
                // résout que l'IDENTITÉ (compte interne + RBAC), comme les boutons.
                // =========================================================
                // Constat beta 14/09/2026 — deux manques mesurés **ici** :
                //   · le gate RBAC ne couvrait que `type === 3` ⇒ on le réapplique
                //     (même carte, même refus, aucune règle dupliquée) ;
                //   · `member.user.id` (snowflake Discord) était transmis comme
                //     `userId`, or `resolveMemberContext` lit `UserProfile.userId`
                //     (id **interne** SigilOS) ⇒ « ❌ Aucun profil SigilOS dans cette
                //     guilde » à chaque offre, alors que le dashboard fonctionnait
                //     (session = `User.id`).
                const account = await findUserByDiscordId(member.user.id);
                if (!account) {
                    return ephemeralDiscordRefusal(DISCORD_ACCOUNT_REQUIRED);
                }
                if (!(await isDiscordPrefixAuthorized(prefix, guild_id, member.user.id))) {
                    return ephemeralDiscordRefusal(DISCORD_PERMISSION_DENIED);
                }

                const { handleMarketModalSubmit } = await import("@/server/market/discord-interactions");
                const marketOutcome = await handleMarketModalSubmit({
                    customId: custom_id,
                    components,
                    discordGuildId: guild_id ?? null,
                    userId: account.userId,
                });
                // §13.7 : ni montant offert ni pseudo d'acheteur dans la réponse.
                return NextResponse.json({
                    type: 4,
                    data: { content: marketOutcome.content, flags: 64 },
                });
            } else if (prefix === "tb") {
                // =========================================================
                // TICKET BOT MODAL SUBMITS
                // custom_id = tb:modal_open:{panelId}:{categoryId}
                // custom_id = tb:modal_note:{ticketId}
                // custom_id = tb:modal_rename:{ticketId}
                // custom_id = tb:modal_close:{ticketId}
                // =========================================================
                // 🆕 v2 — même contexte d'autorisation que la branche boutons : une seule
                // règle, résolue serveur (identité, rôles, rang Discord, `staff:tickets`).
                const { internalCheckPermission: modalCheckPermission } = await import(
                    "@/server/actions/user-actions"
                );
                const modalTicketActorContext = {
                    discordUserId: modalActor.discordUserId,
                    discordUserName: modalActor.displayName,
                    discordUserRoleIds: modalActor.roleIds,
                    discordUserIsAdmin: modalActor.isGuildAdmin,
                    hasStaffPermission: await modalCheckPermission(
                        guild_id,
                        modalActor.discordUserId,
                        PERMISSION_IDS.STAFF_TICKETS
                    ),
                };
                if (action === "modal_open") {
                    const panelId = entityId;
                    const targetId = extra;

                    // 🆕 Tickets v2 — parcours : les réponses sont **clés par `id` de champ**
                    // (`tf_...`) et revalidées plus loin sur la version figée du questionnaire.
                    const submitted: Array<{ customId: string; value: string }> = [];
                    for (const row of components) {
                        for (const comp of row.components) {
                            submitted.push({
                                customId: String(comp.custom_id ?? ""),
                                value: String(comp.value ?? ""),
                            });
                        }
                    }

                    const journey = await ticketJourneyInteraction({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        discordUserAvatar: member.user.avatar,
                        panelId,
                        journeyId: targetId,
                        advance: { submitted },
                        afterModalSubmit: true,
                    });
                    if (journey.handled) return journey.response;

                    // ⚠️ v1 — catégorie + réponses clés par libellé (panneaux déjà déployés).
                    const categoryId = targetId;
                    const { db } = await import("@/lib/prisma");
                    const category = await db.ticketBotCategory.findFirst({
                        where: { id: categoryId, guild: { discordGuildId: guild_id } },
                    });

                    const formSchema = Array.isArray(category?.formSchemaJson) ? (category.formSchemaJson as any[]) : [];
                    const answers: Record<string, string> = {};

                    for (const row of components) {
                        for (const comp of row.components) {
                            if (comp.custom_id.startsWith("field_")) {
                                const idx = parseInt(comp.custom_id.replace("field_", ""), 10);
                                const label = formSchema[idx]?.label || `Question ${idx + 1}`;
                                answers[label] = comp.value?.trim() || "";
                            }
                        }
                    }

                    const { internalHandleTicketCreate } = await import("@/server/actions/ticket-bot-actions");
                    const res = await internalHandleTicketCreate({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        discordUserAvatar: member.user.avatar,
                        panelId,
                        categoryId,
                        answers,
                    });

                    if (res.success && res.channelId) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: `✅ Votre ticket a été créé : <#${res.channelId}>`,
                                flags: 64,
                            },
                        });
                    } else {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: `❌ ${res.error || "Erreur lors de la création du ticket"}`,
                                flags: 64,
                            },
                        });
                    }
                } else if (action === "modal_note") {
                    const ticketId = entityId;
                    let content = "";
                    for (const row of components) {
                        for (const comp of row.components) {
                            if (comp.custom_id === "note_content") content = comp.value?.trim() || "";
                        }
                    }
                    const { internalHandleTicketAddNote } = await import("@/server/actions/ticket-bot-actions");
                    const res = await internalHandleTicketAddNote({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        content,
                        actor: modalTicketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "modal_rename") {
                    const ticketId = entityId;
                    let newName = "";
                    for (const row of components) {
                        for (const comp of row.components) {
                            if (comp.custom_id === "new_name") newName = comp.value?.trim() || "";
                        }
                    }
                    // Le renommage passe par la **même** autorisation que les autres actions
                    // de staff (l'appel direct à l'action dashboard exigeait une session
                    // NextAuth absente ici ⇒ il échouait en silence en annonçant un succès).
                    const { internalHandleTicketRename } = await import("@/server/actions/ticket-bot-actions");
                    const res = await internalHandleTicketRename({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        newName,
                        actor: modalTicketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "modal_close") {
                    const ticketId = entityId;
                    let reason = "";
                    for (const row of components) {
                        for (const comp of row.components) {
                            if (comp.custom_id === "close_reason") reason = comp.value?.trim() || "";
                        }
                    }
                    const { internalHandleTicketClose } = await import("@/server/actions/ticket-bot-actions");
                    const res = await internalHandleTicketClose({
                        discordGuildId: guild_id,
                        discordUserId: member.user.id,
                        discordUserName: member.user.global_name || member.user.username,
                        ticketId,
                        reason,
                        actor: modalTicketActorContext,
                    });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                } else if (action === "modal_add" || action === "modal_remove") {
                    const ticketId = entityId;
                    let target = "";
                    for (const row of components) {
                        for (const comp of row.components) {
                            if (comp.custom_id === "target_user") target = comp.value?.trim() || "";
                        }
                    }
                    const { internalHandleTicketAdd, internalHandleTicketRemove } = await import(
                        "@/server/actions/ticket-bot-actions"
                    );
                    const res =
                        action === "modal_add"
                            ? await internalHandleTicketAdd({
                                  discordGuildId: guild_id,
                                  discordUserId: member.user.id,
                                  discordUserName: member.user.global_name || member.user.username,
                                  ticketId,
                                  targetDiscordId: target,
                                  actor: modalTicketActorContext,
                              })
                            : await internalHandleTicketRemove({
                                  discordGuildId: guild_id,
                                  discordUserId: member.user.id,
                                  discordUserName: member.user.global_name || member.user.username,
                                  ticketId,
                                  targetDiscordId: target,
                                  actor: modalTicketActorContext,
                              });
                    return NextResponse.json({
                        type: 4,
                        data: { content: res.message, flags: 64 },
                    });
                }
            }

            // =========================================================
            // TICKET CREATION V2 (from category-adapted modal submit)
            // custom_id format: ticket:create:{guildId}:{category}
            // =========================================================
            if (prefix === "ticket" && action === "create") {
                // V2: Category is in the 4th part of custom_id
                const parts = custom_id.split(":");
                const ticketGuildId = parts[2] || guild_id;
                const ticketCategory = (parts[3] || "OTHER") as "ACCESS_REQUEST" | "BUG_REPORT" | "FEATURE_REQUEST" | "OTHER";

                // Extract all possible fields from modal
                const fields: Record<string, string> = {};
                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id && comp.value) {
                            fields[comp.custom_id] = comp.value.trim();
                        }
                    }
                }

                // Build subject and description based on category
                let targetMeta: any = {};
                let subject = "";
                let description = "";

                if (ticketCategory === "ACCESS_REQUEST") {
                    // 1. Validate Discord Guild ID
                    const discordGuildIdInput = fields.discord_guild_id || "";
                    if (!/^\d{17,20}$/.test(discordGuildIdInput)) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "❌ L'ID de serveur Discord est invalide (17-20 chiffres).\n💡 Clic droit sur votre serveur -> Copier l'identifiant.",
                                flags: 64,
                            },
                        });
                    }

                    // 2. Validate Names & Pseudo (Nomenclature Dofus SigilOS : lettres, espaces, tirets et crochets, pas de chiffres)
                    const dofusPseudoRegex = /^[a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\-\s\[\]]+$/;
                    const guildName = fields.guild_name || "";
                    const pseudoDofus = fields.pseudo_dofus || "";

                    if (!dofusPseudoRegex.test(guildName)) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le nom de guilde ne doit contenir que des lettres, espaces, tirets ou crochets (pas de chiffres).", flags: 64 },
                        });
                    }
                    if (!dofusPseudoRegex.test(pseudoDofus)) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le pseudo Dofus ne doit contenir que des lettres, espaces, tirets ou crochets (pas de chiffres).", flags: 64 },
                        });
                    }

                    // 3. Validate Member Count (Max 350 - Quota SigilOS)
                    const memberCountRaw = fields.member_count || "";
                    const count = parseInt(memberCountRaw, 10);
                    if (isNaN(count) || count < 1 || count > 350) {
                        return NextResponse.json({
                            type: 4,
                            data: { content: "❌ Le nombre de membres doit être un chiffre entre 1 et 350 (quota max SigilOS).", flags: 64 },
                        });
                    }

                    targetMeta = {
                        targetGuildId: discordGuildIdInput,
                        targetGuildName: guildName,
                        targetGuildMemberCount: count,
                    };

                    subject = `Accès — ${guildName} (${pseudoDofus})`;
                    description = [
                        `🔹 **Serveur Discord :** \`${discordGuildIdInput}\``,
                        `🏰 **Guilde :** ${guildName}`,
                        `👤 **Leader :** ${pseudoDofus}`,
                        `👥 **Membres :** ${count}`,
                        "",
                        `📝 **Message :**`,
                        fields.description || "Aucune description",
                    ].join("\n");
                } else if (ticketCategory === "BUG_REPORT") {
                    subject = fields.subject || "Bug sans titre";
                    description = [
                        `📍 **Page/Feature :** ${fields.page || "Non précisé"}`,
                        "",
                        `🔍 **Détails :**`,
                        fields.description || "Aucune description",
                    ].join("\n");
                } else {
                    subject = fields.subject || "Ticket sans titre";
                    description = fields.description || "Aucune description";
                }

                // Get channel for thread creation
                const channelId = payload.channel_id || payload.channel?.id;
                if (!channelId) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Impossible de déterminer le salon.", flags: 64 },
                    });
                }

                const { createSupportTicket } = await import("@/server/actions/ticket-actions");
                const ticketResult = await createSupportTicket({
                    channelId,
                    discordGuildId: ticketGuildId,
                    category: ticketCategory,
                    subject,
                    description,
                    creatorDiscordId: member.user.id,
                    creatorDiscordName: member.user.global_name || member.user.username,
                    ...targetMeta,
                });

                if (ticketResult.success) {
                    // AUTO-PROVISION: For ACCESS_REQUEST, auto-create AllowedGuild as PENDING
                    if (ticketCategory === "ACCESS_REQUEST" && fields.discord_guild_id) {
                        try {
                            const existingGuild = await db.allowedGuild.findUnique({
                                where: { discordGuildId: fields.discord_guild_id },
                            });
                            if (!existingGuild) {
                                await db.allowedGuild.create({
                                    data: {
                                        discordGuildId: fields.discord_guild_id,
                                        name: fields.guild_name || null,
                                        tier: "PENDING",
                                        isActive: false,
                                        addedBy: member.user.id,
                                        notes: `[AUTO] Ticket #${ticketResult.ticketNumber} — ${fields.pseudo_dofus || "?"} — En attente d'approbation`,
                                    },
                                });
                            }
                        } catch (e) {
                            // Non-blocking: if auto-provision fails, ticket is still created
                            console.error("[Tickets] Auto-provision AllowedGuild failed:", e);
                        }
                    }

                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `✅ Ticket **#${ticketResult.ticketNumber}** créé ! Un fil privé a été ouvert — regarde dans tes fils.`,
                            flags: 64,
                        },
                    });
                } else {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ ${ticketResult.error}`, flags: 64 },
                    });
                }
            } else if (prefix === "valrecrue" && action === "submit") {
                // ── Soumission de la modale /valider-recrue (Staff) ────────────────
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSIONS } = await import("@/lib/permissions");
                let isStaff = false;
                try {
                    isStaff = guild_id
                        ? await internalCheckPermission(guild_id, member.user.id, PERMISSIONS.STAFF_MEMBER_MGMT)
                        : false;
                } catch {
                    isStaff = false;
                }
                if (!isStaff) {
                    return ephemeralDiscordRefusal("🚫 `/valider-recrue` est réservée au staff (permission « Ressources Humaines »).");
                }

                const targetId = entityId;
                if (!targetId || !guild_id) {
                    return ephemeralDiscordMessage("❌ Interaction de validation invalide.");
                }

                const guildConfig = await db.guildConfig.findUnique({
                    where: { discordGuildId: guild_id },
                    select: { id: true, trialDurationDays: true },
                });
                if (!guildConfig) {
                    return ephemeralDiscordMessage("❌ Ce serveur n'est pas lié à SigilOS.");
                }

                // Extraire les champs saisis dans la modale
                let rawPseudo = "";
                let rawAnkama = "";
                let rawArrivee = "";
                let rawRecruiter = "";

                for (const row of components) {
                    for (const comp of row.components) {
                        if (comp.custom_id === "pseudo_dofus") rawPseudo = comp.value?.trim() || "";
                        if (comp.custom_id === "tag_ankama") rawAnkama = comp.value?.trim() || "";
                        if (comp.custom_id === "arrivee") rawArrivee = comp.value?.trim() || "";
                        if (comp.custom_id === "recruteur") rawRecruiter = comp.value?.trim() || "";
                    }
                }

                if (!rawPseudo || rawPseudo.length < 2) {
                    return ephemeralDiscordMessage("❌ Le pseudo Dofus est obligatoire (min. 2 caractères).");
                }
                rawPseudo = rawPseudo.slice(0, 30);

                const { ANKAMA_ID_PATTERN, computeSeniorityDays } = await import("@/lib/member-registry");
                if (rawAnkama && !ANKAMA_ID_PATTERN.test(rawAnkama)) {
                    return ephemeralDiscordMessage("❌ Tag Ankama invalide — format attendu : `Nom#0000`.");
                }

                if (!rawArrivee) {
                    return ephemeralDiscordMessage("❌ La date d'arrivée est obligatoire.");
                }
                const ymd = parseAlmanaxDateInput(rawArrivee);
                if (!ymd) {
                    return ephemeralDiscordMessage("❌ Date d'arrivée invalide — format attendu : `JJ/MM/AAAA`.");
                }
                const arrivalDate = new Date(`${ymd}T12:00:00`);

                const findGuildProfile = async (discordId: string) => {
                    const account = await db.account.findFirst({
                        where: { provider: "discord", providerAccountId: discordId },
                        include: {
                            user: {
                                include: {
                                    profiles: {
                                        where: { guildId: guildConfig.id },
                                        take: 1,
                                        select: {
                                            id: true,
                                            pseudoDofus: true,
                                            discordNickname: true,
                                            ankamaId: true,
                                            trialValidated: true,
                                            trialEndsAt: true,
                                            guildJoinedAt: true,
                                            recruitedById: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                    return account?.user?.profiles?.[0] ?? null;
                };

                const profile = await findGuildProfile(targetId);
                // B-2 : plus besoin d'un profil dashboard pour compléter une recrue. Un membre
                // hors dashboard a désormais sa ligne dédiée (`MemberRegistryEntry`, clé guilde +
                // ID Discord) — on l'écrit au même titre qu'un profil.
                const registryEntry = profile
                    ? null
                    : await db.memberRegistryEntry.findUnique({
                          where: { guildId_discordId: { guildId: guildConfig.id, discordId: targetId } },
                          select: { id: true, trialValidated: true, trialEndsAt: true },
                      });

                // Recruteur : analysé si fourni, sinon l'auteur de l'interaction (le staff)
                let recruiterProfileId: string | null = null;
                let recruiterLabel: string | null = null;
                if (rawRecruiter) {
                    const matchSnowflake = rawRecruiter.match(/^<@!?(\d{5,25})>$/) || rawRecruiter.match(/^(\d{5,25})$/);
                    if (matchSnowflake) {
                        const recProfile = await findGuildProfile(matchSnowflake[1]);
                        if (recProfile) {
                            recruiterProfileId = recProfile.id;
                            recruiterLabel = recProfile.pseudoDofus || recProfile.discordNickname || "Recruteur";
                        }
                    }
                    if (!recruiterProfileId) {
                        const cleanQuery = rawRecruiter.trim();
                        const rec = await db.userProfile.findFirst({
                            where: {
                                guildId: guildConfig.id,
                                OR: [
                                    { pseudoDofus: { equals: cleanQuery, mode: "insensitive" } },
                                    { discordNickname: { equals: cleanQuery, mode: "insensitive" } },
                                    { user: { name: { equals: cleanQuery, mode: "insensitive" } } },
                                ],
                            },
                            select: { id: true, pseudoDofus: true, discordNickname: true },
                        });
                        if (rec) {
                            recruiterProfileId = rec.id;
                            recruiterLabel = rec.pseudoDofus || rec.discordNickname || cleanQuery;
                        } else {
                            return ephemeralDiscordMessage(`❌ Recruteur « ${cleanQuery} » introuvable parmi les membres de la guilde.`);
                        }
                    }
                } else {
                    const authorProfile = await findGuildProfile(member.user.id);
                    recruiterProfileId = authorProfile?.id ?? null;
                    recruiterLabel = authorProfile ? authorProfile.pseudoDofus || authorProfile.discordNickname || "Toi" : null;
                }

                // Mise en essai si la recrue n'est ni validée ni déjà en essai daté
                // (l'état est lu sur le profil **ou** sur la ligne de registre du hors dashboard).
                const trialValidated = profile?.trialValidated ?? registryEntry?.trialValidated ?? false;
                const trialAlreadyDated = profile?.trialEndsAt ?? registryEntry?.trialEndsAt ?? null;
                const needsTrial = !trialValidated && !trialAlreadyDated;
                const trialBase = arrivalDate ?? new Date();
                const trialEndsAt = needsTrial
                    ? new Date(trialBase.getTime() + Math.max(1, guildConfig.trialDurationDays) * 86_400_000)
                    : undefined;

                // Rôles appliqués par défaut selon réglage dashboard
                const { parseValiderRecrueConfig } = await import("@/lib/slash-commands-catalog");
                const permRow = await db.guildSlashCommandPermission.findUnique({
                    where: { guildId_commandName: { guildId: guildConfig.id, commandName: "valider-recrue" } },
                    select: { config: true },
                });
                const dashboardRoles = parseValiderRecrueConfig(permRow?.config);
                const addRoleId = dashboardRoles.addRoleId;
                const removeRoleId = dashboardRoles.removeRoleId;

                const registryData = {
                    pseudoDofus: rawPseudo,
                    ...(rawAnkama ? { ankamaId: rawAnkama } : {}),
                    guildJoinedAt: arrivalDate,
                    ...(recruiterProfileId ? { recruitedById: recruiterProfileId } : {}),
                    ...(needsTrial ? { trialValidated: false, trialEndsAt } : {}),
                };

                if (profile) {
                    await db.userProfile.update({ where: { id: profile.id }, data: registryData });
                } else {
                    // Recrue hors dashboard : la ligne de registre est créée si besoin, sinon complétée.
                    await db.memberRegistryEntry.upsert({
                        where: { guildId_discordId: { guildId: guildConfig.id, discordId: targetId } },
                        create: { guildId: guildConfig.id, discordId: targetId, ...registryData },
                        update: registryData,
                    });
                }

                // Application des rôles sur Discord
                const { addGuildMemberRole, removeGuildMemberRole } = await import("@/server/discord");
                const roleOutcomes: string[] = [];
                if (addRoleId) {
                    const r = await addGuildMemberRole(guild_id, targetId, addRoleId, "SigilOS /valider-recrue (modale)");
                    roleOutcomes.push(r.success ? `+ <@&${addRoleId}>` : `⚠️ ajout <@&${addRoleId}> : ${r.error}`);
                }
                if (removeRoleId) {
                    const r = await removeGuildMemberRole(guild_id, targetId, removeRoleId, "SigilOS /valider-recrue (modale)");
                    roleOutcomes.push(r.success ? `− <@&${removeRoleId}>` : `⚠️ retrait <@&${removeRoleId}> : ${r.error}`);
                }

                const { createAuditLog } = await import("@/server/actions/audit-actions");
                await createAuditLog({
                    guildId: guildConfig.id,
                    actorUserId: `discord:${member.user.id}`,
                    actorName: "Discord /valider-recrue (modale)",
                    action: "SETTINGS_UPDATED",
                    targetType: "USER_PROFILE",
                    targetId: profile?.id ?? registryEntry?.id ?? targetId,
                    newValue: {
                        pseudoDofus: rawPseudo,
                        ankamaId: rawAnkama,
                        guildJoinedAt: arrivalDate,
                        recruitedById: recruiterProfileId,
                        addRoleId,
                        removeRoleId,
                    },
                    metadata: { source: "modal-valider-recrue", channelId: payload.channel_id ?? null },
                }).catch(() => null);

                const seniority = computeSeniorityDays(arrivalDate.toISOString());
                const appBaseUrl = getAppBaseUrl();
                const fields: { name: string; value: string; inline?: boolean }[] = [
                    { name: "Pseudo Dofus", value: rawPseudo, inline: true },
                    { name: "Tag Ankama", value: rawAnkama || "—", inline: true },
                    { name: "Recruté par", value: recruiterLabel || "—", inline: true },
                    {
                        name: "Arrivée",
                        value: `${new Date(arrivalDate).toLocaleDateString("fr-FR")} (${seniority} j)`,
                        inline: true,
                    },
                    {
                        name: "Essai",
                        value: needsTrial
                            ? `démarré (${guildConfig.trialDurationDays} j)`
                            : trialValidated
                              ? "déjà validé"
                              : "en cours",
                        inline: true,
                    },
                    {
                        name: "Fiche",
                        value: profile ? "Profil dashboard" : "Hors dashboard (registre)",
                        inline: true,
                    },
                    ...(roleOutcomes.length > 0
                        ? [{ name: "Rôles Discord", value: roleOutcomes.join("\n"), inline: false }]
                        : []),
                ];

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `✅ Ligne registre complétée — <@${targetId}>`,
                            color: 0x22C55E,
                            fields,
                            url: `${appBaseUrl}/dashboard/${guild_id}/admin/members`,
                            footer: { text: "SigilOS • Registre staff" },
                        }],
                        flags: 64,
                    },
                });
            }

            return NextResponse.json({ type: 4, data: { content: "Modal inconnu", flags: 64 } });
        }



        // ================================================================
        // TYPE 4 — AUTOCOMPLETE (triggered when user types in a /command option)
        // Must respond within 3 seconds. No signature needed beyond initial verify.
        // ================================================================
        if (payload.type === 4) {
            const commandName = payload.data?.name;
            const focusedOption = payload.data?.options?.find((o: any) => o.focused);

            if (commandName === "boss" && focusedOption?.name === "nom") {
                const query = (focusedOption.value || "").trim().toLowerCase();
                const dungeons = await db.dungeon.findMany({
                    where: query ? {
                        OR: [
                            { bossName: { contains: query, mode: "insensitive" } },
                            { name: { contains: query, mode: "insensitive" } },
                        ]
                    } : undefined,
                    select: { bossName: true, name: true, level: true },
                    orderBy: { level: "desc" },
                    take: 25
                });

                const seen = new Set<string>();
                const choices: { name: string; value: string }[] = [];
                for (const d of dungeons) {
                    if (d.bossName && !seen.has(d.bossName.toLowerCase())) {
                        seen.add(d.bossName.toLowerCase());
                        choices.push({
                            name: `${d.bossName} (Niv. ${d.level} • ${d.name})`.slice(0, 100),
                            value: d.bossName.slice(0, 100)
                        });
                        if (choices.length >= 25) break;
                    }
                }

                if (choices.length < 25) {
                    const stats = await db.monsterStat.findMany({
                        where: query ? { monsterName: { contains: query, mode: "insensitive" } } : undefined,
                        select: { monsterName: true, dungeonName: true },
                        take: 25 - choices.length
                    });
                    for (const s of stats) {
                        if (s.monsterName && !seen.has(s.monsterName.toLowerCase())) {
                            seen.add(s.monsterName.toLowerCase());
                            choices.push({
                                name: s.dungeonName ? `${s.monsterName} (${s.dungeonName})`.slice(0, 100) : s.monsterName.slice(0, 100),
                                value: s.monsterName.slice(0, 100)
                            });
                            if (choices.length >= 25) break;
                        }
                    }
                }

                return NextResponse.json({
                    type: 8,
                    data: { choices }
                });
            }

            if (commandName === "monstre" && focusedOption?.name === "nom") {
                const query = (focusedOption.value || "").trim().toLowerCase();
                const seen = new Set<string>();
                const choices: { name: string; value: string }[] = [];

                const monsters = await db.monster.findMany({
                    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
                    select: { name: true, level: true, family: { select: { name: true } } },
                    orderBy: { name: "asc" },
                    take: 25
                });
                for (const m of monsters) {
                    if (m.name && !seen.has(m.name.toLowerCase())) {
                        seen.add(m.name.toLowerCase());
                        const meta = [m.level ? `Niv. ${m.level}` : null, m.family?.name].filter(Boolean).join(" • ");
                        choices.push({
                            name: meta ? `${m.name} (${meta})`.slice(0, 100) : m.name.slice(0, 100),
                            value: m.name.slice(0, 100)
                        });
                        if (choices.length >= 25) break;
                    }
                }

                if (choices.length < 25 && query) {
                    const archis = await db.archimonstre.findMany({
                        where: { name: { contains: query, mode: "insensitive" } },
                        select: { name: true, level: true, zone: true },
                        take: 25 - choices.length
                    });
                    for (const a of archis) {
                        if (a.name && !seen.has(a.name.toLowerCase())) {
                            seen.add(a.name.toLowerCase());
                            const meta = [a.level ? `Niv. ${a.level}` : null, a.zone].filter(Boolean).join(" • ");
                            choices.push({
                                name: `🌟 ${a.name}${meta ? ` (${meta})` : ""}`.slice(0, 100),
                                value: a.name.slice(0, 100)
                            });
                            if (choices.length >= 25) break;
                        }
                    }
                }

                if (choices.length < 25) {
                    const stats = await db.monsterStat.findMany({
                        where: query ? { monsterName: { contains: query, mode: "insensitive" } } : undefined,
                        select: { monsterName: true },
                        take: 25 - choices.length
                    });
                    for (const s of stats) {
                        if (s.monsterName && !seen.has(s.monsterName.toLowerCase())) {
                            seen.add(s.monsterName.toLowerCase());
                            choices.push({
                                name: s.monsterName.slice(0, 100),
                                value: s.monsterName.slice(0, 100)
                            });
                            if (choices.length >= 25) break;
                        }
                    }
                }

                return NextResponse.json({
                    type: 8,
                    data: { choices }
                });
            }

            if (commandName === "metiers" && focusedOption?.name === "metier") {
                const query = normSearch(focusedOption.value || "");
                const allJobs = (Object.values(DOFUS_JOBS) as unknown as Array<Array<{ id: string; name: string }>>).flat();
                const choices = allJobs
                    .filter((j) => !query || normSearch(j.name).includes(query) || normSearch(j.id).includes(query))
                    .slice(0, 25)
                    .map((j) => ({ name: j.name.slice(0, 100), value: j.id.slice(0, 100) }));

                return NextResponse.json({ type: 8, data: { choices } });
            }

            if (commandName === "ocre" && focusedOption?.name === "archimonstre") {
                const query = (focusedOption.value || "").trim();
                const archis = await db.archimonstre.findMany({
                    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
                    select: { name: true, level: true, zone: true },
                    orderBy: { name: "asc" },
                    take: 25
                });

                return NextResponse.json({
                    type: 8,
                    data: {
                        choices: archis.map((a) => {
                            const meta = [a.level ? `Niv. ${a.level}` : null, a.zone].filter(Boolean).join(" • ");
                            return {
                                name: (meta ? `${a.name} (${meta})` : a.name).slice(0, 100),
                                value: a.name.slice(0, 100)
                            };
                        })
                    }
                });
            }

            // Default empty autocomplete for unhandled options
            return NextResponse.json({ type: 8, data: { choices: [] } });
        }

        // ================================================================
        // TYPE 2 — SLASH COMMAND (Application Command)
        // ================================================================
        if (payload.type === 2) {
            const commandName: string = payload.data?.name;
            const { guild_id, member } = payload;
            const discordUserId: string = member?.user?.id || payload.user?.id;
            const userRoleIds: string[] = member?.roles || [];

            // RBAC Gate — check GuildSlashCommandPermission
            if (guild_id) {
                const channelId: string = payload.channel_id || payload.channel?.id || "";
                const guildConfig = await db.guildConfig.findUnique({
                    where: { discordGuildId: guild_id },
                    include: {
                        slashCommandPermissions: {
                            where: { commandName }
                        }
                    }
                });

                if (guildConfig) {
                    const perm = guildConfig.slashCommandPermissions[0];
                    // Commande `staffOnly` (ex. `/valider-recrue`) : elle n'existe sur la
                    // guilde que si God l'a autorisée. Aucune ligne = pas déployée = refus,
                    // même si un client Discord l'a encore en cache (fail-closed).
                    const { SLASH_COMMANDS_CATALOG: catalogForGate } = await import("@/lib/slash-commands-catalog");
                    const catalogCommand = catalogForGate.find((command) => command.name === commandName);
                    if (catalogCommand?.staffOnly && !perm) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "🚫 Cette commande n'est pas déployée sur ce serveur.",
                                flags: 64,
                            },
                        });
                    }
                    if (perm && !perm.isEnabled) {
                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: "🚫 Cette commande est désactivée par le staff de ta guilde.",
                                flags: 64
                            }
                        });
                    }
                    if (perm && perm.channelIds && perm.channelIds.length > 0) {
                        if (!channelId || !perm.channelIds.includes(channelId)) {
                            const allowedChannels = perm.channelIds.map((cId: string) => `<#${cId}>`).join(", ");
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: `🚫 La commande \`/${commandName}\` n'est pas autorisée dans ce salon.\n👉 Salon(s) autorisé(s) : ${allowedChannels}`,
                                    flags: 64
                                }
                            });
                        }
                    }
                    if (perm && perm.roleIds.length > 0) {
                        const hasRole = userRoleIds.some((r) => perm.roleIds.includes(r));
                        if (!hasRole) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "🚫 Tes rôles Discord ne t'autorisent pas à utiliser `/" + commandName + "`. Contacte un admin de ta guilde.",
                                    flags: 64
                                }
                            });
                        }
                    }
                }
            }

            // ── /almanax ──────────────────────────────────────────────
            if (commandName === "almanax") {
                const appBaseUrl = getAppBaseUrl();
                const dateInput = payload.data?.options?.find((o: any) => o.name === "date")?.value;
                const isoDate = parseAlmanaxDateInput(dateInput);

                if (!isoDate) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "❌ Date invalide. Utilise le format `JJ/MM/AAAA` (ex: `/almanax date:09/09/2026`) ou omet la date pour aujourd'hui.",
                            flags: 64
                        }
                    });
                }

                const { getUpcomingAlmanax } = await import("@/server/actions/resources-actions");
                const list = await getUpcomingAlmanax();
                const item = list.find((a) => a.date.slice(0, 10) === isoDate);

                if (!item) {
                    const hasAny = list.length > 0;
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: hasAny
                                ? `❌ Pas d'Almanax pour le ${frenchLongDate(isoDate)} (données ~30 jours autour d'aujourd'hui).`
                                : "❌ Almanax temporairement indisponible. Réessaie dans quelques minutes.",
                            flags: 64
                        }
                    });
                }

                const fields: { name: string; value: string; inline?: boolean }[] = [
                    { name: "🎁 Offrande", value: `×${item.tribute.quantity} ${item.tribute.item.name}`, inline: true },
                    { name: "✨ Bonus", value: item.bonus.description || item.bonus.type.name, inline: false },
                ];
                if (item.reward_kamas && item.reward_kamas > 0) {
                    fields.push({ name: "💰 Kamas", value: Number(item.reward_kamas).toLocaleString("fr-FR"), inline: true });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `📅 Almanax — ${frenchLongDate(isoDate)}`,
                            color: 0xF4A261,
                            thumbnail: item.tribute.item.image_urls?.icon ? { url: item.tribute.item.image_urls.icon } : undefined,
                            fields,
                            url: `${appBaseUrl}/almanax`,
                            footer: { text: "SigilOS • Almanax" },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 0
                    }
                });
            }

            // ── /profil ───────────────────────────────────────────────
            if (commandName === "profil") {
                const targetMember = payload.data?.options?.find((o: any) => o.name === "membre");
                const lookupId = targetMember?.value || discordUserId;
                const appBaseUrl = getAppBaseUrl();

                const resolvedUser = payload.data?.resolved?.users?.[lookupId];
                const resolvedMember = payload.data?.resolved?.members?.[lookupId];
                const avatarHash: string | undefined = resolvedUser?.avatar;
                const avatarUrl = avatarHash
                    ? `https://cdn.discordapp.com/avatars/${lookupId}/${avatarHash}.png?size=256`
                    : undefined;
                const discordDisplayName: string | undefined =
                    resolvedMember?.nick || resolvedUser?.global_name || resolvedUser?.username;

                const account = await db.account.findFirst({
                    where: { provider: "discord", providerAccountId: lookupId },
                    include: {
                        user: {
                            include: {
                                profiles: {
                                    where: guild_id ? { guild: { discordGuildId: guild_id } } : undefined,
                                    take: 1,
                                    select: {
                                        id: true,
                                        pseudoDofus: true,
                                        discordNickname: true,
                                        classe: true,
                                        metiers: true,
                                        preferredActivities: true,
                                        altPseudos: true,
                                        successPoints: true,
                                        hasLegendaryPrerequisites: true,
                                        availability: true,
                                        guildJoinedAt: true,
                                        createdAt: true,
                                    }
                                }
                            }
                        }
                    }
                });

                const profile = account?.user?.profiles?.[0];
                if (!profile) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "❌ Ce membre n'a pas encore de profil SigilOS. Il doit se connecter sur le site !",
                            flags: 64
                        }
                    });
                }

                const displayName = profile.pseudoDofus || profile.discordNickname || discordDisplayName || "Membre SigilOS";
                const joinedDate = profile.guildJoinedAt || profile.createdAt;
                const memberSince = joinedDate
                    ? new Date(joinedDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                    : null;
                const profileUrl = guild_id
                    ? `${appBaseUrl}/dashboard/${guild_id}/members/${profile.id}`
                    : undefined;

                // Métiers 200
                const rawMetiers = Array.isArray(profile.metiers) ? (profile.metiers as any[]) : [];
                const metiers200: string[] = [];
                for (const m of rawMetiers) {
                    if (typeof m === "object" && m !== null) {
                        if (m.level === 200 && m.name) {
                            metiers200.push(m.name);
                        }
                    } else if (typeof m === "string") {
                        const match = m.match(/^(.+?)\s+200$/);
                        if (match) {
                            metiers200.push(match[1].trim());
                        }
                    }
                }
                const metiers200Display = metiers200.length > 0
                    ? metiers200.join(" • ")
                    : "Aucun";

                // Activités appréciées
                const rawActivities = Array.isArray(profile.preferredActivities) ? (profile.preferredActivities as string[]) : [];
                const activityLabels = rawActivities.map((id) => {
                    const found = PREFERRED_ACTIVITIES.find((a) => a.id === id);
                    return found ? `${found.icon} ${found.label}` : id;
                });
                const activitiesDisplay = activityLabels.length > 0
                    ? activityLabels.join(" • ")
                    : "Non renseigné";

                // Mules
                const rawAlts = Array.isArray(profile.altPseudos) ? (profile.altPseudos as any[]) : [];
                const mules = rawAlts.map((m) => {
                    if (typeof m === "string") return m;
                    if (m && typeof m === "object" && m.pseudo) {
                        return m.classe ? `${m.pseudo} (${m.classe})` : m.pseudo;
                    }
                    return null;
                }).filter(Boolean);
                const mulesDisplay = mules.length > 0
                    ? mules.join(", ")
                    : "Aucune";

                // Succès
                const successPointsDisplay = profile.successPoints
                    ? `${profile.successPoints.toLocaleString("fr-FR")} pts`
                    : "0 pt";

                // Craft Légendaire (éligibilité si prérequis cochés)
                const legendaryDisplay = profile.hasLegendaryPrerequisites
                    ? "✅ Éligible"
                    : "❌ Non éligible";

                // Planning de la semaine
                const formatPlanning = (availability: any): string => {
                    if (!availability || typeof availability !== "object") return "pas renseigné";
                    const isLegacy = Object.keys(availability).some((k) => DAYS_OF_WEEK.includes(k as any));
                    const template = isLegacy ? availability : (availability.template || {});

                    const now = new Date();
                    const target = new Date(now.valueOf());
                    const dayNr = (now.getDay() + 6) % 7;
                    target.setDate(target.getDate() - dayNr + 3);
                    const firstThursday = target.valueOf();
                    target.setMonth(0, 1);
                    if (target.getDay() !== 4) {
                        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                    }
                    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
                    const currentWeekKey = `${now.getFullYear()}-W${weekNum}`;

                    const weekData = (!isLegacy && availability.weeks) ? availability.weeks[currentWeekKey] : null;
                    const effective = weekData || template;

                    const DAY_NAMES: Record<string, string> = {
                        lundi: "Lun",
                        mardi: "Mar",
                        mercredi: "Mer",
                        jeudi: "Jeu",
                        vendredi: "Ven",
                        samedi: "Sam",
                        dimanche: "Dim",
                    };
                    const SLOT_NAMES: Record<string, string> = {
                        matin: "Matin",
                        midi: "Aprem",
                        soir: "Soir",
                        nuit: "Nuit",
                    };

                    const lines: string[] = [];
                    for (const day of DAYS_OF_WEEK) {
                        const slots = effective[day];
                        if (Array.isArray(slots) && slots.length > 0) {
                            const dayLabel = DAY_NAMES[day] || day;
                            const slotLabels = slots.map((s: string) => SLOT_NAMES[s] || s).join(", ");
                            lines.push(`• **${dayLabel} :** ${slotLabels}`);
                        }
                    }

                    return lines.length > 0 ? lines.join("\n") : "pas renseigné";
                };

                const planningDisplay = formatPlanning(profile.availability);

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `🎖️ ${displayName}`,
                            color: 0x5865F2,
                            thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                            fields: [
                                { name: "Classe", value: profile.classe || "Non définie", inline: true },
                                { name: "Points de Succès", value: successPointsDisplay, inline: true },
                                ...(memberSince ? [{ name: "Membre depuis", value: memberSince, inline: true }] : []),
                                { name: "Craft Légendaire", value: legendaryDisplay, inline: true },
                                { name: `🔨 Métiers 200 (${metiers200.length})`, value: metiers200Display, inline: false },
                                { name: "Activités appréciées", value: activitiesDisplay, inline: false },
                                { name: `Mules (${mules.length})`, value: mulesDisplay, inline: false },
                                { name: "Planning de la semaine", value: planningDisplay, inline: false },
                            ],
                            url: profileUrl,
                            footer: { text: "SigilOS • Fiche membre" }
                        }],
                        flags: 0
                    }
                });
            }

            // ── /boss ─────────────────────────────────────────────────
            if (commandName === "boss") {
                const monsterName = payload.data?.options?.find((o: any) => o.name === "nom")?.value?.trim();
                const appBaseUrl = getAppBaseUrl();

                if (!monsterName) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "💀 Utilise `/boss nom:Comte Harebourg` pour consulter la fiche d'un boss !",
                            flags: 64
                        }
                    });
                }

                // ⚡ Discord impose une réponse < 3 s : lecture 100 % locale, ZÉRO réseau.
                // L'ancien chemin réseau enchaînait jusqu'à ~6 fetch externes (8 s chacun)
                // dès que le boss manquait en local ⇒ timeout systématique (« n'a pas répondu »).
                const { getLocalMonsterFiche } = await import("@/lib/monster-stats-core");
                const fiche = await getLocalMonsterFiche(monsterName);

                if (!fiche?.data) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `❌ Boss « ${monsterName} » introuvable en local.\n💡 Choisis un nom dans la liste d'autocomplétion, ou ouvre la fiche complète sur le site.`,
                            flags: 64
                        }
                    });
                }

                const mob = fiche.data;
                const grades = Array.isArray(mob.grades) ? mob.grades : [];
                const g = grades[grades.length - 1] || grades[0];
                const resists = g?.resists || {};
                // Nom du donjon pour l'embed (la fiche Unity n'en porte pas).
                let bossDungeonName: string | undefined = mob.dungeonName;
                if (!bossDungeonName) {
                    const dj = await db.dungeon.findFirst({
                        where: { bossName: { equals: monsterName, mode: "insensitive" } },
                        select: { name: true },
                    });
                    if (dj?.name) bossDungeonName = dj.name;
                }
                const succesUrl = guild_id
                    ? `${appBaseUrl}/dashboard/${guild_id}/succes`
                    : `${appBaseUrl}`;

                const fields: { name: string; value: string; inline?: boolean }[] = [
                    { name: "❤️ PV", value: g?.lifePoints ? Number(g.lifePoints).toLocaleString("fr-FR") : "—", inline: true },
                    { name: "⚡ PA / PM", value: `${g?.actionPoints ?? "—"} / ${g?.movementPoints ?? "—"}`, inline: true },
                    { name: "📍 Coordonnées", value: mob.coordinates ? `[${mob.coordinates.x}, ${mob.coordinates.y}]` : "Donjon", inline: true },
                    ...(bossDungeonName ? [{ name: "🏰 Donjon", value: `${bossDungeonName}`, inline: false }] : []),
                    {
                        name: "🛡️ Résistances",
                        value: `⚪ ${resists.neutral ?? 0}%  •  🟤 ${resists.earth ?? 0}%  •  🔴 ${resists.fire ?? 0}%\n🔵 ${resists.water ?? 0}%  •  🟢 ${resists.air ?? 0}%`,
                        inline: false
                    }
                ];

                if (mob.spells && mob.spells.length > 0) {
                    const topSpells = mob.spells.slice(0, 4).map((s: any) => {
                        const po = s.range > 0 ? `${s.minRange > 0 ? `${s.minRange}-` : ""}${s.range} PO` : "CàC";
                        const los = s.castTestLos ? "" : " (Sans LdV)";
                        return `• **${s.name}** (${s.apCost} PA • ${po}${los})`;
                    }).join("\n");
                    fields.push({ name: "⚔️ Sorts majeurs", value: topSpells, inline: false });
                }

                if (mob.drops && mob.drops.length > 0) {
                    const topDrops = mob.drops.slice(0, 3).map((d: any) => `• ${d.name} (${d.percent}%)`).join("\n");
                    fields.push({ name: "💎 Drops notables", value: topDrops, inline: false });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `💀 ${mob.name} (Niv. ${g?.level || "?"})`,
                            color: 0xED4245,
                            thumbnail: mob.imageUrl ? { url: mob.imageUrl } : undefined,
                            fields,
                            url: succesUrl,
                            footer: { text: "SigilOS • Bestiaire & Boss" },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 0
                    }
                });
            }

            // ── /monstre ──────────────────────────────────────────────
            if (commandName === "monstre") {
                const monsterName = payload.data?.options?.find((o: any) => o.name === "nom")?.value?.trim();
                const appBaseUrl = getAppBaseUrl();

                if (!monsterName) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: "👾 Utilise `/monstre nom:Bouftou` pour consulter la fiche d'un monstre !",
                            flags: 64
                        }
                    });
                }

                // ⚡ Même contrainte < 3 s que /boss : lecture 100 % locale, ZÉRO réseau.
                const { getLocalMonsterFiche } = await import("@/lib/monster-stats-core");
                const fiche = await getLocalMonsterFiche(monsterName);

                if (!fiche?.data) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `❌ Monstre « ${monsterName} » introuvable en local.\n💡 Tape les premières lettres et choisis dans la liste déroulante d'autocomplétion !`,
                            flags: 64
                        }
                    });
                }

                const mob = fiche.data;
                const monsterGrades = Array.isArray(mob.grades) ? mob.grades : [];
                const g = monsterGrades[monsterGrades.length - 1] || monsterGrades[0];
                const resists = g?.resists || {};
                const succesUrl = guild_id
                    ? `${appBaseUrl}/dashboard/${guild_id}/succes`
                    : `${appBaseUrl}`;

                const fields: { name: string; value: string; inline?: boolean }[] = [
                    { name: "❤️ PV", value: g?.lifePoints ? Number(g.lifePoints).toLocaleString("fr-FR") : "—", inline: true },
                    { name: "⚡ PA / PM", value: `${g?.actionPoints ?? "—"} / ${g?.movementPoints ?? "—"}`, inline: true },
                    { name: "📍 Coordonnées", value: mob.coordinates ? `[${mob.coordinates.x}, ${mob.coordinates.y}]` : "Monde", inline: true },
                    ...(mob.dungeonName ? [{ name: "🏰 Donjon", value: `${mob.dungeonName}`, inline: false }] : []),
                    {
                        name: "🛡️ Résistances",
                        value: `⚪ ${resists.neutral ?? 0}%  •  🟤 ${resists.earth ?? 0}%  •  🔴 ${resists.fire ?? 0}%\n🔵 ${resists.water ?? 0}%  •  🟢 ${resists.air ?? 0}%`,
                        inline: false
                    }
                ];

                if (mob.spells && mob.spells.length > 0) {
                    const topSpells = mob.spells.slice(0, 4).map((s: any) => {
                        const po = s.range > 0 ? `${s.minRange > 0 ? `${s.minRange}-` : ""}${s.range} PO` : "CàC";
                        const los = s.castTestLos ? "" : " (Sans LdV)";
                        return `• **${s.name}** (${s.apCost} PA • ${po}${los})`;
                    }).join("\n");
                    fields.push({ name: "⚔️ Sorts majeurs", value: topSpells, inline: false });
                }

                if (mob.drops && mob.drops.length > 0) {
                    const topDrops = mob.drops.slice(0, 3).map((d: any) => `• ${d.name} (${d.percent}%)`).join("\n");
                    fields.push({ name: "💎 Drops notables", value: topDrops, inline: false });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `👾 ${mob.name} (Niv. ${g?.level || "?"})`,
                            color: 0x3498DB,
                            thumbnail: mob.imageUrl ? { url: mob.imageUrl } : undefined,
                            fields,
                            url: succesUrl,
                            footer: { text: "SigilOS • Bestiaire & Monstres" },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 0
                    }
                });
            }

            // ── /metiers ──────────────────────────────────────────────
            if (commandName === "metiers") {
                const rawJob = payload.data?.options?.find((o: any) => o.name === "metier")?.value?.trim();
                const appBaseUrl = getAppBaseUrl();

                if (!rawJob) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "🔨 Utilise `/metiers metier:Tailleur` pour trouver qui a ce métier dans ta guilde !", flags: 64 }
                    });
                }

                const allJobs = (Object.values(DOFUS_JOBS) as unknown as Array<Array<{ id: string; name: string }>>).flat();
                const q = normSearch(rawJob);
                const job = allJobs.find((j) => normSearch(j.id) === q)
                    ?? allJobs.find((j) => normSearch(j.name) === q)
                    ?? allJobs.find((j) => normSearch(j.name).includes(q) && q.length > 0);

                if (!job) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: `❌ Métier « ${rawJob} » inconnu. Exemples : Tailleur, Mineur, Forgemage…`, flags: 64 }
                    });
                }

                if (!guild_id) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Cette commande doit être utilisée dans un serveur Discord.", flags: 64 }
                    });
                }

                const guildConfig = await db.guildConfig.findUnique({
                    where: { discordGuildId: guild_id },
                    select: { id: true }
                });
                if (!guildConfig) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "❌ Cette guilde n'est pas enregistrée sur SigilOS.", flags: 64 }
                    });
                }

                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE" },
                    select: { pseudoDofus: true, discordNickname: true, metiers: true }
                });

                const holders: Array<{ name: string; level: number | null }> = [];
                for (const p of profiles) {
                    const list = Array.isArray(p.metiers) ? (p.metiers as any[]) : [];
                    for (const m of list) {
                        const mid = typeof m === "string" ? null : (m?.id ?? null);
                        const mname = typeof m === "string" ? m : (m?.name ?? "");
                        const lvl = typeof m === "string" ? null : (typeof m?.level === "number" ? m.level : null);
                        if ((mid && normSearch(mid) === normSearch(job.id)) || normSearch(mname) === normSearch(job.name)) {
                            holders.push({ name: p.pseudoDofus || p.discordNickname || "Membre", level: lvl });
                            break;
                        }
                    }
                }
                holders.sort((a, b) => (b.level ?? -1) - (a.level ?? -1));
                const top = holders.slice(0, 10);

                if (top.length === 0) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            embeds: [{
                                title: `🔨 ${job.name} — personne trouvée`,
                                description: `Aucun membre n'a renseigné ce métier.\n👉 Chacun peut ajouter ses métiers dans son profil SigilOS.`,
                                color: 0xFEE75C,
                                footer: { text: "SigilOS • Métiers de guilde" }
                            }],
                            flags: 0
                        }
                    });
                }

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `🔨 ${job.name} (${holders.length})`,
                            description: top.map((h) => `• **${h.name}** — Niv. ${h.level ?? "?"}`).join("\n"),
                            color: 0x57F287,
                            url: `${appBaseUrl}/dashboard/${guild_id}/members`,
                            footer: { text: "SigilOS • Métiers de guilde" },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 0
                    }
                });
            }

            // ── /ocre ─────────────────────────────────────────────────
            if (commandName === "ocre") {
                const rawName = payload.data?.options?.find((o: any) => o.name === "archimonstre")?.value?.trim();
                const appBaseUrl = getAppBaseUrl();

                if (!rawName) {
                    return NextResponse.json({
                        type: 4,
                        data: { content: "🥚 Utilise `/ocre archimonstre:Aboubra` pour voir où apparaît un archimonstre !", flags: 64 }
                    });
                }

                const archi = await db.archimonstre.findFirst({
                    where: { name: { equals: rawName, mode: "insensitive" } },
                    select: { name: true, level: true, zone: true, subzone: true, imageUrl: true, type: true }
                }) ?? await db.archimonstre.findFirst({
                    where: { name: { contains: rawName, mode: "insensitive" } },
                    select: { name: true, level: true, zone: true, subzone: true, imageUrl: true, type: true }
                });

                if (!archi) {
                    return NextResponse.json({
                        type: 4,
                        data: {
                            content: `❌ Archimonstre « ${rawName} » introuvable.\n💡 Tape les premières lettres et choisis dans la liste déroulante d'autocomplétion !`,
                            flags: 64
                        }
                    });
                }

                const zone = [archi.zone, archi.subzone].filter(Boolean).join(" — ") || "Zone inconnue";
                const fields: { name: string; value: string; inline?: boolean }[] = [
                    { name: "📍 Zone", value: zone, inline: false },
                    { name: "⭐ Niveau", value: archi.level ? `${archi.level}` : "—", inline: true },
                ];

                return NextResponse.json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: `🥚 ${archi.name}`,
                            color: 0x9B59B6,
                            thumbnail: archi.imageUrl ? { url: archi.imageUrl } : undefined,
                            fields,
                            url: guild_id ? `${appBaseUrl}/dashboard/${guild_id}/quete-ocre` : `${appBaseUrl}`,
                            footer: { text: "SigilOS • Quête Ocre" },
                            timestamp: new Date().toISOString()
                        }],
                        flags: 0
                    }
                });
            }

            // ── /valider-recrue (STAFF — ouvre la modale de saisie registre) ──
            if (commandName === "valider-recrue") {
                // Gate : permission dashboard « Ressources Humaines », **ou** rôle Discord
                // listé dans le dashboard, **ou** admin Discord. Les deux sources ne doivent
                // plus se contredire : un EMPEREUR autorisé côté dashboard passait la porte
                // Discord puis se faisait refuser ici (mesure du 24/10/2026).
                const { internalCheckPermission } = await import("@/server/actions/user-actions");
                const { PERMISSION_IDS } = await import("@/lib/permissions");
                const isDiscordAdmin = (BigInt(member?.permissions || "0") & BigInt(0x8)) === BigInt(0x8);
                const roleGate = guild_id
                    ? await db.guildSlashCommandPermission.findFirst({
                          where: { commandName: "valider-recrue", guild: { discordGuildId: guild_id } },
                          select: { roleIds: true },
                      })
                    : null;
                const hasGuildRole = (roleGate?.roleIds ?? []).some((roleId) => userRoleIds.includes(roleId));
                let isStaff = false;
                try {
                    isStaff = guild_id
                        ? await internalCheckPermission(guild_id, discordUserId, PERMISSION_IDS.STAFF_MEMBER_MGMT)
                        : false;
                } catch {
                    isStaff = false;
                }
                if (!isStaff && !hasGuildRole && !isDiscordAdmin) {
                    return ephemeralDiscordRefusal(
                        "🚫 `/valider-recrue` est réservée au staff : permission « Ressources Humaines » ou rôle autorisé par la guilde."
                    );
                }

                const opt = (name: string): string | undefined =>
                    payload.data?.options?.find((o: any) => o.name === name)?.value;
                const targetId: string | undefined = opt("membre");
                if (!targetId || !guild_id) {
                    return ephemeralDiscordMessage("❌ Utilise `/valider-recrue membre:@pseudo` dans un serveur lié à SigilOS.");
                }

                const guildConfig = await db.guildConfig.findUnique({
                    where: { discordGuildId: guild_id },
                    select: { id: true, trialDurationDays: true },
                });
                if (!guildConfig) {
                    return ephemeralDiscordMessage("❌ Ce serveur n'est pas lié à SigilOS.");
                }

                const findGuildProfile = async (discordId: string) => {
                    const account = await db.account.findFirst({
                        where: { provider: "discord", providerAccountId: discordId },
                        include: {
                            user: {
                                include: {
                                    profiles: {
                                        where: { guildId: guildConfig.id },
                                        take: 1,
                                        select: {
                                            id: true,
                                            pseudoDofus: true,
                                            discordNickname: true,
                                            ankamaId: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                    return account?.user?.profiles?.[0] ?? null;
                };

                const profile = await findGuildProfile(targetId);
                // B-2 : plus besoin d'un profil dashboard pour compléter une recrue. Sans profil,
                // on préremplit depuis la ligne de registre (hors dashboard) si elle existe.
                const registryEntry = profile
                    ? null
                    : await db.memberRegistryEntry.findUnique({
                          where: { guildId_discordId: { guildId: guildConfig.id, discordId: targetId } },
                          select: { pseudoDofus: true, ankamaId: true },
                      });

                // Date du jour JJ/MM/AAAA (prépopulée avec la date du jour et non la date existante, éditable)
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, "0");
                const todayFr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
                const targetName =
                    profile?.pseudoDofus ||
                    profile?.discordNickname ||
                    registryEntry?.pseudoDofus ||
                    "Recrue";

                return NextResponse.json({
                    type: 9, // MODAL
                    data: {
                        custom_id: `valrecrue:submit:${targetId}`,
                        title: `Validation : ${targetName.slice(0, 25)}`,
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 4,
                                        custom_id: "pseudo_dofus",
                                        label: "Pseudo Dofus",
                                        style: 1,
                                        placeholder: "Ex: Wylan",
                                        required: true,
                                        min_length: 2,
                                        max_length: 30,
                                        value: profile?.pseudoDofus || registryEntry?.pseudoDofus || "",
                                    },
                                ],
                            },
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 4,
                                        custom_id: "tag_ankama",
                                        label: "Tag Ankama (format : Pseudo#0000)",
                                        style: 1,
                                        placeholder: "Ex: Michmich#4777",
                                        required: false,
                                        max_length: 60,
                                        value: profile?.ankamaId || registryEntry?.ankamaId || "",
                                    },
                                ],
                            },
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 4,
                                        custom_id: "arrivee",
                                        label: "Date d'arrivée (JJ/MM/AAAA)",
                                        style: 1,
                                        placeholder: "JJ/MM/AAAA",
                                        required: true,
                                        max_length: 10,
                                        value: todayFr,
                                    },
                                ],
                            },
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 4,
                                        custom_id: "recruteur",
                                        label: "Recruté par (vide = toi)",
                                        style: 1,
                                        placeholder: "Pseudo ou mention Discord (vide = toi)",
                                        required: false,
                                        max_length: 50,
                                        // Vide par défaut : le recruteur est **l'auteur de
                                        // l'interaction** (le champ reste éditable pour un
                                        // autre pseudo), il n'est plus passé en option.
                                        value: "",
                                    },
                                ],
                            },
                        ],
                    },
                });
            }

            // ── Commandes Slash Personnalisées de Tickets ─────────────────────────
            if (guild_id) {
                const { readTicketCustomCommands, interpolateTicketCommandTokens } = await import(
                    "@/lib/tickets/custom-commands"
                );
                const { addRoleToMember, removeRoleFromMember } = await import("@/server/discord");
                const { internalHandleTicketClose } = await import("@/server/actions/ticket-bot-actions");

                const ticketConfig = await db.ticketGuildConfig.findFirst({
                    where: { guild: { discordGuildId: guild_id } },
                    include: { guild: true },
                });

                if (ticketConfig?.isEnabled) {
                    const customCommands = readTicketCustomCommands(ticketConfig.settingsJson);
                    const matchedCmd = customCommands.find(
                        (c) => c.isEnabled && c.name.toLowerCase() === commandName.toLowerCase()
                    );

                    if (matchedCmd) {
                        const channelId: string = payload.channel_id || payload.channel?.id || "";

                        // Verrou 1 : Salon ticket ouvert obligatoire
                        const ticket = await db.ticketRecord.findFirst({
                            where: {
                                guildId: ticketConfig.guildId,
                                discordChannelId: channelId,
                                status: { in: ["OPEN", "CLAIMED"] },
                            },
                            include: { journey: true },
                        });

                        if (!ticket) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "💡 Cette commande est un outil d'assistance réservé aux salons tickets.",
                                    flags: 64,
                                },
                            });
                        }

                        // Verrou anti-spam : max 3 exécutions par 5s par utilisateur
                        if ((await consumeRateLimit(`ticket-cmd:${discordUserId}:${channelId}`, 3, 5_000)) > 0) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "⏳ Merci de patienter quelques secondes avant de réutiliser une commande sur ce ticket.",
                                    flags: 64,
                                },
                            });
                        }

                        // Verrou 2 : Whitelist & Autorisations
                        const isGuildAdmin = (BigInt(member?.permissions || "0") & BigInt(0x8)) === BigInt(0x8);
                        const motifStaff = ticket.journey?.staffRoleIds || [];
                        const globalStaff = ticketConfig.staffRoleIds || [];
                        const allStaffRoleIds = [...new Set([...motifStaff, ...globalStaff])];
                        let isAllowed = isGuildAdmin;

                        if (!isAllowed) {
                            if (matchedCmd.permissionMode === "ALL") {
                                isAllowed = true;
                            } else if (matchedCmd.permissionMode === "CUSTOM_ROLES") {
                                const allowed = matchedCmd.allowedRoleIds || [];
                                isAllowed = allowed.length === 0 || userRoleIds.some((r) => allowed.includes(r));
                            } else {
                                // STAFF_ONLY
                                isAllowed = allStaffRoleIds.length === 0 || userRoleIds.some((r) => allStaffRoleIds.includes(r));
                            }
                        }

                        if (!isAllowed) {
                            return NextResponse.json({
                                type: 4,
                                data: {
                                    content: "🚫 Tes rôles Discord ne t'autorisent pas à utiliser cette commande.",
                                    flags: 64,
                                },
                            });
                        }

                        // Résolution du membre cible (option `membre` ou demandeur)
                        const memberOption = payload.data?.options?.find((opt: any) => opt.name === "membre");
                        const targetUserId = memberOption?.value ? String(memberOption.value) : ticket.creatorDiscordId;
                        const targetUserObj = payload.data?.resolved?.users?.[targetUserId];
                        const targetPseudo =
                            payload.data?.resolved?.members?.[targetUserId]?.nick ||
                            targetUserObj?.global_name ||
                            targetUserObj?.username ||
                            (targetUserId === ticket.creatorDiscordId ? ticket.creatorDiscordName : "Membre");
                        const targetAvatar = targetUserObj?.avatar
                            ? `https://cdn.discordapp.com/avatars/${targetUserId}/${targetUserObj.avatar}.png`
                            : undefined;

                        // Exécution des actions sur les rôles
                        if (matchedCmd.addRoleIds && matchedCmd.addRoleIds.length > 0) {
                            for (const rId of matchedCmd.addRoleIds) {
                                await addRoleToMember(guild_id, targetUserId, rId);
                            }
                        }
                        if (matchedCmd.removeRoleIds && matchedCmd.removeRoleIds.length > 0) {
                            for (const rId of matchedCmd.removeRoleIds) {
                                await removeRoleFromMember(guild_id, targetUserId, rId);
                            }
                        }

                        // Contexte pour le remplacement des variables
                        const cmdCtx = {
                            demandeurId: ticket.creatorDiscordId,
                            demandeurPseudo: ticket.creatorDiscordName,
                            targetId: targetUserId,
                            targetPseudo,
                            targetAvatar,
                            staffId: discordUserId,
                            staffPseudo: member?.user?.global_name || member?.user?.username || member?.nick || "Staff",
                            staffRoleIds: allStaffRoleIds,
                            ticketNumero: ticket.ticketNumber,
                            ticketMotif: ticket.journey?.name || "Support",
                            channelId,
                            serverName: ticketConfig.guild.name,
                        };

                        const textContent = interpolateTicketCommandTokens(matchedCmd.content, cmdCtx);

                        // Construction de l'embed
                        const responseEmbeds: any[] = [];
                        if (matchedCmd.embedEnabled && matchedCmd.embed) {
                            const emb = matchedCmd.embed;
                            const embTitle = interpolateTicketCommandTokens(emb.title, cmdCtx);
                            const embDesc = interpolateTicketCommandTokens(emb.description, cmdCtx);
                            const embFooter = interpolateTicketCommandTokens(emb.footer, cmdCtx);

                            const colorHex = emb.color?.replace("#", "").trim() || "5865F2";
                            const colorInt = parseInt(colorHex, 16) || 0x5865f2;

                            responseEmbeds.push({
                                title: embTitle || undefined,
                                description: embDesc || undefined,
                                color: colorInt,
                                image: emb.imageUrl ? { url: emb.imageUrl } : undefined,
                                thumbnail: emb.thumbnailUrl ? { url: emb.thumbnailUrl } : undefined,
                                footer: embFooter ? { text: embFooter } : undefined,
                            });
                        }

                        // Clôture automatique du ticket si demandée
                        if (matchedCmd.autoCloseTicket) {
                            try {
                                const actor = resolveInteractionActor(payload);
                                if (actor) {
                                    const ticketActorContext: TicketAuthorizationContext = {
                                        discordUserId: actor.discordUserId,
                                        discordUserName: actor.displayName,
                                        discordUserRoleIds: actor.roleIds,
                                        discordUserIsAdmin: actor.isGuildAdmin,
                                        hasStaffPermission: isAllowed,
                                    };
                                    await internalHandleTicketClose({
                                        discordGuildId: guild_id,
                                        discordUserId: actor.discordUserId,
                                        discordUserName: actor.displayName,
                                        ticketId: ticket.id,
                                        actor: ticketActorContext,
                                        reason: `Exécution de la commande /${matchedCmd.name}`,
                                    });
                                }
                            } catch (closeErr) {
                                logger.warn("[TicketCustomCommand] Échec clôture automatique:", closeErr);
                            }
                        }

                        return NextResponse.json({
                            type: 4,
                            data: {
                                content: textContent || (responseEmbeds.length === 0 ? "✅ Commande exécutée." : undefined),
                                embeds: responseEmbeds.length > 0 ? responseEmbeds : undefined,
                                flags: matchedCmd.ephemeral ? 64 : undefined,
                            },
                        });
                    }
                }
            }

            return NextResponse.json({ type: 4, data: { content: "Commande inconnue.", flags: 64 } });
        }

        return NextResponse.json({ error: "Unknown type" }, { status: 400 });

    } catch (error) {
        // 🔇 Une réponse 5xx s'affiche « L'application n'a pas répondu » dans Discord.
        // On répond donc **toujours** une interaction valide (refus éphémère) et on
        // journalise l'erreur réelle pour Sentry.
        logger.error("[Discord Interaction] Error:", error);
        return NextResponse.json({
            type: 4,
            data: {
                content: "❌ Une erreur interne est survenue. Réessaie dans un instant.",
                flags: 64,
            },
        });
    } finally {
        // ⏱️ Trace **par chemin** : jusqu'ici, rien ne disait quelle interaction
        // frôlait les 3 s de Discord (les logs bêta étaient vides sur 40 min).
        const elapsedMs = Date.now() - interactionStartedAt;
        if (elapsedMs > 2_500) {
            logger.warn("[Discord Interaction] interaction lente (> budget)", {
                elapsedMs,
                interaction: interactionLabel,
            });
        }
    }
}
