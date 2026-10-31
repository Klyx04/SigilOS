/**
 * Taxonomie des journaux d'audit — **source unique, pure** (importable client + serveur).
 *
 * Audit croisé du 24/09/2026 : il n'existait **aucune séparation** audit/sécurité.
 * Tout vivait dans `AuditLog` et était classé par conventions d'`action` ⇒ l'écran
 * de droite de `/god` s'appelait « **Security Feed** » tout en affichant
 * `CONFIG_UPDATED` et `WEBHOOK_MEMBER_UPDATE`, et les deux écrans God affichaient
 * le **même total brut**. La catégorie est donc une **liste fermée** :
 *
 * - **security** — incidents et refus : contenu dangereux signalé, accès admin
 *   complet refusé, code d'accès bêta erroné, contournement God. Ce sont les
 *   événements qu'un staff doit voir **en premier**, jamais noyés dans la vie
 *   quotidienne des guildes.
 * - **functional** — tout le reste : vie de guilde (membres, profils, missions,
 *   bonus, sondages, marché) et configuration, y compris les actions God
 *   « métier » (whitelist, ban plateforme, sync base de données).
 *
 * ⚠️ Toute action nouvelle doit être classée ici **explicitement** : `auditCategoryOf`
 * ne devine pas, il range par défaut dans `functional` (le bruit ne doit jamais
 * atterrir dans la catégorie « sécurité » sans décision).
 */

export type AuditCategory = "security" | "functional";

/** Actions **security** — liste fermée (le reste = fonctionnel). */
export const SECURITY_AUDIT_ACTIONS: readonly string[] = [
    "SECURITY_ALERT",        // signalement de contenu (NSFW/safety) — `reportSecurityIncident`
    "ADMIN_FULL_DENIED",     // tentative d'accès admin non autorisée (IP + UA + geo)
    "BETA_ACCESS_ATTEMPT",   // code d'accès bêta invalide
    "GOD_AUTH_BYPASS",       // super-admin ayant contourné un contrôle
];

export function auditCategoryOf(action: string): AuditCategory {
    return SECURITY_AUDIT_ACTIONS.includes(action) ? "security" : "functional";
}

/** Libellé court d'une catégorie (badges, entêtes). */
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
    security: "Sécurité",
    functional: "Fonctionnel",
};

/** Filtre de catégorie proposé dans les écrans God. */
export const AUDIT_CATEGORY_FILTER_OPTIONS: readonly { value: AuditCategory | "all"; label: string }[] = [
    { value: "all", label: "Toutes les catégories" },
    { value: "security", label: "🚨 Sécurité (incidents & refus)" },
    { value: "functional", label: "⚙️ Fonctionnel (vie des guildes & God)" },
];

/** Périmètre : actions plateforme (God) ou journaux de guilde. */
export const AUDIT_SCOPE_FILTER_OPTIONS: readonly { value: "all" | "platform" | "guild"; label: string }[] = [
    { value: "all", label: "Tout le journal" },
    { value: "platform", label: "🛡️ Plateforme (God)" },
    { value: "guild", label: "🏰 Guildes" },
];

/**
 * **Une seule** liste de filtres d'action, partagée par le **seul** viewer de
 * journaux (`src/app/god/logs/log-viewer.tsx` : onglet plateforme **et** onglet
 * guilde). Les deux écrans God en avaient deux différentes — et prétendaient donc
 * afficher deux sources de données qui n'en étaient qu'une.
 */
export const AUDIT_ACTION_FILTER_OPTIONS: readonly {
    value: string;
    label: string;
    category: AuditCategory;
}[] = [
    { value: "SECURITY_ALERT,ADMIN_FULL_DENIED,GOD_AUTH_BYPASS,BETA_ACCESS_ATTEMPT", label: "🚨 Alertes & refus", category: "security" },
    { value: "RBAC_UPDATE,RBAC_ROLE_ADD,RBAC_ROLE_REMOVE", label: "🔑 Permissions (RBAC)", category: "functional" },
    { value: "CONFIG_UPDATED,SETTINGS_UPDATED,CHANNEL_CONFIGURED,API_KEY_UPDATED", label: "⚙️ Configuration guilde", category: "functional" },
    { value: "WEBHOOK_MEMBER_ADD,WEBHOOK_MEMBER_REMOVE,WEBHOOK_MEMBER_UPDATE,WEBHOOK_GUILD_CREATE,WEBHOOK_GUILD_DELETE,PLATFORM_ARRIVAL,PLATFORM_DEPARTURE", label: "🔄 Mouvements Discord", category: "functional" },
    { value: "MEMBER_PURGED,MEMBER_BANNED,MEMBER_ARCHIVED,MEMBER_LEFT,MEMBER_BAN_DELETED,PROFILE_ARCHIVED,PROFILE_REACTIVATED,MEMBER_PSEUDO_UPDATE,MEMBER_ANKAMA_ID_UPDATE,MEMBER_COMMENT_UPDATED,MEMBER_COMMENT_DELETED,MEMBER_RELANCE,ADMIN_ROSTER_AUDIT_SENT", label: "👥 Cycle de vie membre", category: "functional" },
    { value: "MISSION_CREATED,MISSION_DELETED,MISSION_VALIDATED,MISSION_REJECTED,MISSION_PUBLISHED,MISSION_PUBLISH_DISCORD,MISSION_XP_OVERRIDE", label: "⚔️ Missions", category: "functional" },
    { value: "EVENT_STANDBY,EVENT_CLOSED,EVENT_CANCELLED,EVENT_DELETED,RAID_CLOSED,RAID_CLOSURE_UNDONE,RAID_PRESENCE_CORRECTED", label: "🗓️ Calendrier & raids", category: "functional" },
    { value: "BONUS_PURCHASED,BONUS_CANCELLED", label: "🔮 Bonus", category: "functional" },
    { value: "POLL_CREATED,POLL_CLOSED,POLL_DELETED,POLL_CREATOR_ROLE_ACQUIRED,SCHEDULED_POLL_CREATED,SCHEDULED_POLL_UPDATED,SCHEDULED_POLL_CANCELLED,SCHEDULED_POLL_PUBLISHED", label: "📊 Sondages & micro", category: "functional" },
    { value: "GUILDATON_UPDATE,GUILDATON_CSV_IMPORT,GUILDATON_SETTINGS_UPDATE", label: "🏰 Guildaton", category: "functional" },
    { value: "HELP_CREDIT_GIVEN", label: "🤝 Coups de main", category: "functional" },
    { value: "SUCCESS_SYNC", label: "🔄 Synchronisations", category: "functional" },
    { value: "USER_GDPR_DELETE", label: "🗑️ Suppressions RGPD", category: "functional" },
    { value: "GOD_GUILD_WHITELIST,GOD_USER_PLATFORM_BAN,GOD_CONFIG_OVERRIDE,GOD_DATABASE_SYNC,GOD_MODULE_LOCK,GOD_MARKET_SETTINGS,GOD_NEWS_PUBLISH,GOD_DASHBOARD_ACCESS,GOD_MAINTENANCE_MODE,GOD_GUIDE_UPDATE,GOD_RUSH_UPDATE,GOD_RUSH_UI_UPDATE,GOD_QUEST_DATA_UPDATE,GOD_GAME_DATA_UPDATE,GOD_TICKET_ACTION,GOD_DOC_UPDATE,GOD_MARKET_RESYNC,GOD_POLL_EMBED_RESYNC,GOD_MARKET_IMAGE_REGEN,GOD_MARKET_MEDIA_PURGE", label: "🛡️ Actions God", category: "functional" },
];
