"use client";

import { useState, useTransition } from "react";
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
    RefreshCw
} from "lucide-react";
import { markGodNotificationRead } from "@/server/actions/god-notif-actions";
import { toast } from "sonner";

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
    const [isPending, startTransition] = useTransition();

    const filteredNotifications = notifications.filter(n => 
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleMarkRead = (id: string) => {
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

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-white/5">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <Bell className="w-8 h-8 text-rose-500" />
                        Alertes Système
                    </h2>
                    <p className="text-zinc-500 font-medium">Notifications temps-réel de l'infrastructure et des services.</p>
                </div>

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input 
                        type="text"
                        placeholder="Filtrer les notifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 border border-white/5 rounded-2xl text-sm text-zinc-300 focus:outline-none focus:border-rose-500/30 transition-all shadow-inner"
                    />
                </div>
            </div>

            {/* Notifications List */}
            <div className="grid gap-4">
                {filteredNotifications.length === 0 ? (
                    <div className="py-20 text-center space-y-4 bg-zinc-900/20 border border-white/5 rounded-3xl">
                        <div className="inline-flex p-4 rounded-full bg-zinc-900 border border-white/5">
                            <Bell className="w-8 h-8 text-zinc-700" />
                        </div>
                        <p className="text-zinc-600 font-medium italic">Aucune notification trouvée.</p>
                    </div>
                ) : (
                    filteredNotifications.map((notif) => (
                        <div 
                            key={notif.id}
                            className={`group relative overflow-hidden p-6 bg-zinc-900/40 border border-white/5 rounded-3xl transition-all hover:bg-zinc-900/60 ${!notif.isRead ? 'ring-1 ring-rose-500/30 bg-rose-500/5' : ''}`}
                        >
                            <div className="flex items-start gap-6">
                                {/* Success/Fail Indicator */}
                                <div className={`shrink-0 p-3 rounded-2xl border ${notif.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                    {notif.success ? 
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : 
                                        <XCircle className="w-5 h-5 text-rose-400" />
                                    }
                                </div>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                                {getTypeIcon(notif.type)}
                                                {notif.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-zinc-600 text-[10px] flex items-center gap-1.5 font-bold">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(notif.createdAt), "d MMMM HH:mm", { locale: fr })}
                                            </span>
                                        </div>
                                        {!notif.isRead && (
                                            <button 
                                                onClick={() => handleMarkRead(notif.id)}
                                                className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 transition-colors"
                                            >
                                                Marquer comme lu
                                            </button>
                                        )}
                                    </div>

                                    <h4 className="text-lg font-bold text-white group-hover:text-rose-100 transition-colors tracking-tight">
                                        {notif.title}
                                    </h4>
                                    
                                    <p className="text-zinc-400 text-sm leading-relaxed max-w-4xl">
                                        {notif.message}
                                    </p>

                                    {notif.metadata && (
                                        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Object.entries(notif.metadata).map(([key, value]) => (
                                                <div key={key} className="space-y-0.5">
                                                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{key}</div>
                                                    <div className="text-xs text-zinc-300 font-mono truncate">{String(value)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Unread Glow */}
                            {!notif.isRead && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-[50px] -translate-y-1/2 translate-x-1/2" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
