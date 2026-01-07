export default function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // The root /dashboard (Guild Selector) does not share the Sidebar layout of /dashboard/[guildId]
    // because it is global context. It has its own AuroraBackground in page.tsx.
    return (
        <main className="min-h-screen w-full bg-black text-white">
            {children}
        </main>
    );
}
