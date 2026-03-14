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
import { Checkbox } from "@/components/ui/checkbox";
import { 
    Bell, 
    Users, 
    MessageSquare, 
    History, 
    Search, 
    UserMinus, 
    UserPlus,
    Send,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Target,
    Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    getRelanceCandidates, 
    sendRelance 
} from "@/server/actions/relance-actions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RelanceClientProps {
    guildId: string;
    channels: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string; color: number }>;
    initialHistory: any[];
}

export function RelanceClient({ guildId, channels, roles, initialHistory }: RelanceClientProps) {
    const [activeTab, setActiveTab] = useState("new");
    const [criteria, setCriteria] = useState<"MISSING_MISSIONS" | "INACTIVE">("MISSING_MISSIONS");
    const [inactiveDays, setInactiveDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [relanceType, setRelanceType] = useState<"DM" | "CHANNEL" | "BULK">("DM");
    const [channelId, setChannelId] = useState<string>("");
    const [message, setMessage] = useState("Bonjour ! Il semble que tu n'aies pas encore validé de missions cette semaine. N'oublie pas de participer pour aider la guilde ! 🚀");
    const [addRoleId, setAddRoleId] = useState<string>("");
    const [removeRoleId, setRemoveRoleId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const res = await getRelanceCandidates(guildId, criteria, inactiveDays);
            if (res.success) {
                setCandidates(res.data || []);
                setSelectedUsers(res.data?.map((u: any) => u.discordId) || []);
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
                channelId: (relanceType === "CHANNEL" || relanceType === "BULK") ? channelId : undefined,
                addRoleId: addRoleId || undefined,
                removeRoleId: removeRoleId || undefined,
                criteria: criteria
            });

            if (res.success) {
                toast.success(res.data?.message || "Relance envoyée");
                // Reset or refresh?
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
                        <History className="w-4 h-4" /> Historique
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Step 1: Filters/Criteria */}
                    <Card className="bg-zinc-950 border-white/5 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="border-b border-white/5 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Target className="w-4 h-4 text-violet-400" /> 1. Cibler les membres
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Critères</Label>
                                <Select value={criteria} onValueChange={(v: any) => setCriteria(v)}>
                                    <SelectTrigger className="bg-white/5 border-white/10 h-11">
                                        <SelectValue placeholder="Sélectionner un critère" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        <SelectItem value="MISSING_MISSIONS">Missions non validées (Semaine)</SelectItem>
                                        <SelectItem value="INACTIVE">Inactivité prolongée</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {criteria === "INACTIVE" && (
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
                                className="w-full h-11 bg-violet-600 hover:bg-violet-700 font-black gap-2 transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Analyser la guilde
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Step 2: Customization */}
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
                                <div className="grid grid-cols-3 gap-2">
                                    {(["DM", "CHANNEL", "BULK"] as const).map(t => (
                                        <Button
                                            key={t}
                                            variant={relanceType === t ? "default" : "outline"}
                                            className={cn(
                                                "h-10 text-[10px] font-black transition-all",
                                                relanceType === t ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white/5 border-white/10"
                                            )}
                                            onClick={() => setRelanceType(t)}
                                        >
                                            {t}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {(relanceType === "CHANNEL" || relanceType === "BULK") && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Salon Discord</Label>
                                    <Select value={channelId} onValueChange={setChannelId}>
                                        <SelectTrigger className="bg-white/5 border-white/10">
                                            <SelectValue placeholder="# choisir-un-salon" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                                            {channels.map(c => (
                                                <SelectItem key={c.id} value={c.id}># {c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Message (Embed Content)</Label>
                                <textarea
                                    className="w-full min-h-[100px] bg-white/5 border border-white/10 rounded-md p-3 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Écrivez votre message..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 3: Discord Actions */}
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
                                <Select value={addRoleId} onValueChange={setAddRoleId}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue placeholder="Aucun changement" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 lg:w-max">
                                        <SelectItem value="none">Aucun changement</SelectItem>
                                        {roles.map(r => (
                                            <SelectItem key={r.id} value={r.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                                                    {r.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retirer un rôle</Label>
                                <Select value={removeRoleId} onValueChange={setRemoveRoleId}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue placeholder="Aucun changement" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 lg:w-max">
                                        <SelectItem value="none">Aucun changement</SelectItem>
                                        {roles.map(r => (
                                            <SelectItem key={r.id} value={r.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                                                    {r.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    onClick={handleSend} 
                                    disabled={loading || selectedUsers.length === 0}
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95 transition-all"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Lancer la Relance ({selectedUsers.length})
                                </Button>
                                <p className="text-[10px] text-zinc-500 text-center mt-3 font-bold uppercase tracking-tight">
                                    Une entrée dans les logs d'audit sera créée.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Candidate List Section */}
                {candidates.length > 0 && (
                    <Card className="bg-zinc-950 border-white/5 shadow-2xl relative overflow-hidden border-t-2 border-t-emerald-500/50">
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
                                        className="pl-9 bg-white/5 border-white/10 h-10 text-xs"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 border-white/10 font-bold px-4"
                                    onClick={() => setSelectedUsers(selectedUsers.length === candidates.length ? [] : candidates.map(u => u.discordId))}
                                >
                                    {selectedUsers.length === candidates.length ? "Tout désélectionner" : "Tout sélectionner"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4 gap-4">
                                    {filteredCandidates.map(user => (
                                        <div 
                                            key={user.discordId}
                                            onClick={() => toggleUser(user.discordId)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 relative group/card",
                                                selectedUsers.includes(user.discordId)
                                                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_4px_12px_rgba(16,185,129,0.1)]"
                                                    : "bg-white/[0.02] border-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border border-white/10">
                                                    <AvatarImage src={user.image || undefined} />
                                                    <AvatarFallback className="text-[10px] bg-zinc-900">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {selectedUsers.includes(user.discordId) && (
                                                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 shadow-lg border-2 border-zinc-950 animate-in zoom-in">
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-black truncate text-zinc-100">{user.name}</span>
                                                <span className="text-[10px] font-bold text-zinc-500">
                                                    {criteria === "MISSING_MISSIONS" 
                                                        ? "0 mission validée" 
                                                        : `Inactif ${formatDistanceToNow(new Date(user.lastSeen), { locale: fr, addSuffix: true })}`
                                                    }
                                                </span>
                                            </div>
                                            
                                            {/* Glow effect on hover */}
                                            {!selectedUsers.includes(user.discordId) && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none rounded-xl" />
                                            )}
                                        </div>
                                    ))}
                                    {filteredCandidates.length === 0 && (
                                        <div className="col-span-full py-20 text-center space-y-3">
                                            <Users className="w-12 h-12 text-zinc-800 mx-auto" />
                                            <div className="space-y-1">
                                                <p className="text-zinc-400 font-bold">Aucun membre trouvé</p>
                                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">Essayez d'ajuster vos critères d'analyse</p>
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

function PlusSquare(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
        </svg>
    )
}

function Loader2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}

// Sub-component for History
function RelanceHistory({ history }: { history: any[] }) {
    if (history.length === 0) {
        return (
            <Card className="bg-zinc-950 border-white/5 py-20">
                <div className="text-center space-y-4">
                    <History className="w-12 h-12 text-zinc-800 mx-auto" />
                    <div>
                        <p className="text-zinc-400 font-bold">Aucun historique de relance</p>
                        <p className="text-xs text-zinc-600">Les relances envoyées s'afficheront ici.</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
                <Card key={item.id} className="bg-zinc-950 border-white/5 shadow-xl group hover:border-white/10 transition-all overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-3 opacity-20 transition-opacity group-hover:opacity-40">
                         <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-zinc-700">
                             #{item.id.slice(-4)}
                         </Badge>
                    </div>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3 mb-2">
                             <Avatar className="h-6 w-6 border border-white/10">
                                 <AvatarImage src={item.admin?.image || ""} />
                                 <AvatarFallback className="text-[8px] bg-zinc-900">{item.admin?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                             </Avatar>
                             <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{item.admin?.name || "Admin"}</span>
                             <span className="text-[10px] font-bold text-zinc-400">• {formatDistanceToNow(new Date(item.createdAt), { locale: fr, addSuffix: true })}</span>
                        </div>
                        <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                            {item.type === "DM" ? <MessageSquare className="w-5 h-5 text-emerald-400" /> : <Bell className="w-5 h-5 text-rose-500" />}
                            {item.type === "DM" ? "Privé (DM)" : item.type === "CHANNEL" ? "Salon Public" : "Général (Bulk)"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 relative group/msg">
                             <div className="text-xs text-zinc-300 line-clamp-3 italic group-hover/msg:line-clamp-none transition-all duration-500">
                                 "{item.message}"
                             </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <Badge className="bg-zinc-800 border-zinc-700 text-zinc-300 font-bold gap-1.5 flex items-center h-6">
                                <Users className="w-3 h-3" /> {item.targetIds?.length || 0} membres
                            </Badge>
                            {item.criteria && (
                                <Badge className="bg-violet-500/10 border-violet-500/20 text-violet-400 font-bold gap-1.5 flex items-center h-6">
                                    <Target className="w-3 h-3" /> {item.criteria === "MISSING_MISSIONS" ? "Missions" : "Inactivité"}
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
