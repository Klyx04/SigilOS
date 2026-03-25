"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

import { useState, useTransition } from "react";
import {
    Megaphone,
    Radio,
    AlertTriangle,
    Info,
    Wrench,
    Send,
    X,
    Rocket,
    Loader2,
    CheckCircle2,
} from "lucide-react";
import {
    setSystemAnnouncement,
    clearSystemAnnouncement,
    broadcastDiscordAnnouncement,
    getStelliumChannels,
} from "@/server/actions/announcement-actions";
import { useEffect } from "react";
import type { SystemAnnouncement } from "@/server/actions/announcement-actions";

interface AnnouncementPanelProps {
    currentAnnouncement: SystemAnnouncement | null;
}

export function AnnouncementPanel({ currentAnnouncement }: AnnouncementPanelProps) {
    // Banner state
    const [bannerMessage, setBannerMessage] = useState("");
    const [bannerType, setBannerType] = useState<"info" | "warning" | "maintenance">("maintenance");
    const [bannerExpiry, setBannerExpiry] = useState<number>(60); // minutes
    const [bannerPending, startBannerTransition] = useTransition();
    const [bannerResult, setBannerResult] = useState<string | null>(null);

    // Discord broadcast state
    const [discordMessage, setDiscordMessage] = useState("");
    const [discordType, setDiscordType] = useState<"maintenance" | "update" | "info">("maintenance");
    const [mentionEveryone, setMentionEveryone] = useState(false);
    const [discordPending, startDiscordTransition] = useTransition();
    const [discordResult, setDiscordResult] = useState<string | null>(null);

    // Active announcement
    const [activeAnnouncement, setActiveAnnouncement] = useState(currentAnnouncement);

    // Stellium Specific
    const [stelliumChannels, setStelliumChannels] = useState<{ id: string; name: string }[]>([]);
    const [stelliumChannelId, setStelliumChannelId] = useState<string>("");

    useEffect(() => {
        getStelliumChannels().then(setStelliumChannels);
    }, []);

    const handleSetBanner = () => {
        if (!bannerMessage.trim()) return;
        startBannerTransition(async () => {
            const result = await setSystemAnnouncement(bannerMessage, bannerType, bannerExpiry || undefined);
            if (result.success) {
                setBannerResult("✅ Bandeau activé !");
                setActiveAnnouncement({
                    message: bannerMessage,
                    type: bannerType,
                    createdAt: new Date().toISOString(),
                    expiresAt: bannerExpiry ? new Date(Date.now() + bannerExpiry * 60000).toISOString() : undefined,
                });
                setBannerMessage("");
            } else {
                setBannerResult(`❌ ${result.error}`);
            }
            setTimeout(() => setBannerResult(null), 3000);
        });
    };

    const handleClearBanner = () => {
        startBannerTransition(async () => {
            const result = await clearSystemAnnouncement();
            if (result.success) {
                setBannerResult("✅ Bandeau désactivé");
                setActiveAnnouncement(null);
            } else {
                setBannerResult(`❌ ${result.error}`);
            }
            setTimeout(() => setBannerResult(null), 3000);
        });
    };

    const handleBroadcast = () => {
        if (!discordMessage.trim()) return;
        startDiscordTransition(async () => {
            const result = await broadcastDiscordAnnouncement(
                discordMessage,
                discordType,
                mentionEveryone,
                stelliumChannelId || undefined
            );
            if (result.success) {
                setDiscordResult(`✅ Envoyé à ${result.sent} guilde(s)${result.failed ? ` (${result.failed} échec)` : ""}`);
                setDiscordMessage("");
            } else {
                setDiscordResult(`❌ ${result.error}`);
            }
            setTimeout(() => setDiscordResult(null), 5000);
        });
    };

    const typeIcons = {
        info: <Info className="w-4 h-4" />,
        warning: <AlertTriangle className="w-4 h-4" />,
        maintenance: <Wrench className="w-4 h-4" />,
    };

    const typeColors = {
        info: "text-blue-400 border-blue-500/20 bg-blue-500/10",
        warning: "text-amber-400 border-amber-500/20 bg-amber-500/10",
        maintenance: "text-orange-400 border-orange-500/20 bg-orange-500/10",
    };

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                    <Megaphone className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                        Communication
                    </h2>
                    <p className="text-zinc-500 text-sm font-medium">Bandeaux dashboard et annonces globales discord.</p>
                </div>
            </div>

            <div className="space-y-8">
                {/* 1. DASHBOARD BANNER SECTION */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6 md:p-10 space-y-8 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                <Radio className="w-5 h-5 text-teal-400" />
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">
                                Bandeau Dashboard
                            </h3>
                        </div>
                        {activeAnnouncement && (
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    Diffusion en cours
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Active banner preview/control */}
                    {activeAnnouncement && (
                        <div className={cn(
                            "p-6 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all shadow-xl",
                            typeColors[activeAnnouncement.type]
                        )}>
                            <div className="flex items-start gap-4 flex-1">
                                <div className="p-2 rounded-lg bg-white/10">
                                    {typeIcons[activeAnnouncement.type]}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm md:text-base font-bold leading-tight">{activeAnnouncement.message}</p>
                                    {activeAnnouncement.expiresAt && (
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                            Expiration : {new Date(activeAnnouncement.expiresAt).toLocaleString("fr-FR")}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleClearBanner}
                                disabled={bannerPending}
                                className="w-full md:w-auto px-6 py-3 bg-white/10 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <X className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                                Couper la diffusion
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mt-4">
                        <div className="space-y-6">
                            <textarea
                                value={bannerMessage}
                                onChange={(e) => setBannerMessage(e.target.value)}
                                placeholder="Écrivez le message qui apparaîtra sur tous les dashboards..."
                                className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-base text-white placeholder:text-zinc-700 resize-none h-32 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/30 transition-all font-medium"
                                maxLength={200}
                            />
                            
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex flex-wrap gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                                    {(["info", "warning", "maintenance"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setBannerType(t)}
                                            className={cn(
                                                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                bannerType === t
                                                    ? typeColors[t]
                                                    : "border-transparent text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3 ml-auto">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Durée :</span>
                                    <select
                                        value={bannerExpiry}
                                        onChange={(e) => setBannerExpiry(Number(e.target.value))}
                                        className="bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                                    >
                                        <option value={30}>30 min</option>
                                        <option value={60}>1h</option>
                                        <option value={120}>2h</option>
                                        <option value={360}>6h</option>
                                        <option value={720}>12h</option>
                                        <option value={0}>Permanent</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleSetBanner}
                                disabled={bannerPending || !bannerMessage.trim()}
                                className="w-full py-5 bg-teal-500 hover:bg-teal-400 text-white rounded-3xl text-sm font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-20 disabled:grayscale"
                            >
                                {bannerPending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Radio className="w-5 h-5" />
                                )}
                                <span>Activer le bandeau</span>
                            </button>
                        </div>
                        
                        <div className="bg-black/20 rounded-3xl p-6 border border-white/5 space-y-4">
                            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center">Aperçu Dashboard</h4>
                            <div className="flex items-center justify-center min-h-[100px]">
                                {bannerMessage ? (
                                    <div className={cn("w-full p-4 rounded-xl border-l-4 shadow-lg", typeColors[bannerType])}>
                                        <div className="flex items-center gap-3">
                                            {typeIcons[bannerType]}
                                            <p className="text-xs font-bold line-clamp-3">{bannerMessage}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-600 font-medium italic text-center px-8">Tapez un message pour voir l'aperçu...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. DISCORD BROADCAST SECTION */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6 md:p-10 space-y-8 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Send className="w-5 h-5 text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">
                                Broadcast Discord
                            </h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-6">
                            <textarea
                                value={discordMessage}
                                onChange={(e) => setDiscordMessage(e.target.value)}
                                placeholder="Le message sera envoyé sur tous les salons d'annonces des guildes..."
                                className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-base text-white placeholder:text-zinc-700 resize-none h-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
                                maxLength={500}
                            />

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex flex-wrap gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                                    {(["maintenance", "update", "info"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setDiscordType(t)}
                                            className={cn(
                                                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                                                discordType === t
                                                    ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                                                    : "border-transparent text-zinc-500 hover:text-white"
                                            )}
                                        >
                                            <div className={cn("w-1.5 h-1.5 rounded-full", 
                                                t === "maintenance" ? "bg-amber-500" : t === "update" ? "bg-emerald-500" : "bg-indigo-500"
                                            )} />
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                <label className="flex items-center gap-3 p-3 bg-black/40 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/5 transition-all ml-auto">
                                    <input
                                        type="checkbox"
                                        checked={mentionEveryone}
                                        onChange={() => setMentionEveryone(!mentionEveryone)}
                                        className="w-5 h-5 rounded-lg border-white/10 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30"
                                    />
                                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                        @everyone
                                    </span>
                                </label>
                            </div>

                            {stelliumChannels.length > 0 && (
                                <div className="p-6 rounded-3xl bg-violet-500/5 border border-violet-500/10 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                        <span className="text-xs font-black text-violet-400 uppercase tracking-widest">
                                            Destination Stellium
                                        </span>
                                    </div>
                                    <select
                                        value={stelliumChannelId}
                                        onChange={(e) => setStelliumChannelId(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500/30 transition-all"
                                    >
                                        <option value="">Par défaut (Config Guilde)</option>
                                        {stelliumChannels.map(c => (
                                            <option key={c.id} value={c.id}># {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button
                                onClick={handleBroadcast}
                                disabled={discordPending || !discordMessage.trim()}
                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl text-sm font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-20 disabled:grayscale"
                            >
                                {discordPending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                                <span>Envoyer globalement</span>
                            </button>
                        </div>

                        <div className="bg-[#313338] rounded-3xl p-6 md:p-10 border border-black/50 shadow-2xl relative">
                             <div className="absolute top-4 left-6 text-[10px] font-black text-white/20 uppercase tracking-widest">Aperçu Discord</div>
                             <div className="mt-8 flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#5865f2] flex-shrink-0 flex items-center justify-center font-bold text-white text-lg">S</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-bold text-sm">SigilBot</span>
                                        <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1 rounded uppercase">Bot</span>
                                        <span className="text-white/20 text-[10px] font-medium">Aujourd'hui à {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}</span>
                                    </div>
                                    <div className={cn(
                                        "rounded-lg overflow-hidden border-l-4 mt-2",
                                        discordType === "maintenance" ? "border-amber-500 bg-[#2b2d31]" : 
                                        discordType === "update" ? "border-emerald-500 bg-[#2b2d31]" : 
                                        "border-indigo-500 bg-[#2b2d31]"
                                    )}>
                                        <div className="p-4 space-y-2">
                                            <div className="text-xs text-white/40 font-bold uppercase tracking-wider">SigilOS Platform</div>
                                            <div className="text-sm font-bold text-white">
                                                {discordType === "maintenance" ? "🛠️ Maintenance Programmée" : 
                                                 discordType === "update" ? "🚀 Mise à Jour SigilOS" : 
                                                 "📢 Annonce SigilOS"}
                                            </div>
                                            <div className="text-sm text-zinc-300 break-words">
                                                {discordMessage ? <ReactMarkdown>{discordMessage}</ReactMarkdown> : "Le contenu de votre message apparaîtra ici avec le formatage Markdown..."}
                                            </div>
                                        </div>
                                    </div>
                                    {mentionEveryone && <div className="text-xs text-[#00a8fc] mt-1 font-medium">@everyone</div>}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
