import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Palette } from "lucide-react";
import { GarticGame } from "@/client/components/GarticGame";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function GarticPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.isMember) return <AccessDenied />;

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-b-3xl border-b border-white/5 mx-2">
            <div className="flex-shrink-0 px-4 md:px-6 pt-3 pb-1 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Sigil-Phone (Gartic)"
                    description="Le téléphone arabe, mais en dessin."
                    icon={Palette}
                    backHref={`/dashboard/${guildId}`}
                />
            </div>
            <div className="flex-1 w-full relative overflow-y-auto">
                <GarticGame guildId={guildId} user={user} />
            </div>
        </div>
    );
}
