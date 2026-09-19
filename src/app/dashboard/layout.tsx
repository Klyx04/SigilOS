import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";

export default async function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // --- MAINTENANCE : même garde que /dashboard/[guildId] (sélecteur de
    // guildes). Fail-open : BDD injoignable → on laisse passer.
    const maintenanceOn = await db.platformConfig
        .findUnique({ where: { id: "singleton" }, select: { maintenanceMode: true } })
        .then((c) => c?.maintenanceMode === true)
        .catch(() => false);
    if (maintenanceOn) redirect("/maintenance");

    // The root /dashboard (Guild Selector) does not share the Sidebar layout of /dashboard/[guildId]
    // because it is global context. It has its own AuroraBackground in page.tsx.
    return (
        <main className="min-h-screen w-full bg-background text-foreground">
            {children}
        </main>
    );
}
