import { UserNav } from "@/components/user-nav";
import { getUserContext } from "@/server/actions/user-actions";
import Link from "next/link";

export async function AppHeader() {
    const user = await getUserContext();

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
            <div className="container flex h-16 items-center justify-between">
                <Link href="/dashboard" className="flex items-center space-x-2">
                    {/* Logo Placeholder - Text with Glow */}
                    <span className="text-2xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary animate-pulse-slow">
                        SIGIL<span className="text-foreground">OS</span>
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    {/* Placeholder for Breadcrumbs or Nav Links could go here */}

                    <UserNav user={user} />
                </div>
            </div>
        </header>
    );
}
