import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";

/**
 * 🛡️ #108 — Passe sous-god : la page Changelog Engine est réservée aux super-admins
 * (brique `changelog` = subGodAccess:false dans god-bricks.ts). Les sous-gods qui
 * tapaient l'URL directement voyaient la page faute de garde côté page.
 */
export default async function GodChangelogLayout({ children }: { children: React.ReactNode }) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");
    return <>{children}</>;
}