"use client";

import { useEffect, useState } from "react";
import { getGuildsStorageStats } from "@/server/actions/god-storage-actions";
import { HardDrive, Activity, Image as ImageIcon, Loader2 } from "lucide-react";

export function StoragePanel() {
    const [stats, setStats] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getGuildsStorageStats().then((data) => {
            setStats(data);
            setIsLoading(false);
        });
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (isLoading) {
        return (
            <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl space-y-8">
            <div className="flex items-center gap-3">
                <HardDrive className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-black text-white uppercase tracking-widest">
                    Ressources Disque & Captures
                </h3>
            </div>

            <div className="grid gap-4">
                {stats?.map((guild) => (
                    <div key={guild.id} className="bg-black/40 border border-white/5 rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg text-white">{guild.name}</h4>
                                <p className="text-xs text-zinc-500">{guild.members} membres inscrits</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-xl text-blue-400 font-bold">{formatBytes(guild.sizeBytes)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-lg">
                                    <ImageIcon className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Captures en attente
                                    </p>
                                    <p className="text-xl font-black text-white">{guild.pendingSubmissions}</p>
                                </div>
                            </div>

                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Captures (/jour)
                                    </p>
                                    <p className="text-xl font-black text-white">{guild.submissionsToday} ajoutées ajd.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {stats?.length === 0 && (
                    <div className="text-center text-zinc-500 py-12 border border-white/5 rounded-2xl bg-black/20">
                        Aucune guilde active pour les statistiques.
                    </div>
                )}
            </div>
        </div>
    );
}
