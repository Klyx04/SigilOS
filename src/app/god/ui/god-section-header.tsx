import { cn } from "@/lib/utils";
import { GodBadge } from "./god-badge";
import type { GodBadgeVariant } from "./god-badge";

export function GodSectionHeader({ title, description, badge, badgeVariant = "info", className }: {
    title: string; description?: string; badge?: string; badgeVariant?: GodBadgeVariant; className?: string;
}) {
    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
                {badge ? <GodBadge variant={badgeVariant}>{badge}</GodBadge> : null}
            </div>
            {description ? <p className="text-sm text-zinc-400 max-w-2xl">{description}</p> : null}
        </div>
    );
}