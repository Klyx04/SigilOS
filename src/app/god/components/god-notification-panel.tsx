"use client";

import { useState, useTransition, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
    Bell, 
    CheckCircle2, 
    CheckCheck,
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
import { markGodNotificationRead, markAllGodNotificationsRead } from "@/server/actions/god-notif-actions";
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

    const handleMarkAllRead = () => {
        startTransition(async () => {
            const res = await markAllGodNotificationsRead();
            if (res.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                toast.success("Toutes les alertes marquées comme lues.");
            } else {
                toast.error("Erreur lors du marquage en lu");
            }
        });
    };

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
            case "USER_FEEDBACK":
                return notif.metadata?.ticketId ? `/god/bugs?ticket=SIG-${notif.metadata.ticketId}` : "/god/bugs";
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
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Smart Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-border">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
                        <Bell className="w-6 h-6 text-danger" />
                        Alertes Système God
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium">Notifications temps-réel de l'infrastructure et des services.</p>
                </div>

                <div className="relative w-full md:w-[380px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                        type="text"
                        placeholder="Recherche (titre, message, metadata)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
                    />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2.5 p-3 bg-surface/50 border border-border rounded-2xl">
                <div className="flex items-center gap-2 mr-1 border-r border-border pr-3">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-caption font-bold text-muted-foreground uppercase tracking-wider">Filtres</span>
                </div>

                {/* Type Filter */}
                <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer"
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
                    className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer"
                >
                    <option value="ALL">Tous les statuts</option>
                    <option value="SUCCESS">Succès uniquement</option>
                    <option value="FAILURE">Erreurs uniquement</option>
                </select>

                {/* Read Status Filter */}
                <select 
                    value={filterRead}
                    onChange={(e) => setFilterRead(e.target.value)}
                    className="bg-surface border border-border text-foreground text-xs font-medium rounded-xl px-2.5 py-1.5 outline-none focus:border-border-strong transition-colors cursor-pointer"
                >
                    <option value="ALL">Toutes les lectures</option>
                    <option value="UNREAD">Non lues</option>
                    <option value="READ">Lues</option>
                </select>

                <div className="flex-1" />

                {/* Actions */}
                <button 
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-xl hover:bg-elevated transition-colors text-foreground text-xs font-bold"
                >
                    <CheckCheck className="w-3.5 h-3.5 text-success" />
                    <span>Tout marquer lu</span>
                </button>

                <button 
                    onClick={() => setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-xl hover:bg-elevated transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
                >
                    {sortOrder === "DESC" ? (
                        <ArrowDownAZ className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                        <ArrowUpZA className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>
                        {sortOrder === "DESC" ? "Plus récentes" : "Plus anciennes"}
                    </span>
                </button>
            </div>

            {/* Notifications List */}
            <div className="grid gap-3">
                {filteredAndSortedNotifications.length === 0 ? (
                    <div className="py-16 text-center space-y-3 bg-surface/30 border border-dashed border-border rounded-2xl">
                        <div className="inline-flex p-3 rounded-full bg-surface border border-border">
                            <ListFilter className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-xs font-medium">Aucune notification ne correspond à vos critères.</p>
                    </div>
                ) : (
                    filteredAndSortedNotifications.map((notif) => {
                        const link = getNotificationLink(notif);
                        
                        const CardContent = (
                            <div className="flex items-start gap-4 relative z-10 w-full">
                                {/* Success/Fail Indicator */}
                                <div className={cn(
                                    "shrink-0 p-2.5 rounded-xl border",
                                    notif.success ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'
                                )}>
                                    {notif.success ? 
                                        <CheckCircle2 className="w-4 h-4" /> : 
                                        <XCircle className="w-4 h-4" />
                                    }
                                </div>

                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-md bg-muted/40 text-caption font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                {getTypeIcon(notif.type)}
                                                {notif.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-muted-foreground text-caption flex items-center gap-1 font-mono whitespace-nowrap">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(notif.createdAt), "d MMMM HH:mm", { locale: fr })}
                                            </span>
                                            {link && (
                                                <span className="text-info text-caption flex items-center gap-1 font-bold whitespace-nowrap hover:underline">
                                                    <ExternalLink className="w-3 h-3" />
                                                    Détails
                                                </span>
                                            )}
                                        </div>
                                        
                                        {!notif.isRead && (
                                            <button 
                                                onClick={(e) => handleMarkRead(notif.id, e)}
                                                className="text-caption font-bold text-danger uppercase tracking-wider hover:bg-danger/15 transition-colors shrink-0 px-2 py-0.5 bg-danger/10 rounded-md z-20"
                                            >
                                                Marquer lu
                                            </button>
                                        )}
                                    </div>

                                    <h4 className="text-base font-bold text-foreground tracking-tight truncate">
                                        {notif.title}
                                    </h4>
                                    
                                    <p className="text-muted-foreground text-xs leading-relaxed max-w-4xl">
                                        {notif.message}
                                    </p>

                                    {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {Object.entries(notif.metadata).map(([key, value]) => (
                                                <div key={key} className="space-y-0.5 min-w-0">
                                                    <div className="text-caption font-bold text-muted-foreground uppercase tracking-wider truncate">{key}</div>
                                                    <div className="text-xs text-foreground font-mono truncate">{String(value)}</div>
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
                                    "group relative overflow-hidden p-5 bg-surface border border-border rounded-2xl transition-all duration-200 hover:bg-elevated/30 hover:border-border-strong",
                                    !notif.isRead && "border-danger/30 bg-danger/5",
                                    link && "cursor-pointer"
                                )}
                            >
                                {link ? (
                                    <Link href={link} className="block w-full">
                                        {CardContent}
                                    </Link>
                                ) : (
                                    CardContent
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
