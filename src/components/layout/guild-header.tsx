import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { Users } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export async function GuildHeader({ guildId }: { guildId: string }) {
    const data = await getGuildHeaderData(guildId);

    if (!data.exists) return null;

    return (
        <header className="w-full flex items-center justify-between py-6 mb-2">
            <div className="flex items-center gap-6">
                {/* Guild Icon - Larger, No Border */}
                <Avatar className="h-16 w-16 shadow-2xl">
                    <AvatarImage src={data.iconUrl || undefined} alt={data.name} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary text-2xl font-bold">
                        {data.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col justify-center gap-2">
                    {/* Guild Name - Much Larger & Prominent */}
                    <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/70">
                        {data.name}
                    </h1>

                    {/* Member Count - Cleaner, No Border */}
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground/80 font-medium text-sm">{data.memberCount} Agents</span>
                    </div>
                </div>
            </div>

            {/* Theme Toggle */}
            <div className="hidden md:block">
                <ModeToggle />
            </div>
        </header>
    );
}
