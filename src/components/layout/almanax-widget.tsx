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
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="hidden md:flex items-center gap-3 px-2 py-1 transition-all group cursor-help">
                        {/* Icon Container (Flat) */}
                        <div className="relative h-9 w-9 shrink-0 flex items-center justify-center overflow-hidden">
                            {data.tribute.item.image_urls.icon ? (
                                <Image
                                    src={data.tribute.item.image_urls.icon}
                                    alt={data.tribute.item.name}
                                    width={36}
                                    height={36}
                                    className="object-contain w-full h-full drop-shadow-md group- transition-transform"
                                />
                            ) : (
                                <Package className="h-full w-full p-2 text-muted-foreground" />
                            )}
                        </div>

                        {/* Text Info */}
                        <div className="flex flex-col min-w-0">
                            <span className="text-caption text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5 leading-tight">
                                <Calendar className="h-3 w-3 text-warning/80" />
                                Almanax
                            </span>
                            <span className="text-label font-black text-foreground truncate group-hover:text-warning transition-colors leading-tight">
                                {data.bonus.type.name}
                            </span>
                        </div>
                    </div>
                </TooltipTrigger>

                {/* Detailed Tooltip */}
                <TooltipContent side="bottom" className="p-4 w-80 bg-background/95 border-warning/20 shadow-xl shadow-black/50 backdrop-blur-xl">
                    <div className="space-y-3">
                        <div className="flex items-start gap-4 pb-3 border-b border-border">
                            {data.tribute.item.image_urls.icon && (
                                <div className="h-12 w-12 bg-surface rounded-md border border-border p-1 shrink-0">
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
                                <h4 className="font-bold text-warning text-base">{data.bonus.type.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Offrande : <span className="text-foreground font-medium">{data.tribute.quantity}x {data.tribute.item.name}</span>
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm text-foreground leading-relaxed">
                                {data.bonus.description}
                            </p>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </AlmanaxRefreshWrapper>
    );
}
