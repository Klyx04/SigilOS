"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Hash, Volume2, Shield, Info, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbedPreviewProps {
    title?: string;
    description?: string;
    color?: number; // Hex number
    fields?: EmbedField[];
    thumbnail?: string;
    image?: string;
    footer?: string;
    author?: {
        name: string;
        iconUrl?: string;
    };
    mentionContent?: string;
    channelName?: string;
    timestamp?: Date;
    className?: string;
}

export function DiscordEmbedPreview({
    title,
    description,
    color = 0x9333ea,
    fields = [],
    thumbnail,
    image,
    footer,
    author,
    mentionContent,
    channelName = "annonces",
    timestamp = new Date(),
    className
}: DiscordEmbedPreviewProps) {
    // Convert decimal color to hex string
    const hexColor = color ? `#${color.toString(16).padStart(6, '0')}` : "#9333ea";

    return (
        <div className={cn("flex flex-col gap-1 w-full max-w-[520px] font-sans text-body leading-[1.375rem]", className)}>
            {/* Channel Info Header */}
            <div className="flex items-center gap-2 mb-2 px-1">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground font-bold text-sm tracking-tight">{channelName}</span>
                <span className="text-caption text-muted-foreground font-medium uppercase tracking-wider ml-1 bg-elevated/50 px-1.5 py-0.5 rounded border border-border">Aperçu Discord</span>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-[#313338] border border-border shadow-2xl relative overflow-hidden group">
                {/* User Avatar Placeholder (SigilOS Bot) */}
                <div className="shrink-0 pt-0.5">
                    <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center border border-border shadow-lg relative">
                        <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-6 h-6 object-contain" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-info border-2 border-[#313338] flex items-center justify-center">
                            <Shield className="w-2 h-2 text-foreground" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Message Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-foreground hover:underline cursor-pointer">SigilOS</span>
                        <span className="bg-[#5865F2] text-foreground text-caption px-1.5 py-0.5 rounded-[3px] font-black uppercase flex items-center gap-0.5 leading-none">
                             BOT
                        </span>
                        <span className="text-label text-muted-foreground font-medium">
                            {format(timestamp, "'Aujourd'hui à' HH:mm", { locale: fr })}
                        </span>
                    </div>

                    {/* Mention Content (if any) */}
                    {mentionContent && (
                        <div className="text-[#dbdee1] mb-1.5 whitespace-pre-wrap break-words">
                            {mentionContent.split(/(<@&\d+>)/g).map((part, i) => {
                                if (part.startsWith("<@&")) {
                                    return <span key={i} className="text-[#c9cdfb] bg-[#3e4171] px-0.5 rounded-[3px] font-medium hover:bg-[#5865f2] hover:text-foreground cursor-pointer transition-colors">@Rôle Mentionné</span>;
                                }
                                return part;
                            })}
                        </div>
                    )}

                    {/* The Embed */}
                    <div 
                        className="mt-1 flex flex-col rounded-[4px] border-l-4 bg-[#2b2d31] max-w-[432px] shadow-sm"
                        style={{ borderLeftColor: hexColor }}
                    >
                        <div className="p-3 pr-4 flex gap-3">
                            <div className="flex-1 min-w-0">
                                {/* Author */}
                                {author && (
                                    <div className="flex items-center gap-2 mb-2">
                                        {author.iconUrl && <img src={author.iconUrl} alt="" className="w-6 h-6 rounded-full" />}
                                        <span className="text-foreground text-body-sm font-bold hover:underline cursor-pointer">{author.name}</span>
                                    </div>
                                )}

                                {/* Title */}
                                {title && (
                                    <div className="text-foreground text-[16px] font-bold mb-2 hover:underline cursor-pointer leading-[1.25rem] text-[#00a8fc]">
                                        {title}
                                    </div>
                                )}

                                {/* Description */}
                                {description && (
                                    <div className="text-[#dbdee1] text-body leading-[1.125rem] whitespace-pre-wrap break-words opacity-90">
                                        {description.split('\n').map((line, i) => (
                                            <p key={i} className={cn(i > 0 && "mt-1")}>{line}</p>
                                        ))}
                                    </div>
                                )}

                                {/* Fields */}
                                {fields.length > 0 && (
                                    <div className="mt-4 grid grid-cols-12 gap-y-4 gap-x-2">
                                        {fields.map((field, i) => (
                                            <div 
                                                key={i} 
                                                className={cn(
                                                    "col-span-12",
                                                    field.inline ? "sm:col-span-4" : "col-span-12"
                                                )}
                                            >
                                                <div className="text-foreground text-body-sm font-bold mb-1">{field.name}</div>
                                                <div className="text-[#dbdee1] text-body-sm leading-[1.125rem] whitespace-pre-wrap">{field.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail */}
                            {thumbnail && (
                                <div className="shrink-0 mt-2">
                                    <img src={thumbnail} alt="" className="w-[80px] h-[80px] rounded object-contain bg-surface/50" />
                                </div>
                            )}
                        </div>

                        {/* Large Image */}
                        {image && (
                            <div className="mt-2 px-3 pb-3">
                                <img src={image} alt="" className="rounded max-h-[300px] w-full object-cover border border-border" />
                            </div>
                        )}

                        {/* Footer */}
                        {(footer || timestamp) && (
                            <div className="px-3 pb-3 flex items-center gap-2 text-muted-foreground text-caption font-medium">
                                <span>{footer || "SigilOS — Donjons & Quêtes"}</span>
                                {timestamp && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-muted" />
                                        <span>{format(timestamp, "dd/MM/yyyy", { locale: fr })}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Component Buttons (Simulated) */}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <div className="px-4 py-1.5 rounded-[3px] bg-[#4e5058] text-foreground text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-80">
                             ⚔️ S'inscrire
                        </div>
                        <div className="px-4 py-1.5 rounded-[3px] bg-[#4e5058] text-foreground text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-80">
                            🚪 Se désinscrire
                        </div>
                        <div className="px-4 py-1.5 rounded-[3px] bg-[#4e5058] text-foreground text-xs font-bold flex items-center gap-2 cursor-not-allowed opacity-80">
                            🔗 Voir sur le site <ExternalLink className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-caption text-muted-foreground italic mt-1 ml-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> Note: Cet aperçu simule l'affichage final sur Discord.
            </p>
        </div>
    );
}
