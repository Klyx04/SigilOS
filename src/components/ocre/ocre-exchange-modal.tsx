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
    Bell,
    Search,
    Users
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
    const [monsterSearch, setMonsterSearch] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [hideOwned, setHideOwned] = useState(false);

    // Trade Request State
    const [tradeRequest, setTradeRequest] = useState<{ targetProfileId: string; monsterId: number; targetName: string; monsterName: string; monsterImage?: string } | null>(null);
    const [tradeMessage, setTradeMessage] = useState("");
    const [sendDiscordPing, setSendDiscordPing] = useState(hasOcreChannel ?? false);
    const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
    const [targetChannelName, setTargetChannelName] = useState<string>("commerce");

    useEffect(() => {
        if (hasOcreChannel && guildId) {
            import("@/server/actions/ocre-actions").then(m => {
                m.getOcrePublicConfig(guildId).then(res => {
                    if (res.success && res.data?.ocreNotifyChannelId) {
                        import("@/server/actions/discord-actions").then(d => {
                            d.getDiscordChannelInfo(guildId, res.data!.ocreNotifyChannelId!).then(chanRes => {
                                if (chanRes.success && chanRes.data) {
                                    setTargetChannelName(chanRes.data.name);
                                }
                            });
                        });
                    }
                });
            });
        }
    }, [hasOcreChannel, guildId]);

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
            // Apply search query filter if typed
            if (monsterSearch.trim()) {
                const q = monsterSearch.toLowerCase().trim();
                if (!monster.name.toLowerCase().includes(q)) {
                    return;
                }
            }

            // Apply hideOwned filter (#24)
            if (hideOwned && !monster.coversNeed) {
                return;
            }

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
                        <Sparkles className="h-4 w-4 text-success" />
                        Trouver des échanges
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] sm:h-[85vh] !flex flex-col bg-black/95 border-border p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 border-b border-border flex-shrink-0">
                    <div className="flex items-center justify-between mr-8">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-success" />
                                Place de Marché
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-1">
                                {totalMatches > 0
                                    ? `${totalMatches} archimonstres dispo dans la guilde (dont ${Array.from(monstersMap.values()).filter(m => m.coversNeed).length} que vous recherchez)`
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

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {loading && partners.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center gap-6 text-muted-foreground w-full max-w-sm mx-auto px-6">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-success/20 blur-xl rounded-full" />
                                <Loader2 className="h-10 w-10 animate-spin text-success relative z-10" />
                            </div>
                            <div className="w-full space-y-2 text-center">
                                <p className="text-foreground font-medium">Analyse méticuleuse des doublons de la guilde...</p>
                                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-success transition-all duration-300 ease-out"
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
                        <Tabs defaultValue="monsters" className="h-full flex flex-col flex-1 min-h-0">
                            <div className="px-4 sm:px-6 pt-4 flex flex-col gap-3 flex-shrink-0">
                                {/* Tabs + Search row */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                                    <TabsList className="grid w-full grid-cols-2 bg-background/80 border border-border p-1 rounded-xl shrink-0 sm:w-auto">
                                        <TabsTrigger 
                                            value="monsters" 
                                            className="rounded-lg font-black py-2 text-caption uppercase tracking-wider gap-1.5 transition-all duration-205 data-[state=active]:bg-success data-[state=active]:text-success-foreground text-muted-foreground"
                                        >
                                            <PackageOpen className="h-3.5 w-3.5 shrink-0" />
                                            <span>Par Monstre ({monstersList.length})</span>
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="members" 
                                            className="rounded-lg font-black py-2 text-caption uppercase tracking-wider gap-1.5 transition-all duration-205 data-[state=active]:bg-success data-[state=active]:text-success-foreground text-muted-foreground"
                                        >
                                            <Users className="h-3.5 w-3.5 shrink-0" />
                                            <span>Par Membre ({partners.filter(p => p.monstersTheyHave.some(m => (!monsterSearch.trim() || m.name.toLowerCase().includes(monsterSearch.toLowerCase().trim())) && (!hideOwned || m.coversNeed))).length})</span>
                                        </TabsTrigger>
                                    </TabsList>
                                    <div className="relative w-full group">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Search className="h-3.5 w-3.5 text-muted-foreground group-focus-within:text-success transition-colors" />
                                        </div>
                                        <Input
                                            value={monsterSearch}
                                            onChange={(e) => setMonsterSearch(e.target.value)}
                                            placeholder="RECHERCHER UN MONSTRE OU ARCHI..."
                                            className="pl-9 bg-surface/50 border-border h-9 text-caption font-black uppercase tracking-[0.1em] placeholder:text-muted-foreground focus:border-success/40 focus:ring-success/10 transition-all rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* Legend & Filter row (#24) */}
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface/50 backdrop-blur-md border border-border rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                            </span>
                                            <span className="font-bold text-success text-caption">Recherché</span>
                                            <span className="text-caption text-muted-foreground hidden xs:inline">(vous manque)</span>
                                        </div>
                                        <div className="w-px h-3 bg-border shrink-0" />
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-muted shrink-0" />
                                            <span className="font-bold text-muted-foreground text-caption">Possédé</span>
                                            <span className="text-caption text-muted-foreground hidden xs:inline">(déjà acquis)</span>
                                        </div>
                                    </div>

                                    {/* Quick Toggle Hide Owned (#24) */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={hideOwned}
                                            onChange={(e) => setHideOwned(e.target.checked)}
                                            className="rounded border-border text-success focus:ring-success/30 w-3.5 h-3.5 cursor-pointer accent-emerald-500"
                                        />
                                        <span className={cn("text-caption font-bold transition-colors", hideOwned ? "text-success" : "text-muted-foreground")}>
                                            Masquer les monstres déjà possédés
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <TabsContent value="monsters" className="mt-4 focus-visible:outline-none flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {monstersList.map((monster) => (
                                            <div
                                                key={monster.name}
                                                className={cn(
                                                    "border transition-all duration-200 rounded-xl p-3",
                                                    monster.coversNeed 
                                                        ? "bg-success/5 border-success/20 shadow-md shadow-emerald-950/10 hover:border-success/40" 
                                                        : "bg-surface/20 border-border/60 hover:border-border/60 opacity-75 hover:opacity-100"
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        {monster.imageUrl && (
                                                            <img
                                                                src={monster.imageUrl}
                                                                alt={monster.name}
                                                                className="w-8 h-8 object-contain shrink-0"
                                                            />
                                                        )}
                                                        <div className="flex flex-col">
                                                            <h4 className={cn("font-bold text-sm flex items-center gap-1.5", monster.coversNeed ? "text-success" : "text-muted-foreground")}>
                                                                {monster.name}
                                                                {monster.coversNeed && (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                                                                )}
                                                            </h4>
                                                            {monster.coversNeed && (
                                                                <span className="text-caption text-success font-bold uppercase tracking-wider">Recherché (vous manque)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-caption border-border bg-black/20 text-muted-foreground font-bold">
                                                        x{monster.providers.length}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1.5 mt-2">
                                                    {monster.providers.map((provider) => (
                                                        <div key={provider.name} className="flex items-center justify-between text-xs bg-background/80 border border-border p-1.5 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <Link href={`/dashboard/${guildId}/members/${provider.profileId}`} target="_blank" rel="noopener noreferrer">
                                                                    <Avatar className="h-5 w-5 border border-border cursor-pointer hover:border-warning/50 transition-colors">
                                                                        <AvatarImage src={provider.avatar} />
                                                                        <AvatarFallback className="text-caption bg-elevated text-muted-foreground font-bold">
                                                                            {provider.name.substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                </Link>
                                                                <div className="flex flex-col">
                                                                    <Link
                                                                        href={`/dashboard/${guildId}/members/${provider.profileId}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-foreground hover:text-warning font-semibold transition-colors cursor-pointer"
                                                                    >
                                                                        {provider.name} <span className="text-muted-foreground text-caption ml-1 font-normal">(x{provider.count})</span>
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:text-success"
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
                                                                    className="h-6 w-6 p-0 hover:text-success"
                                                                    title="Copier le MP Discord"
                                                                    onClick={() => handleCopyMP(provider.metamobName, monster.name)}
                                                                >
                                                                    {copiedUser === provider.metamobName ? (
                                                                        <Check className="h-3.5 w-3.5 text-success" />
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
                                </div>
                            </TabsContent>

                            <TabsContent value="members" className="mt-4 focus-visible:outline-none flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
                                    <div className="space-y-4">
                                        {partners
                                            .map(partner => ({
                                                ...partner,
                                                monstersTheyHave: partner.monstersTheyHave.filter(m => 
                                                    !monsterSearch.trim() || m.name.toLowerCase().includes(monsterSearch.toLowerCase().trim())
                                                )
                                            }))
                                            .filter(partner => partner.monstersTheyHave.length > 0)
                                            .map((partner) => (
                                                <div
                                                    key={partner.username}
                                                    className="bg-surface/40 border border-border rounded-xl p-4"
                                                >
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <Link href={`/dashboard/${guildId}/members/${partner.profileId}`} target="_blank" rel="noopener noreferrer">
                                                                <Avatar className="h-10 w-10 border border-border cursor-pointer hover:border-warning/50 transition-colors">
                                                                    <AvatarImage src={partner.discordAvatar} />
                                                                    <AvatarFallback className="bg-success/50 text-success font-bold">
                                                                        {partner.characterName[0].toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </Link>
                                                            <div>
                                                                <Link
                                                                    href={`/dashboard/${guildId}/members/${partner.profileId}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="font-bold text-sm text-foreground hover:text-warning hover:underline cursor-pointer transition-colors"
                                                                >
                                                                    {partner.characterName}
                                                                </Link>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs text-muted-foreground">
                                                                        propose {partner.monstersTheyHave.length} monstres
                                                                    </p>
                                                                    <span className="text-caption bg-elevated text-muted-foreground px-1.5 rounded font-semibold">
                                                                        {partner.username}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {partner.monstersTheyHave.map((monster) => (
                                                            <div
                                                                key={monster.id}
                                                                className={cn(
                                                                    "flex items-center justify-between text-xs p-2 rounded-lg border group cursor-pointer transition-all duration-200",
                                                                    monster.coversNeed
                                                                        ? "bg-success/10 border-success/30 text-success shadow-md shadow-emerald-950/20 hover:border-success/50"
                                                                        : "bg-surface/30 border-border/80 text-muted-foreground opacity-60 hover:opacity-100 hover:border-border"
                                                                )}
                                                                onClick={() => handleCopyMP(partner.characterName, monster.name)}
                                                            >
                                                                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                                                    {monster.imageUrl && (
                                                                        <img
                                                                            src={monster.imageUrl}
                                                                            alt={monster.name}
                                                                            className="w-6 h-6 object-contain shrink-0"
                                                                        />
                                                                    )}
                                                                    <span className={cn("truncate transition-colors", monster.coversNeed ? "text-success font-bold" : "text-muted-foreground")}>
                                                                        {monster.name}
                                                                    </span>
                                                                    {monster.coversNeed && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0 ml-auto" />
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 hover:text-success"
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
                                                                        <Handshake className="h-3.5 w-3.5 text-muted-foreground hover:text-success" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 hover:text-success"
                                                                        title="Copier le MP Discord"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCopyMP(partner.characterName, monster.name);
                                                                        }}
                                                                    >
                                                                        {copiedUser === partner.characterName ? (
                                                                            <Check className="h-3.5 w-3.5 text-success" />
                                                                        ) : (
                                                                            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-success" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </DialogContent>

            {/* Sub-Dialog for Trade Message */}
            {
                tradeRequest && (
                    <Dialog open={!!tradeRequest} onOpenChange={(open) => !open && setTradeRequest(null)}>
                        <DialogContent className="bg-background border-border sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Handshake className="h-5 w-5 text-success" />
                                    Demander un échange
                                </DialogTitle>
                                <DialogDescription>
                                    Proposer un échange à <strong className="text-success">{tradeRequest.targetName}</strong> pour <strong className="text-success">{tradeRequest.monsterName}</strong>.
                                </DialogDescription>
                            </DialogHeader>

                            {!hasOcreChannel && (
                                <div className="mt-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2.5">
                                    <Bell className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                    <div className="text-caption text-warning/80 leading-relaxed font-medium">
                                        <span className="text-warning font-bold block mb-0.5">Configuration Discord absente</span>
                                        Demandez à un officier de configurer le salon Ocre pour activer les notifications Discord.
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 py-2">
                                <Textarea
                                    placeholder="Message optionnel (ex: Dispo ce soir 20h zaap astrub ? J'ai un Piou Vert en échange)"
                                    value={tradeMessage}
                                    onChange={(e) => setTradeMessage(e.target.value)}
                                    className="bg-black/50 border-border resize-none h-24 text-sm"
                                    maxLength={500}
                                />
                                <div className="flex flex-row items-center justify-between rounded-lg border border-border bg-black/40 p-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium flex items-center gap-2 text-foreground">
                                            <Bell className="h-4 w-4 text-success" />
                                            Mentionner sur Discord
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {hasOcreChannel
                                                ? "Envoie l'annonce sur le serveur."
                                                : "Configuration manquante. Demandez à un officier de configurer le salon Ocre."}
                                        </p>
                                        {hasOcreChannel && sendDiscordPing && (
                                            <div className="flex items-center gap-1 mt-2 animate-in fade-in">
                                                <span className="text-caption text-success/90 font-bold uppercase tracking-widest">
                                                    Sera posté dans #{targetChannelName}
                                                </span>
                                            </div>
                                        )}
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
                                <Button onClick={submitTradeRequest} disabled={isSubmittingTrade} className="bg-success hover:bg-success text-success-foreground">
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
