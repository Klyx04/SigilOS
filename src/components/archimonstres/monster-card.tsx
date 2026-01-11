"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, Loader2, MapPin, User, Users, Sparkles } from "lucide-react";
import type { MetamobMonster, MonsterOwner } from "@/lib/metamob-api";
import { findExchangePartners } from "@/server/actions/metamob-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MonsterCardProps {
    monster: MetamobMonster;
    guildId: string;
    showOwners?: boolean;
    compact?: boolean;
    // Pre-computed number of available helpers (from doublonsMap)
    availableHelpers?: number;
    // Pre-loaded owners from parent (optional optimization)
    preloadedOwners?: MonsterOwner[];
}

export function MonsterCard({
    monster,
    guildId,
    showOwners = true,
    compact = false,
    availableHelpers = 0,
    preloadedOwners,
}: MonsterCardProps) {
    const [owners, setOwners] = useState<MonsterOwner[]>(preloadedOwners || []);
    const [loadingOwners, setLoadingOwners] = useState(false);
    const [ownersLoaded, setOwnersLoaded] = useState(!!preloadedOwners);
    const [showOwnersSection, setShowOwnersSection] = useState(false);
    const [copiedPseudo, setCopiedPseudo] = useState<string | null>(null);

    // Load owners on demand (not auto!)
    const loadOwners = async () => {
        if (ownersLoaded) {
            setShowOwnersSection(!showOwnersSection);
            return;
        }

        setLoadingOwners(true);
        setShowOwnersSection(true);
        const result = await findExchangePartners({ guildId, monsterId: monster.id });
        if (result.success && result.data) {
            setOwners(result.data);
        }
        setOwnersLoaded(true);
        setLoadingOwners(false);
    };

    const stateConfig = {
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

    const config = stateConfig[monster.etat];
    const hasAvailableExchange = availableHelpers > 0;

    const handleCopyMP = (owner: MonsterOwner, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const message = `/w ${owner.displayName} Salut ! Tu aurais ${monster.nom} en doublon à échanger ? :)`;
        navigator.clipboard.writeText(message);
        setCopiedPseudo(owner.metamobPseudo);
        toast.success("Message copié !");
        setTimeout(() => setCopiedPseudo(null), 2000);
    };

    if (compact) {
        return (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-card/50 border border-border/50">
                {monster.imageUrl && (
                    <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-black/20">
                        <Image
                            src={monster.imageUrl}
                            alt={monster.nom}
                            fill
                            className="object-contain"
                            sizes="40px"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{monster.nom}</p>
                    <p className="text-xs text-muted-foreground truncate">{monster.zone}</p>
                </div>
                <Badge variant="outline" className={cn("shrink-0", config.color)}>
                    x{monster.quantite}
                </Badge>
            </div>
        );
    }

    return (
        <Card className={cn(
            "overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-colors",
            hasAvailableExchange
                ? "border-emerald-500/50 hover:border-emerald-500/70 ring-1 ring-emerald-500/20"
                : "hover:border-primary/30"
        )}>
            <CardContent className="p-4">
                <div className="flex gap-4">
                    {/* Monster Image */}
                    {monster.imageUrl && (
                        <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-black/20 border border-border/30">
                            <Image
                                src={monster.imageUrl}
                                alt={monster.nom}
                                fill
                                className="object-contain"
                                sizes="64px"
                            />
                            {/* Exchange available indicator */}
                            {hasAvailableExchange && (
                                <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                                    <Sparkles className="h-3 w-3 text-white" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Monster Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                {monster.nom}
                            </h3>
                            <Badge variant="outline" className={cn("shrink-0", config.color)}>
                                {config.icon} x{monster.quantite}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{monster.zone}</span>
                            {monster.souszone && (
                                <span className="truncate text-muted-foreground/60">
                                    • {monster.souszone}
                                </span>
                            )}
                        </div>

                        {/* Exchange available badge */}
                        {hasAvailableExchange && !showOwnersSection && (
                            <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            >
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                {availableHelpers} membre{availableHelpers > 1 ? "s" : ""}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Find helpers button - only for MANQUANT monsters */}
                {showOwners && monster.etat === "MANQUANT" && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                        {!showOwnersSection ? (
                            <Button
                                variant={hasAvailableExchange ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "w-full h-8 text-xs gap-2",
                                    hasAvailableExchange && "bg-emerald-600 hover:bg-emerald-700"
                                )}
                                onClick={loadOwners}
                                disabled={loadingOwners}
                            >
                                {loadingOwners ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : hasAvailableExchange ? (
                                    <Sparkles className="h-3 w-3" />
                                ) : (
                                    <Users className="h-3 w-3" />
                                )}
                                {hasAvailableExchange
                                    ? `${availableHelpers} peut échanger !`
                                    : "Qui peut m'aider ?"
                                }
                            </Button>
                        ) : loadingOwners ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Recherche...
                            </div>
                        ) : owners.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic text-center py-1">
                                Aucun membre n&apos;a ce monstre en doublon
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                        {owners.length} membre{owners.length > 1 ? "s" : ""} :
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-muted-foreground"
                                        onClick={() => setShowOwnersSection(false)}
                                    >
                                        Masquer
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {owners.slice(0, 4).map((owner) => (
                                        <OwnerBadge
                                            key={owner.profileId}
                                            owner={owner}
                                            guildId={guildId}
                                            monsterName={monster.nom}
                                            copiedPseudo={copiedPseudo}
                                            onCopy={(e) => handleCopyMP(owner, e)}
                                        />
                                    ))}
                                    {owners.length > 4 && (
                                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                                            +{owners.length - 4}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Propose indicator for DOUBLON */}
                {monster.etat === "DOUBLON" && monster.propose && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                        <Badge variant="outline" className="w-full justify-center bg-amber-500/10 text-amber-500 border-amber-500/30">
                            Proposé à l&apos;échange sur Metamob
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Owner Badge Component - Clickable badge linking to member profile
// -----------------------------------------------------------------------------

function OwnerBadge({
    owner,
    guildId,
    monsterName,
    copiedPseudo,
    onCopy,
}: {
    owner: MonsterOwner;
    guildId: string;
    monsterName: string;
    copiedPseudo: string | null;
    onCopy: (e: React.MouseEvent) => void;
}) {
    const isCopied = copiedPseudo === owner.metamobPseudo;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="group flex items-center gap-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-full px-2 py-0.5 transition-colors">
                    <Link
                        href={`/dashboard/${guildId}/members/${owner.profileId}`}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        <User className="h-3 w-3" />
                        {owner.displayName}
                    </Link>
                    <span className="text-[10px] text-primary/70">x{owner.quantite}</span>
                    <button
                        onClick={onCopy}
                        className="ml-0.5 p-0.5 rounded hover:bg-primary/30 transition-colors"
                    >
                        {isCopied ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                            <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                        )}
                    </button>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>Voir le profil de {owner.displayName}</p>
                <p className="text-xs text-muted-foreground">Cliquer sur 📋 pour copier le MP</p>
            </TooltipContent>
        </Tooltip>
    );
}
