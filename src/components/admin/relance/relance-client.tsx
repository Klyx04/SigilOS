"use client";

import { useState } from "react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    Bell, 
    Users, 
    MessageSquare, 
    History as HistoryIcon, 
    Search, 
    Send,
    CheckCircle2,
    Target,
    Shield,
    ArrowDown,
    Info,
    Check,
    PlusSquare,
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
    getRelanceCandidates, 
    sendRelance 
} from "@/server/actions/relance-actions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RelanceClientProps {
    guildId: string;
    channels: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string; color: number }>;
    initialHistory: any[];
}

export function RelanceClient({ guildId, channels, roles, initialHistory }: RelanceClientProps) {
    const [activeTab, setActiveTab] = useState("new");
    const [criteria, setCriteria] = useState<"MISSING_MISSIONS" | "INACTIVE" | "LADDER_INACTIVE" | "DOFUS_INACTIVE" | "DISCORD_INACTIVE" | "GLOBAL_INACTIVE">("MISSING_MISSIONS");
    const [inactiveDays, setInactiveDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [relanceType, setRelanceType] = useState<"DM" | "CHANNEL">("DM");
    const [channelId, setChannelId] = useState<string>("");
    const [openChannel, setOpenChannel] = useState(false);
    const [openAddRole, setOpenAddRole] = useState(false);
    const [openRemoveRole, setOpenRemoveRole] = useState(false);
    const [message, setMessage] = useState("Bonjour ! Il semble que tu n'aies pas encore validé de missions cette semaine. N'oublie pas de participer pour aider la guilde ! 🚀");
    const [addRoleId, setAddRoleId] = useState<string>("");
    const [removeRoleId, setRemoveRoleId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    const templates = {
        MISSING_MISSIONS: "Bonjour ! Il semble que tu n'aies pas encore validé de missions cette semaine. N'oublie pas de participer pour aider la guilde ! 🚀",
        INACTIVE: "Hello ! On ne t'a pas vu sur le dashboard depuis un petit moment. Passe faire un tour pour voir les nouveautés et les missions en cours ! 😉",
        LADDER_INACTIVE: "Hello ! On a remarqué que tu n'as pas gagné d'expérience en jeu (Ladder bloqué) depuis un moment. Fais-nous signe si tu fais une pause Dofus ! ⚔️",
        DOFUS_INACTIVE: "Hello ! Petite relance pour le point absence/activité en jeu : peux-tu mettre à jour ton statut sur le dashboard SigilOS ? Ça nous aide énormément pour l'organisation des raids et sorties ! Merci d'avance ⚔️",
        DISCORD_INACTIVE: "Hey ! On a remarqué que tu étais très discret sur Discord ces derniers temps (vocal et écrit). Hésite pas à passer nous faire un coucou, on aime bien savoir que tout va bien ! 👋",
        GLOBAL_INACTIVE: "Attention ! Tu sembles totalement inactif sur tous nos supports (Dofus, Discord et Dashboard). Merci de nous tenir au courant de ton état de jeu pour éviter un archivage automatique. 🚩"
    };

    const handleCriteriaChange = (v: "MISSING_MISSIONS" | "INACTIVE" | "LADDER_INACTIVE" | "DOFUS_INACTIVE" | "DISCORD_INACTIVE" | "GLOBAL_INACTIVE") => {
        setCriteria(v);
        setMessage(templates[v]);
        setCandidates([]);
        setSelectedUsers([]);
    };

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const res = await getRelanceCandidates(guildId, criteria, inactiveDays);
            if (res.success) {
                setCandidates(res.data || []);
                setSelectedUsers(res.data?.map((u: any) => u.discordId) || []);
                toast.success(`${res.data?.length || 0} membres trouvés`);
            } else {
                toast.error(res.error || "Erreur inconnue");
            }
        } catch (error) {
            toast.error("Impossible de charger les candidats");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (selectedUsers.length === 0) {
            toast.error("Sélectionnez au moins un membre");
            return;
        }
        if (!message) {
            toast.error("Le message est vide");
            return;
        }

        setLoading(true);
        try {
            const res = await sendRelance({
                guildId,
                targetUserIds: selectedUsers,
                type: relanceType,
                message,
                channelId: (relanceType === "CHANNEL") ? channelId : undefined,
                addRoleId: (addRoleId && addRoleId !== "none") ? addRoleId : undefined,
                removeRoleId: (removeRoleId && removeRoleId !== "none") ? removeRoleId : undefined,
                criteria: criteria
            });

            if (res.success) {
                toast.success(res.data?.message || "Relance envoyée avec succès !");
                setCandidates([]);
                setSelectedUsers([]);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Échec de l'envoi");
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const filteredCandidates = candidates.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <TabsList className="bg-zinc-900 border border-white/5 p-1 shrink-0">
                    <TabsTrigger value="new" className="data-[state=active]:bg-zinc-800 gap-2">
                        <PlusSquare className="w-4 h-4" /> Nouvelle Relance
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-zinc-800 gap-2">
                        <HistoryIcon className="w-4 h-4" /> Historique
                    </TabsTrigger>
                </TabsList>
                
                {activeTab === "new" && (
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 animate-pulse">
                            Module Admin
                        </Badge>
                    </div>
                )}
            </div>

            <TabsContent value="new" className="space-y-6 focus-visible:outline-none">
                <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-400 py-3">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="text-xs font-black uppercase tracking-wider">Comment ça marche ?</AlertTitle>
                    <AlertDescription className="text-xs font-medium text-zinc-400 mt-1">
                        1. Choisissez un critère et lancez l'analyse • 2. <span className="text-white font-bold">Sélectionnez manuellement les membres</span> dans la liste qui s'affiche en bas • 3. Paramétrez le message et envoyez.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="bg-zinc-950 border-white/5 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="border-b border-white/5 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Target className="w-4 h-4 text-violet-400" /> 1. Cibler les membres
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { 
                                        id: "MISSING_MISSIONS", 
                                        label: "Missions (Semaine)", 
                                        desc: "Ceux qui n'ont rien validé depuis mardi 7h.",
                                        icon: <Target className="w-4 h-4 text-violet-400" /> 
                                    },
                                    { 
                                        id: "INACTIVE", 
                                        label: "Inactivité Dashboard", 
                                        desc: `Pas vu sur le site depuis ${inactiveDays} jours.`,
                                        icon: <HistoryIcon className="w-4 h-4 text-orange-400" /> 
                                    },
                                    { 
                                        id: "LADDER_INACTIVE", 
                                        label: "Inactivité IG (Ladder)", 
                                        desc: `Pas vu en jeu depuis ${inactiveDays} jours.`,
                                        icon: <Target className="w-4 h-4 text-yellow-400" /> 
                                    },
                                    { 
                                        id: "DISCORD_INACTIVE", 
                                        label: "Silence Discord", 
                                        desc: "Aucune trace écrite ou vocale cette semaine.",
                                        icon: <MessageSquare className="w-4 h-4 text-sky-400" /> 
                                    },
                                    { 
                                        id: "GLOBAL_INACTIVE", 
                                        label: "Fantôme Global", 
                                        desc: "0 mission + 0 site + 0 discord. Le néant.",
                                        icon: <Bell className="w-4 h-4 text-rose-500 animate-pulse" /> 
                                    },
                                    { 
                                        id: "DOFUS_INACTIVE", 
                                        label: "Absence (Manuel)", 
                                        desc: "Cible tout le monde pour un tri manuel.",
                                        icon: <Users className="w-4 h-4 text-emerald-400" /> 
                                    }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleCriteriaChange(item.id as any)}
                                        className={cn(
                                            "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-200 group/item relative overflow-hidden",
                                            criteria === item.id 
                                                ? "bg-violet-500/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)] ring-1 ring-violet-500/20" 
                                                : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.icon}
                                            <span className={cn(
                                                "text-[11px] font-black uppercase tracking-wider",
                                                criteria === item.id ? "text-white" : "text-zinc-400 group-hover/item:text-zinc-200"
                                            )}>
                                                {item.label}
                                            </span>
                                            {criteria === item.id && (
                                                <div className="ml-auto bg-violet-500 rounded-full p-0.5 animate-in zoom-in duration-300">
                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-medium text-zinc-500 pl-6 leading-tight">
                                            {item.desc}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {(criteria === "INACTIVE" || criteria === "LADDER_INACTIVE") && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Jours d'inactivité</Label>
                                    <Input 
                                        type="number" 
                                        value={inactiveDays} 
                                        onChange={(e) => setInactiveDays(parseInt(e.target.value))}
                                        className="bg-white/5 border-white/10"
                                        min={1}
                                    />
                                </div>
                            )}

                            <Button 
                                onClick={fetchCandidates} 
                                disabled={loading}
                                className="w-full h-11 bg-violet-600 hover:bg-violet-700 font-black gap-2 transition-all active:scale-95 shadow-[0_4px_15px_rgba(124,58,237,0.2)]"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Analyser la guilde
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950 border-white/5 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="border-b border-white/5 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-emerald-400" /> 2. Personnaliser
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Type d'envoi</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["DM", "CHANNEL"] as const).map(t => (
                                        <Button
                                            key={t}
                                            variant={relanceType === t ? "default" : "outline"}
                                            className={cn(
                                                "h-10 text-[10px] font-black transition-all",
                                                relanceType === t 
                                                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.2)]" 
                                                    : "bg-white/5 border-white/10 hover:bg-white/10"
                                            )}
                                            onClick={() => setRelanceType(t)}
                                        >
                                            {t === "DM" ? "Message Privé (DM)" : "Salon Discord"}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                             {(relanceType === "CHANNEL") && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Salon Discord</Label>
                                    <Popover open={openChannel} onOpenChange={setOpenChannel}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openChannel}
                                                className="w-full justify-between bg-white/5 border-white/10 font-bold h-11"
                                            >
                                                <span className="truncate">
                                                    {channelId
                                                        ? `# ${channels.find((c) => c.id === channelId)?.name}`
                                                        : "# Choisir un salon..."}
                                                </span>
                                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-zinc-900 border-zinc-800 text-white shadow-2xl">
                                            <Command className="bg-zinc-900">
                                                <CommandInput placeholder="Chercher un salon..." className="text-white border-none focus:ring-0" />
                                                <CommandList>
                                                    <CommandEmpty className="py-6 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">Aucun salon trouvé.</CommandEmpty>
                                                    <CommandGroup>
                                                        {channels.map((c) => (
                                                            <CommandItem
                                                                key={c.id}
                                                                value={c.name}
                                                                onSelect={() => {
                                                                    setChannelId(c.id);
                                                                    setOpenChannel(false);
                                                                }}
                                                                className="hover:bg-zinc-800 cursor-pointer text-white flex items-center gap-2 p-2 mx-1 rounded-md transition-colors"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4 text-emerald-500",
                                                                        channelId === c.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <span className="font-bold underline decoration-zinc-800 underline-offset-4 decoration-2"># {c.name}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Contenu du message</Label>
                                <textarea
                                    className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-md p-3 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Écrivez votre message..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950 border-white/5 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="border-b border-white/5 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Shield className="w-4 h-4 text-rose-400" /> 3. Actions Discord
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Ajouter un rôle</Label>
                                <Popover open={openAddRole} onOpenChange={setOpenAddRole}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openAddRole}
                                            className="w-full justify-between bg-white/5 border-white/10 font-bold h-11"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {addRoleId && addRoleId !== "none" ? (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${roles.find(r => r.id === addRoleId)?.color.toString(16).padStart(6, '0')}` }} />
                                                        <span className="truncate">{roles.find(r => r.id === addRoleId)?.name}</span>
                                                    </>
                                                ) : "Aucun changement"}
                                            </div>
                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-zinc-900 border-zinc-800 text-white shadow-2xl">
                                        <Command className="bg-zinc-900">
                                            <CommandInput placeholder="Chercher un rôle..." className="text-white border-none focus:ring-0" />
                                            <CommandList>
                                                <CommandEmpty className="py-6 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">Aucun rôle trouvé.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setAddRoleId("none");
                                                            setOpenAddRole(false);
                                                        }}
                                                        className="hover:bg-zinc-800 cursor-pointer text-white flex items-center gap-2 p-2 mx-1 rounded-md"
                                                    >
                                                        <Check className={cn("h-4 w-4 text-emerald-500", addRoleId === "none" || !addRoleId ? "opacity-100" : "opacity-0")} />
                                                        <span className="font-bold opacity-50">Aucun changement</span>
                                                    </CommandItem>
                                                    {roles.map((r) => (
                                                        <CommandItem
                                                            key={r.id}
                                                            value={r.name}
                                                            onSelect={() => {
                                                                setAddRoleId(r.id);
                                                                setOpenAddRole(false);
                                                            }}
                                                            className="hover:bg-zinc-800 cursor-pointer text-white flex items-center gap-2 p-2 mx-1 rounded-md"
                                                        >
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Check className={cn("h-4 w-4 text-emerald-500 shrink-0", addRoleId === r.id ? "opacity-100" : "opacity-0")} />
                                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                                                                <span className="truncate font-bold tracking-tight">{r.name}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retirer un rôle</Label>
                                <Popover open={openRemoveRole} onOpenChange={setOpenRemoveRole}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openRemoveRole}
                                            className="w-full justify-between bg-white/5 border-white/10 font-bold h-11"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {removeRoleId && removeRoleId !== "none" ? (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `#${roles.find(r => r.id === removeRoleId)?.color.toString(16).padStart(6, '0')}` }} />
                                                        <span className="truncate">{roles.find(r => r.id === removeRoleId)?.name}</span>
                                                    </>
                                                ) : "Aucun changement"}
                                            </div>
                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-zinc-900 border-zinc-800 text-white shadow-2xl">
                                        <Command className="bg-zinc-900">
                                            <CommandInput placeholder="Chercher un rôle..." className="text-white border-none focus:ring-0" />
                                            <CommandList>
                                                <CommandEmpty className="py-6 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">Aucun rôle trouvé.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            setRemoveRoleId("none");
                                                            setOpenRemoveRole(false);
                                                        }}
                                                        className="hover:bg-zinc-800 cursor-pointer text-white flex items-center gap-2 p-2 mx-1 rounded-md"
                                                    >
                                                        <Check className={cn("h-4 w-4 text-rose-500", removeRoleId === "none" || !removeRoleId ? "opacity-100" : "opacity-0")} />
                                                        <span className="font-bold opacity-50">Aucun changement</span>
                                                    </CommandItem>
                                                    {roles.map((r) => (
                                                        <CommandItem
                                                            key={r.id}
                                                            value={r.name}
                                                            onSelect={() => {
                                                                setRemoveRoleId(r.id);
                                                                setOpenRemoveRole(false);
                                                            }}
                                                            className="hover:bg-zinc-800 cursor-pointer text-white flex items-center gap-2 p-2 mx-1 rounded-md"
                                                        >
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Check className={cn("h-4 w-4 text-rose-500 shrink-0", removeRoleId === r.id ? "opacity-100" : "opacity-0")} />
                                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                                                                <span className="truncate font-bold tracking-tight">{r.name}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                             <div className="pt-4 space-y-4">
                                {candidates.length > 0 && selectedUsers.length === 0 && (
                                    <div className="flex flex-col items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-bounce active:scale-95 transition-transform">
                                        <ArrowDown className="w-4 h-4 text-rose-500" />
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Sélectionnez les membres ci-dessous</span>
                                    </div>
                                )}
                                <Button 
                                    onClick={handleSend} 
                                    disabled={loading || selectedUsers.length === 0}
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95 transition-all text-white disabled:opacity-50 disabled:bg-zinc-800 disabled:border-white/5"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                                    Lancer la Relance ({selectedUsers.length})
                                </Button>
                                <p className="text-[10px] text-zinc-600 text-center mt-3 font-bold uppercase tracking-tight">
                                    Les logs d'audit enregistreront cette action.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {candidates.length > 0 && (
                    <Card className="bg-zinc-950 border-white/5 shadow-2xl relative overflow-hidden border-t-2 border-t-emerald-500/50 transition-all duration-500 animate-in slide-in-from-bottom-4">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/5">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-black tracking-tight">Cibles identifiées</CardTitle>
                                <CardDescription className="text-zinc-500 font-bold">
                                    {selectedUsers.length} / {candidates.length} membres sélectionnés
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input 
                                        placeholder="Chercher un membre..." 
                                        className="pl-9 bg-white/5 border-white/10 h-10 text-xs font-bold"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 border-white/10 font-black px-4 bg-zinc-900/50 hover:bg-zinc-900 uppercase tracking-widest text-[9px] transition-colors"
                                    onClick={() => setSelectedUsers(selectedUsers.length === candidates.length ? [] : candidates.map(u => u.discordId))}
                                >
                                    {selectedUsers.length === candidates.length ? "Tout dé-cocher" : "Tout cocher"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[450px]">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4 gap-4">
                                    {filteredCandidates.map(user => (
                                        <div 
                                            key={user.discordId}
                                            onClick={() => toggleUser(user.discordId)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 relative group/card overflow-hidden",
                                                selectedUsers.includes(user.discordId)
                                                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_4px_12px_rgba(16,185,129,0.1)] ring-1 ring-emerald-500/20"
                                                    : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border border-white/10 group-hover/card:border-white/20 transition-colors">
                                                    <AvatarImage src={user.image || undefined} />
                                                    <AvatarFallback className="text-[10px] bg-zinc-900 font-black">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {selectedUsers.includes(user.discordId) && (
                                                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 shadow-lg border-2 border-zinc-950 animate-in zoom-in duration-300">
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-sm font-black truncate text-zinc-100 group-hover/card:text-white transition-colors">{user.name}</span>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                                                        {criteria === "MISSING_MISSIONS" 
                                                            ? "0 mission validée" 
                                                            : criteria === "LADDER_INACTIVE"
                                                                ? "Aucune XP récente"
                                                            : criteria === "DOFUS_INACTIVE"
                                                                ? "Cible Manuelle"
                                                                : `Site: ${user.lastSeen ? formatDistanceToNow(new Date(user.lastSeen), { locale: fr, addSuffix: true }) : 'Jamais'}`
                                                        }
                                                    </span>
                                                    {user.discordStats && (
                                                        <span className="text-[9px] font-medium text-violet-400/70 flex items-center gap-1 uppercase tracking-tighter">
                                                            <div className="w-1 h-1 rounded-full bg-violet-500" />
                                                            {user.discordStats.messages} msg • {user.discordStats.voiceMin} min vocal
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {!selectedUsers.includes(user.discordId) && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none rounded-xl" />
                                            )}
                                        </div>
                                    ))}
                                    {filteredCandidates.length === 0 && (
                                        <div className="col-span-full py-20 text-center space-y-4">
                                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-white/5">
                                                <Users className="w-8 h-8 text-zinc-700" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Aucun membre trouvé</p>
                                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Ajustez vos filtres et relancez l'analyse</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6 focus-visible:outline-none">
                <RelanceHistory history={initialHistory} />
            </TabsContent>
        </Tabs>
    );
}

function RelanceHistory({ history }: { history: any[] }) {
    if (history.length === 0) {
        return (
            <Card className="bg-zinc-950 border-white/5 py-20 border-dashed">
                <div className="text-center space-y-4">
                    <HistoryIcon className="w-12 h-12 text-zinc-800 mx-auto" />
                    <div>
                        <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Aucun historique de relance</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight mt-1">Les relances envoyées s'afficheront ici.</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
                <Card key={item.id} className="bg-zinc-950 border-white/5 shadow-xl group hover:border-white/10 transition-all overflow-hidden relative border-l-2 border-l-transparent hover:border-l-emerald-500/50">
                    <div className="absolute top-0 right-0 p-3 opacity-20 transition-opacity group-hover:opacity-60 z-10">
                         <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.2em] border-zinc-800 bg-black/40 px-2 py-0.5 pointer-events-none">
                             #{item.id.slice(-4)}
                         </Badge>
                    </div>
                    <CardHeader className="pb-3 relative">
                        <div className="flex items-center gap-3 mb-3">
                             <Avatar className="h-7 w-7 border border-white/10 shadow-lg">
                                 <AvatarImage src={item.admin?.image || ""} />
                                 <AvatarFallback className="text-[8px] bg-zinc-900 font-black">{item.admin?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none mb-0.5">{item.admin?.name || "Admin"}</span>
                                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{formatDistanceToNow(new Date(item.createdAt), { locale: fr, addSuffix: true })}</span>
                             </div>
                        </div>
                        <CardTitle className="text-base font-black tracking-tight flex items-center gap-2.5">
                            <div className={cn(
                                "p-1.5 rounded-lg",
                                item.type === "DM" ? "bg-emerald-500/10 text-emerald-400" : "bg-violet-500/10 text-violet-400"
                            )}>
                                {item.type === "DM" ? <MessageSquare className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                            </div>
                            <span className="uppercase tracking-tight text-sm">{item.type === "DM" ? "Message Privé" : "Salon Discord"}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 relative group/msg transition-all hover:bg-white/[0.04]">
                             <div className="text-[11px] text-zinc-400 line-clamp-3 italic font-medium leading-relaxed group-hover/msg:line-clamp-none transition-all duration-300">
                                 "{item.message}"
                             </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Badge className="bg-zinc-900/50 hover:bg-zinc-900 border-white/5 text-zinc-100 font-black uppercase text-[8px] tracking-widest gap-1.5 flex items-center h-6 px-2 transition-colors">
                                <Users className="w-3 h-3 text-emerald-500" /> {item.targetIds?.length || 0} membres
                            </Badge>
                            {item.criteria && (
                                <Badge className="bg-violet-500/5 hover:bg-violet-500/10 border-violet-500/20 text-violet-400 font-black uppercase text-[8px] tracking-widest gap-1.5 flex items-center h-6 px-2 transition-colors">
                                    <Target className="w-3 h-3" /> {
                                        item.criteria === "MISSING_MISSIONS" ? "Missions" : 
                                        item.criteria === "DOFUS_INACTIVE" ? "Absences" : 
                                        item.criteria === "LADDER_INACTIVE" ? "Inactivité IG" : 
                                        item.criteria === "DISCORD_INACTIVE" ? "Discord" :
                                        item.criteria === "GLOBAL_INACTIVE" ? "Globale" : "Dashboard"
                                    }
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
