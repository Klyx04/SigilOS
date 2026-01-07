import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppFooter } from "@/components/layout/app-footer";
import { getUserContext } from "@/server/actions/user-actions";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { guildId: string };
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    return (
        <div className="min-h-screen bg-background font-sans antialiased overflow-hidden selection:bg-primary/20 md:flex">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
            </div>

            <AppSidebar user={user} guildId={guildId} />

            <div className="flex-1 flex flex-col relative z-10 h-screen overflow-y-auto">
                <main className="flex-1 container mx-auto py-8 px-4 md:px-8 max-w-7xl">
                    {children}
                </main>

                <div className="p-4 md:p-8">
                    <AppFooter />
                </div>
            </div>
        </div>
    );
}
