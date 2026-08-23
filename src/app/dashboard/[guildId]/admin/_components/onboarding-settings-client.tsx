"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ChannelPreview } from "@/components/shared/ChannelPreview";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
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

    // — Détection « modifications non sauvegardées »
    type OnboardingConfigSnapshot = {
        welcomeEnabled: boolean;
        welcomeChannelId: string;
        welcomeTemplate: string;
        welcomeDiscordTemplate: string;
        welcomeMentionRoleId: string;
        welcomeDashboardEnabled: boolean;
        welcomeDiscordEnabled: boolean;
        welcomeBadgeName: string;
    };
    const [initialConfig, setInitialConfig] = useState<OnboardingConfigSnapshot | null>(null);

    const currentConfig: OnboardingConfigSnapshot = useMemo(() => ({
        welcomeEnabled,
        welcomeChannelId,
        welcomeTemplate,
        welcomeDiscordTemplate,
        welcomeMentionRoleId,
        welcomeDashboardEnabled,
        welcomeDiscordEnabled,
        welcomeBadgeName,
    }), [
        welcomeEnabled, welcomeChannelId, welcomeTemplate, welcomeDiscordTemplate,
        welcomeMentionRoleId, welcomeDashboardEnabled, welcomeDiscordEnabled, welcomeBadgeName,
    ]);

    const hasUnsavedChanges = isDirty(currentConfig, initialConfig);

    useEffect(() => {
        const load = async () => {
            const res = await getOnboardingSettings(guildId);
            if (res.success && res.data) {
                const loaded: OnboardingConfigSnapshot = {
                    welcomeEnabled: res.data.enabled,
                    welcomeChannelId: res.data.channelId || "",
                    welcomeTemplate: res.data.template || "",
                    welcomeDiscordTemplate: res.data.discordTemplate || "",
                    welcomeMentionRoleId: res.data.mentionRoleId || "",
                    welcomeDashboardEnabled: res.data.dashboardEnabled,
                    welcomeDiscordEnabled: res.data.discordEnabled,
                    welcomeBadgeName: res.data.welcomeBadgeName || "Nouveau",
                };
                setWelcomeEnabled(loaded.welcomeEnabled);
                setWelcomeChannelId(loaded.welcomeChannelId);
                setWelcomeTemplate(loaded.welcomeTemplate);
                setWelcomeDiscordTemplate(loaded.welcomeDiscordTemplate);
                setWelcomeMentionRoleId(loaded.welcomeMentionRoleId);
                setWelcomeDashboardEnabled(loaded.welcomeDashboardEnabled);
                setWelcomeDiscordEnabled(loaded.welcomeDiscordEnabled);
                setWelcomeBadgeName(loaded.welcomeBadgeName);
                setInitialConfig(loaded);
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
            if (res.success) {
                setInitialConfig(currentConfig);
                toast.success("Paramètres d'accueil enregistrés");
            }
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
            if (res.success) {
                setInitialConfig(currentConfig);
                toast.success("Nom du badge mis à jour");
            }
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
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
            return <p className="text-muted-foreground italic text-sm">Le message apparaîtra ici...</p>;
        }

        const processed = content
            .replace(/{member}|{user}|{nickname}/g, isDiscord ? `**@${previewUser}**` : `**${previewUser}**`)
            .replace(/{guild}|{server}/g, `**${previewGuild}**`);

        return (
            <div className={cn(
                "prose prose-invert max-w-none text-foreground",
                isDiscord ? "font-sans leading-relaxed text-body-sm" : "font-sans leading-relaxed text-sm"
            )}>
                <ReactMarkdown>{processed}</ReactMarkdown>
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className="space-y-10 max-w-6xl pb-20">
                {/* --- HEADER --- */}
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        <UserPlus className="w-8 h-8 text-info" /> Centre d&apos;Accueil
                    </h2>
                    <p className="text-muted-foreground text-sm">Configurez l&apos;arrivée de vos nouveaux membres et l&apos;automatisation des messages.</p>
                </div>

                {/* --- AIDE AUX VARIABLES --- */}
                <Card className="p-6 bg-info/5 border-info/20 relative overflow-hidden ring-1 ring-ring/10">
                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-info" />
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Variables de personnalisation</h3>
                        </div>
                        
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                            Utilisez ces balises dans vos messages. Elles seront remplacées par les informations réelles du membre.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button 
                                onClick={() => { navigator.clipboard.writeText("{nickname}"); toast.success("Copié !"); }}
                                className="group flex items-center gap-4 p-4 rounded-2xl bg-background/60 border border-border hover:border-info/50 transition-all text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0 group- transition-transform">
                                    <Copy className="w-4 h-4 text-info" />
                                </div>
                                <div>
                                    <code className="text-lg font-bold text-info block">{`{nickname}`}</code>
                                    <p className="text-caption text-muted-foreground font-medium uppercase tracking-tight">Nom du membre</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => { navigator.clipboard.writeText("{server}"); toast.success("Copié !"); }}
                                className="group flex items-center gap-4 p-4 rounded-2xl bg-background/60 border border-border hover:border-info/50 transition-all text-left"
                            >
                                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0 group- transition-transform">
                                    <Copy className="w-4 h-4 text-info" />
                                </div>
                                <div>
                                    <code className="text-lg font-bold text-info block">{`{server}`}</code>
                                    <p className="text-caption text-muted-foreground font-medium uppercase tracking-tight">Nom de la guilde</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </Card>

                {/* --- BADGE SECTION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                    <Card className="lg:col-span-2 p-6 bg-surface/40 border-border flex flex-col justify-between gap-6 relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center border border-warning/20">
                                <Trophy className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Badge Temporaire Automatique</h4>
                                <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">Distinction visuelle sur SigilOS</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Nom du Badge (ex: Nouveau, Recrue, Test...)</label>
                                <div className="flex gap-4">
                                    <Input 
                                        value={welcomeBadgeName}
                                        onChange={(e) => setWelcomeBadgeName(e.target.value)}
                                        className="bg-muted/40 border-border h-12 text-foreground font-bold uppercase tracking-wider text-center rounded-xl focus:ring-warning/20 text-md"
                                    />
                                    <Button onClick={handleSaveBadge} disabled={saving} className="bg-warning hover:bg-warning text-warning-foreground font-bold h-12 px-6 rounded-xl uppercase tracking-wider text-xs transition-all active:scale-95">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appliquer"}
                                    </Button>
                                </div>
                            </div>

                            <div className="p-5 rounded-3xl bg-warning/5 border border-warning/10 flex items-start gap-4">
                                <HelpCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-caption text-foreground font-bold uppercase tracking-tight">À quoi ça sert ?</p>
                                    <p className="text-caption text-muted-foreground font-medium leading-relaxed uppercase tracking-tight opacity-80">
                                        Ce badge s&apos;affiche sur le profil SigilOS des membres à qui vous l&apos;attribuez manuellement (via l&apos;onglet Membres). Il disparaît automatiquement après la durée que vous aurez choisie. Très utile pour repérer les nouveaux sans toucher aux vrais rôles Discord.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-background/80 border-border flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-2xl rounded-3xl">
                        <div className="absolute top-3 right-4 text-caption font-bold text-foreground uppercase tracking-widest">Aperçu Profil</div>
                        <div className="relative">
                            <Avatar className="w-20 h-20 border-2 border-border ring-4 ring-warning/10">
                                <AvatarFallback className="bg-surface text-sm font-bold text-muted-foreground text-muted-foreground">USER</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-warning text-warning-foreground px-3 py-1 rounded-full text-caption font-bold uppercase tracking-wider shadow-lg border border-warning/20">
                                <ShieldCheck className="w-3 h-3 inline mr-1" /> {welcomeBadgeName}
                            </div>
                        </div>
                        <div className="text-center">
                             <p className="text-md font-bold text-foreground italic tracking-tight uppercase">Voyageur X</p>
                             <p className="text-caption text-muted-foreground font-bold uppercase tracking-wider">Membre</p>
                        </div>
                    </Card>
                </div>

                {/* --- MAIN MODULE BLOCK --- */}
                <Card className="p-6 bg-surface/40 border-border space-y-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center">
                                <Bell className="w-6 h-6 text-info" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground tracking-wide uppercase italic">Notifications d&apos;arrivée</h3>
                                <p className="text-caption text-muted-foreground font-medium uppercase tracking-[0.15em] opacity-80 flex items-center gap-2">
                                    Automatisation Dashboard + Discord
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-2 pl-4 rounded-xl border border-border bg-black/40">
                             <span className={cn("text-caption font-bold uppercase tracking-wider transition-colors", welcomeEnabled ? "text-green-500" : "text-muted-foreground")}>{welcomeEnabled ? "Actif" : "Inactif"}</span>
                            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} className="data-[state=checked]:bg-green-500" />
                        </div>
                    </div>

                    <div className={cn("space-y-10 transition-all duration-300", !welcomeEnabled && "opacity-30 pointer-events-none grayscale blur-sm")}>
                        <Tabs defaultValue="dashboard" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-border p-1 rounded-2xl h-14">
                                <TabsTrigger value="dashboard" className="data-[state=active]:bg-info data-[state=active]:text-info-foreground font-bold text-xs uppercase tracking-wider gap-2 rounded-xl transition-all">
                                    <LayoutDashboard className="w-4 h-4" /> Mur Social SigilOS
                                </TabsTrigger>
                                <TabsTrigger value="discord" className="data-[state=active]:bg-info data-[state=active]:text-info-foreground font-bold text-xs uppercase tracking-wider gap-2 rounded-xl transition-all">
                                    <Bell className="w-4 h-4" /> Alerte Discord
                                </TabsTrigger>
                            </TabsList>

                             {/* --- TAB DASHBOARD --- */}
                             <TabsContent value="dashboard" className="mt-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-surface rounded-3xl border border-border gap-6">
                                    <div className="flex items-center gap-4 text-left mr-auto">
                                        <Switch checked={welcomeDashboardEnabled} onCheckedChange={setWelcomeDashboardEnabled} className="data-[state=checked]:bg-info mr-2" />
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-wider text-foreground">Activer sur le Dashboard</p>
                                            <p className="text-caption text-muted-foreground font-medium uppercase tracking-tight">Le message sera visible dans l&apos;onglet &quot;Bienvenue&quot;.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => insertVariable("{nickname}", "dash")} className="h-10 px-4 rounded-xl border-border bg-surface shadow-xl hover:bg-info/10 hover:border-info/40 text-caption font-bold uppercase tracking-wider text-info">
                                            + {`nickname`}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => insertVariable("{server}", "dash")} className="h-10 px-4 rounded-xl border-border bg-surface shadow-xl hover:bg-info/10 hover:border-info/40 text-caption font-bold uppercase tracking-wider text-info">
                                            + {`server`}
                                        </Button>
                                    </div>
                                </div>
                                
                                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                    <div className="lg:col-span-3 space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                            <MessageSquareText className="w-4 h-4 text-info" />
                                            <h4 className="text-caption font-bold uppercase tracking-widest text-info">Modèle du message</h4>
                                        </div>
                                        <Textarea
                                            value={welcomeTemplate}
                                            onChange={(e) => setWelcomeTemplate(e.target.value)}
                                            placeholder="Tapez le message ici..."
                                            className="min-h-[220px] bg-black/40 border-border font-sans text-md rounded-2xl p-6 resize-none focus:ring-ring/10"
                                        />
                                    </div>
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                            <h4 className="text-caption font-bold uppercase tracking-widest text-muted-foreground">Aperçu Dashboard</h4>
                                        </div>
                                        <div className="bg-background/90 border border-border rounded-3xl p-8 min-h-[220px] h-full shadow-inner relative flex flex-col justify-center">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 rounded-full bg-info/10 shrink-0 border border-info/20" />
                                                <div className="flex-1 space-y-3">
                                                    <div className="h-3 w-1/2 bg-surface rounded-full" />
                                                    <div className="p-5 rounded-2xl bg-surface border border-border backdrop-blur-xl">
                                                        {renderPreview(welcomeTemplate, false)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                             {/* --- TAB DISCORD --- */}
                             <TabsContent value="discord" className="mt-8 space-y-8 animate-in fade-in zoom-in-95 duration-300 text-left">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-info/5 rounded-3xl border border-info/20">
                                    <div className="flex items-center gap-4">
                                        <Switch checked={welcomeDiscordEnabled} onCheckedChange={setWelcomeDiscordEnabled} className="data-[state=checked]:bg-info" />
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-wider text-foreground">Activer l&apos;Alerte Discord</p>
                                            <p className="text-caption text-muted-foreground font-medium uppercase tracking-tight">Utilise le format Embed Premium automatiquement.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 md:justify-end md:border-l border-border md:pl-8">
                                        <div className="flex flex-col items-end">
                                            <span className="text-caption font-bold uppercase tracking-wider text-info mb-2">Pinger un rôle ?</span>
                                            <RoleSelector
                                                value={welcomeMentionRoleId || null}
                                                onChange={(val) => setWelcomeMentionRoleId(val || "")}
                                                roles={availableRoles}
                                            />
                                        </div>
                                    </div>
                                </div>

                                 <div className="space-y-3 max-w-xl">
                                    <label className="text-caption font-bold uppercase tracking-[0.2em] text-info flex items-center gap-2 ml-2">
                                         ID SALON DISCORD
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-surface border-border-strong p-4 max-w-sm rounded-xl">
                                                <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                                                    <Info className="w-3 h-3 text-info" /> Tuto Rapide
                                                </p>
                                                <ol className="text-caption text-muted-foreground space-y-1 list-decimal ml-4">
                                                    <li>Active le <strong>Mode Développeur</strong> dans Discord.</li>
                                                    <li>Fais un <strong>clic droit</strong> sur le salon.</li>
                                                    <li>Clique sur <strong>Copier l&apos;identifiant</strong> et colle le ici.</li>
                                                </ol>
                                            </TooltipContent>
                                        </Tooltip>
                                    </label>
                                    <Input
                                        value={welcomeChannelId}
                                        onChange={(e) => setWelcomeChannelId(e.target.value)}
                                        placeholder="Ex: 1234..."
                                        className="bg-black/40 border-border h-12 font-mono text-md rounded-xl focus:ring-ring/20 px-6"
                                    />
                                    <ChannelPreview guildId={guildId} channelId={welcomeChannelId} color="indigo" />
                                </div>

                                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 pt-4">
                                    <div className="lg:col-span-3 space-y-4">
                                        <div className="flex justify-between items-center px-2">
                                             <label className="text-caption font-bold uppercase tracking-widest text-info flex items-center gap-2">
                                                <MessageSquareText className="w-4 h-4" /> Message Alerte
                                             </label>
                                             <div className="flex gap-2">
                                                <button onClick={() => insertVariable("{nickname}", "discord")} className="text-caption font-bold bg-elevated hover:bg-muted px-3 py-1.5 rounded-xl border border-border transition-all shadow-lg active:scale-95">+ {`nickname`}</button>
                                                <button onClick={() => insertVariable("{server}", "discord")} className="text-caption font-bold bg-elevated hover:bg-muted px-3 py-1.5 rounded-xl border border-border transition-all shadow-lg active:scale-95">+ {`server`}</button>
                                             </div>
                                        </div>
                                        <Textarea
                                            value={welcomeDiscordTemplate}
                                            onChange={(e) => setWelcomeDiscordTemplate(e.target.value)}
                                            placeholder="Tapez le message ici..."
                                            className="min-h-[200px] bg-black/40 border-border font-sans text-md rounded-2xl p-6 resize-none focus:ring-ring/10"
                                        />
                                        <div className="p-4 rounded-xl bg-info/5 border border-info/10 flex items-start gap-4">
                                            <Sparkles className="w-5 h-5 text-info shrink-0 mt-0.5" />
                                            <p className="text-caption text-muted-foreground leading-relaxed font-bold uppercase tracking-tight italic">
                                                Le texte sera intégré dans un **Rich-Embed Premium** automatique (Avatar, Logo, Bannière...).
                                            </p>
                                        </div>
                                    </div>
                                    
                                     <div className="lg:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                            <h4 className="text-caption font-bold uppercase tracking-widest text-muted-foreground">Rendu Discord</h4>
                                        </div>
                                        <div className="bg-[#2b2d31] rounded-3xl p-8 border-l-[6px] border-warning shadow-3xl relative min-h-[300px] flex flex-col h-full group/discord">
                                            <div className="flex items-center gap-4 mb-6">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-info to-info flex items-center justify-center border border-border">
                                                    <Sparkles className="w-5 h-5 text-foreground" />
                                                </div>
                                                <span className="font-bold text-foreground text-sm tracking-tight uppercase italic group-hover/discord:text-warning transition-colors">NOUVELLE ARRIVÉE !</span>
                                            </div>
                                            <div className="text-foreground text-sm leading-relaxed flex-1 px-1 mb-8">
                                                {renderPreview(welcomeDiscordTemplate || welcomeTemplate, true)}
                                            </div>
                                            <div className="mt-auto pt-4 border-t border-border opacity-40 flex justify-between items-center">
                                                <span className="text-caption font-bold uppercase tracking-widest text-muted-foreground italic">Authored by SigilOS Orchestrator</span>
                                                <MessageSquareText className="w-3 h-3 text-foreground" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                     <div className="flex justify-end pt-8 border-t border-border">
                        <Button
                            onClick={handleSaveWelcome}
                            disabled={saving}
                            className="bg-info hover:bg-info text-info-foreground font-bold h-14 px-10 rounded-xl gap-3 shadow-lg transition-all active:scale-95 flex items-center group/save"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover/save:rotate-12 transition-transform" />}
                             <span className="text-md uppercase tracking-tight">Enregistrer la configuration</span>
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Garde anti-navigation : avertit si des paramètres d'accueil ne sont pas sauvegardés */}
            <UnsavedChangesGuard
                hasUnsavedChanges={hasUnsavedChanges}
                message="Vous avez des modifications des paramètres d'accueil non sauvegardées. Quitter cette page les perdra définitivement."
            />
        </TooltipProvider>
    );
}
