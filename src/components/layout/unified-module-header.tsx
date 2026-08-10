
import Link from "next/link";
import { ChevronLeft, LucideIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
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
    compact?: boolean;
}

export function UnifiedModuleHeader({
    title,
    description,
    icon: Icon,
    iconColor = "#fff",
    imageSrc,
    backHref,
    backLabel = "Dashboard",
    actions,
    middleContent,
    className,
    gradient = true,
    compact = false,
}: UnifiedModuleHeaderProps) {
    return (
        <div className={cn(
            "relative animate-in fade-in slide-in-from-top-2 duration-150",
            compact ? "space-y-1 mb-2" : "space-y-4 mb-8 md:mb-12",
            className
        )}>
            {/* 1. BACK BUTTON & BREADCRUMBS */}
            {backHref && (
                <Button
                    asChild
                    variant="ghost"
                    className="inline-flex h-auto items-center gap-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group mb-2 p-0 bg-transparent hover:bg-transparent"
                >
                    <Link href={backHref}>
                        <div className="h-8 w-8 rounded-xl border border-foreground/5 bg-foreground/[0.03] backdrop-blur-xl flex items-center justify-center group-hover:border-foreground/20 group-hover:bg-foreground/10 transition-colors">
                            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                        </div>
                        <span className="opacity-70 group-hover:opacity-100 transition-opacity">{backLabel}</span>
                    </Link>
                </Button>
            )}

            {/* 2. MAIN CONTENT LAYER */}
            <div className={cn(
                "flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6",
                !compact && "lg:items-end gap-6 lg:gap-10"
            )}>
                <div className={cn("min-w-0 flex-1", compact ? "space-y-1" : "space-y-3")}>
                    <div className={cn("flex items-center", compact ? "gap-3" : "gap-4 md:gap-7")}>
                        {/* ICON / IMAGE SECTION */}
                        {imageSrc ? (
                            <div className={cn(
                                "relative shrink-0",
                                compact ? "h-8 w-8 md:h-10 md:w-10" : "h-14 w-14 md:h-18 md:w-18"
                            )}>
                                <Image
                                    src={imageSrc}
                                    alt={title}
                                    fill
                                    sizes="(max-width: 768px) 40px, 72px"
                                    className="object-contain"
                                />
                            </div>
                        ) : Icon ? (
                            <div className={cn(
                                "relative shrink-0 flex items-center justify-center bg-foreground/[0.03] backdrop-blur-2xl rounded-xl border border-foreground/5 group transition-colors",
                                compact ? "h-9 w-9 md:h-10 md:w-10 rounded-xl" : "h-14 w-14 md:h-16 md:w-16 rounded-2xl"
                            )}>
                                <Icon
                                    className={cn("transition-colors duration-150", compact ? "h-4 w-4 md:h-5 md:w-5" : "h-7 w-7 md:h-8 md:w-8")}
                                    style={{ color: iconColor }}
                                    strokeWidth={2.5}
                                />
                                <div className="absolute inset-0 bg-foreground/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ) : null}

                        {/* TITLE SECTION - Fluid Typography 2026 */}
                        <div className="min-w-0">
                            <h1 className={cn(
                                compact ? "text-lg md:text-xl font-bold tracking-tight py-0" : "text-[clamp(1.75rem,8vw,3.5rem)] font-bold tracking-tight leading-[0.9] py-1",
                                "uppercase text-foreground"
                            )}>
                                {title}
                            </h1>
                        </div>
                    </div>

                    {description && !compact && (
                        <p className="text-muted-foreground text-sm md:text-base font-medium max-w-3xl leading-relaxed opacity-70 border-l-2 border-foreground/5 pl-4 ml-1">
                            {description}
                        </p>
                    )}
                </div>

                {/* MIDDLE CONTENT - Responsive behavior */}
                {middleContent && (
                    <div className="flex justify-start lg:justify-center items-center py-1 lg:py-0">
                        {middleContent}
                    </div>
                )}
                
                {/* ACTIONS - Grouped & Pushed to right on desktop */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {actions}
                </div>
            </div>

            {/* 3. PREMIUM DIVIDER - Modern subtle aesthetic */}
            <div className="relative h-px w-full overflow-hidden mt-2">
                <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-border/40 via-border/20 to-transparent" />
            </div>
        </div>
    );
}
