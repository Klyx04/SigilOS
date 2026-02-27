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
    UserCircle
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
    updateProbationRoleName
} from "@/server/actions/onboarding-admin-actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface OnboardingSettingsClientProps {
    guildId: string;
}

export function OnboardingSettingsClient({ guildId }: OnboardingSettingsClientProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const switchTab = (tabId: string) => {
        router.push(`/dashboard/${guildId}/admin/settings?tab=${tabId}`);
    };

    const [welcomeEnabled, setWelcomeEnabled] = useState(false);
    const [welcomeChannelId, setWelcomeChannelId] = useState<string>("");
    const [welcomeTemplate, setWelcomeTemplate] = useState<string>("");
    const [welcomeMentionRoleId, setWelcomeMentionRoleId] = useState<string>("");
    const [welcomeDashboardEnabled, setWelcomeDashboardEnabled] = useState(true);
    const [welcomeDiscordEnabled, setWelcomeDiscordEnabled] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);

    const [probationRoleName, setProbationRoleName] = useState("Période d'essai");

    useEffect(() => {
        const load = async () => {
            const res = await getOnboardingSettings(guildId);
            if (res.success && res.data) {
                setWelcomeEnabled(res.data.enabled);
                setWelcomeChannelId(res.data.channelId || "");
                setWelcomeTemplate(res.data.template || "");
                setWelcomeMentionRoleId(res.data.mentionRoleId || "");
                setWelcomeDashboardEnabled(res.data.dashboardEnabled);
                setWelcomeDiscordEnabled(res.data.discordEnabled);
                setProbationRoleName(res.data.probationRoleName);
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

    const handleSaveProbation = async () => {
        setSaving(true);
        try {
            const res = await updateProbationRoleName({
                guildId,
                roleName: probationRoleName,
            });
            if (res.success) toast.success("Nom du rôle d'essai mis à jour");
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

    return (
        <div className="space-y-8 max-w-4xl">
            {/* --- SECTION ACCUEIL --- */}
            <Card className="p-6 bg-zinc-900/40 border-white/5 space-y-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Template de Bienvenue</h3>
                            <p className="text-sm text-zinc-500">Configurez le message automatique envoyé aux nouveaux membres.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">Activer</span>
                        <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
                    </div>
                </div>

                <div className={`space-y-4 transition-all ${welcomeEnabled ? "opacity-100" : "opacity-40 pointer-events-none grayscale"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-black/20 border border-white/5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-white">Dashboard SigilOS</p>
                                <p className="text-[10px] text-zinc-500">Affiche le message dans le salon "Bienvenue" du site.</p>
                            </div>
                            <Switch checked={welcomeDashboardEnabled} onCheckedChange={setWelcomeDashboardEnabled} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-white">Serveur Discord</p>
                                <p className="text-[10px] text-zinc-500">Envoie le message sur Discord (id salon requis).</p>
                            </div>
                            <Switch checked={welcomeDiscordEnabled} onCheckedChange={setWelcomeDiscordEnabled} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`space-y-2 transition-opacity ${welcomeDiscordEnabled ? "opacity-100" : "opacity-30"}`}>
                            <label className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                <Bell className="w-3 h-3" /> Salon Discord (ID)
                            </label>
                            <Input
                                placeholder="ID du salon Discord"
                                value={welcomeChannelId}
                                onChange={(e) => setWelcomeChannelId(e.target.value)}
                                className="bg-zinc-950 border-white/10"
                                disabled={!welcomeDiscordEnabled}
                            />
                        </div>
                        <div className={`space-y-2 transition-opacity ${welcomeDiscordEnabled ? "opacity-100" : "opacity-30"}`}>
                            <label className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                <Save className="w-3 h-3" /> Mention Discord
                            </label>
                            <Select
                                value={welcomeMentionRoleId || "none"}
                                onValueChange={(val) => setWelcomeMentionRoleId(val === "none" ? "" : val)}
                                disabled={!welcomeDiscordEnabled}
                            >
                                <SelectTrigger className="bg-zinc-950 border-white/10">
                                    <SelectValue placeholder="Choisir une mention" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-white/10 text-zinc-300">
                                    <SelectItem value="none">Aucune (Pas de mention)</SelectItem>
                                    <SelectItem value="everyone">@everyone</SelectItem>
                                    {availableRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                            <Info className="w-3 h-3" /> Template du Message
                        </label>
                        <Textarea
                            placeholder="Bienvenue {member} ! Ravi de te voir ici."
                            value={welcomeTemplate}
                            onChange={(e) => setWelcomeTemplate(e.target.value)}
                            className="bg-zinc-950 border-white/10 min-h-[100px] resize-none"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center mr-2">
                                <Sparkles className="w-3 h-3 mr-1 text-emerald-500" /> Insérer :
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setWelcomeTemplate(prev => prev + "{member}")}
                                className="h-7 text-[10px] font-bold bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 gap-1.5"
                            >
                                <UserCircle className="w-3 h-3" /> @Membre
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setWelcomeTemplate(prev => prev + "{guild}")}
                                className="h-7 text-[10px] font-bold bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 gap-1.5"
                            >
                                <ShieldCheck className="w-3 h-3" /> Nom de Guilde
                            </Button>
                        </div>
                        <p className="text-[10px] text-zinc-600">
                            Astuce : Cliquez sur les boutons ci-dessus pour insérer des variables dynamiques.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleSaveWelcome}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-6 gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                    </Button>
                </div>
            </Card>

            {/* --- SECTION PROBATION --- */}
            <Card className="p-6 bg-zinc-900/40 border-white/5 space-y-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Rôle de Probation (SigilOS)</h3>
                        <p className="text-sm text-zinc-500">Un rôle temporaire affiché sur le Dashboard, indépendant de Discord.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-amber-400 flex items-center gap-2">
                            <Settings2 className="w-3 h-3" /> Nom du Rôle Personnalisé
                        </label>
                        <Input
                            value={probationRoleName}
                            onChange={(e) => setProbationRoleName(e.target.value)}
                            className="bg-zinc-950 border-white/10"
                        />
                    </div>
                    <div>
                        <Button
                            onClick={handleSaveProbation}
                            disabled={saving}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-10 px-6 gap-2 w-full md:w-auto"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Mettre à jour le nom
                        </Button>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60">
                        <Info className="w-3 h-3" /> Fonctionnement
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Ce rôle peut être appliqué à n'importe quel membre via la{" "}
                        <button
                            onClick={() => switchTab("membres")}
                            className="text-amber-400 font-bold hover:underline decoration-amber-400/30 underline-offset-4"
                        >
                            Gestion des Membres
                        </button>{" "}
                        pour une durée déterminée. Il affiche un badge spécial sur le profil et l'annuaire.
                    </p>
                </div>
            </Card >

            {/* --- SECTION QUICK SEND (TEST) --- */}
            < div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center gap-4" >
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="flex-1">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Pour envoyer manuellement un message de bienvenue à un membre, utilisez le menu d&apos;actions dans l&apos;onglet{" "}
                        <button
                            onClick={() => switchTab("membres")}
                            className="text-rose-400 font-bold hover:underline decoration-rose-400/30 underline-offset-4"
                        >
                            Membres & Sync
                        </button>.
                    </p>
                </div>
            </div >
        </div >
    );
}
