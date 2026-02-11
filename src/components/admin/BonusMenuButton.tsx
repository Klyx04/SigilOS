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
} from "@/server/actions/bonus-actions";
import { Loader2, AlertCircle, XCircle, Sparkles } from "lucide-react";
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

    useEffect(() => {
        loadActiveBonuses();
    }, [guildId]);

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

        // Lazy-load Discord roles once
        if (guildRoles.length === 0) {
            setLoadingRoles(true);
            try {
                const result = await getGuildRoles(guildId);
                if (result.success && result.data) {
                    setGuildRoles(result.data);
                }
            } catch {
                // Non-blocking
            } finally {
                setLoadingRoles(false);
            }
        }
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
                toast.success("Bonus acheté avec succès ! Il sera actif dans 24h.");
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
                    variant="outline"
                    size="sm"
                    className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500"
                >
                    <Sparkles className="w-4 h-4" />
                    Acheter Bonus
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800">
                <DialogHeader className="p-6 pb-2 border-b border-white/5">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        Bonus de Guilde
                    </DialogTitle>
                    <DialogDescription>
                        Achetez des bonus pour votre guilde. Les bonus s&apos;activent automatiquement après 24h et durent 2h.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden p-6 space-y-6">
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
                                                {bonus.status === "ACTIVE" ? "✨ Actif" : "⏳ En attente (24h)"}
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
                            <ScrollArea className="h-[50vh] pr-4">
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
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-white">
                                        Acheter {ALL_BONUSES.find(b => b.type === selectedBonus)?.name}
                                    </h3>
                                    <Button
                                        onClick={() => setSelectedBonus(null)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-zinc-400"
                                    >
                                        Retour
                                    </Button>
                                </div>

                                {/* Discord Publishing Toggle */}
                                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                                    <div>
                                        <Label className="text-white font-semibold">Publier sur Discord</Label>
                                        <p className="text-xs text-zinc-500 mt-1">Annonce automatique dans le salon configuré dans les Paramètres</p>
                                    </div>
                                    <Switch
                                        checked={publishToDiscord}
                                        onCheckedChange={setPublishToDiscord}
                                    />
                                </div>

                                {/* Mention Type - Only if Discord publishing is ON */}
                                {publishToDiscord && (
                                    <div>
                                        <Label className="text-white">Mentionner</Label>
                                        <div className="mt-2 space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="mention"
                                                    checked={mentionType === MentionType.NONE}
                                                    onChange={() => {
                                                        setMentionType(MentionType.NONE);
                                                        setRoleId("");
                                                    }}
                                                    className="text-purple-500"
                                                />
                                                <span className="text-white">Personne</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="mention"
                                                    checked={mentionType === MentionType.EVERYONE}
                                                    onChange={() => {
                                                        setMentionType(MentionType.EVERYONE);
                                                        setRoleId("");
                                                    }}
                                                    className="text-purple-500"
                                                />
                                                <span className="text-white">@everyone</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="mention"
                                                    checked={mentionType === MentionType.ROLE}
                                                    onChange={() => setMentionType(MentionType.ROLE)}
                                                    className="text-purple-500"
                                                />
                                                <span className="text-white">Un rôle spécifique</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Role Dropdown - Only if ROLE mention type + Discord publishing */}
                                {publishToDiscord && mentionType === MentionType.ROLE && (
                                    <div>
                                        <Label className="text-white">Rôle à mentionner</Label>
                                        {loadingRoles ? (
                                            <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-zinc-800 text-zinc-400">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Chargement des rôles...
                                            </div>
                                        ) : (
                                            <select
                                                value={roleId}
                                                onChange={(e) => setRoleId(e.target.value)}
                                                className="w-full mt-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            >
                                                <option value="">Sélectionnez un rôle</option>
                                                {guildRoles.map(role => (
                                                    <option key={role.id} value={role.id}>
                                                        {role.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={() => setSelectedBonus(null)}
                                        disabled={purchasing}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={handlePurchaseSubmit}
                                        disabled={purchasing}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                                    >
                                        {purchasing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Achat...
                                            </>
                                        ) : (
                                            "Confirmer l'achat"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
