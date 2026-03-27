"use client";

import { useState } from "react";
import { Search, Shield, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
    RBAC_UPDATE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    RBAC_ROLE_ADD: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    RBAC_ROLE_REMOVE: "bg-red-500/20 text-red-400 border-red-500/30",
    CONFIG_UPDATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    SETTINGS_UPDATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    SECURITY_ALERT: "bg-red-600/20 text-red-300 border-red-600/30 animate-pulse",
    ACCESS_ATTEMPT: "bg-red-600/20 text-red-300 border-red-600/30 animate-pulse",
    ADMIN_ACCESS_DENIED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    MEMBER_LEFT: "bg-zinc-500/20 text-zinc-400 border-white/5",
    MEMBER_ARCHIVED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    MEMBER_BANNED: "bg-red-500/20 text-red-400 border-red-500/30",
    MEMBER_PURGED: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    WEBHOOK_MEMBER_ADD: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    WEBHOOK_MEMBER_REMOVE: "bg-zinc-500/20 text-zinc-400 border-white/5",
    MISSION_CREATED: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    MISSION_DELETED: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    MISSION_VALIDATED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    MISSION_REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
    BONUS_PURCHASED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    BONUS_CANCELLED: "bg-zinc-500/20 text-zinc-400 border-white/5",
    POLL_CREATED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    POLL_CLOSED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    POLL_DELETED: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    POLL_CREATOR_ROLE_ACQUIRED: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
    CHAT_BLOCKED_ATTEMPT: "bg-red-500/20 text-red-400 border-red-500/30",
    USER_GDPR_DELETE: "bg-red-600/20 text-red-300 border-red-600/30",
    GOD_ACTION: "bg-blue-600/20 text-blue-300 border-blue-500/30",
};

const ACTION_OPTIONS = [
    { value: "all", label: "Toutes les actions" },
    { value: "SECURITY_ALERT,ACCESS_ATTEMPT", label: "🚨 Alertes Sécurité & Accès (IP)" },
    { value: "RBAC_UPDATE", label: "Permissions modifiées" },
    { value: "MISSION_CREATED,MISSION_DELETED,MISSION_VALIDATED,MISSION_REJECTED", label: "⚔️ Missions" },
    { value: "BONUS_PURCHASED,BONUS_CANCELLED", label: "🔮 Bonus" },
    { value: "POLL_CREATED,POLL_CLOSED,POLL_DELETED,POLL_CREATOR_ROLE_ACQUIRED", label: "📊 Sondages & Micro" },
    { value: "MEMBER_PURGED,MEMBER_BANNED,MEMBER_ARCHIVED,MEMBER_LEFT,WEBHOOK_MEMBER_ADD,WEBHOOK_MEMBER_REMOVE", label: "🔄 Mouvements" },
    { value: "CONFIG_UPDATED,SETTINGS_UPDATED", label: "⚙️ Configuration" },
    { value: "CHAT_BLOCKED_ATTEMPT", label: "💬 Modération Chat" },
    { value: "USER_GDPR_DELETE", label: "🗑️ Suppressions RGPD" },
];

export function AuditFeedPanel({ logs, total }: { logs: any[]; total: number }) {
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("all");

    const filteredLogs = logs.filter(log => {
        // Text Search
        const s = search.toLowerCase();
        let textMatch = true;
        if (s) {
            const metadataStr = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
            textMatch = (
                log.action?.toLowerCase().includes(s) ||
                log.actorName?.toLowerCase().includes(s) ||
                log.targetType?.toLowerCase().includes(s) ||
                (log.guild?.name || "").toLowerCase().includes(s) ||
                metadataStr.includes(s) // Includes IPs, descriptions, reasons mapped in metadata
            );
        }

        // Action Filter
        let actionMatch = true;
        if (actionFilter !== "all") {
            const wantedActions = actionFilter.split(",");
            actionMatch = wantedActions.includes(log.action);
        }

        return textMatch && actionMatch;
    });

    return (
        <div className="p-8 flex flex-col h-full max-h-[800px]">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-500 font-black uppercase tracking-widest">
                        Security Feed ({total})
                    </span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                    
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-[200px] h-9 text-xs bg-zinc-900/50 border-white/5 text-zinc-300">
                            <SelectValue placeholder="Catégorie d'action..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10">
                            {ACTION_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs text-zinc-300 focus:bg-zinc-800">
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="relative w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Chercher acteur, IP, guilde..."
                            className="w-full h-9 pl-9 pr-4 text-xs bg-zinc-900/50 border-white/5 text-white placeholder:text-zinc-700 focus:border-blue-500/40"
                        />
                    </div>
                    
                    {(search || actionFilter !== "all") && (
                        <button onClick={() => { setSearch(""); setActionFilter("all"); }} className="text-zinc-500 hover:text-white px-2 cursor-pointer transition-colors border border-white/5 h-9 rounded-xl flex items-center justify-center">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3 font-mono text-[11px] overflow-y-auto pr-2 pb-4 flex-1 styling-scrollbar">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
                        Aucun log ne correspond
                    </div>
                ) : (
                    filteredLogs.map(log => {
                        const metadata = log.metadata || {};
                        const displayMsg = metadata.message && metadata.message.length > 80 ? metadata.message.substring(0, 80) + "..." : metadata.message;

                        return (
                            <div key={log.id} className="flex flex-col justify-center gap-1.5 p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all group relative">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-zinc-600 whitespace-nowrap shrink-0">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                    </span>
                                    
                                    <Badge variant="outline" className={cn("text-[9px] px-2 py-0.5 h-auto uppercase font-black", ACTION_COLORS[log.action] || "bg-zinc-800 text-zinc-400 border-white/5")}>
                                        {log.action}
                                    </Badge>

                                    <span className="text-zinc-300 ml-1">@{log.actorName}</span>
                                    
                                    {log.guild?.name && (
                                        <span className="text-[9px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded ml-auto">
                                            {log.guild.name}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="text-zinc-500 flex flex-col gap-0.5 pl-[68px]">
                                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                        <span className="opacity-70 font-semibold">{log.targetType}</span>
                                        {log.targetId && <span>({log.targetId})</span>}
                                        
                                        {metadata.ip && (
                                            <span className="text-red-400/80 bg-red-500/10 px-1 py-0.5 rounded font-black tracking-widest ml-2 flex items-center gap-1">
                                                <Shield className="w-2.5 h-2.5" /> IP: {metadata.ip}
                                            </span>
                                        )}
                                        {metadata.reason && <span className="text-amber-500/70 italic">- {metadata.reason}</span>}
                                    </div>
                                    
                                    {displayMsg && (
                                        <div className="mt-1 bg-black/50 border border-white/5 p-1.5 rounded italic break-all max-w-[80%]">
                                            "{displayMsg}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
