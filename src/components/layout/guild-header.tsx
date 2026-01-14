import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { Users, Wifi } from "lucide-react";

export async function GuildHeader({ guildId }: { guildId: string }) {
    const data = await getGuildHeaderData(guildId);

    if (!data.exists) return null;

    return (
        <header className="w-full py-3 mb-1">
            {/* Compact horizontal layout */}
            <div className="flex items-center justify-center gap-4">
                {/* Guild Icon - smaller */}
                <Avatar className="h-12 w-12 shadow-lg border border-primary/20">
                    <AvatarImage src={data.iconUrl || undefined} alt={data.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary text-lg font-bold">
                        {data.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                {/* Guild Name - compact */}
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {data.name}
                </h1>

                {/* Member Stats - inline badges */}
                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Wifi className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">{data.activeCount} connectés</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <Users className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground font-medium">{data.memberCount} membres</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

