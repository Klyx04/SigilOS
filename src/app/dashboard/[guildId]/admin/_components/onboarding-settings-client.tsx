"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Sparkles,
    Bell,
    Save,
    Loader2,
    Info,
    LayoutDashboard,
    Eye,
    ShieldCheck,
    MessageSquareText,
    HelpCircle,
    Copy,
    ChevronRight,
    Trophy,
    UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
    getOnboardingSettings,
    updateWelcomeSettings,
    updateWelcomeBadgeName
} from "@/server/actions/onboarding-admin-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RoleSelector } from "@/components/admin/role-selector";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface OnboardingSettingsClientProps {
    guildId: string;
}

export function OnboardingSettingsClient({ guildId }: OnboardingSettingsClientProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const switchTabParam = (tabId: string) => {
        router.push(`/dashboard/${guildId}/admin/settings?tab=${tabId}`);
    };

    const [welcomeEnabled, setWelcomeEnabled] = useState(false);
    const [welcomeChannelId, setWelcomeChannelId] = useState<string>("");
    const [welcomeTemplate, setWelcomeTemplate] = useState<string>("");
    const [welcomeDiscordTemplate, setWelcomeDiscordTemplate] = useState<string>("");
    const [welcomeMentionRoleId, setWelcomeMentionRoleId] = useState<string>("");
    const [welcomeDashboardEnabled, setWelcomeDashboardEnabled] = useState(true);
    const [welcomeDiscordEnabled, setWelcomeDiscordEnabled] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);

    const [welcomeBadgeName, setWelcomeBadgeName] = useState("Nouveau");

    useEffect(() => {
        const load = async () => {
            const res = await getOnboardingSettings(guildId);
            if (res.success && res.data) {
                setWelcomeEnabled(res.data.enabled);
                setWelcomeChannelId(res.data.channelId || "");
                setWelcomeTemplate(res.data.template || "");
                setWelcomeDiscordTemplate(res.data.discordTemplate || "");
                setWelcomeMentionRoleId(res.data.mentionRoleId || "");
                setWelcomeDashboardEnabled(res.data.dashboardEnabled);
                setWelcomeDiscordEnabled(res.data.discordEnabled);
                setWelcomeBadgeName(res.data.welcomeBadgeName || "Nouveau");
                if (res.data.availableRoles) setAvailableRoles(res.data.availableRoles);
            }
            setLoading(false);
        };
        load();
    }, [guildId]);

    const handleSaveWelcome = async () => {
        setSaving(true);
        try {
            const res = await updateWelcomeSettings({
                guildId,
                enabled: welcomeEnabled,
                channelId: welcomeChannelId || null,
                template: welcomeTemplate || null,
                discordTemplate: welcomeDiscordTemplate || null,
                mentionRoleId: welcomeMentionRoleId || null,
                dashboardEnabled: welcomeDashboardEnabled,
                discordEnabled: welcomeDiscordEnabled,
            });
            if (res.success) toast.success("Paramètres d'accueil enregistrés");
            else toast.error(res.error || "Erreur");
        } catch (e) {
            toast.error("Erreur de communication");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBadge = async () => {
        setSaving(true);
        try {
            const res = await updateWelcomeBadgeName({
                guildId,
                badgeName: welcomeBadgeName,
            });
            if (res.success) toast.success("Nom du badge mis à jour");
            else toast.error(res.error || "Erreur");
        } catch (e) {
            toast.error("Erreur de communication");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
        );
    }

    const previewUser = "Voyageur";
    const previewGuild = "SigilOS";

    const insertVariable = (variable: string, target: 'dash' | 'discord') => {
        if (target === 'dash') {
            setWelcomeTemplate(prev => prev + variable);
        } else {
            setWelcomeDiscordTemplate(prev => prev + variable);
        }
        toast.info(`Variable ${variable} ajoutée !`);
    };

    const renderPreview = (content: string, isDiscord: boolean) => {
        if (!content || !content.trim()) {
            return <p className="text-zinc-600 italic text-sm">Le message apparaîtra ici...</p>;
        }

        const processed = content
            .replace(/{member}|{user}|{nickname}/g, isDiscord ? `**@${previewUser}**` : `**${previewUser}**`)
            .replace(/{guild}|{server}/g, `**${previewGuild}**`);

        return (
            <div className={cn(
                "prose prose-invert max-w-none text-zinc-300",
                isDiscord ? "font-sans leading-relaxed text-[13px]" : "font-sans leading-relaxed text-sm"
            )}>
                <ReactMarkdown>{processed}</ReactMarkdown>
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className="space-y-10 max-w-6xl pb-20">
                {/* --- HEADER --- */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase flex items-center gap-4">
                        <UserPlus className="w-10 h-10 text-indigo-500" /> Centre d&apos;Accueil
                    </h2>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Configurez l&apos;arrivée de vos nouveaux membres en quelques clics.</p>
                </div>

                {/* --- AIDE AUX VARIABLES - ENORME --- */}
                <Card className="p-8 bg-indigo-500/10 border-indigo-500/30 relative overflow-hidden shadow-[0_20px_50px_rgba(79,70,229,0.15)]">
                    <div className="absolute -top-10 -right-10 opacity-5">
                        <HelpCircle className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="space-y-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                                <Info className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Les &quot;Mots Magiques&quot; (Variables)</h3>
                        </div>
                        
                        <p className="text-sm text-zinc-400 font-bold leading-relaxed max-w-3xl">
                            Écrivez ces mots exactement comme ça dans vos textes. SigilOS les remplacera automatiquement par les vraies infos.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button 
                                onClick={() => { navigator.clipboard.writeText("{nickname}"); toast.success("Copié !"); }}
                                className="group flex items-center gap-6 p-6 rounded-[2rem] bg-black/60 border border-white/5 hover:border-indigo-500/50 transition-all text-left shadow-2xl"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Copy className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <code className="text-xl font-black text-indigo-400 mb-1 block">{`{nickname}`}</code>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Insère le nom du membre</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => { navigator.clipboard.writeText("{server}"); toast.success("Copié !"); }}
                                className="group flex items-center gap-6 p-6 rounded-[2rem] bg-black/60 border border-white/5 hover:border-indigo-500/50 transition-all text-left shadow-2xl"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Copy className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <code className="text-xl font-black text-indigo-400 mb-1 block">{`{server}`}</code>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">Insère le nom de la guilde</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </Card>

                {/* --- BADGE SECTION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                    <Card className="lg:col-span-2 p-8 bg-zinc-900/40 border-white/5 flex flex-col justify-between gap-8 relative overflow-hidden group shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <Trophy className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-md font-black text-white uppercase tracking-widest">Badge Temporaire Automatique</h4>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Distinction visuelle sur SigilOS</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Nom du Badge (ex: Nouveau, Recrue, Test...)</label>
                                <div className="flex gap-4">
                                    <Input 
                                        value={welcomeBadgeName}
                                        onChange={(e) => setWelcomeBadgeName(e.target.value)}
                                        className="bg-black/40 border-white/10 h-14 text-white font-black uppercase tracking-widest text-center rounded-2xl focus:ring-amber-500/20 text-lg shadow-inner"
                                    />
                                    <Button onClick={handleSaveBadge} disabled={saving} className="bg-amber-600 hover:bg-amber-500 text-white font-black h-14 px-8 rounded-2xl uppercase tracking-widest text-xs shadow-lg transition-all hover:scale-105">
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Appliquer"}
                                    </Button>
                                </div>
                            </div>

                            <div className="p-5 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
                                <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[11px] text-zinc-300 font-bold uppercase tracking-tight">À quoi ça sert ?</p>
                                    <p className="text-[10px] text-zinc-500 font-medium leading-relaxed uppercase tracking-tight opacity-80">
                                        Ce badge s&apos;affiche sur le profil SigilOS des membres à qui vous l&apos;attribuez manuellement (via l&apos;onglet Membres). Il disparaît automatiquement après la durée que vous aurez choisie. Très utile pour repérer les nouveaux sans toucher aux vrais rôles Discord.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 bg-zinc-950/80 border-white/10 flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl rounded-[3rem]">
                        <div className="absolute top-4 right-6 text-[8px] font-black text-zinc-800 uppercase tracking-widest">Aperçu Profil</div>
                        <div className="relative">
                            <Avatar className="w-24 h-24 border-4 border-white/5 ring-4 ring-amber-500/20 shadow-2xl">
                                <AvatarFallback className="bg-zinc-900 text-xl font-black text-zinc-700">USER</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-amber-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-amber-400/20 animate-bounce">
                                <ShieldCheck className="w-3 h-3 inline mr-1" /> {welcomeBadgeName}
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                             <p className="text-lg font-black text-white italic tracking-tighter uppercase">Voyageur X</p>
                             <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Membre de la guilde</p>
                        </div>
                    </Card>
                </div>

                {/* --- MAIN MODULE BLOCK --- */}
                <Card className="p-8 bg-zinc-900/40 border-white/5 space-y-10 relative overflow-hidden shadow-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-8 border-b border-white/5">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                                <Bell className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white tracking-widest uppercase italic">Notifications d&apos;arrivée</h3>
                                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                                    Automatisation Dashboard + Discord
                                    <ChevronRight className="w-3 h-3" />
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-black/60 p-4 rounded-3xl border border-white/5 shadow-2xl">
                            <div className="flex flex-col items-end pr-2 border-r border-white/10 mr-2">
                                <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", welcomeEnabled ? "text-green-500" : "text-zinc-600")}>Statut</span>
                                <span className="text-xs font-bold text-white uppercase tracking-tighter">{welcomeEnabled ? "Système ON" : "Système OFF"}</span>
                            </div>
                            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} className="data-[state=checked]:bg-green-500 scale-125" />
                        </div>
                    </div>

                    <div className={cn("space-y-12 transition-all duration-1000", !welcomeEnabled && "opacity-30 pointer-events-none grayscale blur-sm")}>
                        <Tabs defaultValue="dashboard" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/5 p-2 rounded-[2.5rem] h-20">
                                <TabsTrigger value="dashboard" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-black text-sm uppercase tracking-widest gap-4 rounded-[1.8rem] transition-all shadow-2xl">
                                    <LayoutDashboard className="w-5 h-5" /> Mur Social SigilOS
                                </TabsTrigger>
                                <TabsTrigger value="discord" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-black text-sm uppercase tracking-widest gap-4 rounded-[1.8rem] transition-all shadow-2xl">
                                    <Bell className="w-5 h-5" /> Alerte Embed Discord
                                </TabsTrigger>
                            </TabsList>

                            {/* --- TAB DASHBOARD --- */}
                            <TabsContent value="dashboard" className="mt-12 space-y-10 animate-in fade-in zoom-in-95 duration-500">
                                <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white/5 rounded-[2.5rem] border border-white/5 gap-6">
                                    <div className="flex items-center gap-5">
                                        <Switch checked={welcomeDashboardEnabled} onCheckedChange={setWelcomeDashboardEnabled} className="data-[state=checked]:bg-indigo-500 scale-110" />
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-white">Activer le message sur le Dashboard</p>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Le message sera visible par tous les membres dans l&apos;onglet &quot;Bienvenue&quot;.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <Button variant="outline" size="lg" onClick={() => insertVariable("{nickname}", "dash")} className="h-12 px-6 rounded-2xl border-white/10 bg-zinc-900 shadow-xl hover:bg-indigo-500/20 hover:border-indigo-500/40 text-[11px] font-black uppercase tracking-widest text-indigo-400">
                                            + {`nickname`}
                                        </Button>
                                        <Button variant="outline" size="lg" onClick={() => insertVariable("{server}", "dash")} className="h-12 px-6 rounded-2xl border-white/10 bg-zinc-900 shadow-xl hover:bg-indigo-500/20 hover:border-indigo-500/40 text-[11px] font-black uppercase tracking-widest text-indigo-400">
                                            + {`server`}
                                        </Button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                                    <div className="lg:col-span-3 space-y-6">
                                        <div className="flex items-center gap-3 ml-2">
                                            <MessageSquareText className="w-5 h-5 text-indigo-400" />
                                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">Texte du message de bienvenue</h4>
                                        </div>
                                        <Textarea
                                            value={welcomeTemplate}
                                            onChange={(e) => setWelcomeTemplate(e.target.value)}
                                            placeholder="Tapez le message ici... (ex: Bienvenue {nickname} sur le serveur {server} !)"
                                            className="min-h-[220px] bg-black/40 border-white/10 font-sans text-lg rounded-[2rem] p-8 shadow-inner resize-none focus:ring-indigo-500/20"
                                        />
                                    </div>
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="flex items-center gap-3 ml-2">
                                            <Eye className="w-5 h-5 text-zinc-500" />
                                            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Aperçu au déploiement</h4>
                                        </div>
                                        <div className="bg-zinc-950/90 border border-white/10 rounded-[3rem] p-10 min-h-[220px] h-full shadow-inner group/dash relative flex flex-col justify-center">
                                            <div className="absolute top-4 right-8 text-[8px] font-black text-zinc-800 uppercase tracking-widest group-hover/dash:text-indigo-500/40 transition-colors">SIGILOS_FEED_PREVIEW</div>
                                            <div className="flex gap-6">
                                                <div className="w-14 h-14 rounded-full bg-indigo-500/20 shrink-0 shadow-lg ring-4 ring-indigo-500/5" />
                                                <div className="flex-1 space-y-4">
                                                    <div className="h-4 w-40 bg-zinc-900 rounded-full" />
                                                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 shadow-2xl backdrop-blur-xl">
                                                        {renderPreview(welcomeTemplate, false)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* --- TAB DISCORD --- */}
                            <TabsContent value="discord" className="mt-12 space-y-10 animate-in fade-in zoom-in-95 duration-500 text-left">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-indigo-600/10 rounded-[2.5rem] border border-indigo-600/20 shadow-xl">
                                    <div className="flex items-center gap-6">
                                        <Switch checked={welcomeDiscordEnabled} onCheckedChange={setWelcomeDiscordEnabled} className="data-[state=checked]:bg-indigo-500 scale-125" />
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest text-white">Activer l&apos;Alerte Discord</p>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Utilise le format Embed Premium automatiquement.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 md:justify-end border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-10">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Pinger un rôle Discord ?</span>
                                            <RoleSelector
                                                value={welcomeMentionRoleId || null}
                                                onChange={(val) => setWelcomeMentionRoleId(val || "")}
                                                roles={availableRoles}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 max-w-2xl">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-3 ml-2">
                                         ID DU SALON DISCORD D&apos;ACCUEIL
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="w-4 h-4 text-zinc-600 hover:text-white cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-zinc-900 border-white/20 p-5 max-w-sm rounded-2xl shadow-3xl">
                                                <p className="text-sm font-black text-white mb-3 flex items-center gap-2">
                                                    <Info className="w-4 h-4 text-indigo-400" /> Tuto Rapide
                                                </p>
                                                <ol className="text-xs text-zinc-400 space-y-2 list-decimal ml-5">
                                                    <li>Active le <strong>Mode Développeur</strong> dans Discord (Réglages {'>'} Apparence).</li>
                                                    <li>Fais un <strong>clic droit</strong> sur le salon où tu veux l&apos;alerte.</li>
                                                    <li>Clique sur <strong>Copier l&apos;identifiant</strong> et colle le ici.</li>
                                                </ol>
                                            </TooltipContent>
                                        </Tooltip>
                                    </label>
                                    <Input
                                        value={welcomeChannelId}
                                        onChange={(e) => setWelcomeChannelId(e.target.value)}
                                        placeholder="Ex: 1234567890..."
                                        className="bg-black/40 border-white/10 h-16 font-mono text-lg rounded-3xl focus:ring-indigo-500/20 shadow-inner px-8"
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 pt-6">
                                    <div className="lg:col-span-3 space-y-6">
                                        <div className="flex justify-between items-center px-2">
                                             <label className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-3">
                                                <MessageSquareText className="w-5 h-5" /> Message de l&apos;Alerte
                                             </label>
                                             <div className="flex gap-3">
                                                <button onClick={() => insertVariable("{nickname}", "discord")} className="text-[10px] font-black bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-2xl border border-white/5 transition-all active:scale-95 shadow-lg">+ {`nickname`}</button>
                                                <button onClick={() => insertVariable("{server}", "discord")} className="text-[10px] font-black bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-2xl border border-white/5 transition-all active:scale-95 shadow-lg">+ {`server`}</button>
                                             </div>
                                        </div>
                                        <Textarea
                                            value={welcomeDiscordTemplate}
                                            onChange={(e) => setWelcomeDiscordTemplate(e.target.value)}
                                            placeholder="Tapez le message ici..."
                                            className="min-h-[200px] bg-black/40 border-white/10 font-sans text-lg rounded-[2.5rem] p-10 shadow-inner resize-none focus:ring-indigo-500/20"
                                        />
                                        <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-5 shadow-inner">
                                            <Sparkles className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                                            <p className="text-[11px] text-zinc-500 leading-relaxed font-bold uppercase tracking-wide italic opacity-80">
                                                Votre texte sera inséré dans un **Rich-Embed Premium** pré-formaté par SigilOS (Titre coloré, Logo de guilde, Bannière...). Inutile de s&apos;embêter avec le formatage.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="flex items-center gap-3 ml-2">
                                            <Eye className="w-5 h-5 text-zinc-500" />
                                            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Rendu sur Discord</h4>
                                        </div>
                                        <div className="bg-[#2b2d31] rounded-[2.5rem] p-10 border-l-[8px] border-amber-500 shadow-3xl relative min-h-[300px] flex flex-col h-full group/discord">
                                            <div className="flex items-center gap-5 mb-8">
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center border border-white/10 shadow-xl group-hover/discord:rotate-12 transition-all">
                                                    <Sparkles className="w-7 h-7 text-white" />
                                                </div>
                                                <span className="font-black text-white text-md tracking-tighter uppercase italic group-hover/discord:text-amber-400 transition-colors">NOUVELLE ARRIVÉE !</span>
                                            </div>
                                            <div className="text-zinc-200 text-md leading-relaxed flex-1 px-2 mb-10">
                                                {renderPreview(welcomeDiscordTemplate || welcomeTemplate, true)}
                                            </div>
                                            <div className="mt-auto pt-6 border-t border-white/5 opacity-50 flex justify-between items-center group-hover/discord:opacity-90 transition-opacity">
                                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 italic">Authored by SigilOS Orchestrator</span>
                                                <MessageSquareText className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="flex justify-end pt-12 border-t border-white/5">
                        <Button
                            onClick={handleSaveWelcome}
                            disabled={saving}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black h-16 px-14 rounded-2xl gap-4 shadow-[0_15px_45px_rgba(79,70,229,0.35)] transition-all hover:scale-105 active:scale-95 flex items-center group/save"
                        >
                            {saving ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7 group-hover/save:rotate-12 transition-transform" />}
                             <span className="text-lg uppercase tracking-tighter">Enregistrer la configuration</span>
                        </Button>
                    </div>
                </Card>
            </div>
        </TooltipProvider>
    );
}
