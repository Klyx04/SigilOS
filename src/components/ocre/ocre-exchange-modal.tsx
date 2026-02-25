"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
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
    PackageOpen,
    Handshake,
    Bell
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { findOcreExchangePartners, getOcreExchangeJobStatus, createTradeRequest, type ExchangePartner } from "@/server/actions/ocre-actions";

interface OcreExchangeModalProps {
    guildId: string;
    hasOcreChannel?: boolean;
    trigger?: React.ReactNode;
}

export function OcreExchangeModal({ guildId, hasOcreChannel, trigger }: OcreExchangeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [partners, setPartners] = useState<ExchangePartner[]>([]);
    const [copiedUser, setCopiedUser] = useState<string | null>(null);

    // Trade Request State
    const [tradeRequest, setTradeRequest] = useState<{ targetProfileId: string; monsterId: number; targetName: string; monsterName: string; monsterImage?: string } | null>(null);
    const [tradeMessage, setTradeMessage] = useState("");
    const [sendDiscordPing, setSendDiscordPing] = useState(hasOcreChannel ?? false);
    const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);

    const fetchExchanges = async () => {
        setLoading(true);
        setProgress(0);
        try {
            const result = await findOcreExchangePartners({ guildId });
            if (result.success && result.data?.jobId) {
                const jobId = result.data.jobId;

                const pollInterval = setInterval(async () => {
                    try {
                        const statusResult = await getOcreExchangeJobStatus(jobId);
                        if (statusResult.success && statusResult.data) {
                            const { state, progress: jobProgress, result: jobResult } = statusResult.data;

                            if (typeof jobProgress === 'number') {
                                setProgress(jobProgress);
                            }

                            if (state === "completed" && jobResult) {
                                clearInterval(pollInterval);
                                const sorted = [...jobResult].sort((a, b) => b.matchScore - a.matchScore);
                                setPartners(sorted);
                                setLoading(false);
                            } else if (state === "failed") {
                                clearInterval(pollInterval);
                                toast.error(statusResult.error || "Le calcul a échoué");
                                setLoading(false);
                            }
                        } else {
                            clearInterval(pollInterval);
                            toast.error(statusResult.error || "Erreur lors du traitement asynchrone");
                            setLoading(false);
                        }
                    } catch (e) {
                        // Ignore occasional network errors during polling
                    }
                }, 1500);
            } else {
                toast.error(result.error || "Impossible d'initier la recherche");
                setLoading(false);
            }
        } catch (error) {
            toast.error("Erreur de connexion");
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

    const submitTradeRequest = async () => {
        if (!tradeRequest) return;
        setIsSubmittingTrade(true);
        try {
            const res = await createTradeRequest({
                guildId,
                targetProfileId: tradeRequest.targetProfileId,
                monsterId: tradeRequest.monsterId,
                monsterName: tradeRequest.monsterName,
                monsterImage: tradeRequest.monsterImage,
                message: tradeMessage,
                sendDiscordPing
            });
            if (res.success) {
                toast.success("Demande d'échange envoyée !");
                setTradeRequest(null);
                setTradeMessage("");
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        } catch (e) {
            toast.error("Erreur de connexion");
        } finally {
            setIsSubmittingTrade(false);
        }
    };

    // Aggregate by monster
    const monstersMap = new Map<number, {
        id: number;
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
                    id: monster.id,
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
            <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col bg-black/95 border-white/10 p-0 gap-0">
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
                        <div className="h-[400px] flex flex-col items-center justify-center gap-6 text-muted-foreground w-full max-w-sm mx-auto px-6">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-emerald-500/20 blur-xl rounded-full" />
                                <Loader2 className="h-10 w-10 animate-spin text-emerald-500 relative z-10" />
                            </div>
                            <div className="w-full space-y-2 text-center">
                                <p className="text-zinc-300 font-medium">Analyse méticuleuse des doublons de la guilde...</p>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs opacity-50">{progress}%</p>
                            </div>
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

                            <TabsContent value="monsters" className="mt-4 focus-visible:outline-none flex-1 overflow-hidden">
                                <ScrollArea className="h-[50vh] sm:h-[60vh] px-6 pb-6 rounded-md">
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
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:text-emerald-400"
                                                                    title="Envoyer une demande d'échange SigilOS"
                                                                    onClick={() => setTradeRequest({
                                                                        targetProfileId: provider.profileId,
                                                                        monsterId: monster.id,
                                                                        targetName: provider.name,
                                                                        monsterName: monster.name,
                                                                        monsterImage: monster.imageUrl,
                                                                    })}
                                                                >
                                                                    <Handshake className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:text-emerald-400"
                                                                    title="Copier le MP Discord"
                                                                    onClick={() => handleCopyMP(provider.metamobName, monster.name)}
                                                                >
                                                                    {copiedUser === provider.metamobName ? (
                                                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                                    ) : (
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="members" className="mt-4 focus-visible:outline-none flex-1 overflow-hidden">
                                <ScrollArea className="h-[50vh] sm:h-[60vh] px-6 pb-6 rounded-md">
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
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:text-emerald-400"
                                                                    title="Envoyer une demande d'échange SigilOS"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTradeRequest({
                                                                            targetProfileId: partner.profileId,
                                                                            monsterId: monster.id,
                                                                            targetName: partner.characterName,
                                                                            monsterName: monster.name,
                                                                            monsterImage: monster.imageUrl,
                                                                        });
                                                                    }}
                                                                >
                                                                    <Handshake className="h-3.5 w-3.5 text-zinc-400 hover:text-emerald-400" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:text-emerald-400"
                                                                    title="Copier le MP Discord"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCopyMP(partner.characterName, monster.name);
                                                                    }}
                                                                >
                                                                    {copiedUser === partner.characterName ? (
                                                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                                    ) : (
                                                                        <Copy className="h-3.5 w-3.5 text-zinc-400 hover:text-emerald-400" />
                                                                    )}
                                                                </Button>
                                                            </div>
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

            {/* Sub-Dialog for Trade Message */}
            {
                tradeRequest && (
                    <Dialog open={!!tradeRequest} onOpenChange={(open) => !open && setTradeRequest(null)}>
                        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Handshake className="h-5 w-5 text-emerald-500" />
                                    Demander un échange
                                </DialogTitle>
                                <DialogDescription>
                                    Proposer un échange à <strong className="text-emerald-400">{tradeRequest.targetName}</strong> pour <strong className="text-emerald-400">{tradeRequest.monsterName}</strong>.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <Textarea
                                    placeholder="Message optionnel (ex: Dispo ce soir 20h zaap astrub ? J'ai un Piou Vert en échange)"
                                    value={tradeMessage}
                                    onChange={(e) => setTradeMessage(e.target.value)}
                                    className="bg-black/50 border-white/10 resize-none h-24 text-sm"
                                    maxLength={500}
                                />
                                <div className="flex flex-row items-center justify-between rounded-lg border border-white/5 bg-black/40 p-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium flex items-center gap-2 text-zinc-300">
                                            <Bell className="h-4 w-4 text-emerald-400" />
                                            Mentionner sur Discord
                                        </Label>
                                        <p className="text-xs text-zinc-500">
                                            {hasOcreChannel
                                                ? "Envoie une notification dans le salon Ocre de la guilde."
                                                : "Configuration manquante. Demandez à un officier de configurer le salon Ocre."}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={sendDiscordPing}
                                        onCheckedChange={setSendDiscordPing}
                                        disabled={!hasOcreChannel}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setTradeRequest(null)} disabled={isSubmittingTrade}>
                                    Annuler
                                </Button>
                                <Button onClick={submitTradeRequest} disabled={isSubmittingTrade} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {isSubmittingTrade ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    Envoyer la demande
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )
            }
        </Dialog >
    );
}
