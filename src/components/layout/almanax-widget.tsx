import { getAlmanaxData } from "@/server/actions/external/almanax-actions";
import { Calendar, Package } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { AlmanaxRefreshWrapper } from "./almanax-refresh-wrapper";

export async function AlmanaxWidget() {
    const { success, data, secondsUntilMidnight } = await getAlmanaxData();

    if (!success || !data || !secondsUntilMidnight) return null;

    return (
        <AlmanaxRefreshWrapper secondsUntilMidnight={secondsUntilMidnight}>
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 hover:border-amber-500/20 rounded-xl transition-all group cursor-help max-w-sm">
                            {/* Icon Container */}
                            <div className="relative h-10 w-10 shrink-0 bg-background/50 rounded-lg p-1 border border-white/5 group-hover:border-amber-500/30 overflow-hidden">
                                {data.tribute.item.image_urls.icon ? (
                                    <Image
                                        src={data.tribute.item.image_urls.icon}
                                        alt={data.tribute.item.name}
                                        width={40}
                                        height={40}
                                        className="object-contain w-full h-full drop-shadow-md group-hover:scale-110 transition-transform"
                                    />
                                ) : (
                                    <Package className="h-full w-full p-2 text-zinc-500" />
                                )}
                            </div>

                            {/* Text Info */}
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3 text-amber-500" />
                                    Almanax du jour
                                </span>
                                <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                                    {data.bonus.type.name}
                                </span>
                            </div>
                        </div>
                    </TooltipTrigger>

                    {/* Detailed Tooltip */}
                    <TooltipContent side="bottom" className="p-4 w-80 bg-zinc-950/95 border-amber-500/20 shadow-xl shadow-black/50 backdrop-blur-xl">
                        <div className="space-y-3">
                            <div className="flex items-start gap-4 pb-3 border-b border-white/5">
                                {data.tribute.item.image_urls.icon && (
                                    <div className="h-12 w-12 bg-zinc-900 rounded-md border border-white/10 p-1 shrink-0">
                                        <Image
                                            src={data.tribute.item.image_urls.icon}
                                            alt={data.tribute.item.name}
                                            width={48}
                                            height={48}
                                            className="object-contain w-full h-full"
                                        />
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-amber-400 text-base">{data.bonus.type.name}</h4>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Offrande : <span className="text-white font-medium">{data.tribute.quantity}x {data.tribute.item.name}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-zinc-300 leading-relaxed">
                                    {data.bonus.description}
                                </p>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </AlmanaxRefreshWrapper>
    );
}

