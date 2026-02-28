"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Sparkles,
    MessageSquare,
    Bell,
    Save,
    Loader2,
    Settings2,
    Info,
    Send,
    ShieldAlert,
    ShieldCheck,
    UserCircle,
    LayoutDashboard,
    CheckCircle2,
    HelpCircle,
    Eye,
    Type,
    Code
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AdvancedEditor } from "@/components/editor/advanced-editor";
import { RoleSelector } from "@/components/admin/role-selector";

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
            if (res.success) toast.success("Paramètres de bienvenue mis à jour");
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

    const renderPreview = (content: string, isDiscord: boolean) => {
        if (!content || !content.trim() || content === "<p></p>") {
            return <p className="text-zinc-600 italic text-xs">Le message est vide...</p>;
        }

        // Simple HTML to Markdown conversion for preview purposes
        let processed = content
            .replace(/<p>/g, "")
            .replace(/<\/p>/g, "\n")
            .replace(/<strong>/g, "**")
            .replace(/<\/strong>/g, "**")
            .replace(/<em>/g, "_")
            .replace(/<\/em>/g, "_")
            .replace(/<br\s*\/?>/g, "\n")
            .replace(/<[^>]*>?/gm, "") // Strip any other tags
            .replace(/{member}/g, isDiscord ? `**@${previewUser}**` : `**${previewUser}**`)
            .replace(/{user}/g, isDiscord ? `**@${previewUser}**` : `**${previewUser}**`)
            .replace(/{guild}/g, `**${previewGuild}**`);

        return (
            <div className={cn(
                "prose prose-invert prose-sm max-w-none text-zinc-300",
                isDiscord ? "font-sans leading-relaxed" : "font-sans leading-relaxed text-sm"
            )}>
                <ReactMarkdown>{processed}</ReactMarkdown>
            </div>
        );
    };

    const renderDiscordPreview = (content: string) => {
        if (!content || !content.trim()) {
            return <p className="text-zinc-600 italic text-xs">Le message Discord est vide...</p>;
        }

        let processed = content
            .replace(/{member}/g, `**@${previewUser}**`)
            .replace(/{user}/g, `**@${previewUser}**`)
            .replace(/{guild}/g, `**${previewGuild}**`);

        return (
            <div className="prose prose-invert prose-sm max-w-none text-zinc-300 font-sans leading-relaxed">
                <ReactMarkdown>{processed}</ReactMarkdown>
            </div>
        );
    };

    return (
        <div className="space-y-8 max-w-6xl">
            {/* --- SECTION ACCUEIL --- */}
            <Card className="p-8 bg-zinc-900/40 border-white/5 space-y-8 relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner">
                            <Sparkles className="w-7 h-7 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-widest uppercase italic">Orchestration d&apos;Accueil</h3>
                            <p className="text-sm text-zinc-500 font-medium tracking-tight">Automatisez les présentations de vos nouveaux arrivants avec style.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-2xl border border-white/5 self-start md:self-auto">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-2">Focus Automatique</span>
                        <div className="flex items-center gap-3 bg-zinc-900/50 p-1.5 rounded-xl border border-white/5">
                            <span className={cn("text-[10px] font-bold uppercase tracking-widest", welcomeEnabled ? "text-amber-500" : "text-zinc-600")}>
                                {welcomeEnabled ? "Actif" : "Veille"}
                            </span>
                            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
                        </div>
                    </div>
                </div>

                <div className={cn("space-y-8 transition-all duration-500", !welcomeEnabled && "opacity-40 pointer-events-none grayscale blur-[1px]")}>
                    {/* Canals Toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={cn(
                            "p-5 rounded-3xl border transition-all cursor-pointer group/card self-stretch flex flex-col justify-between",
                            welcomeDashboardEnabled ? "bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "bg-black/20 border-white/5 opacity-50"
                        )} onClick={() => setWelcomeDashboardEnabled(!welcomeDashboardEnabled)}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", welcomeDashboardEnabled ? "bg-amber-500/20" : "bg-zinc-800")}>
                                        <LayoutDashboard className={cn("w-4 h-4", welcomeDashboardEnabled ? "text-amber-500" : "text-zinc-500")} />
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-wider">Dashboard SigilOS</span>
                                </div>
                                <Switch checked={welcomeDashboardEnabled} onCheckedChange={setWelcomeDashboardEnabled} onClick={(e) => e.stopPropagation()} className="data-[state=checked]:bg-amber-500" />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight opacity-70">Publication dans le flux Social</p>
                        </div>

                        <div className={cn(
                            "p-5 rounded-3xl border transition-all cursor-pointer group/card self-stretch flex flex-col justify-between",
                            welcomeDiscordEnabled ? "bg-indigo-500/5 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.05)]" : "bg-black/20 border-white/5 opacity-50"
                        )} onClick={() => setWelcomeDiscordEnabled(!welcomeDiscordEnabled)}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", welcomeDiscordEnabled ? "bg-indigo-500/20" : "bg-zinc-800")}>
                                        <Bell className={cn("w-4 h-4", welcomeDiscordEnabled ? "text-indigo-400" : "text-zinc-500")} />
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-wider">Alerte Discord</span>
                                </div>
                                <Switch checked={welcomeDiscordEnabled} onCheckedChange={setWelcomeDiscordEnabled} onClick={(e) => e.stopPropagation()} />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight opacity-70">Alerte rich-embed dans un salon dédié</p>
                        </div>
                    </div>

                    <Tabs defaultValue="dashboard" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/5 p-1.5 rounded-2xl h-14">
                            <TabsTrigger value="dashboard" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 font-black text-[10px] uppercase tracking-[0.2em] gap-2 rounded-xl transition-all">
                                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard Engine
                            </TabsTrigger>
                            <TabsTrigger value="discord" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em] gap-2 rounded-xl transition-all">
                                <Bell className="w-3.5 h-3.5" /> Discord Orchestrator
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard" className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-1">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                <div className="lg:col-span-3 space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2">
                                            <Type className="w-3 h-3" /> Contenu du Message
                                        </label>
                                        <div className="flex gap-3">
                                            <button onClick={() => setWelcomeTemplate(prev => prev + " {member} ")} className="text-[10px] font-black text-zinc-600 hover:text-amber-500 transition-colors uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded border border-white/5">+{`member`}</button>
                                            <button onClick={() => setWelcomeTemplate(prev => prev + " {guild} ")} className="text-[10px] font-black text-zinc-600 hover:text-amber-500 transition-colors uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded border border-white/5">+{`guild`}</button>
                                        </div>
                                    </div>
                                    <div className="min-h-[220px]">
                                        <AdvancedEditor
                                            initialContent={welcomeTemplate}
                                            onChange={setWelcomeTemplate}
                                            contentClassName="min-h-[180px] text-sm"
                                        />
                                    </div>
                                    <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                            <Info className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[11px] text-white font-black uppercase tracking-widest">Guide des Balises</p>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold italic">
                                                Les tags <code className="text-amber-500 font-mono tracking-tighter">{`{member}`}</code> et <code className="text-amber-500 font-mono tracking-tighter">{`{guild}`}</code> injecteront dynamiquement le profil et le nom de votre serveur.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-2 space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2 px-2">
                                        <Eye className="w-3.5 h-3.5" /> Dashboard Render
                                    </label>
                                    <div className="bg-zinc-950/80 border border-white/5 rounded-[2rem] p-8 min-h-[220px] flex items-start justify-center relative overflow-hidden group/preview shadow-inner h-full">
                                        <div className="absolute top-4 right-6 text-[9px] font-black text-zinc-800 uppercase tracking-widest">Twin_Render_V3</div>
                                        <div className="flex gap-5 w-full">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-transparent border border-amber-500/10 animate-pulse shrink-0" />
                                            <div className="space-y-4 flex-1">
                                                <div className="h-4 w-32 bg-zinc-900 rounded-lg overflow-hidden relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent animate-shimmer" />
                                                </div>
                                                <div className="p-6 rounded-[1.5rem] bg-white/5 border border-white/5 shadow-2xl backdrop-blur-sm">
                                                    {renderPreview(welcomeTemplate, false)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="discord" className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-1">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                <div className="lg:col-span-3 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
                                                <Bell className="w-3 h-3" /> Target Channel ID
                                            </label>
                                            <Input
                                                value={welcomeChannelId}
                                                onChange={(e) => setWelcomeChannelId(e.target.value)}
                                                placeholder="ID du salon Discord..."
                                                className="bg-black/40 border-white/10 h-12 font-mono text-xs rounded-xl focus:ring-indigo-500/20 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3" /> Notification Mention
                                            </label>
                                            <RoleSelector
                                                value={welcomeMentionRoleId || null}
                                                onChange={(val) => setWelcomeMentionRoleId(val || "")}
                                                roles={availableRoles}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
                                                <Code className="w-3 h-3" /> Raw Markdown Template
                                            </label>
                                            <div className="flex gap-3">
                                                <button onClick={() => setWelcomeDiscordTemplate(prev => prev + " {member} ")} className="text-[10px] font-black text-zinc-600 hover:text-indigo-400 transition-colors uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded border border-white/5">+{`member`}</button>
                                                <button onClick={() => setWelcomeDiscordTemplate(prev => prev + " {guild} ")} className="text-[10px] font-black text-zinc-600 hover:text-indigo-400 transition-colors uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded border border-white/5">+{`guild`}</button>
                                            </div>
                                        </div>
                                        <Textarea
                                            value={welcomeDiscordTemplate}
                                            onChange={(e) => setWelcomeDiscordTemplate(e.target.value)}
                                            placeholder="Tapez votre message Markdown Discord ici..."
                                            className="min-h-[220px] bg-black/40 border-white/10 font-mono text-sm rounded-2xl resize-none focus:ring-indigo-500/20"
                                        />
                                        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex gap-4">
                                            <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold italic tracking-tight uppercase opacity-80">
                                                Discord pinge le membre via <code className="text-indigo-400">{`{member}`}</code>. Si le template Discord est vide, la version Dashboard sera utilisée par défaut.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2 px-2">
                                        <Eye className="w-3.5 h-3.5" /> Discord UI Twin
                                    </label>
                                    <div className="bg-[#1e1f22] rounded-[1.5rem] p-6 border-l-[6px] border-amber-500 space-y-5 shadow-2xl relative min-h-[300px] flex flex-col h-full group/discord">
                                        <div className="absolute top-4 right-6 text-[8px] font-black text-white/5 uppercase tracking-[0.2em]">Embed_Orchestrator</div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/30 to-zinc-950 flex items-center justify-center border border-indigo-500/20 shadow-lg">
                                                <Sparkles className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <span className="font-black text-white text-xs uppercase tracking-widest italic tracking-tighter shadow-sm">Nouvelle Légende Dashboard !</span>
                                        </div>
                                        <div className="space-y-4 flex-1">
                                            <div className="text-zinc-200 text-sm leading-relaxed px-1">
                                                {renderDiscordPreview(welcomeDiscordTemplate || welcomeTemplate)}
                                            </div>
                                            <div className="mt-auto pt-6 flex items-center gap-3 border-t border-white/5 opacity-50">
                                                <div className="w-6 h-6 rounded-full bg-zinc-800" />
                                                <span className="text-[9px] text-zinc-400 uppercase font-black tracking-[0.3em]">Authored by SigilOS • 2026</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="flex justify-end pt-8 border-t border-white/5">
                    <Button
                        onClick={handleSaveWelcome}
                        disabled={saving}
                        className="bg-amber-600 hover:bg-amber-500 text-amber-950 font-black h-14 px-12 rounded-2xl gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.2)] group/save transition-all hover:scale-[1.02] active:scale-95 overflow-hidden relative"
                    >
                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 group-hover/save:-translate-y-12 transition-transform duration-500 ease-in-out" />}
                        <span className={cn("transition-all duration-500 uppercase tracking-widest text-[11px]", saving ? "opacity-100" : "group-hover/save:-translate-y-1.5")}>
                            {saving ? "SYNCHRONISATION..." : "SÉCURISER LES TEMPLATES"}
                        </span>
                        {!saving && <Sparkles className="w-5 h-5 absolute bottom-[-30px] group-hover/save:bottom-[16px] transition-all duration-700 delay-100" />}
                    </Button>
                </div>
            </Card>

            {/* --- SECTION BADGE --- */}
            <Card className="p-8 bg-zinc-900/40 border-white/5 space-y-8 relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                            <ShieldCheck className="w-7 h-7 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-widest uppercase italic">Badge de Bienvenue</h3>
                            <p className="text-sm text-zinc-500 font-medium tracking-tight">Marqueur visuel premium pour l&apos;identification rapide des membres.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 px-1">
                                <Settings2 className="w-3 h-3" /> Intitulé du Badge
                            </label>
                            <div className="flex flex-col md:flex-row gap-4">
                                <Input
                                    value={welcomeBadgeName}
                                    onChange={(e) => setWelcomeBadgeName(e.target.value)}
                                    placeholder="Ex: Nouveau, Recrue, Test..."
                                    className="bg-black/40 border-white/10 h-14 text-white font-black uppercase tracking-widest focus:ring-indigo-500/20 text-center rounded-2xl md:flex-1"
                                />
                                <Button
                                    onClick={handleSaveBadge}
                                    disabled={saving}
                                    className="bg-zinc-100 hover:bg-white text-zinc-950 font-black h-14 px-10 gap-3 shrink-0 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    MISE À JOUR
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 space-y-6">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/80">
                                <Info className="w-5 h-5" /> Orchestration des Badges
                            </div>
                            <ul className="space-y-4 text-[11px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight">
                                <li className="flex gap-4">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                    <span>Injection automatique d&apos;une **infobulle premium** sur le profil et l&apos;annuaire.</span>
                                </li>
                                <li className="flex gap-4">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                    <span>Idéal pour les périodes d&apos;essai, les rôles temporaires ou le marketing interne.</span>
                                </li>
                                <li className="flex gap-4">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                    <span>Pilotable à distance via l&apos;onglet <button onClick={() => switchTabParam("membres")} className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 font-black transition-colors">Membres & Sync</button>.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2 px-1">
                            <Eye className="w-3.5 h-3.5" /> Profil Render Preview
                        </label>
                        <div className="bg-zinc-950/80 border border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center gap-6 relative overflow-hidden group/badge shadow-2xl h-full min-h-[320px]">
                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent opacity-0 group-hover/badge:opacity-100 transition-opacity duration-700" />
                            <div className="relative z-10">
                                <Avatar className="w-28 h-28 border-[3px] border-white/10 group-hover/badge:border-indigo-500/50 transition-all duration-700 scale-110 shadow-2xl ring-8 ring-indigo-500/5">
                                    <AvatarFallback className="bg-zinc-900 text-3xl font-black text-zinc-700 italic">SIG</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 right-0 flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-[0_10px_20px_rgba(79,70,229,0.4)] border border-indigo-400/20 group-hover/badge:scale-110 transition-transform duration-500">
                                    <ShieldCheck className="w-3 h-3" /> {welcomeBadgeName}
                                </div>
                            </div>
                            <div className="text-center space-y-2 z-10">
                                <p className="text-lg font-black text-white italic tracking-tight">Voyageur Éclairé</p>
                                <p className="text-[10px] text-zinc-500 font-black tracking-[0.3em] uppercase opacity-40">Nouveau de la Semaine</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* --- SECTION TEST --- */}
            <div className="p-6 rounded-[2rem] border border-amber-500/20 bg-amber-500/5 flex items-center gap-6 group/test shadow-lg backdrop-blur-sm">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover/test:rotate-12 transition-transform">
                    <HelpCircle className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                    <p className="text-xs text-zinc-400 leading-relaxed font-bold uppercase tracking-tight">
                        <span className="text-amber-500 mr-2">Pro-Tip :</span> Envoyez manuellement une notification de bienvenue (test) à un membre via{" "}
                        <button
                            onClick={() => switchTabParam("membres")}
                            className="text-amber-500 font-black hover:underline decoration-amber-500/30 underline-offset-4 transition-all"
                        >
                            Membres & Sync
                        </button>{" "}
                        pour vérifier vos templates en conditions réelles.
                    </p>
                </div>
            </div>
        </div>
    );
}
