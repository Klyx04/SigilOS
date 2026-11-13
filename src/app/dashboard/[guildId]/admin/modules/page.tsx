import { redirect } from "next/navigation";

/**
 * Route **historique** `/admin/modules` → **redirigée** vers la seule surface qui
 * porte les interrupteurs de modules : `Pilotage → Modules`.
 *
 * Pourquoi : les toggles de modules ne sont modifiables que par le propriétaire
 * ou un admin Discord — exactement l'audience de Pilotage. Deux écrans qui
 * rendaient le même `ModulesClient`, c'étaient deux fois la même vérité à
 * maintenir ; la carte « Gestion des Modules » du Centre de contrôle et l'entrée
 * de sidebar ont donc été retirées, et cette URL reste **vivante** (signets,
 * modales d'onboarding, fiches de doc) par redirection.
 */
export default async function AdminModulesPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/admin/pilotage?tab=modules`);
}