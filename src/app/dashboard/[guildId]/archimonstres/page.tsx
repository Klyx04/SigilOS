import { redirect } from "next/navigation";

/**
 * Page orpheline (aucune nav, aucun lien ne pointe ici) — la Bourse aux
 * Archimonstres vit dans le module Quête Ocre. Redirection définitive du
 * point d'entrée pour les éventuels bookmarks, plutôt qu'un doublon fantôme.
 */
export default async function ArchimonstresPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/quete-ocre`);
}
