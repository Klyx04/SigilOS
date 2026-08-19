"use client";

// =============================================================================
// OCRE MONSTER CARD - Premium glassmorphism card with exchange indicator
// =============================================================================

import { useState, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Copy,
    Check,
    Loader2,
    MapPin,
    Sparkles,
    Users,
    ChevronDown,
    ChevronUp,
    Settings2,
    Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OcreMonster, MonsterState } from "@/lib/metamob-client";
import type { ExchangePartner } from "@/server/actions/ocre-actions";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    updateMonsterTradeParamsAction,
} from "@/server/actions/ocre-actions";
import { toast } from "sonner";

interface OcreMonsterCardProps {
    monster: OcreMonster;
    guildId: string;
    availableExchanges?: number;
    showExchangeButton?: boolean;
    onFindExchanges?: () => Promise<ExchangePartner[]>;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: number) => void;
}

const stateConfig: Record<MonsterState, { label: string; color: string; icon: string }> = {
    MANQUANT: {
        label: "Manquant",
        color: "bg-danger/10 text-danger border border-danger/20 backdrop-blur-md ",
        icon: "🔴",
    },
    POSSEDE: {
        label: "Possédé",
        color: "bg-success/10 text-success border border-success/20 backdrop-blur-md ",
        icon: "🟢",
    },
    DOUBLON: {
        label: "Doublon",
        color: "bg-warning/10 text-warning border border-warning/20 backdrop-blur-md ",
        icon: "🟡",
    },
};

export const OcreMonsterCard = memo(function OcreMonsterCard({
    monster,
    guildId,
    availableExchanges = 0,
    showExchangeButton = true,
    onFindExchanges,
    isSelected = false,
    isSelectionMode = false,
    onToggleSelection,
}: OcreMonsterCardProps) {
    const [showPartners, setShowPartners] = useState(false);
    const [partners, setPartners] = useState<ExchangePartner[]>([]);
    const [copiedUser, setCopiedUser] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Manual Trade Override State
    const [tradeParams, setTradeParams] = useState({
        offer: monster.trade_offer ?? 0,
        want: monster.trade_want ?? 0,
    });
    const [isUpdatingTrade, setIsUpdatingTrade] = useState(false);

    const handleUpdateTrade = async () => {
        setIsUpdatingTrade(true);
        try {
            const res = await updateMonsterTradeParamsAction({
                guildId,
                monsterId: monster.id,
                params: {
                    trade_offer: tradeParams.offer,
                    trade_want: tradeParams.want,
                }
            });
            if (res.success) {
                toast.success("Préférences d'échange mises à jour");
            } else {
                toast.error(res.error || "Erreur");
            }
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setIsUpdatingTrade(false);
        }
    };

    const config = stateConfig[monster.state];
    const hasExchange = availableExchanges > 0;
    const isManquant = monster.state === "MANQUANT";

    const handleFindExchanges = async () => {
        if (showPartners) {
            setShowPartners(false);
            return;
        }

        if (partners.length > 0) {
            setShowPartners(true);
            return;
        }

        if (!onFindExchanges) return;


        setIsLoading(true);
        try {
            const result = await onFindExchanges();
            // Filter partners to only show those who have THIS specific monster in 'monstersTheyHave'
            // We use 'monstersTheyHave' which contains the list of surplus monsters from the partner
            const relevantPartners = result.filter(partner =>
                partner.monstersTheyHave.some(m => m.id === monster.id)
            );

            setPartners(relevantPartners);
            setShowPartners(true);
        } catch {
            toast.error("Erreur lors de la recherche");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMP = (partner: ExchangePartner) => {
        const message = `/w ${partner.characterName} Salut ! Tu aurais ${monster.name} en doublon à échanger ? :)`;
        navigator.clipboard.writeText(message);
        setCopiedUser(partner.username);
        toast.success("Message copié !");
        setTimeout(() => setCopiedUser(null), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
        >
            <Card
                className={cn(
                    "group relative overflow-hidden transition-all duration-300",
                    "backdrop-blur-xl bg-surface/90 hover:bg-elevated/95",
                    "border border-border hover:border-warning/40 shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.6)]",
                    "hover:-translate-y-1 hover:scale-[1.03]",
                    isSelected && isSelectionMode
                        ? "border-warning ring-2 ring-warning/20"
                        : hasExchange && isManquant
                            ? "border-success/40 hover:border-success/60 ring-1 ring-success/20 shadow-[0_8px_32px_rgba(16,185,129,0.08)] hover:shadow-[0_16px_40px_rgba(16,185,129,0.15)]"
                            : "",
                    isSelectionMode && "cursor-pointer active:scale-95"
                )}
                onClick={() => isSelectionMode && onToggleSelection?.(monster.id)}
            >
                {/* Selection Indicator */}
                {isSelectionMode && (
                    <div className="absolute top-3 left-3 z-20">
                        <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                            isSelected 
                                ? "bg-warning border-warning " 
                                : "bg-black/40 border-border-strong"
                        )}>
                            {isSelected && <Check className="h-3 w-3 text-foreground" strokeWidth={4} />}
                        </div>
                    </div>
                )}
                {/* Glow effect on hover */}
                <div
                    className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                        hasExchange && isManquant
                            ? "bg-gradient-to-br from-success/5 to-transparent"
                            : "bg-gradient-to-br from-warning/5 to-transparent"
                    )}
                />

                {/* Exchange available badge */}
                {hasExchange && isManquant && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <Badge className="bg-success text-success-foreground text-caption font-bold px-1.5 py-0.5 animate-pulse">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            {availableExchanges}
                        </Badge>
                    </div>
                )}

                <CardContent className="relative z-10 p-4">
                    <div className="flex gap-3">
                        {/* Monster Image */}
                        {monster.image && (
                            <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-background/80 border border-border group-hover:border-warning/30 transition-colors">
                                <Image
                                    src={monster.image}
                                    alt={monster.name}
                                    fill
                                    className="object-contain p-1 group- transition-transform duration-300"
                                    sizes="56px"
                                />
                            </div>
                        )}

                        {/* Monster Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground group-hover:text-warning transition-colors duration-300">
                                    {monster.name}
                                </h3>
                                <div className={cn("flex flex-col items-end gap-1 shrink-0", isSelectionMode && "pointer-events-none opacity-50")}>
                                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                                        {config.icon} x{monster.owned}
                                    </Badge>
                                    
                                    {/* Manual Trade Override Popover */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md hover:bg-warning/10 hover:text-warning transition-colors">
                                                <Settings2 className="h-3 w-3" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-3 rounded-2xl bg-card border-border shadow-2xl" side="left" align="start">
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-caption font-black uppercase tracking-widest text-muted-foreground/50">Forçage Manuel</span>
                                                    <span className="text-caption text-muted-foreground leading-tight">Remplace les calculs automatiques de Metamob.</span>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <Label className="text-caption font-bold">Offrir</Label>
                                                        <Input 
                                                            type="number" 
                                                            className="h-7 w-12 text-caption text-center font-bold px-1"
                                                            value={tradeParams.offer}
                                                            onChange={(e) => setTradeParams(s => ({ ...s, offer: parseInt(e.target.value) || 0 }))}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <Label className="text-caption font-bold">Chercher</Label>
                                                        <Input 
                                                            type="number" 
                                                            className="h-7 w-12 text-caption text-center font-bold px-1"
                                                            value={tradeParams.want}
                                                            onChange={(e) => setTradeParams(s => ({ ...s, want: parseInt(e.target.value) || 0 }))}
                                                        />
                                                    </div>
                                                </div>

                                                <Button 
                                                    size="sm" 
                                                    className="w-full h-7 text-caption font-bold gap-2 bg-warning hover:bg-warning text-warning-foreground rounded-lg transition-all"
                                                    onClick={handleUpdateTrade}
                                                    disabled={isUpdatingTrade}
                                                >
                                                    {isUpdatingTrade ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Appliquer
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{monster.zone || "Zone inconnue"}</span>
                            </div>

                            {monster.type && (
                                <Badge variant="secondary" className="text-caption px-1.5 py-0 h-4 bg-elevated/80 border border-border text-foreground">
                                    {monster.type === "archimonstre" ? "Archi" : monster.type}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Exchange button for missing monsters */}
                    {isManquant && showExchangeButton && (
                        <div className={cn("mt-3 pt-3 border-t border-border", isSelectionMode && "pointer-events-none opacity-50")}>
                            <Button
                                variant={hasExchange ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "w-full h-8 text-xs gap-2",
                                    hasExchange && "bg-success hover:bg-success"
                                )}
                                onClick={handleFindExchanges}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : hasExchange ? (
                                    <Sparkles className="h-3 w-3" />
                                ) : (
                                    <Users className="h-3 w-3" />
                                )}
                                {hasExchange
                                    ? `${availableExchanges} guildeux peut échanger`
                                    : "Chercher un échange"
                                }
                                {showPartners ? (
                                    <ChevronUp className="h-3 w-3 ml-auto" />
                                ) : (
                                    <ChevronDown className="h-3 w-3 ml-auto" />
                                )}
                            </Button>

                            {/* Partners list */}
                            {showPartners && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 space-y-1"
                                >
                                    {partners.length === 0 ? (
                                        <p className="text-xs text-muted-foreground/60 italic text-center py-2">
                                            Aucun guildeux n&apos;a ce monstre en doublon
                                        </p>
                                    ) : (
                                        partners.slice(0, 4).map((partner) => (
                                            <div
                                                key={partner.username}
                                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted hover:bg-accent transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <Link href={`/dashboard/${guildId}/members/${encodeURIComponent(partner.slug || partner.profileId)}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                        <Avatar className="h-6 w-6 border border-border cursor-pointer hover:border-warning/50 transition-colors">
                                                            <AvatarImage src={partner.discordAvatar} />
                                                            <AvatarFallback className="text-caption bg-muted text-muted-foreground">
                                                                 {partner.characterName.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </Link>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <Link
                                                            href={`/dashboard/${guildId}/members/${encodeURIComponent(partner.slug || partner.profileId)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-medium text-warning truncate hover:underline cursor-pointer block"
                                                        >
                                                            {partner.characterName}
                                                        </Link>
                                                        <span className="text-caption text-muted-foreground truncate flex items-center gap-1">
                                                            <span className="opacity-50 shrink-0">Metamob:</span> <span className="truncate">{partner.username}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 shrink-0"
                                                            onClick={() => handleCopyMP(partner)}
                                                        >
                                                            {copiedUser === partner.username ? (
                                                                <Check className="h-3 w-3 text-success" />
                                                            ) : (
                                                                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left">Copier le MP</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        ))
                                    )}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* Doublon indicator */}
                    {monster.state === "DOUBLON" && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <Badge
                                variant="outline"
                                className="w-full justify-center bg-warning/10 text-warning border-warning/30"
                            >
                                Disponible pour échange
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
});
