import { getSystemAnnouncement } from "@/server/actions/announcement-actions";
import { Info, AlertTriangle, Wrench } from "lucide-react";

const typeConfig = {
    info: {
        icon: Info,
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        text: "text-blue-300",
        iconColor: "text-blue-400",
        glow: "shadow-[0_0_30px_rgba(59,130,246,0.05)]",
    },
    warning: {
        icon: AlertTriangle,
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        text: "text-amber-200",
        iconColor: "text-amber-400",
        glow: "shadow-[0_0_30px_rgba(245,158,11,0.05)]",
    },
    maintenance: {
        icon: Wrench,
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        text: "text-orange-200",
        iconColor: "text-orange-400",
        glow: "shadow-[0_0_30px_rgba(249,115,22,0.05)]",
    },
};

export async function AnnouncementBanner() {
    const announcement = await getSystemAnnouncement();
    if (!announcement) return null;

    const config = typeConfig[announcement.type] || typeConfig.info;
    const Icon = config.icon;

    return (
        <div
            className={`
                mx-4 mt-4 px-5 py-3 rounded-xl border backdrop-blur-sm
                ${config.bg} ${config.border} ${config.glow}
                flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-500
            `}
        >
            <Icon className={`w-4 h-4 ${config.iconColor} flex-shrink-0`} />
            <p className={`text-sm font-medium ${config.text} flex-1`}>
                {announcement.message}
            </p>
            {announcement.expiresAt && (
                <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                    ⏱ {new Date(announcement.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
            )}
        </div>
    );
}
