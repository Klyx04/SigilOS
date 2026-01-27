import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { PERMISSIONS } from "@/lib/permissions";
import { GuildEvent, User, AttendeeStatus, CalendarEventType } from "@prisma/client";
import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import {
    LayoutDashboard,
    Calendar as CalendarIcon,
    ChevronRight,
    Home
} from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";

interface CalendarPageProps {
    params: Promise<{ guildId: string }>;
}

export default async function CalendarPage({ params }: CalendarPageProps) {
    const { guildId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const ctx = await getUserContext(guildId);

    // Check view permission or global member access
    if (!ctx.isMember && !ctx.canViewCalendar) {
        return <AccessDenied />;
    }

    const canManage = ctx.canManageCalendar;

    return (
        <div className="flex flex-col h-full bg-black/40">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 px-6 py-4 text-sm border-b border-zinc-800/50 bg-zinc-900/20">
                <Link href={`/dashboard/${guildId}`} className="text-zinc-500 hover:text-amber-500 transition-colors flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    Dashboard
                </Link>
                <ChevronRight className="h-4 w-4 text-zinc-700" />
                <span className="text-zinc-300 font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-emerald-500" />
                    Calendrier
                </span>
            </div>

            <main className="flex-1 overflow-auto p-6 lg:p-10">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header Section */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl">
                            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-400">
                                    Événements
                                </span>{" "}
                                de Guilde
                            </h1>
                            <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
                                Planifiez vos runs songes, vos sessions de farm ou simplement vos moments de détente entre membres.
                            </p>
                        </div>
                    </div>

                    {/* Main Dashboard */}
                    <CalendarDashboard
                        guildId={guildId}
                        currentUserId={session.user.id}
                        canManage={canManage}
                    />
                </div>
            </main>
        </div>
    );
}
