"use client";

import { useEffect, useState } from "react";
import { 
    Database, 
    Zap, 
    ShieldCheck, 
    RefreshCw, 
    CheckCircle2, 
    AlertTriangle, 
    Loader2,
    Clock,
    TerminalSquare,
    Cpu
} from "lucide-react";
import { getInternalSystemStatus } from "@/server/actions/god-system-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SystemStatus {
    database: { 
        status: string; 
        latency: number; 
        insights?: { auditLogs: number; profiles: number; missions: number } 
    };
    cache: { status: string; latency: number };
    backup: { status: string; lastAt: Date | null };
    worker: { 
        status: string; 
        lastAt: Date | null; 
        queues?: { 
            metamob: { waiting: number; active: number; failed: number };
            ladder: { waiting: number; active: number; failed: number };
        } 
    };
    maintenance: { status: string; lastAt: Date | null; metrics?: any };
    disk?: { totalMb: number; freeMb: number; usagePercent: number };
    ram?: { totalMb: number; freeMb: number; usagePercent: number };
}

export function SystemHealthDashboard() {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        const res = await getInternalSystemStatus();
        if (res) setStatus(res as SystemStatus);
        setLoading(false);
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center p-12 bg-zinc-900/20 border border-white/5 rounded-3xl animate-pulse">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Analyse des systèmes...</span>
            </div>
        </div>
    );

    if (!status) return (
        <div className="p-12 bg-rose-500/5 border border-rose-500/10 rounded-3xl text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-tight">Erreur de Diagnostic</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">Le serveur n'a pas pu renvoyer l'état de santé. Vérifiez les logs ou réessayez.</p>
            </div>
            <button onClick={() => { setLoading(true); fetchStatus(); }} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                Réessayer la connexion
            </button>
        </div>
    );

    const getDiskDisplay = () => {
        if (!status.disk || status.disk.totalMb === 0) return "Jamais";
        const totalGb = (status.disk.totalMb / 1024).toFixed(1);
        const freeGb = (status.disk.freeMb / 1024).toFixed(1);
        return `${freeGb}Go libres / ${totalGb}Go`;
    };

    const getRamDisplay = () => {
        if (!status.ram || status.ram.totalMb === 0) return "Jamais";
        const totalGb = (status.ram.totalMb / 1024).toFixed(1);
        const freeGb = (status.ram.freeMb / 1024).toFixed(1);
        return `${freeGb}Go libres / ${totalGb}Go`;
    };

    const totalWaitingJobs = (status.worker.queues?.metamob.waiting || 0) + (status.worker.queues?.ladder.waiting || 0);

    const cards = [
        {
            label: "Base de données",
            subLabel: "PostgreSQL Prisma",
            value: status.database.status === "ONLINE" ? `${status.database.latency}ms` : "OFFLINE",
            status: status.database.status,
            icon: Database,
            color: "emerald",
            footer: status.database.insights ? `${(status.database.insights.auditLogs / 1000).toFixed(1)}k logs / ${status.database.insights.profiles} profils` : null
        },
        {
            label: "Moteur Cache",
            subLabel: "Redis WebSocket",
            value: status.cache.status === "ONLINE" ? `${status.cache.latency}ms` : "OFFLINE",
            status: status.cache.status,
            icon: Zap,
            color: "amber"
        },
        {
            label: "Stockage Système",
            subLabel: "/dev/root OS Disk",
            value: getDiskDisplay(),
            status: status.disk && status.disk.usagePercent < 85 ? "ONLINE" : "OFFLINE",
            icon: TerminalSquare,
            color: status.disk && status.disk.usagePercent >= 85 ? "rose" : "cyan"
        },
        {
            label: "Mémoire Vive (RAM)",
            subLabel: "OS Node Allocation",
            value: getRamDisplay(),
            status: status.ram && status.ram.usagePercent < 90 ? "ONLINE" : "OFFLINE",
            icon: Cpu,
            color: status.ram && status.ram.usagePercent >= 90 ? "rose" : "violet"
        },
        {
            label: "Worker Platforms",
            subLabel: "Ladder & Metamob",
            value: status.worker.lastAt ? formatDistanceToNow(new Date(status.worker.lastAt), { addSuffix: true, locale: fr }) : "En attente",
            status: status.worker.status === "IDLE" ? "ONLINE" : "OFFLINE",
            icon: RefreshCw,
            color: "rose",
            footer: status.worker.queues ? `${totalWaitingJobs} tâches en attente` : null
        },
        {
            label: "Dernier Backup",
            subLabel: "Cloudflare R2 Storage",
            value: status.backup.lastAt ? formatDistanceToNow(new Date(status.backup.lastAt), { addSuffix: true, locale: fr }) : "Aucun",
            status: status.backup.status === "SUCCESS" ? "ONLINE" : "OFFLINE",
            icon: ShieldCheck,
            color: "indigo"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {cards.map((card, i) => (
                <div key={i} className="group relative overflow-hidden bg-zinc-900/40 border border-white/5 p-5 rounded-3xl transition-all hover:bg-zinc-900/60 hover:border-white/10">
                    {/* Background Glow */}
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-${card.color}-500/5 blur-[40px] -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity`} />
                    
                    <div className="flex items-start justify-between mb-4">
                        <div className={`p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 group-hover:text-${card.color}-400 group-hover:border-${card.color}-500/20 transition-all`}>
                            <card.icon className="w-4 h-4" />
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-900/50 border border-white/5`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${card.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                                {card.status === 'ONLINE' ? 'Ok' : 'Err'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">
                            {card.subLabel}
                        </div>
                        <div className="text-sm font-bold text-white group-hover:tracking-wide transition-all truncate">
                            {card.label}
                        </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                        <div className="space-y-1">
                            <div className="text-lg font-black text-zinc-400 group-hover:text-white transition-colors">
                                {card.value}
                            </div>
                            {card.footer && (
                                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest whitespace-nowrap">
                                    {card.footer}
                                </div>
                            )}
                        </div>
                        <Clock className="w-3.5 h-3.5 text-zinc-800" />
                    </div>
                </div>
            ))}
        </div>
    );
}
