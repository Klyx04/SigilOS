import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { Wifi } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlmanaxWidget } from "@/components/layout/almanax-widget";

export async function GuildHeader({ guildId }: { guildId: string }) {
    const data = await getGuildHeaderData(guildId);

    if (!data.exists) return null;

    return (
        <header className="w-full bg-zinc-950/50 backdrop-blur-sm border-b border-white/5 mb-6">
            <div className="flex flex-col md:flex-row h-auto md:h-24 items-center justify-between px-6 md:px-8 max-w-7xl mx-auto py-4 md:py-0 gap-4 md:gap-0">

                {/* LEFT: Guild Identity (Hero) */}
                <div className="flex items-center gap-5 w-full md:w-auto justify-center md:justify-start">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                        <Avatar className="relative h-16 w-16 md:h-14 md:w-14 border-2 border-zinc-900 shadow-xl ring-2 ring-white/10 group-hover:ring-primary/50 transition-all duration-300">
                            <AvatarImage src={data.iconUrl || undefined} alt={data.name} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl font-bold">
                                {data.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="flex flex-col items-center md:items-start">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-400">
                            {data.name}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 w-1 rounded-full bg-primary/50"></div>
                            <span className="text-xs font-medium text-primary/80 uppercase tracking-widest">
                                Tableau de bord
                            </span>
                        </div>
                    </div>
                </div>

                {/* CENTER: Empty Slot for Future Flux (Ticker, Events...) */}
                <div className="hidden lg:flex flex-1 items-center justify-center mx-8 relative">
                    {/* Placeholder: The void is the feature. */}
                </div>

                {/* RIGHT: Actions & Status */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:block">
                        <AlmanaxWidget />
                    </div>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900/50 border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all group/status cursor-help">
                                    <div className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 group-hover/status:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-shadow"></span>
                                    </div>
                                    <span className="text-sm font-semibold text-zinc-300 group-hover/status:text-emerald-400 transition-colors">
                                        {data.activeCount} <span className="hidden sm:inline font-normal text-zinc-500">en ligne</span>
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-zinc-900 border-white/10 text-zinc-300">
                                <span className="flex items-center gap-2">
                                    <Wifi className="h-3 w-3" />
                                    Membres actifs sur SigilOS
                                </span>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </header>
    );
}
