"use client";

// =============================================================================
// OCRE MONSTER CARD - Premium glassmorphism card with exchange indicator
// =============================================================================

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, Loader2, MapPin, Sparkles, Users, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OcreMonster, MonsterState } from "@/lib/metamob-client";
import type { ExchangePartner } from "@/server/actions/ocre-actions";
import { toast } from "sonner";

interface OcreMonsterCardProps {
    monster: OcreMonster;
    guildId: string;
    availableExchanges?: number;
    showExchangeButton?: boolean;
    onFindExchanges?: () => Promise<ExchangePartner[]>;
}

const stateConfig: Record<MonsterState, { label: string; color: string; icon: string }> = {
    MANQUANT: {
        label: "Manquant",
        color: "bg-red-500/10 text-red-500 border-red-500/30",
        icon: "🔴",
    },
    POSSEDE: {
        label: "Possédé",
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        icon: "🟢",
    },
    DOUBLON: {
        label: "Doublon",
        color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        icon: "🟡",
    },
};

export function OcreMonsterCard({
    monster,
    guildId,
    availableExchanges = 0,
    showExchangeButton = true,
    onFindExchanges,
}: OcreMonsterCardProps) {
    const [showPartners, setShowPartners] = useState(false);
    const [loading, setLoading] = useState(false);
    const [partners, setPartners] = useState<ExchangePartner[]>([]);
    const [copiedUser, setCopiedUser] = useState<string | null>(null);

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

        setLoading(true);
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
            setLoading(false);
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
                    "backdrop-blur-xl bg-gradient-to-br from-card/50 to-card/30",
                    "border hover:scale-[1.02]",
                    hasExchange && isManquant
                        ? "border-emerald-500/50 hover:border-emerald-500/70 ring-1 ring-emerald-500/20"
                        : "border-white/10 hover:border-amber-500/30"
                )}
            >
                {/* Glow effect on hover */}
                <div
                    className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                        hasExchange && isManquant
                            ? "bg-gradient-to-br from-emerald-500/5 to-transparent"
                            : "bg-gradient-to-br from-amber-500/5 to-transparent"
                    )}
                />

                {/* Exchange available badge */}
                {hasExchange && isManquant && (
                    <div className="absolute -top-1 -right-1 z-10">
                        <Badge className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 animate-pulse">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            {availableExchanges}
                        </Badge>
                    </div>
                )}

                <CardContent className="relative z-10 p-4">
                    <div className="flex gap-3">
                        {/* Monster Image */}
                        {monster.image && (
                            <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-black/30 border border-white/10">
                                <Image
                                    src={monster.image}
                                    alt={monster.name}
                                    fill
                                    className="object-contain"
                                    sizes="56px"
                                />
                            </div>
                        )}

                        {/* Monster Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                    {monster.name}
                                </h3>
                                <Badge variant="outline" className={cn("shrink-0 text-xs", config.color)}>
                                    {config.icon} x{monster.owned}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{monster.zone || "Zone inconnue"}</span>
                            </div>

                            {monster.type && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {monster.type === "archimonstre" ? "Archi" : monster.type}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Exchange button for missing monsters */}
                    {isManquant && showExchangeButton && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <Button
                                variant={hasExchange ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "w-full h-8 text-xs gap-2",
                                    hasExchange && "bg-emerald-600 hover:bg-emerald-700"
                                )}
                                onClick={handleFindExchanges}
                                disabled={loading}
                            >
                                {loading ? (
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
                                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Link href={`/dashboard/${guildId}/members/${partner.profileId}`} target="_blank" rel="noopener noreferrer">
                                                        <Avatar className="h-6 w-6 border border-white/10 cursor-pointer hover:border-amber-500/50 transition-colors">
                                                            <AvatarImage src={partner.discordAvatar} />
                                                            <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
                                                                {partner.characterName.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </Link>
                                                    <div className="flex flex-col min-w-0">
                                                        <Link
                                                            href={`/dashboard/${guildId}/members/${partner.profileId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-medium text-amber-400 truncate hover:underline cursor-pointer"
                                                        >
                                                            {partner.characterName}
                                                        </Link>
                                                        <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                                            <span className="opacity-50">Metamob:</span> {partner.username}
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
                                                                <Check className="h-3 w-3 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3 text-muted-foreground hover:text-white" />
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
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <Badge
                                variant="outline"
                                className="w-full justify-center bg-amber-500/10 text-amber-500 border-amber-500/30"
                            >
                                Disponible pour échange
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
