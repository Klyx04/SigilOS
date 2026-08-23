import { redirect } from "next/navigation";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";

/**
 * 🛡️ #108 — Passe sous-god : garde fail-closed pour TOUTES les routes sous /god/game-data
 * (archimonstres, bounties, ...). Un sous-god n'y accède que s'il possède au moins une
 * brique du module Données de Jeu (scope "game-data" ou grant PIM ciblé).
 */
export default async function GodGameDataLayout({ children }: { children: React.ReactNode }) {
    const isAdmin = await isSuperAdmin();
    if (isAdmin) return <>{children}</>;

    const gameDataBricks = [
        "game-data",
        "game-data-quests",
        "game-data-bounties",
        "game-data-quetes",
        "game-data-guides",
        "game-data-rush",
    ] as const;

    const allowed = await Promise.all(gameDataBricks.map((b) => canAccessBrick(b)));
    if (!allowed.some(Boolean)) redirect("/");

    return <>{children}</>;
}