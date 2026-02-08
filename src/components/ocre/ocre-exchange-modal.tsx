"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    RefreshCw,
    Sparkles,
    Copy,
    Check,
    PackageOpen
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { findOcreExchangePartners, type ExchangePartner } from "@/server/actions/ocre-actions";

interface OcreExchangeModalProps {
    guildId: string;
    trigger?: React.ReactNode;
}

export function OcreExchangeModal({ guildId, trigger }: OcreExchangeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [partners, setPartners] = useState<ExchangePartner[]>([]);
    const [copiedUser, setCopiedUser] = useState<string | null>(null);

    const fetchExchanges = async () => {
        setLoading(true);
        try {
            const result = await findOcreExchangePartners({ guildId });
            if (result.success && result.data) {
                // Sort by match score (descending)
                const sorted = [...result.data].sort((a, b) => b.matchScore - a.matchScore);
                setPartners(sorted);
            } else {
                toast.error(result.error || "Impossible de charger les échanges");
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchExchanges();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCopyMP = (partnerName: string, monsterName: string) => {
        const message = `/w ${partnerName} Salut ! Tu aurais ${monsterName} en doublon à échanger ? :)`;
        navigator.clipboard.writeText(message);
        setCopiedUser(partnerName);
        toast.success("Message copié !");
        setTimeout(() => setCopiedUser(null), 2000);
    };

    // Aggregate by monster
    const monstersMap = new Map<number, {
        name: string;
        imageUrl?: string;
        coversNeed: boolean;
        providers: {
            name: string;
            count: number;
            avatar?: string;
            profileId: string;
            metamobName: string;
        }[]
    }>();
    let neededCount = 0;

    partners.forEach(partner => {
        partner.monstersTheyHave.forEach(monster => {
            if (!monstersMap.has(monster.id)) {
                monstersMap.set(monster.id, {
                    name: monster.name,
                    imageUrl: monster.imageUrl,
                    coversNeed: monster.coversNeed,
                    providers: []
                });
            }
            monstersMap.get(monster.id)?.providers.push({
                name: partner.characterName,
                count: monster.available,
                avatar: partner.discordAvatar,
                profileId: partner.profileId,
                metamobName: partner.username
            });
            if (monster.coversNeed) neededCount++;
        });
    });

    const monstersList = Array.from(monstersMap.values()).sort((a, b) => {
        // Sort by Needed first, then Name
        if (a.coversNeed && !b.coversNeed) return -1;
        if (!a.coversNeed && b.coversNeed) return 1;
        return a.name.localeCompare(b.name);
    });

    const totalMatches = partners.reduce((acc, p) => acc + p.monstersTheyHave.length, 0);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        Trouver des échanges
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col bg-black/95 border-white/10 p-0 gap-0">
                <DialogHeader className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between mr-8">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-emerald-400" />
                                Place de Marché
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 mt-1">
                                {totalMatches > 0
                                    ? `${totalMatches} archimontres dispo dans la guilde (dont ${monstersList.filter(m => m.coversNeed).length} que vous recherchez)`
                                    : "Recherche de correspondances dans la guilde..."}
                            </DialogDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={fetchExchanges}
                            disabled={loading}
                            className="shrink-0"
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {loading && partners.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            <p>Analyse des doublons de la guilde...</p>
                        </div>
                    ) : partners.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 text-center">
                            <PackageOpen className="h-12 w-12 opacity-20" />
                            <p>Aucun échange trouvé pour le moment.</p>
                            <p className="text-sm opacity-60">
                                Assurez-vous que vos guildeux ont mis à jour leur Metamob !
                            </p>
                        </div>
                    ) : (
                        <Tabs defaultValue="monsters" className="h-full flex flex-col">
                            <div className="px-6 pt-4">
                                <TabsList className="grid w-full grid-cols-2 bg-white/5">
                                    <TabsTrigger value="monsters">Par Monstre ({monstersList.length})</TabsTrigger>
                                    <TabsTrigger value="members">Par Membre ({partners.length})</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="monsters" className="mt-4 focus-visible:outline-none">
                                <ScrollArea className="h-[60vh] px-6 pb-6 rounded-md">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {monstersList.map((monster) => (
                                            <div
                                                key={monster.name}
                                                className={cn(
                                                    "border border-white/5 rounded-lg p-3 transition-colors",
                                                    monster.coversNeed ? "bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40" : "bg-zinc-900/50 hover:border-white/10"
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        {monster.imageUrl && (
                                                            <img
                                                                src={monster.imageUrl}
                                                                alt={monster.name}
                                                                className="w-8 h-8 object-contain"
                                                            />
                                                        )}
                                                        <div className="flex flex-col">
                                                            <h4 className={cn("font-semibold text-sm", monster.coversNeed ? "text-emerald-300" : "text-zinc-300")}>
                                                                {monster.name}
                                                            </h4>
                                                            {monster.coversNeed && (
                                                                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Recherché</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] border-white/10 bg-black/20 text-zinc-400">
                                                        x{monster.providers.length}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1.5 mt-2">
                                                    {monster.providers.map((provider) => (
                                                        <div key={provider.name} className="flex items-center justify-between text-xs bg-black/40 p-1.5 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <Link href={`/dashboard/${guildId}/members/${provider.profileId}`} target="_blank" rel="noopener noreferrer">
                                                                    <Avatar className="h-5 w-5 border border-white/10 cursor-pointer hover:border-amber-500/50 transition-colors">
                                                                        <AvatarImage src={provider.avatar} />
                                                                        <AvatarFallback className="text-[8px] bg-zinc-800 text-zinc-400">
                                                                            {provider.name.substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                </Link>
                                                                <div className="flex flex-col">
                                                                    <Link
                                                                        href={`/dashboard/${guildId}/members/${provider.profileId}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer"
                                                                    >
                                                                        {provider.name} <span className="text-zinc-500 text-[10px] ml-1">(x{provider.count})</span>
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0 hover:text-emerald-400"
                                                                onClick={() => handleCopyMP(provider.metamobName, monster.name)}
                                                            >
                                                                {copiedUser === provider.metamobName ? (
                                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                                ) : (
                                                                    <Copy className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="members" className="mt-4 focus-visible:outline-none">
                                <ScrollArea className="h-[60vh] px-6 pb-6 rounded-md">
                                    <div className="space-y-4">
                                        {partners.map((partner) => (
                                            <div
                                                key={partner.username}
                                                className="bg-zinc-900/50 border border-white/5 rounded-xl p-4"
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <Link href={`/dashboard/${guildId}/members/${partner.profileId}`} target="_blank" rel="noopener noreferrer">
                                                            <Avatar className="h-10 w-10 border border-white/10 cursor-pointer hover:border-amber-500/50 transition-colors">
                                                                <AvatarImage src={partner.discordAvatar} />
                                                                <AvatarFallback className="bg-emerald-900/50 text-emerald-200">
                                                                    {partner.characterName[0].toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </Link>
                                                        <div>
                                                            <Link
                                                                href={`/dashboard/${guildId}/members/${partner.profileId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-bold text-sm text-zinc-100 hover:text-amber-400 hover:underline cursor-pointer transition-colors"
                                                            >
                                                                {partner.characterName}
                                                            </Link>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs text-zinc-500">
                                                                    propose {partner.monstersTheyHave.length} monstres
                                                                </p>
                                                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
                                                                    {partner.username}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {partner.monstersTheyHave.map((monster) => (
                                                        <div
                                                            key={monster.id}
                                                            className={cn(
                                                                "flex items-center justify-between text-xs p-2 rounded border group cursor-pointer transition-all",
                                                                monster.coversNeed
                                                                    ? "bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-500/50"
                                                                    : "bg-black/40 border-white/5 hover:border-white/10"
                                                            )}
                                                            onClick={() => handleCopyMP(partner.characterName, monster.name)}
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                {monster.imageUrl && (
                                                                    <img
                                                                        src={monster.imageUrl}
                                                                        alt={monster.name}
                                                                        className="w-6 h-6 object-contain"
                                                                    />
                                                                )}
                                                                <span className={cn("truncate transition-colors", monster.coversNeed ? "text-emerald-200" : "text-zinc-400")}>
                                                                    {monster.name}
                                                                </span>
                                                            </div>
                                                            <Copy className={cn("h-3 w-3 transition-opacity", monster.coversNeed ? "text-emerald-500" : "opacity-0 group-hover:opacity-100 text-zinc-500")} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    );
}
