"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, Save, AlertTriangle, Hash, Clock, Calendar, 
    Trophy, Bell, ShieldCheck, Camera, Users, Info
} from "lucide-react";
import { toast } from "sonner";
import { getGuildatonData, updateGuildatonSettings, type GuildatonSettings } from "@/server/actions/guildaton-actions";
import { cn } from "@/lib/utils";

interface GuildatonSettingsClientProps {
    guildId: string;
}

const DAYS = [
    { id: 1, label: "Lundi" },
    { id: 2, label: "Mardi" },
    { id: 3, label: "Mercredi" },
    { id: 4, label: "Jeudi" },
    { id: 5, label: "Vendredi" },
    { id: 6, label: "Samedi" },
    { id: 0, label: "Dimanche" },
];

export function GuildatonSettingsClient({ guildId }: GuildatonSettingsClientProps) {
    const [settings, setSettings] = useState<GuildatonSettings | null>(null);
    const [availableChannels, setAvailableChannels] = useState<{id: string, name: string}[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{id: string, name: string, color: number}[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            try {
                const res = await getGuildatonData(guildId);
                if (res.success && res.data) {
                    setSettings(res.data.settings || {
                        trackedRoles: [],
                        notifyChannelId: null,
                        adminNotifyChannelId: null,
                        weeklyQuota: 0,
                        reminderDay: 0,
                        reminderTime: "18:00"
                    });
                    setAvailableChannels(res.data.availableChannels || []);
                    setAvailableRoles(res.data.availableRoles || []);
                } else {
                    toast.error(res.error || "Erreur lors du chargement des données");
                    // On définit quand même des settings par défaut pour débloquer l'UI
                    setSettings({
                        trackedRoles: [],
                        notifyChannelId: null,
                        adminNotifyChannelId: null,
                        weeklyQuota: 0,
                        reminderDay: 0,
                        reminderTime: "18:00"
                    });
                }
            } catch (err) {
                toast.error("Erreur de connexion au serveur");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [guildId]);

    const toggleTrackedRole = (roleId: string) => {
        if (!settings) return;
        const roles = settings.trackedRoles.includes(roleId)
            ? settings.trackedRoles.filter(r => r !== roleId)
            : [...settings.trackedRoles, roleId];
        setSettings({ ...settings, trackedRoles: roles });
    };

    const handleSave = () => {
        if (!settings) return;
        startTransition(async () => {
            const res = await updateGuildatonSettings(guildId, settings);
            if (res.success) {
                toast.success("Paramètres Guildaton mis à jour !");
            } else {
                toast.error(res.error || "Erreur de sauvegarde");
            }
        });
    };

    if (isLoading || !settings) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        );
    }

    const activeDayLabel = DAYS.find(d => d.id === settings.reminderDay)?.label || "Lundi";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-zinc-900/40 border-white/5 backdrop-blur-xl">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3 italic uppercase font-black text-xl tracking-tighter">
                                <span className="bg-violet-500/20 text-violet-400 p-2 rounded-xl border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                                    <Trophy className="w-5 h-5" />
                                </span>
                                Rappels <span className="text-violet-500">Guildaton</span>
                            </CardTitle>
                            {settings.adminNotifyChannelId ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                                    Reminders ON
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-zinc-600 border-white/5 px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                                    Désactivé
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-zinc-500 font-medium">
                            Configurez le ciblage des membres et les rappels automatiques.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-10 pb-10">
                        {/* 1. Ciblage des membres */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-600/10 rounded-lg">
                                    <Users className="w-4 h-4 text-violet-400" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-white italic">1. Ciblage & Quota</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-4 border-l-2 border-white/5">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Rôles trackés par le bot</label>
                                    <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto no-scrollbar pr-2">
                                        {availableRoles.map((r) => {
                                            const isActive = settings.trackedRoles.includes(r.id);
                                            return (
                                                <Badge 
                                                    key={r.id}
                                                    onClick={() => toggleTrackedRole(r.id)}
                                                    className={cn(
                                                        "cursor-pointer transition-all px-3 py-1.5 text-[10px] font-bold uppercase",
                                                        isActive 
                                                            ? "bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.1)]" 
                                                            : "bg-zinc-900/50 text-zinc-600 border-white/5 hover:border-white/10"
                                                    )}
                                                    variant="outline"
                                                >
                                                    {r.name}
                                                </Badge>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 italic">
                                        Seuls les membres avec au moins un de ces rôles apparaîtront dans le tableau.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Objectif Hebdomadaire</label>
                                    <div className="relative group">
                                        <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
                                        <Input
                                            type="number"
                                            value={settings.weeklyQuota}
                                            onChange={(e) => setSettings({ ...settings, weeklyQuota: parseInt(e.target.value) || 0 })}
                                            className="pl-12 h-12 bg-black/40 border-white/5 rounded-2xl text-white font-black italic focus:ring-violet-500/20"
                                            placeholder="Ex: 50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-600 uppercase">Points / Semaine</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 italic">
                                        Le quota utilisé pour le badge de retardataires (Slackers).
                                    </p>
                                </div>
                            </div>

                            {/* Canal Public */}
                            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-violet-400" /> Canal de Notification Public (Membres)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select
                                        value={settings.notifyChannelId || ""}
                                        onChange={(e) => setSettings({ ...settings, notifyChannelId: e.target.value || null })}
                                        className="h-12 px-4 rounded-xl bg-black/40 border border-white/5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    >
                                        <option value="">Sélectionnez un salon...</option>
                                        {availableChannels.map(c => (
                                            <option key={c.id} value={c.id}># {c.name}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase leading-tight">
                                            Salon où les membres recevront le rapport hebdomadaire et les pings de rappel.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Rappel Admin */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-600/10 rounded-lg">
                                    <Bell className="w-4 h-4 text-emerald-400" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-white italic">2. Rappel Administrateur</h3>
                            </div>
                            
                            <div className="pl-4 border-l-2 border-white/5 space-y-8">
                                {/* Étape 1 */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Salon Admin (Discord ID)
                                    </label>
                                    <Input
                                        value={settings.adminNotifyChannelId || ""}
                                        onChange={(e) => setSettings({ ...settings, adminNotifyChannelId: e.target.value })}
                                        placeholder="Ex: 1234567890..."
                                        className="font-mono bg-black/40 border-white/5 h-12 rounded-2xl focus:ring-violet-500/20"
                                    />
                                    <p className="text-[11px] text-zinc-500 italic">
                                        Activez le mode dévelopeur Discord pour copier l'ID du salon.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Planification */}
                        <div className="pt-6 border-t border-white/5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2 mb-4">
                                <Calendar className="w-4 h-4 text-emerald-400" /> Planification du rappel
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-zinc-600 ml-1 uppercase">Jour</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DAYS.map((d) => (
                                            <button
                                                key={d.id}
                                                onClick={() => setSettings({ ...settings, reminderDay: d.id })}
                                                className={cn(
                                                    "px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                                                    settings.reminderDay === d.id 
                                                        ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                                                        : "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                                                )}
                                            >
                                                {d.label.substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-zinc-600 ml-1 uppercase">Heure de notification</span>
                                    <div className="relative group">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
                                        <Input
                                            type="time"
                                            value={settings.reminderTime}
                                            onChange={(e) => setSettings({ ...settings, reminderTime: e.target.value })}
                                            className="pl-12 h-12 bg-black/40 border-white/10 rounded-2xl text-white font-black hover:border-white/20 transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-end">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isPending}
                                        className="w-full h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.02]"
                                    >
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-zinc-950/60 border-white/5 overflow-hidden backdrop-blur-2xl">
                        <CardHeader className="bg-white/5 pb-4 border-b border-white/5">
                            <CardTitle className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
                                <Bell className="w-3 h-3 text-amber-400" /> Aperçu du Rappel Admin
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 border border-violet-400/30">
                                    <Trophy className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-bold text-white text-xs">SigilOS</span>
                                        <span className="bg-violet-500/20 text-violet-300 text-[8px] px-1 rounded font-black">BOT</span>
                                        <span className="text-[9px] text-zinc-600">{activeDayLabel} à {settings.reminderTime}</span>
                                    </div>

                                    <div className="bg-[#2b2d31] rounded-lg border-l-4 border-violet-500 p-4 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🗓️</span>
                                            <h4 className="font-black text-white text-[11px] uppercase italic tracking-tighter">Rappel <span className="text-violet-500">Guildaton</span> (Admins)</h4>
                                        </div>

                                        <p className="text-zinc-300 text-[10px] mb-4 leading-relaxed">
                                            C'est l'heure du scan hebdomadaire ! Pensez à lancer <span className="text-violet-400 font-bold">SigilOCR</span> pour récupérer les scores.
                                        </p>

                                        <div className="flex gap-4">
                                            <div className="bg-black/20 p-2 rounded-lg border border-white/5 flex-1">
                                                <div className="text-[#b5bac1] text-[8px] font-black uppercase tracking-[0.1em] mb-1">Dernier Scan</div>
                                                <div className="text-white text-[10px] font-bold italic">Il y a 6 jours</div>
                                            </div>
                                            <div className="bg-black/20 p-2 rounded-lg border border-white/5 flex-1">
                                                <div className="text-[#b5bac1] text-[8px] font-black uppercase tracking-[0.1em] mb-1">Logiciel</div>
                                                <div className="text-emerald-400 text-[10px] font-bold italic">v3.2 Stable</div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-[#3f4147] flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                    <ShieldCheck className="w-2 h-2 text-emerald-400" />
                                                </div>
                                                <span className="text-[#949ba4] text-[8px] font-bold">Channel Admin Uniquement</span>
                                            </div>
                                            <div className="p-1 bg-white/5 rounded cursor-pointer hover:bg-white/10 transition-colors">
                                                <Camera className="w-3 h-3 text-zinc-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-violet-500/5 border-violet-500/10">
                        <CardContent className="p-4 flex gap-4">
                            <div className="p-2 bg-violet-500/20 rounded-xl shrink-0 h-fit border border-violet-500/10">
                                <ShieldCheck className="w-4 h-4 text-violet-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-violet-200 leading-none">Confidentialité</h4>
                                <p className="text-[10px] text-violet-400/80 leading-relaxed font-medium">
                                    Ce salon est réservé aux administrateurs. Les membres ne verront pas cette notification de rappel de scan.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
