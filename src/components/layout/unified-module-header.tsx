
import Link from "next/link";
import { ChevronLeft, LucideIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface UnifiedModuleHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    iconColor?: string;
    imageSrc?: string;
    backHref?: string;
    backLabel?: string;
    actions?: ReactNode;
    middleContent?: ReactNode;
    className?: string;
    gradient?: boolean;
}

export function UnifiedModuleHeader({
    title,
    description,
    icon: Icon,
    iconColor = "#fff",
    imageSrc,
    backHref,
    backLabel = "Retour au Dashboard",
    actions,
    middleContent,
    className,
    gradient = true,
}: UnifiedModuleHeaderProps) {
    return (
        <div className={cn("relative space-y-4 mb-10", className)}>
            {/* Back Button */}
            {backHref && (
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 hover:text-white transition-all group"
                >
                    <div className="h-7 w-7 rounded-full border border-white/5 bg-white/5 flex items-center justify-center group-hover:border-white/20 transition-all group-hover:scale-110">
                        <ChevronLeft className="h-4 w-4" />
                    </div>
                    {backLabel}
                </Link>
            )}

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-2 min-w-[300px]">
                    <div className="flex items-center gap-4 md:gap-6">
                        {imageSrc ? (
                            <div className="relative h-12 w-12 md:h-14 md:w-14 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:scale-110 transition-transform duration-500">
                                <Image
                                    src={imageSrc}
                                    alt={title}
                                    fill
                                    className="object-contain brightness-110"
                                    priority
                                />
                                <div className="absolute -inset-4 bg-purple-500/5 rounded-full blur-2xl -z-10" />
                            </div>
                        ) : Icon ? (
                            <div className="relative flex items-center justify-center p-3 bg-white/5 rounded-2xl border border-white/5 shadow-xl">
                                <Icon
                                    className="h-8 w-8 transition-all duration-300"
                                    style={{
                                        color: iconColor,
                                        filter: `drop-shadow(0 0 12px ${iconColor}80)`
                                    }}
                                    strokeWidth={2}
                                />
                            </div>
                        ) : null}
                        <h1 className={cn(
                            "text-3xl md:text-5xl font-black tracking-tighter text-white uppercase leading-none pr-8",
                            gradient && "bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/80"
                        )}>
                            {title}
                        </h1>
                    </div>
                    {description && (
                        <p className="text-zinc-500 text-sm md:text-base font-medium max-w-2xl leading-relaxed opacity-80 pl-1">
                            {description}
                        </p>
                    )}
                </div>

                {middleContent && (
                    <div className="flex-1 flex justify-center items-center px-4">
                        {middleContent}
                    </div>
                )}
                
                <div className="flex items-center gap-3 shrink-0 lg:pb-1">
                    {actions}
                </div>
            </div>

            {/* Premium 2026 Divider */}
            <div className="relative h-px w-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-12 h-[2px] bg-purple-500 blur-[1px] -translate-y-1/2" />
            </div>
        </div>
    );
}
