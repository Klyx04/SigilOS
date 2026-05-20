"use client";

import { useState, useEffect } from "react";
import { BonusType, MentionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    getActiveBonuses,
    purchaseBonus,
    cancelBonus,
    getGuildRoles,
    getBonusConfig,
} from "@/server/actions/bonus-actions";
import { 
    Loader2, 
    AlertCircle, 
    XCircle, 
    Sparkles, 
    BellOff, 
    AtSign, 
    Rocket, 
    Save, 
    Check, 
    ChevronLeft,
    Share2,
    Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface BonusMenuButtonProps {
    guildId: string;
}

const ALL_BONUSES: Array<{
    type: BonusType;
    name: string;
    description: string;
    icon: string;
}> = [
        {
            type: BonusType.FORTUNE,
            name: "Oracle de Fortune",
            description: "+50% chances de loot sur les monstres",
            icon: "/bonus_guilde/oracle_de_fortune.png",
        },
        {
            type: BonusType.GLADIATOR,
            name: "Oracle de Gladiateur",
            description: "+50% gains en Kolizéum",
            icon: "/bonus_guilde/oracle_de_gladiateur.png",
        },
        {
            type: BonusType.HARVESTER,
            name: "Oracle de Récolteur",
            description: "Possibilité d'obtenir des Rékloots en récolte",
            icon: "/bonus_guilde/oracle_de_recolteur.png",
        },
        {
            type: BonusType.WISDOM,
            name: "Oracle de Savoir",
            description: "+50% d'expérience sur toutes les missions",
            icon: "/bonus_guilde/oracle_de_savoir.png",
        },
        {
            type: BonusType.DIVINE,
            name: "Oracle Divin",
            description: "Déclenche l'événement Moissonneuse Batteuse",
            icon: "/bonus_guilde/oracle_divin.png",
        },
    ];

export function BonusMenuButton({ guildId }: BonusMenuButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeBonuses, setActiveBonuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Purchase form state
    const [selectedBonus, setSelectedBonus] = useState<BonusType | null>(null);
    const [publishToDiscord, setPublishToDiscord] = useState(true);
    const [mentionType, setMentionType] = useState<MentionType>(MentionType.NONE);
    const [roleId, setRoleId] = useState("");
    const [guildRoles, setGuildRoles] = useState<any[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [configuredChannelName, setConfiguredChannelName] = useState<string | null>(null);

    useEffect(() => {
        loadActiveBonuses();
    }, [guildId]);

    useEffect(() => {
        if (isOpen) {
            setLoadingRoles(true);
            // Fetch roles
            getGuildRoles(guildId).then(res => {
                if (res.success && res.data) setGuildRoles(res.data);
                setLoadingRoles(false);
            });
            // Fetch channel config
            getBonusConfig(guildId).then(res => {
                if (res.success && res.data) {
                    setConfiguredChannelName(res.data.channelName || null);
                }
            });
        }
    }, [isOpen, guildId]);

    const loadActiveBonuses = async () => {
        setLoading(true);
        try {
            const result = await getActiveBonuses(guildId);
            if (result.success) {
                setActiveBonuses(result.data || []);
            }
        } catch {
            toast.error("Erreur lors du chargement des bonus actifs");
        } finally {
            setLoading(false);
        }
    };

    // Helper: check if a specific bonus type is already active/pending
    const getBonusForType = (type: BonusType) =>
        activeBonuses.find((b) => b.bonusType === type);

    const handleBonusSelect = async (bonusType: BonusType) => {
        if (getBonusForType(bonusType)) return; // Already active for this type
        setSelectedBonus(bonusType);
    };

    const handleCancelBonus = async (bonusId: string) => {
        setCancellingId(bonusId);
        try {
            const result = await cancelBonus(bonusId, guildId);
            if (result.success) {
                toast.success("Bonus annulé avec succès !");
                await loadActiveBonuses();
            } else {
                toast.error(result.error || "Échec de l'annulation");
            }
        } catch {
            toast.error("Erreur lors de l'annulation");
        } finally {
            setCancellingId(null);
        }
    };

    const handlePurchaseSubmit = async () => {
        if (!selectedBonus) return;

        setPurchasing(true);
        try {
            const result = await purchaseBonus(
                guildId,
                selectedBonus,
                undefined,
                publishToDiscord ? mentionType : MentionType.NONE,
                publishToDiscord && mentionType === MentionType.ROLE ? (roleId || undefined) : undefined,
            );

            if (result.success) {
                toast.success("Bonus acheté avec succès ! Il est dispo en jeu pendant 24h.");
                setSelectedBonus(null);
                setMentionType(MentionType.NONE);
                setRoleId("");
                await loadActiveBonuses();
                setIsOpen(false);
            } else {
                toast.error(result.error || "Échec de l'achat");
            }
        } catch {
            toast.error("Erreur lors de l'achat");
        } finally {
            setPurchasing(false);
        }
    };

    const hasAnyBonus = activeBonuses.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 gap-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Acheter Bonus</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800">
                <DialogHeader className="p-6 pb-2 border-b border-white/5">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        Bonus de Guilde
                    </DialogTitle>
                    <DialogDescription>
                        Achetez des bonus pour votre guilde. N'importe quel membre pourra l'activer en jeu pendant les 24h qui suivent !
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 p-6 space-y-6 overflow-hidden">
                        {/* Active Bonuses List */}
                        {hasAnyBonus && (
                            <div className="space-y-2">
                                {activeBonuses.map((bonus) => (
                                    <div key={bonus.id} className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center gap-3">
                                        <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-bold text-orange-400">
                                                {bonus.config?.name || "Bonus"}
                                            </span>
                                            <span className="text-xs text-orange-300/60 ml-2">
                                                ⏳ Dispo en jeu (24h max)
                                            </span>
                                        </div>
                                        {bonus.status === "PURCHASED" && (
                                            <Button
                                                onClick={() => handleCancelBonus(bonus.id)}
                                                disabled={cancellingId === bonus.id}
                                                variant="outline"
                                                size="sm"
                                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-7 text-xs"
                                            >
                                                {cancellingId === bonus.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <><XCircle className="w-3 h-3 mr-1" />Annuler</>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Bonus Selection Grid */}
                        {!selectedBonus ? (
                            <ScrollArea className="flex-1 pr-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4">
                                    {ALL_BONUSES.map((bonus) => {
                                        const existing = getBonusForType(bonus.type);
                                        const isActive = existing?.status === "ACTIVE";
                                        const isPurchased = existing?.status === "PURCHASED";
                                        const isDisabled = !!existing; // Only block same type

                                        return (
                                            <button
                                                key={bonus.type}
                                                onClick={() => !isDisabled && handleBonusSelect(bonus.type)}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300",
                                                    isActive && "border-green-500 bg-green-500/10 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]",
                                                    isPurchased && "border-orange-500 bg-orange-500/10 shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]",
                                                    !isActive && !isPurchased && !isDisabled && "border-zinc-800 bg-zinc-900/30 hover:border-purple-700 hover:bg-purple-900/20",
                                                    isDisabled && !isActive && !isPurchased && "opacity-40 cursor-not-allowed border-zinc-900 bg-zinc-950"
                                                )}
                                            >
                                                <div className="mb-4 transform transition-transform group-hover:scale-110 duration-300 relative">
                                                    <Image
                                                        src={bonus.icon}
                                                        alt={bonus.name}
                                                        width={64}
                                                        height={64}
                                                        className="rounded-lg"
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-bold text-center mb-2",
                                                    isActive && "text-green-400",
                                                    isPurchased && "text-orange-400",
                                                    !isActive && !isPurchased && "text-white"
                                                )}>
                                                    {bonus.name}
                                                </span>
                                                <p className="text-xs text-zinc-400 text-center line-clamp-2">
                                                    {bonus.description}
                                                </p>
                                                {isActive && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-green-500 text-white text-[10px] font-bold uppercase">
                                                        Actif
                                                    </div>
                                                )}
                                                {isPurchased && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-orange-500 text-white text-[10px] font-bold uppercase">
                                                        24h
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        ) : (
                            /* Purchase Form */
                            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* Header (Sticky) */}
                                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-zinc-900 group">
                                            <Image 
                                                src={ALL_BONUSES.find(b => b.type === selectedBonus)?.icon || ""} 
                                                alt="Bonus Icon"
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-1">
                                                {ALL_BONUSES.find(b => b.type === selectedBonus)?.name}
                                            </h3>
                                            <p className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em]">
                                                Configuration tactique
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => setSelectedBonus(null)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-4 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-white/5"
                                    >
                                        <ChevronLeft className="w-3 h-3 mr-1.5" />
                                        Retour
                                    </Button>
                                </div>

                                {/* Scrollable content */}
                                <ScrollArea className="flex-1 pr-4 -mr-4">
                                    <div className="space-y-6 pb-4">
                                        {/* Discord Publishing Toggle */}
                                        <div className="flex items-center justify-between p-5 rounded-3xl bg-zinc-800/40 border border-white/10 shadow-xl backdrop-blur-md group hover:border-purple-500/30 transition-all duration-300">
                                    <div className="flex gap-4">
                                        <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 shrink-0 self-start shadow-inner">
                                            <Share2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <Label className="text-sm font-black text-white uppercase tracking-tight">Publier sur Discord</Label>
                                            <p className="text-[11px] text-zinc-400 font-medium mt-1 leading-relaxed max-w-[280px]">
                                                {configuredChannelName ? (
                                                    <span className="flex items-center gap-1.5">
                                                        Annonce automatique dans 
                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 font-bold">
                                                            <Hash className="w-3 h-3" />
                                                            {configuredChannelName}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-500/80 font-bold flex items-center gap-1.5">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Configuration manquante (Paramètres guilde)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={publishToDiscord}
                                        onCheckedChange={setPublishToDiscord}
                                        className="data-[state=checked]:bg-purple-500"
                                    />
                                </div>

                                {/* Mention Type - Only if Discord publishing is ON */}
                                {publishToDiscord && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 mb-1">
                                            <AtSign className="w-3.5 h-3.5 text-zinc-500" />
                                            <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Type de Mention</Label>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                onClick={() => { setMentionType(MentionType.NONE); setRoleId(""); }}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group relative overflow-hidden",
                                                    mentionType === MentionType.NONE
                                                        ? "bg-zinc-800 border-white/30 text-white shadow-xl ring-1 ring-white/10"
                                                        : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10 hover:border-white/20"
                                                )}
                                            >
                                                <BellOff className={cn("w-5 h-5 transition-colors", mentionType === MentionType.NONE ? "text-zinc-300" : "text-zinc-600 group-hover:text-zinc-400")} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Personne</span>
                                                {mentionType === MentionType.NONE && <div className="absolute inset-0 bg-white/5 pointer-events-none" />}
                                            </button>

                                            <button
                                                onClick={() => { setMentionType(MentionType.EVERYONE); setRoleId(""); }}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group relative overflow-hidden",
                                                    mentionType === MentionType.EVERYONE
                                                        ? "bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-xl shadow-rose-500/10 ring-1 ring-rose-500/20"
                                                        : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10 hover:border-white/20"
                                                )}
                                            >
                                                <AtSign className={cn("w-5 h-5 transition-colors", mentionType === MentionType.EVERYONE ? "text-rose-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">@everyone</span>
                                                {mentionType === MentionType.EVERYONE && <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />}
                                            </button>

                                            <button
                                                onClick={() => setMentionType(MentionType.ROLE)}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group relative overflow-hidden",
                                                    mentionType === MentionType.ROLE
                                                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/20"
                                                        : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10 hover:border-white/20"
                                                )}
                                            >
                                                <Share2 className={cn("w-5 h-5 transition-colors", mentionType === MentionType.ROLE ? "text-purple-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Rôle</span>
                                                {mentionType === MentionType.ROLE && <div className="absolute inset-0 bg-purple-500/5 pointer-events-none" />}
                                            </button>
                                        </div>

                                        {/* Role Selector List */}
                                        {mentionType === MentionType.ROLE && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="bg-zinc-800/50 border border-white/10 rounded-2xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar shadow-inner p-2 space-y-1 backdrop-blur-md">
                                                    {loadingRoles ? (
                                                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-600">
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Récupération des rôles...</span>
                                                        </div>
                                                    ) : guildRoles.length === 0 ? (
                                                        <div className="py-10 text-center text-[11px] text-zinc-600 font-bold italic">Aucun rôle Discord disponible</div>
                                                    ) : (
                                                        guildRoles.map(role => {
                                                            const isSelected = roleId === role.id;
                                                            const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                                            return (
                                                                <button
                                                                    key={role.id}
                                                                    onClick={() => setRoleId(role.id)}
                                                                    className={cn(
                                                                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group",
                                                                        isSelected 
                                                                            ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                                                                            : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                                                                    )}
                                                                >
                                                                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] border border-white/10" style={{ backgroundColor: hex }} />
                                                                    <span className="text-xs font-black flex-1 truncate uppercase tracking-tight">@{role.name}</span>
                                                                    {isSelected && <Check className="w-4 h-4 animate-in zoom-in-50 duration-300" />}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Discord Embed Preview */}
                                        {publishToDiscord && selectedBonus && (
                                            <div className="space-y-3 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Aperçu Discord</Label>
                                                        <div className="h-[1px] w-8 bg-indigo-500/30" />
                                                    </div>
                                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest italic">Simulation temps réel</span>
                                                </div>
                                                
                                                <div className="bg-[#2b2d31] rounded-lg overflow-hidden border-l-[3px] border-purple-600 shadow-2xl transition-all duration-300 hover:translate-y-[-1px]">
                                                    <div className="p-3 space-y-2">
                                                        <div className="flex justify-between gap-3">
                                                            <div className="space-y-1">
                                                                <h4 className="text-[#00a8fc] hover:underline cursor-pointer font-bold text-[13px] leading-tight">
                                                                    💎 Bonus de Guilde disponible : {ALL_BONUSES.find(b => b.type === selectedBonus)?.name}
                                                                </h4>
                                                                <div className="text-zinc-300 text-[11px] leading-relaxed whitespace-pre-line font-medium">
                                                                    Un nouveau bonus a été acheté par **vous**.
                                                                    {"\n"}
                                                                    **Comment l'activer ?**
                                                                    {"\n"}
                                                                    N'importe quel membre peut l'activer en jeu ! Vous avez **24h** pour le faire dans l'onglet **"Obtenu"** du menu des bonus de guilde.
                                                                </div>
                                                            </div>
                                                            <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-white/5">
                                                                <Image 
                                                                    src={ALL_BONUSES.find(b => b.type === selectedBonus)?.icon || ""} 
                                                                    alt="Thumb" 
                                                                    width={40} 
                                                                    height={40} 
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <div className="text-white text-[10px] font-bold">✨ Effet du bonus</div>
                                                                <div className="text-zinc-300 text-[10px] truncate">{ALL_BONUSES.find(b => b.type === selectedBonus)?.description}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-white text-[10px] font-bold">⏳ Disponibilité restante</div>
                                                                <div className="text-zinc-300 text-[10px] px-1 bg-zinc-700/50 rounded inline-block">dans 24 heures</div>
                                                            </div>
                                                        </div>

                                                        <div className="pt-1.5 border-t border-white/5 flex items-center gap-2">
                                                            <span className="text-[9px] text-zinc-400">SigilOS · Pas encore sur le Dashboard ? → beta.sigilos.fr</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {mentionType !== MentionType.NONE && (
                                                    <div className="bg-[#2b2d31]/50 px-2 py-1.5 rounded-md border border-white/5 flex items-center gap-2">
                                                        <span className="text-indigo-400 text-[10px] font-medium">
                                                            {mentionType === MentionType.EVERYONE ? "@everyone" : `@${guildRoles.find(r => r.id === roleId)?.name || "Rôle"}`}
                                                        </span>
                                                        <span className="text-zinc-500 text-[9px] font-medium">Sera envoyé en texte brut.</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                    </div>
                                </ScrollArea>

                                {/* Actions (Sticky at bottom) */}
                                <div className="flex gap-4 pt-4 border-t border-white/5 relative shrink-0">
                                    <Button
                                        onClick={() => setSelectedBonus(null)}
                                        disabled={purchasing}
                                        variant="ghost"
                                        className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={handlePurchaseSubmit}
                                        disabled={purchasing}
                                        className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/30 transition-all group overflow-hidden relative"
                                    >
                                        {purchasing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Transaction...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                                                Confirmer l'achat
                                            </>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    </Button>
                                    
                                    {/* Ambient background glow for purchase button */}
                                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
