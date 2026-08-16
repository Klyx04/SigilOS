"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { Shield, RefreshCw, Unlink, CheckCircle2, Zap, Info, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
    getMyOcreProgress, 
    unlinkOcreAccount,
    OcreProgressData
} from "@/server/actions/ocre-actions";

interface DofusOcreMetamobProps {
    guildId: string;
    metamobUsername: string | null;
    onLinkMetamob: (pseudo: string) => Promise<any>;
}

export function DofusOcreMetamob({ guildId, metamobUsername, onLinkMetamob }: DofusOcreMetamobProps) {
    const [username, setUsername] = useState<string | null>(metamobUsername);
    const [isPending, startTransition] = React.useTransition();

    async function handleLink(u: string) {
        const res = await onLinkMetamob(u);
        if (res.success) {
            setUsername(u);
            toast.success("Compte Metamob lié !");
        } else {
            throw new Error(res.error ?? "Erreur de liaison");
        }
    }

    async function handleUnlink() {
        if (!confirm("Voulez-vous délier votre compte Metamob ?")) return;
        startTransition(async () => {
            const res = await unlinkOcreAccount({ guildId });
            if (res.success) {
                setUsername(null);
                toast.success("Compte délié");
            }
        });
    }

    return (
        <div className="w-full">
            {username ? (
                <MetamobProgressView 
                    guildId={guildId} 
                    username={username} 
                    onUnlink={handleUnlink} 
                />
            ) : (
                <MetamobLinkPrompt onLink={handleLink} />
            )}
        </div>
    );
}

function MetamobLinkPrompt({ onLink }: { onLink: (username: string) => Promise<void> }) {
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="py-12 flex flex-col items-center text-center gap-6 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                <Crown className="w-8 h-8 text-warning" />
            </div>
            <div>
                <h3 className="text-lg font-black text-foreground italic uppercase tracking-tighter">Lier ton Ocre</h3>
                <p className="text-label text-muted-foreground leading-relaxed mt-1">
                    Connecte ton compte <span className="text-warning font-bold">Metamob</span> pour synchroniser ta progression réelle.
                </p>
            </div>
            <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setError(null);
                try { await onLink(username); }
                catch (err: any) { setError(err.message); }
                finally { setLoading(false); }
            }} className="w-full space-y-3">
                <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Pseudo Metamob"
                    className="w-full h-11 bg-background/80 border border-border rounded-2xl px-4 text-foreground text-sm font-bold focus:border-warning/40 outline-none transition-colors"
                />
                <Button disabled={loading || !username} className="w-full h-11 bg-warning text-warning-foreground font-black uppercase tracking-widest rounded-2xl">
                    {loading ? "Liaison..." : "Lier mon compte"}
                </Button>
                {error && <div className="text-danger text-caption uppercase font-bold">{error}</div>}
            </form>
        </div>
    );
}

function MetamobProgressView({ guildId, username, onUnlink }: { guildId: string; username: string; onUnlink: () => void }) {
    const [data, setData] = useState<OcreProgressData | null>(null);
    const [loading, setLoading] = useState(true);

    async function refresh() {
        setLoading(true);
        const res = await getMyOcreProgress(guildId);
        if (res.success && res.data) setData(res.data);
        setLoading(false);
    }

    useEffect(() => { refresh(); }, [guildId]);

    const StatItem = ({ label, current, total, color }: { label: string; current: number; total: number; color: string }) => {
        const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        return (
            <div className="space-y-2">
                <div className="flex justify-between text-caption font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground">{current} / {total}</span>
                </div>
                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${pct}%` }} 
                        className={`h-full rounded-full transition-all duration-300 ${color}`}
                    />
                </div>
            </div>
        );
    };

    if (loading && !data) return (
        <div className="py-12 flex flex-col items-center gap-3 opacity-50">
            <RefreshCw className="w-5 h-5 animate-spin text-warning" />
            <span className="text-caption font-black uppercase tracking-widest">Metamob Sync...</span>
        </div>
    );

    return (
        <div className="p-1 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between gap-4 p-4 bg-background/40 border border-border rounded-3xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-warning" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-caption font-black text-warning/60 uppercase tracking-widest">Metamob Live</div>
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-black text-foreground italic truncate">{username}</div>
                        <a 
                            href={`/dashboard/${guildId}/quete-ocre`} 
                            className="p-1 rounded-lg bg-surface border border-border hover:bg-surface transition-colors"
                        >
                            <Crown className="w-3 h-3 text-warning" />
                        </a>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} className="w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onUnlink} className="h-8 px-3 text-caption font-black uppercase text-muted-foreground hover:text-danger rounded-xl">
                        <Unlink className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {data && (
                <div className="grid sm:grid-cols-3 gap-6 px-2">
                    <StatItem label="Étapes Quête" current={data.questInfo.currentStep} total={34} color="bg-warning" />
                    <StatItem label="Gardiens" current={data.stats.bosses.gathered} total={data.stats.bosses.total} color="bg-info" />
                    <StatItem label="Archimonstres" current={data.stats.archis.gathered} total={data.stats.archis.total} color="bg-success" />
                </div>
            )}

            {data && data.stats.bosses.gathered < data.stats.bosses.total && (
                <div className="space-y-4 px-2">
                    <div className="flex items-center gap-2 text-caption font-black text-muted-foreground uppercase tracking-widest">
                        <Zap className="w-3 h-3 text-warning" /> Prochaines cibles (Boss)
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {data.monsters
                            .filter(m => m.type === "boss" && m.state === "MANQUANT")
                            .slice(0, 5)
                            .map(m => (
                                <div key={m.id} className="group relative flex flex-col items-center gap-2 p-3 bg-surface border border-border rounded-2xl hover:bg-surface transition-all">
                                    <div className="relative w-12 h-12 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                        <img 
                                            src={`https://www.metamob.fr/images/monstres/${m.id}.png`} 
                                            alt={m.name} 
                                            className="w-full h-full object-contain"
                                            onError={(e) => { 
                                                (e.target as HTMLImageElement).src = `https://static.dofusdb.fr/monsters/${m.id}.png`; 
                                            }}
                                        />
                                    </div>
                                    <div className="text-caption font-black text-muted-foreground text-center uppercase truncate w-full">{m.name}</div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-info/5 rounded-2xl border border-info/10">
                <Info className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
                <p className="text-caption text-muted-foreground italic leading-relaxed">
                    Données synchronisées avec Metamob. Mets à jour tes captures sur le site pour voir ta progression ici.
                </p>
            </div>
        </div>
    );
}
