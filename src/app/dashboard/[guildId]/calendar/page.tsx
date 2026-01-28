import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import { Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import AccessDenied from "@/components/access-denied";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";

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
        <div className="flex flex-col h-full bg-black/40 pb-12">
            <main className="flex-1 overflow-auto">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    <UnifiedModuleHeader
                        title="Calendrier des Événements"
                        description="Ne manquez aucun rendez-vous important de la vie de guilde."
                        imageSrc="/assets/ui/icons/calendar.png"
                        backHref={`/dashboard/${guildId}`}
                    />

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
