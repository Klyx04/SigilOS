import Image from "next/image";
import { Construction, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComingSoonBannerProps {
    title: string;
    description: string;
    features: string[];
    imageSrc?: string;
    imageAlt?: string;
    icon?: React.ElementType;
    accentColor?: string;
}

export function ComingSoonBanner({
    title,
    description,
    features,
    imageSrc,
    imageAlt = "Preview",
    icon: Icon = Sparkles,
    accentColor = "teal",
}: ComingSoonBannerProps) {
    const colorMap: Record<string, { text: string; bg: string; border: string; glow: string }> = {
        teal: { text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20", glow: "shadow-teal-500/20" },
        amber: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20", glow: "shadow-amber-500/20" },
        violet: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", glow: "shadow-violet-500/20" },
        cyan: { text: "text-info", bg: "bg-info/10", border: "border-info/20", glow: "shadow-cyan-500/20" },
        rose: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/20", glow: "shadow-rose-500/20" },
    };

    const colors = colorMap[accentColor] || colorMap.teal;

    return (
        <div className="flex flex-col items-center gap-8 pb-12">
            {/* Animated Badge */}
            <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm",
                colors.bg, colors.border
            )}>
                <Construction className={cn("w-4 h-4 animate-pulse", colors.text)} />
                <span className={cn("text-sm font-black uppercase tracking-[0.2em]", colors.text)}>
                    En développement
                </span>
                <Construction className={cn("w-4 h-4 animate-pulse", colors.text)} />
            </div>

            {/* Main Card */}
            <div className={cn(
                "relative w-full max-w-4xl rounded-2xl border overflow-hidden",
                "bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-black",
                colors.border,
                "shadow-2xl",
                colors.glow
            )}>
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                {/* Content */}
                <div className="relative p-8 md:p-12 space-y-8">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl border", colors.bg, colors.border)}>
                            <Icon className={cn("w-7 h-7", colors.text)} />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                                {title}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                                {description}
                            </p>
                        </div>
                    </div>

                    {/* Preview Image */}
                    {imageSrc && (
                        <div className={cn(
                            "relative rounded-xl border overflow-hidden",
                            colors.border,
                            "shadow-xl",
                            colors.glow
                        )}>
                            <Image
                                src={imageSrc}
                                alt={imageAlt}
                                width={1200}
                                height={675}
                                className="w-full h-auto object-cover"
                                priority
                            />
                            {/* Overlay gradient for readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        </div>
                    )}

                    {/* Features List */}
                    <div className="space-y-4">
                        <h3 className={cn("text-xs font-black uppercase tracking-widest", colors.text)}>
                            Fonctionnalités prévues
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {features.map((feature, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex items-start gap-3 px-4 py-3 rounded-lg border",
                                        "bg-surface",
                                        "border-border",
                                        "hover:border-border hover:bg-surface transition-all duration-200"
                                    )}
                                >
                                    <Sparkles className={cn("w-4 h-4 shrink-0 mt-0.5", colors.text)} />
                                    <span className="text-sm text-foreground font-medium">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA / info */}
                    <div className="flex items-center justify-center pt-4">
                        <p className="text-xs text-muted-foreground font-medium text-center max-w-md">
                            Ce module est en cours de conception. Restez connecté pour suivre son avancement !
                            Vos retours sont précieux pour façonner cette fonctionnalité.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
