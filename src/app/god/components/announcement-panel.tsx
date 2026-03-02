"use client";

import ReactMarkdown from "react-markdown";

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
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Megaphone className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                    Communication
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ============================================================ */}
                {/* BANNER SECTION */}
                {/* ============================================================ */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Radio className="w-4 h-4 text-teal-400" />
                            Bandeau Dashboard
                        </h3>
                        {activeAnnouncement && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                                Actif
                            </span>
                        )}
                    </div>

                    {/* Current active announcement */}
                    {activeAnnouncement && (
                        <div className={`p-4 rounded-xl border ${typeColors[activeAnnouncement.type]} flex items-start justify-between gap-3`}>
                            <div className="flex items-start gap-3 flex-1">
                                {typeIcons[activeAnnouncement.type]}
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{activeAnnouncement.message}</p>
                                    {activeAnnouncement.expiresAt && (
                                        <p className="text-[10px] opacity-60">
                                            Expire : {new Date(activeAnnouncement.expiresAt).toLocaleString("fr-FR")}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleClearBanner}
                                disabled={bannerPending}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-500 hover:text-red-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* New announcement form */}
                    <textarea
                        value={bannerMessage}
                        onChange={(e) => setBannerMessage(e.target.value)}
                        placeholder="🛠️ Maintenance prévue à 21h. Sauvegardez vos actions en cours !"
                        className="w-full bg-zinc-950/60 border border-white/5 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 resize-none h-20 focus:outline-none focus:border-amber-500/30 transition-colors"
                        maxLength={200}
                    />

                    <div className="flex items-center gap-3">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                            {(["info", "warning", "maintenance"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setBannerType(t)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${bannerType === t
                                        ? typeColors[t]
                                        : "border-white/5 text-zinc-600 hover:text-zinc-400"
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Expiry */}
                        <select
                            value={bannerExpiry}
                            onChange={(e) => setBannerExpiry(Number(e.target.value))}
                            className="bg-zinc-950/60 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 focus:outline-none"
                        >
                            <option value={30}>30 min</option>
                            <option value={60}>1h</option>
                            <option value={120}>2h</option>
                            <option value={360}>6h</option>
                            <option value={720}>12h</option>
                            <option value={0}>Permanent</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSetBanner}
                            disabled={bannerPending || !bannerMessage.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-sm font-bold text-amber-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {bannerPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Radio className="w-4 h-4" />
                            )}
                            Activer le bandeau
                        </button>

                        {bannerResult && (
                            <span className="text-xs font-medium text-emerald-400 animate-in fade-in">
                                {bannerResult}
                            </span>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* DISCORD BROADCAST SECTION */}
                {/* ============================================================ */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-5">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Send className="w-4 h-4 text-indigo-400" />
                        Broadcast Discord
                    </h3>

                    <textarea
                        value={discordMessage}
                        onChange={(e) => setDiscordMessage(e.target.value)}
                        placeholder="🛠️ SigilOS va être mis à jour dans 15 minutes. Quelques minutes d'indisponibilité sont à prévoir."
                        className="w-full bg-zinc-950/60 border border-white/5 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 resize-none h-20 focus:outline-none focus:border-indigo-500/30 transition-colors"
                        maxLength={500}
                    />

                    {/* Embed preview */}
                    {discordMessage.trim() && (
                        <div className="rounded-xl overflow-hidden border border-white/5">
                            <div className="flex">
                                <div
                                    className="w-1"
                                    style={{
                                        background:
                                            discordType === "maintenance"
                                                ? "#f59e0b"
                                                : discordType === "update"
                                                    ? "#14b8a6"
                                                    : "#6366f1",
                                    }}
                                />
                                <div className="bg-zinc-950/80 p-4 flex-1 space-y-2">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                        SigilOS Platform
                                    </div>
                                    <div className="text-sm font-bold text-white">
                                        {discordType === "maintenance"
                                            ? "🛠️ Maintenance Programmée"
                                            : discordType === "update"
                                                ? "🚀 Mise à Jour SigilOS"
                                                : "📢 Annonce SigilOS"}
                                    </div>
                                    <div className="text-sm text-zinc-400 prose prose-invert prose-p:my-1 prose-a:text-blue-400 prose-strong:text-white max-w-none">
                                        <ReactMarkdown>{discordMessage}</ReactMarkdown>
                                    </div>
                                    {mentionEveryone && (
                                        <div className="text-xs text-blue-400 font-mono">@everyone</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                            {([
                                { value: "maintenance" as const, icon: <Wrench className="w-3 h-3" />, label: "Maintenance" },
                                { value: "update" as const, icon: <Rocket className="w-3 h-3" />, label: "Update" },
                                { value: "info" as const, icon: <Info className="w-3 h-3" />, label: "Info" },
                            ]).map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setDiscordType(t.value)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${discordType === t.value
                                        ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                                        : "border-white/5 text-zinc-600 hover:text-zinc-400"
                                        }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* @everyone toggle */}
                        <label className="flex items-center gap-2 cursor-pointer ml-auto">
                            <input
                                type="checkbox"
                                checked={mentionEveryone}
                                onChange={() => setMentionEveryone(!mentionEveryone)}
                                className="w-4 h-4 rounded border-white/10 bg-zinc-900 text-amber-500 focus:ring-amber-500/30"
                            />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                @everyone
                            </span>
                        </label>
                    </div>

                    {/* Stellium Channel Selector (Hidden if no channels found) */}
                    {stelliumChannels.length > 0 && (
                        <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                    Option Stellium Exclusive
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">
                                    Salon de destination pour Stellium
                                </label>
                                <select
                                    value={stelliumChannelId}
                                    onChange={(e) => setStelliumChannelId(e.target.value)}
                                    className="w-full bg-zinc-950/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/30"
                                >
                                    <option value="">Par défaut (Config Guilde)</option>
                                    {stelliumChannels.map(c => (
                                        <option key={c.id} value={c.id}># {c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBroadcast}
                            disabled={discordPending || !discordMessage.trim()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {discordPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Envoyer à toutes les guildes
                        </button>

                        {discordResult && (
                            <span className="text-xs font-medium animate-in fade-in flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">{discordResult}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
