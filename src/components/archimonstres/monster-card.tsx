"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, Loader2, MapPin, User, Users, Sparkles } from "lucide-react";
import type { OcreMonster } from "@/lib/metamob-client";
import { findMonsterOwnersAction, type ExchangePartner } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MonsterCardProps {
    monster: OcreMonster;
    guildId: string;
    showOwners?: boolean;
    compact?: boolean;
    // Pre-computed number of available helpers (from doublonsMap)
    availableHelpers?: number;
    // Pre-loaded owners from parent (optional optimization)
    preloadedOwners?: ExchangePartner[];
}

export function MonsterCard({
    monster,
    guildId,
    showOwners = true,
    compact = false,
    availableHelpers = 0,
    preloadedOwners,
}: MonsterCardProps) {
    const [owners, setOwners] = useState<ExchangePartner[]>(preloadedOwners || []);
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
        const result = await findMonsterOwnersAction({ guildId, monsterId: monster.id });
        if (result.success && result.data) {
            setOwners(result.data);
        }
        setOwnersLoaded(true);
        setLoadingOwners(false);
    };

    const stateConfig: Record<string, { label: string; color: string; icon: string }> = {
        MANQUANT: {
            label: "Manquant",
            color: "bg-danger/10 text-danger border-danger/30",
            icon: "🔴",
        },
        POSSEDE: {
            label: "Possédé",
            color: "bg-success/10 text-success border-success/30",
            icon: "🟢",
        },
        DOUBLON: {
            label: "Doublon",
            color: "bg-warning/10 text-warning border-warning/30",
            icon: "🟡",
        },
    };

    const config = stateConfig[monster.state];
    const hasAvailableExchange = availableHelpers > 0;

    const handleCopyMP = (owner: ExchangePartner, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const message = `/w ${owner.characterName} Salut ! Tu aurais ${monster.name} en doublon à échanger ? :)`;
        navigator.clipboard.writeText(message);
        setCopiedPseudo(owner.username);
        toast.success("Message copié !");
        setTimeout(() => setCopiedPseudo(null), 2000);
    };

    if (compact) {
        return (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-card/50 border border-border/50">
                {monster.image && (
                    <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-black/20">
                        <Image
                            src={monster.image}
                            alt={monster.name}
                            fill
                            className="object-contain"
                            sizes="40px"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{monster.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{monster.zone}</p>
                </div>
                <Badge variant="outline" className={cn("shrink-0", config.color)}>
                    x{monster.owned}
                </Badge>
            </div>
        );
    }

    return (
        <Card className={cn(
            "overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-colors",
            hasAvailableExchange
                ? "border-success/50 hover:border-success/70 ring-1 ring-success/20"
                : "hover:border-primary/30"
        )}>
            <CardContent className="p-4">
                <div className="flex gap-4">
                    {/* Monster Image */}
                    {monster.image && (
                        <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-black/20 border border-border/30">
                            <Image
                                src={monster.image}
                                alt={monster.name}
                                fill
                                className="object-contain"
                                sizes="64px"
                            />
                            {/* Exchange available indicator */}
                            {hasAvailableExchange && (
                                <div className="absolute -top-1 -right-1 bg-success rounded-full p-0.5">
                                    <Sparkles className="h-3 w-3 text-foreground" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Monster Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm leading-tight line-clamp-2">
                                {monster.name}
                            </h3>
                            <Badge variant="outline" className={cn("shrink-0", config.color)}>
                                {config.icon} x{monster.owned}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{monster.zone}</span>
                            {monster.subzone && (
                                <span className="truncate text-muted-foreground/60">
                                    • {monster.subzone}
                                </span>
                            )}
                        </div>

                        {/* Exchange available badge */}
                        {hasAvailableExchange && !showOwnersSection && (
                            <Badge
                                variant="outline"
                                className="text-caption px-1.5 py-0 h-4 bg-success/10 text-success border-success/30"
                            >
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                {availableHelpers} membre{availableHelpers > 1 ? "s" : ""}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Find helpers button - only for MANQUANT monsters */}
                {showOwners && monster.state === "MANQUANT" && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                        {!showOwnersSection ? (
                            <Button
                                variant={hasAvailableExchange ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "w-full h-8 text-xs gap-2",
                                    hasAvailableExchange && "bg-success hover:bg-success"
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
                                            monsterName={monster.name}
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
                {monster.state === "DOUBLON" && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                        <Badge variant="outline" className="w-full justify-center bg-warning/10 text-warning border-warning/30">
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
    owner: ExchangePartner;
    guildId: string;
    monsterName: string;
    copiedPseudo: string | null;
    onCopy: (e: React.MouseEvent) => void;
}) {
    const isCopied = copiedPseudo === owner.username;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="group flex items-center gap-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-full px-2 py-0.5 transition-colors">
                    <Link
                        href={`/dashboard/${guildId}/members/${owner.profileId}`}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        <User className="h-3 w-3" />
                        {owner.characterName}
                    </Link>
                    <span className="text-caption text-primary/70">x{owner.monstersTheyHave[0]?.available || 1}</span>
                    <button
                        onClick={onCopy}
                        className="ml-0.5 p-0.5 rounded hover:bg-primary/30 transition-colors"
                    >
                        {isCopied ? (
                            <Check className="h-3 w-3 text-success" />
                        ) : (
                            <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                        )}
                    </button>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>Voir le profil de {owner.characterName}</p>
                <p className="text-xs text-muted-foreground">Cliquer sur 📋 pour copier le MP</p>
            </TooltipContent>
        </Tooltip>
    );
}
