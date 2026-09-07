"use server";
import { isSuperAdmin } from "./super-admin-actions";
import { sendGlobalStatusPingCore } from "../status-ping-core";

/**
 * 🛰️ Envoie un ping d'état des services sur Discord
 * Version "Premium" avec Living Status (mis à jour du même message si possible).
 *
 * 🔒 Fail-closed (VULN-008) : cet entrypoint (appel direct navigateur / action
 * serveur) exige une session super-admin. Les contextes système SANS session
 * (routes cron protégées par `x-cron-secret`, worker BullMQ) appellent
 * `sendGlobalStatusPingCore` (`@/server/status-ping-core`) directement —
 * ils sont déjà authentifiés en amont.
 */
export async function sendGlobalStatusPing(
    _isTestRequest = false,
    mode?: 'living' | 'notification',
    isLite?: boolean,
    targetChannelId?: string
) {
    // 🔒 Fail-closed : ping Discord = action privilégiée (spam + leak latences).
    // Exigé dans TOUS les cas d'appel direct, pas seulement les tests (VULN-008).
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Accès refusé : Super-admin requis");

    return sendGlobalStatusPingCore({ mode, isLite, targetChannelId });
}
