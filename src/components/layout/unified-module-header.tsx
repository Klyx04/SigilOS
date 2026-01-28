
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
    className,
    gradient = true,
}: UnifiedModuleHeaderProps) {
    return (
        <div className={cn("relative space-y-4 mb-8", className)}>
            {/* Back Button */}
            {backHref && (
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors group"
                >
                    <div className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-colors">
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </div>
                    {backLabel}
                </Link>
            )}

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        {imageSrc ? (
                            <div className="relative h-14 w-14 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">
                                <Image
                                    src={imageSrc}
                                    alt={title}
                                    fill
                                    className="object-contain"
                                    sizes="56px"
                                    priority
                                />
                                <div className="absolute -inset-2 bg-white/5 rounded-full blur-xl -z-10" />
                            </div>
                        ) : Icon ? (
                            <div className="relative flex items-center justify-center">
                                <Icon
                                    className="h-10 w-10 sm:h-12 sm:w-12 transition-all duration-300"
                                    style={{
                                        color: iconColor,
                                        filter: `drop-shadow(0 0 10px ${iconColor})`
                                    }}
                                    strokeWidth={1.5}
                                />
                            </div>
                        ) : null}
                        <h1 className={cn(
                            "text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-none pb-1 pr-8",
                            gradient && "bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/90 pb-1 pr-12 -mr-12"
                        )}>
                            {title}
                        </h1>
                    </div>
                    {description && (
                        <p className="text-zinc-500 text-sm font-medium max-w-2xl leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                {actions && (
                    <div className="flex items-center gap-3 shrink-0">
                        {actions}
                    </div>
                )}
            </div>

            {/* Premium Divider */}
            <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
        </div>
    );
}
