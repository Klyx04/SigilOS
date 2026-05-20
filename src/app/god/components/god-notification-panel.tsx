"use client";

import { useState, useTransition, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
    Bell, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    ExternalLink, 
    Search,
    ShieldAlert,
    Terminal,
    Database,
    Ticket,
    Bug,
    Info,
    RefreshCw,
    Filter,
    ArrowDownAZ,
    ArrowUpZA,
    ListFilter
} from "lucide-react";
import { markGodNotificationRead } from "@/server/actions/god-notif-actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface GodNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    success: boolean;
    isRead: boolean;
    metadata: any;
    createdAt: Date;
}

interface GodNotificationPanelProps {
    notifications: GodNotification[];
}

export function GodNotificationPanel({ notifications: initialNotifications }: GodNotificationPanelProps) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("ALL");
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterRead, setFilterRead] = useState<string>("ALL");
    const [sortOrder, setSortOrder] = useState<"DESC" | "ASC">("DESC");
    const [isPending, startTransition] = useTransition();

    const uniqueTypes = useMemo(() => {
        return Array.from(new Set(notifications.map(n => n.type)));
    }, [notifications]);

    const filteredAndSortedNotifications = useMemo(() => {
        return notifications
            .filter(n => {
                // Smart search
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const matchesTitle = n.title.toLowerCase().includes(term);
                    const matchesMessage = n.message.toLowerCase().includes(term);
                    const matchesType = n.type.toLowerCase().includes(term);
                    let matchesMetadata = false;
                    if (n.metadata) {
                        matchesMetadata = Object.values(n.metadata).some(val => 
                            String(val).toLowerCase().includes(term)
                        );
                    }
                    if (!matchesTitle && !matchesMessage && !matchesType && !matchesMetadata) return false;
                }

                // Filters
                if (filterType !== "ALL" && n.type !== filterType) return false;
                if (filterStatus === "SUCCESS" && !n.success) return false;
                if (filterStatus === "FAILURE" && n.success) return false;
                if (filterRead === "READ" && !n.isRead) return false;
                if (filterRead === "UNREAD" && n.isRead) return false;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
            });
    }, [notifications, searchTerm, filterType, filterStatus, filterRead, sortOrder]);

    const handleMarkRead = (id: string, e?: React.MouseEvent) => {
        if (e) e.preventDefault(); // Empêcher de trigger le lien
        startTransition(async () => {
            const res = await markGodNotificationRead(id);
            if (res.success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            } else {
                toast.error("Erreur lors du marquage en lu");
            }
        });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "VPS_MAINTENANCE": return <Terminal className="w-4 h-4 text-blue-400" />;
            case "BACKUP": return <Database className="w-4 h-4 text-emerald-400" />;
            case "WORKER_SYNC": return <RefreshCw className="w-4 h-4 text-amber-400" />;
            case "TICKET": return <Ticket className="w-4 h-4 text-indigo-400" />;
            case "GEOGUESSER_REPORT": return <Bug className="w-4 h-4 text-rose-400" />;
            case "SECURITY_ALERT": return <ShieldAlert className="w-4 h-4 text-red-500" />;
            default: return <Info className="w-4 h-4 text-zinc-400" />;
        }
    };

    const getNotificationLink = (notif: GodNotification) => {
        switch (notif.type) {
            case "TICKET":
                return notif.metadata?.ticketId ? `/god/bugs?ticket=${notif.metadata.ticketId}` : "/god/bugs";
            case "SECURITY_ALERT":
            case "VPS_MAINTENANCE":
                return "/god/logs";
            case "GEOGUESSER_REPORT":
                return "/god/mini-games";
            case "GUILD_UPDATE":
                return notif.metadata?.guildId ? `/god/guilds/${notif.metadata.guildId}` : "/god/guilds";
            default:
                return null;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header & Smart Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <Bell className="w-8 h-8 text-rose-500" />
                        Alertes Système
                    </h2>
                    <p className="text-zinc-500 font-medium">Notifications temps-réel de l'infrastructure et des services.</p>
                </div>

                <div className="relative w-full md:w-[400px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input 
                        type="text"
                        placeholder="Recherche intelligente (titre, message, metadata)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 border border-white/5 rounded-2xl text-sm text-zinc-300 focus:outline-none focus:border-rose-500/30 transition-all shadow-inner"
                    />
                </div>
            </div>

            {/* Premium Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-zinc-900/30 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mr-2 border-r border-white/5 pr-4">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Filtres</span>
                </div>

                {/* Type Filter */}
                <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium rounded-xl px-3 py-2 outline-none focus:border-rose-500/50 transition-colors cursor-pointer"
                >
                    <option value="ALL">Tous les types</option>
                    {uniqueTypes.map(type => (
                        <option key={type} value={type}>{type.replace('_', ' ')}</option>
                    ))}
                </select>

                {/* Status Filter */}
                <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium rounded-xl px-3 py-2 outline-none focus:border-rose-500/50 transition-colors cursor-pointer"
                >
                    <option value="ALL">Tous les statuts</option>
                    <option value="SUCCESS">Succès uniquement</option>
                    <option value="FAILURE">Erreurs uniquement</option>
                </select>

                {/* Read Status Filter */}
                <select 
                    value={filterRead}
                    onChange={(e) => setFilterRead(e.target.value)}
                    className="bg-zinc-900 border border-white/10 text-zinc-300 text-xs font-medium rounded-xl px-3 py-2 outline-none focus:border-rose-500/50 transition-colors cursor-pointer"
                >
                    <option value="ALL">Toutes les lectures</option>
                    <option value="UNREAD">Non lues</option>
                    <option value="READ">Lues</option>
                </select>

                <div className="flex-1" />

                {/* Sort Order */}
                <button 
                    onClick={() => setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC")}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl hover:bg-zinc-800 hover:border-white/20 transition-all text-zinc-300 group"
                >
                    {sortOrder === "DESC" ? (
                        <ArrowDownAZ className="w-4 h-4 text-zinc-400 group-hover:text-rose-400 transition-colors" />
                    ) : (
                        <ArrowUpZA className="w-4 h-4 text-zinc-400 group-hover:text-rose-400 transition-colors" />
                    )}
                    <span className="text-xs font-medium">
                        {sortOrder === "DESC" ? "Plus récentes" : "Plus anciennes"}
                    </span>
                </button>
            </div>

            {/* Notifications List */}
            <div className="grid gap-4">
                {filteredAndSortedNotifications.length === 0 ? (
                    <div className="py-20 text-center space-y-4 bg-zinc-900/20 border border-white/5 rounded-3xl">
                        <div className="inline-flex p-4 rounded-full bg-zinc-900 border border-white/5">
                            <ListFilter className="w-8 h-8 text-zinc-700" />
                        </div>
                        <p className="text-zinc-600 font-medium italic">Aucune notification ne correspond à vos critères.</p>
                    </div>
                ) : (
                    filteredAndSortedNotifications.map((notif) => {
                        const link = getNotificationLink(notif);
                        
                        const CardContent = (
                            <div className="flex items-start gap-6 relative z-10 w-full">
                                {/* Success/Fail Indicator */}
                                <div className={`shrink-0 p-3 rounded-2xl border ${notif.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                    {notif.success ? 
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : 
                                        <XCircle className="w-5 h-5 text-rose-400" />
                                    }
                                </div>

                                <div className="flex-1 space-y-2 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                                {getTypeIcon(notif.type)}
                                                {notif.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-zinc-600 text-[10px] flex items-center gap-1.5 font-bold whitespace-nowrap">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(notif.createdAt), "d MMMM HH:mm", { locale: fr })}
                                            </span>
                                            {link && (
                                                <span className="text-rose-400/50 text-[10px] flex items-center gap-1 font-bold whitespace-nowrap group-hover:text-rose-400 transition-colors">
                                                    <ExternalLink className="w-3 h-3" />
                                                    Détails
                                                </span>
                                            )}
                                        </div>
                                        
                                        {!notif.isRead && (
                                            <button 
                                                onClick={(e) => handleMarkRead(notif.id, e)}
                                                className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 transition-colors shrink-0 px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-md z-20"
                                            >
                                                Marquer lu
                                            </button>
                                        )}
                                    </div>

                                    <h4 className="text-lg font-bold text-white group-hover:text-rose-100 transition-colors tracking-tight truncate">
                                        {notif.title}
                                    </h4>
                                    
                                    <p className="text-zinc-400 text-sm leading-relaxed max-w-4xl">
                                        {notif.message}
                                    </p>

                                    {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Object.entries(notif.metadata).map(([key, value]) => (
                                                <div key={key} className="space-y-0.5 min-w-0">
                                                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest truncate">{key}</div>
                                                    <div className="text-xs text-zinc-300 font-mono truncate">{String(value)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );

                        return (
                            <div 
                                key={notif.id}
                                className={cn(
                                    "group relative overflow-hidden p-6 bg-zinc-900/40 border border-white/5 rounded-3xl transition-all duration-300 hover:bg-zinc-900/80 hover:border-white/10",
                                    !notif.isRead && "ring-1 ring-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10",
                                    link && "cursor-pointer hover:shadow-[0_0_30px_rgba(244,63,94,0.1)] hover:-translate-y-0.5"
                                )}
                            >
                                {link ? (
                                    <Link href={link} className="block w-full">
                                        {CardContent}
                                    </Link>
                                ) : (
                                    CardContent
                                )}
                                
                                {/* Unread Glow */}
                                {!notif.isRead && (
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
