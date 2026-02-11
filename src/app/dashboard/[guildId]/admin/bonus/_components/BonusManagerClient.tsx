"use client";

import { useState, useEffect } from "react";
import { BonusType, MentionType } from "@prisma/client";
import { BonusCard } from "@/components/admin/BonusCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    getGuildBonuses,
    getActiveBonus,
    purchaseBonus,
    cancelBonus,
} from "@/server/actions/bonus-actions";
import { Loader2, AlertCircle, XCircle } from "lucide-react";

interface BonusManagerClientProps {
    guildId: string;
}

const ALL_BONUSES: Array<{
    type: BonusType;
    name: string;
    description: string;
    cost: number;
    icon: string;
}> = [
        {
            type: BonusType.FORTUNE,
            name: "Oracle de Fortune",
            description: "+50% chances de loot sur les monstres",
            cost: 20,
            icon: "/bonus_guilde/oracle_de_fortune.png",
        },
        {
            type: BonusType.GLADIATOR,
            name: "Oracle de Gladiateur",
            description: "+50% gains en Kolizéum",
            cost: 20,
            icon: "/bonus_guilde/oracle_de_gladiateur.png",
        },
        {
            type: BonusType.HARVESTER,
            name: "Oracle de Récolteur",
            description: "Possibilité d'obtenir des Rékloots en récolte",
            cost: 50,
            icon: "/bonus_guilde/oracle_de_recolteur.png",
        },
        {
            type: BonusType.WISDOM,
            name: "Oracle de Savoir",
            description: "+50% d'expérience sur toutes les missions",
            cost: 20,
            icon: "/bonus_guilde/oracle_de_savoir.png",
        },
        {
            type: BonusType.DIVINE,
            name: "Oracle Divin",
            description: "Déclenche l'événement Moissonneuse Batteuse",
            cost: 200,
            icon: "/bonus_guilde/oracle_divin.png",
        },
    ];

export function BonusManagerClient({ guildId }: BonusManagerClientProps) {
    const [activeBonus, setActiveBonus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Purchase form state
    const [selectedBonus, setSelectedBonus] = useState<BonusType | null>(null);
    const [channelId, setChannelId] = useState("");
    const [mentionType, setMentionType] = useState<MentionType>(MentionType.NONE);
    const [roleId, setRoleId] = useState("");

    useEffect(() => {
        loadActiveBonus();
    }, [guildId]);

    const loadActiveBonus = async () => {
        setLoading(true);
        const result = await getActiveBonus(guildId);
        if (result.success) {
            setActiveBonus(result.data);
        }
        setLoading(false);
    };

    const handlePurchaseClick = (bonusType: BonusType) => {
        setSelectedBonus(bonusType);
    };

    const handleCancelBonus = async () => {
        if (!activeBonus) return;

        setCancelling(true);
        try {
            const result = await cancelBonus(activeBonus.id, guildId);
            if (result.success) {
                toast.success("Bonus annulé avec succès !");
                await loadActiveBonus();
            } else {
                toast.error(result.error || "Échec de l'annulation");
            }
        } catch (error: any) {
            toast.error(error.message || "Erreur lors de l'annulation");
        } finally {
            setCancelling(false);
        }
    };

    const handlePurchaseSubmit = async () => {
        if (!selectedBonus) return;

        setPurchasing(true);
        try {
            const result = await purchaseBonus(
                guildId,
                selectedBonus,
                channelId || undefined,
                mentionType,
                roleId || undefined
            );

            if (result.success) {
                toast.success("Bonus acheté avec succès ! Il sera actif dans 24h.");
                setSelectedBonus(null);
                setChannelId("");
                setMentionType(MentionType.NONE);
                setRoleId("");
                await loadActiveBonus();
            } else {
                toast.error(result.error || "Échec de l'achat");
            }
        } catch (error: any) {
            toast.error(error.message || "Erreur lors de l'achat");
        } finally {
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const isAnyBonusActive = activeBonus !== null;
    const canCancel = activeBonus?.status === "PURCHASED";

    return (
        <div className="space-y-8">
            {/* Active Bonus Warning */}
            {isAnyBonusActive && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-orange-400 mb-1">Bonus actif ou en attente</h3>
                        <p className="text-sm text-orange-300/80">
                            Vous ne pouvez acheter qu'un seul bonus à la fois. Attendez que le bonus actuel expire avant d'en acheter un autre.
                        </p>
                        <div className="mt-2 text-xs text-orange-400">
                            <strong>Bonus actuel :</strong> {activeBonus?.config?.name || "Inconnu"}
                            <br />
                            <strong>Statut :</strong> {activeBonus?.status === "ACTIVE" ? "Actif" : "En attente (24h)"}
                        </div>
                    </div>
                    {canCancel && (
                        <Button
                            onClick={handleCancelBonus}
                            disabled={cancelling}
                            variant="outline"
                            size="sm"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                            {cancelling ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Annulation...
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Annuler
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}

            {/* Bonus Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ALL_BONUSES.map((bonus) => (
                    <BonusCard
                        key={bonus.type}
                        type={bonus.type}
                        name={bonus.name}
                        description={bonus.description}
                        cost={bonus.cost}
                        iconPath={bonus.icon}
                        isPurchased={activeBonus?.bonusType === bonus.type && activeBonus?.status === "PURCHASED"}
                        isActive={activeBonus?.bonusType === bonus.type && activeBonus?.status === "ACTIVE"}
                        onPurchase={() => handlePurchaseClick(bonus.type)}
                    />
                ))}
            </div>

            {/* Purchase Modal */}
            {selectedBonus && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Acheter {ALL_BONUSES.find(b => b.type === selectedBonus)?.name}
                        </h2>

                        <div className="space-y-4">
                            {/* Channel ID */}
                            <div>
                                <Label className="text-white">Canal Discord (ID)</Label>
                                <input
                                    type="text"
                                    value={channelId}
                                    onChange={(e) => setChannelId(e.target.value)}
                                    placeholder="1234567890"
                                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Optionnel - Canal où envoyer la notification</p>
                            </div>

                            {/* Mention Type */}
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
                                            className="text-indigo-500"
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
                                            className="text-indigo-500"
                                        />
                                        <span className="text-white">@everyone</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mention"
                                            checked={mentionType === MentionType.ROLE}
                                            onChange={() => setMentionType(MentionType.ROLE)}
                                            className="text-indigo-500"
                                        />
                                        <span className="text-white">Un rôle spécifique</span>
                                    </label>
                                </div>
                            </div>

                            {/* Role ID (conditional) */}
                            {mentionType === MentionType.ROLE && (
                                <div>
                                    <Label className="text-white">Rôle Discord (ID)</Label>
                                    <input
                                        type="text"
                                        value={roleId}
                                        onChange={(e) => setRoleId(e.target.value)}
                                        placeholder="1234567890"
                                        className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Cost */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Coût total</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-3xl font-bold text-yellow-400">
                                            {ALL_BONUSES.find(b => b.type === selectedBonus)?.cost}
                                        </span>
                                        <span className="text-sm text-slate-400">kamas</span>
                                    </div>
                                </div>
                            </div>

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
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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
                    </div>
                </div>
            )}
        </div>
    );
}
