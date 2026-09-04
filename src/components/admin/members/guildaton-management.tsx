"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
    Trophy, 
    TrendingUp, 
    Calendar, 
    Clock, 
    Search, 
    Plus, 
    Upload, 
    Save, 
    Trash2, 
    Info, 
    CheckCircle2, 
    AlertCircle,
    Loader2,
    ArrowUpRight,
    Download,
    Settings,
    Users,
    FileJson,
    Camera
} from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { 
    ResponsiveContainer, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip 
} from "recharts";
import { toast } from "sonner";
import { 
    getGuildatonData, 
    updateGuildatonValue, 
    importGuildatonCsv, 
    updateGuildatonSettings,
    deleteGuildatonRecord,
    validateWeeklyGuildaton,
    sendManualGuildatonReport,
    type GuildatonMember,
    type GuildatonSettings 
} from "@/server/actions/guildaton-actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, History, BarChart3 } from "lucide-react";

interface GuildatonManagementProps {
    guildId: string;
}

export function GuildatonManagement({ guildId }: GuildatonManagementProps) {
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [sending, setSending] = useState(false);
    const [validating, setValidating] = useState(false);
    const [data, setData] = useState<{ 
        members: GuildatonMember[], 
        history: any[],
        settings?: GuildatonSettings,
        availableRoles?: { id: string, name: string, color: number }[],
        availableChannels?: { id: string, name: string }[]
    }>({ members: [], history: [] });
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [importOpen, setImportOpen] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);

    // Manual Form
    const [manualForm, setManualForm] = useState({
        discordId: "",
        username: "",
        ankamaId: "",
        value: 0
    });

    const fetchData = async () => {
        setLoading(true);
        const res = await getGuildatonData(guildId);
        if (res.success && res.data) {
            setData(res.data);
        } else {
            toast.error(res.error || "Erreur de chargement");
        }
        setLoading(false);
    };

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, [guildId]);

    const filteredMembers = useMemo(() => {
        return data.members.filter(m => {
            const matchSearch = m.displayName.toLowerCase().includes(search.toLowerCase()) || 
                                m.discordId.includes(search) ||
                                (m.ankamaId && m.ankamaId.toLowerCase().includes(search.toLowerCase()));
            const matchRole = roleFilter === "ALL" || m.discordRoleName === roleFilter;
            return matchSearch && matchRole;
        });
    }, [data.members, search, roleFilter]);

    const refreshData = () => fetchData();

    const handleValidateWeek = async () => {
        if (!confirm("Voulez-vous valider la semaine en cours ? Cela cr├®era un point d'historique pour tous les membres pour permettre de voir leur ├®volution.")) return;
        
        setValidating(true);
        const res = await validateWeeklyGuildaton(guildId);
        setValidating(false);
        
        if (res.success) {
            toast.success("Semaine valid├®e !");
            fetchData();
        } else {
            toast.error(res.error || "Erreur lors de la validation");
        }
    };

    const handleSendReminder = async () => {
        setSending(true);
        const res = await sendManualGuildatonReport(guildId);
        setSending(false);
        if (res.success) {
            toast.success("Rapport Discord envoy├® !");
        } else {
            toast.error(res.error || "Erreur lors de l'envoi");
        }
    };

    const handleUpdateValue = async (m: GuildatonMember, newValue: number) => {
        const val = Math.min(Math.max(0, newValue), 999999);
        if (val === m.currentValue) return;

        try {
            const res = await updateGuildatonValue(guildId, {
                discordId: m.discordId,
                value: val,
                username: m.displayName,
                ankamaId: m.ankamaId || undefined
            });

            if (res.success) {
                toast.success(`Guildaton mis ├á jour pour ${m.displayName}`);
                // Optimistic update
                setData(prev => ({
                    ...prev,
                    members: prev.members.map(member => 
                        member.discordId === m.discordId ? { ...member, currentValue: val } : member
                    )
                }));
            } else {
                toast.error(res.error);
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        }
    };

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const allRows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 2);
            if (allRows.length === 0) {
                toast.error("Le fichier semble vide.");
                return;
            }

            // Universal Parser: Try to find a number and a name in each line regardless of separator
            const parsed = allRows.map((line) => {
                // Try common separators
                const parts = line.split(/[;,\t|]/).map(p => p.trim().replace(/"/g, ''));
                
                let name = "";
                let score = 0;
                let discordId = "";

                if (parts.length >= 2) {
                    // Search for a part that is purely numeric or ends with common suffixes
                    const scoreIdx = parts.findIndex(p => /^\d+$/.test(p.replace(/[^\d]/g, '')));
                    if (scoreIdx !== -1) {
                        score = parseInt(parts[scoreIdx].replace(/[^\d]/g, '')) || 0;
                        // The rest is probably the name
                        name = parts.filter((_, i) => i !== scoreIdx).join(" ").trim();
                    } else {
                        // Fallback: first col name, second col score
                        name = parts[0];
                        score = parseInt(parts[1].replace(/[^\d]/g, '')) || 0;
                    }
                } else {
                    // Single column case: search for number at the end or beginning
                    const matches = line.match(/(\d+)/);
                    if (matches) {
                        score = parseInt(matches[0]);
                        name = line.replace(matches[0], "").trim().replace(/^[:\s-]+|[:\s-]+$/g, "");
                    }
                }

                // If name is a snowflake, use it as discordId
                if (/^\d{17,20}$/.test(name)) {
                    discordId = name;
                } else {
                    discordId = name; // Server will fuzzy match
                }

                return { 
                    discordId: discordId || name, 
                    value: score, 
                    username: name || "Membre", 
                    ankamaId: "" 
                };
            }).filter(r => r.username && r.username.length > 1 && !r.username.toLowerCase().includes("pseudo") && !r.username.toLowerCase().includes("name"));

            if (parsed.length === 0) {
                toast.error("Format de donn├®es non reconnu (Pseudo + Points attendus).");
            } else {
                setImportData(parsed);
                toast.success(`${parsed.length} membres d├®tect├®s.`);
            }
        };
        reader.onerror = () => toast.error("Erreur lors de la lecture du fichier.");
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const allRows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 2);
            if (allRows.length === 0) {
                toast.error("Le fichier semble vide.");
                return;
            }

            const parsed = allRows.map((line) => {
                const parts = line.split(/[;,\t|]/).map(p => p.trim().replace(/"/g, ''));
                let name = "";
                let score = 0;
                let discordId = "";

                if (parts.length >= 2) {
                    const scoreIdx = parts.findIndex(p => /^\d+$/.test(p.replace(/[^\d]/g, '')));
                    if (scoreIdx !== -1) {
                        score = parseInt(parts[scoreIdx].replace(/[^\d]/g, '')) || 0;
                        name = parts.filter((_, i) => i !== scoreIdx).join(" ").trim();
                    } else {
                        name = parts[0];
                        score = parseInt(parts[1].replace(/[^\d]/g, '')) || 0;
                    }
                } else {
                    const matches = line.match(/(\d+)/);
                    if (matches) {
                        score = parseInt(matches[0]);
                        name = line.replace(matches[0], "").trim().replace(/^[:\s-]+|[:\s-]+$/g, "");
                    }
                }

                if (/^\d{17,20}$/.test(name)) {
                    discordId = name;
                } else {
                    discordId = name;
                }

                return { 
                    discordId: discordId || name, 
                    value: score, 
                    username: name || "Membre", 
                    ankamaId: "" 
                };
            }).filter(r => r.username && r.username.length > 1 && !r.username.toLowerCase().includes("pseudo") && !r.username.toLowerCase().includes("name"));

            if (parsed.length === 0) {
                toast.error("Format de donn├®es non reconnu (Pseudo + Points attendus).");
            } else {
                setImportData(parsed);
                toast.success(`${parsed.length} membres d├®tect├®s.`);
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = async () => {
        if (importData.length === 0) return;
        setSending(true);
        const res = await importGuildatonCsv(guildId, importData);
        if (res.success) {
            toast.success(`${importData.length} records import├®s avec succ├¿s`);
            setImportOpen(false);
            fetchData();
        } else {
            toast.error(res.error);
        }
        setSending(false);
    };

    const handleManualAdd = async () => {
        if (!manualForm.discordId && !manualForm.username) return toast.error("Discord ID ou Pseudo obligatoire");
        // Auto convert to manual_id if no ID is passed but a Username is passed.
        const idToLog = manualForm.discordId || `manual_${manualForm.username.toLowerCase().replace(/\s+/g, "_")}`;
        
        setSending(true);
        const res = await updateGuildatonValue(guildId, { ...manualForm, discordId: idToLog });
        if (res.success) {
            toast.success("Membre ajout├®");
            setManualOpen(false);
            fetchData();
            setManualForm({ discordId: "", username: "", ankamaId: "", value: 0 });
        } else {
            toast.error(res.error);
        }
        setSending(false);
    };


    const handleDeleteRecord = async (discordId: string) => {
        if (!confirm("Supprimer ce membre du Guildaton ? Les points et l'historique seront effac├®s.")) return;
        
        setLoading(true);
        try {
            const res = await deleteGuildatonRecord(guildId, discordId);
            if (res.success) {
                toast.success("Enregistrement supprim├®");
                fetchData();
            } else {
                toast.error(res.error);
                setLoading(false);
            }
        } catch (error) {
            toast.error("Erreur de connexion");
            setLoading(false);
        }
    };


    // Graph Data processing
    const graphData = useMemo(() => {
        const daily = new Map();
        data.history.forEach(h => {
            const date = format(new Date(h.createdAt), "dd/MM");
            daily.set(date, (daily.get(date) || 0) + h.value);
        });

        // Current month evolution
        return Array.from(daily.entries()).map(([date, value]) => ({
            date,
            total: value
        })).slice(-15);
    }, [data.history]);

    const totalGuildatons = data.members.reduce((acc, m) => acc + m.currentValue, 0);
    const avgGuildaton = data.members.length > 0 ? Math.round(totalGuildatons / data.members.length) : 0;

    return (
        <div className="space-y-8 pb-10">
            {/* --- ANALYTICS SECTION --- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="bg-surface/40 border-border backdrop-blur-xl rounded-[24px] overflow-hidden p-6 relative group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 blur-[40px] rounded-full translate-x-12 -translate-y-12" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-violet-600/10 rounded-xl">
                            <img src="/assets/icons/guildatons.png" alt="Guildaton" className="w-5 h-5 object-contain" />
                        </div>
                        <span className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em]">Total Guilde</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-foreground">{totalGuildatons.toLocaleString()}</span>
                        <span className="text-caption font-black text-violet-500 mb-2 uppercase italic font-black">Points</span>
                    </div>
                    <p className="text-caption text-muted-foreground font-bold mt-2 uppercase tracking-widest italic opacity-60">Volume cumul├® des membres</p>
                </Card>

                <Card className="bg-surface/40 border-border backdrop-blur-xl rounded-[24px] p-6 relative group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-success/20 rounded-xl">
                            <TrendingUp className="w-5 h-5 text-success" />
                        </div>
                        <span className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em]">Moyenne</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-foreground">{avgGuildaton.toLocaleString()}</span>
                        <span className="text-caption font-black text-success mb-2 uppercase italic font-black">Pts/membre</span>
                    </div>
                </Card>

                <Card className="lg:col-span-2 bg-black/40 border-border backdrop-blur-xl rounded-[24px] p-4 flex flex-col h-[180px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-info" />
                            ├ëvolution (15 jours)
                        </span>
                        <Badge variant="outline" className="text-caption border-border text-muted-foreground uppercase font-black">Analyses site</Badge>
                    </div>
                    <div className="flex-1 w-full min-h-[120px]">
                        {!mounted ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
                                <AreaChart data={graphData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        hide 
                                    />
                                    <YAxis hide />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="total" 
                                        stroke="#8b5cf6" 
                                        fillOpacity={1} 
                                        fill="url(#colorTotal)" 
                                        strokeWidth={3}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            {/* --- DOWNLOAD SOFTWARE SECTION --- */}
            <Card className="bg-gradient-to-br from-violet-600/10 via-surface/40 to-success/5 border-border backdrop-blur-xl overflow-hidden group">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border border-border shadow-2xl group- transition-transform duration-300">
                            <Camera className="w-6 h-6 text-violet-400" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-black uppercase italic tracking-tighter text-foreground flex items-center gap-2">
                                Logiciel <span className="text-violet-500">SigilOCR</span>
                                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-caption px-1.5 py-0">v3.2 Stable</Badge>
                            </h3>
                            <p className="text-caption text-muted-foreground font-medium max-w-sm">
                                Outil de scan automatique des points de guilde. Compatible Windows 10/11.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline"
                            className="h-10 bg-muted/40 border-border hover:border-violet-500/30 hover:bg-violet-600/10 text-caption font-black uppercase tracking-widest rounded-xl px-4 text-muted-foreground hover:text-foreground transition-all"
                            onClick={() => window.open('https://github.com/Klyx04/SigilOCR/releases/latest', '_blank')}
                        >
                            <FileJson className="w-4 h-4 mr-2" /> Release Notes
                        </Button>
                        <Button 
                            className="h-10 bg-violet-600 hover:bg-violet-500 text-foreground text-caption font-black uppercase tracking-widest rounded-xl px-6   transition-all"
                            onClick={() => window.open('https://download.sigilos.fr/sigilocr-latest.exe', '_blank')}
                        >
                            <Download className="w-4 h-4 mr-2" /> T├®l├®charger (Win)
                        </Button>
                    </div>
                </CardContent>
                
                {/* Decorative glow */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/10 blur-[50px] pointer-events-none" />
            </Card>

            {/* --- UTILITIES TABLE SECTION --- */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-1 gap-2 w-full lg:max-w-md">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-400 transition-colors" />
                            <Input 
                                placeholder="Rechercher par pseudo, Discord ID..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-12 h-12 bg-muted/40 border-border text-foreground rounded-2xl focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
                            />
                        </div>
                        <select 
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="h-12 px-4 rounded-2xl bg-muted/40 border border-border text-foreground text-xs font-bold focus:outline-none"
                        >
                            <option value="ALL">Tous les r├┤les</option>
                            {Array.from(new Set(data.members.map(m => m.discordRoleName))).filter(Boolean).map(rn => (
                                <option key={rn} value={rn!}>{rn}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <Button 
                            onClick={handleValidateWeek}
                            disabled={validating}
                            className="h-12 bg-success/20 border border-success/30 hover:bg-success/40 text-success rounded-2xl px-6 text-caption font-black uppercase tracking-widest backdrop-blur-xl group"
                        >
                            {validating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2 group- transition-transform" />}
                            Valider la Semaine
                        </Button>

                        <Button 
                            onClick={handleSendReminder}
                            disabled={sending || !data?.settings?.notifyChannelId}
                            variant="outline"
                            className="h-12 bg-surface/60 border-border hover:bg-elevated hover:border-violet-500/30 rounded-2xl px-6 text-caption font-black uppercase tracking-widest backdrop-blur-xl group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2 text-violet-400 group- transition-transform" />}
                            Envoyer Rappel Discord
                        </Button>
                        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="h-12 bg-surface/60 border-border hover:bg-elevated hover:border-violet-500/30 rounded-2xl px-6 text-caption font-black uppercase tracking-widest backdrop-blur-xl">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Ajouter Manuellement
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-background border-border rounded-[32px] max-w-md text-foreground">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-black uppercase italic italic text-foreground">Ajout <span className="text-violet-500">Manuel</span></DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Inscrire un membre non pr├®sent sur le site.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-caption font-black uppercase text-muted-foreground ml-1">Discord ID (Requis si connu)</label>
                                        <Input 
                                            placeholder="Ex: 283..." 
                                            value={manualForm.discordId}
                                            onChange={e => setManualForm({...manualForm, discordId: e.target.value})}
                                            className="bg-black/40 border-border rounded-xl h-11"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-caption font-black uppercase text-muted-foreground ml-1">Pseudo Discord</label>
                                            <Input 
                                                placeholder="Pseudo" 
                                                value={manualForm.username}
                                                onChange={e => setManualForm({...manualForm, username: e.target.value})}
                                                className="bg-black/40 border-border rounded-xl h-11"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-caption font-black uppercase text-muted-foreground ml-1">Ankama ID</label>
                                            <Input 
                                                placeholder="Pseudo#1234" 
                                                value={manualForm.ankamaId}
                                                onChange={e => setManualForm({...manualForm, ankamaId: e.target.value})}
                                                className="bg-black/40 border-border rounded-xl h-11"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-caption font-black uppercase text-muted-foreground ml-1">Guildaton Initial</label>
                                        <Input 
                                            type="number"
                                            value={manualForm.value}
                                            onChange={e => setManualForm({...manualForm, value: parseInt(e.target.value) || 0})}
                                            className="bg-black/40 border-border rounded-xl h-11"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleManualAdd} disabled={sending} className="w-full bg-violet-600 hover:bg-violet-500 text-foreground rounded-xl h-11 font-black uppercase tracking-widest">
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Enregistrer"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={importOpen} onOpenChange={setImportOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="h-12 bg-info/40 border-info/20 hover:bg-info hover:border-info rounded-2xl px-6 text-caption font-black uppercase tracking-widest backdrop-blur-xl group">
                                    <Upload className="w-4 h-4 mr-2 group-hover:animate-bounce" />
                                    Importer CSV (OCR)
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-background border-border rounded-[32px] max-w-2xl text-foreground">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-black uppercase italic text-foreground flex items-center gap-3">
                                        <FileJson className="w-6 h-6 text-info" />
                                        Importation <span className="text-info">OCR Bot</span>
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Uploadez le fichier g├®n├®r├® par votre bot OCR.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-6" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
                                    <div className="p-8 border-2 border-dashed border-border rounded-3xl bg-surface flex flex-col items-center justify-center gap-4 text-center group hover:border-info/30 hover:bg-surface transition-all relative">
                                        <div className="p-4 bg-info/10 rounded-2xl group- transition-transform">
                                            <Upload className="w-8 h-8 text-info" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-foreground italic">Cliquez Libre ou Glissez-D├®posez</p>
                                            <p className="text-caption text-muted-foreground font-bold mt-1 uppercase tracking-tighter">Le robot trouvera automatiquement les fautes dans les noms.</p>
                                        </div>
                                        <Input type="file" accept=".csv" title="Upload" onChange={handleCsvImport} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-50 block" />
                                    </div>

                                    {importData.length > 0 && (
                                        <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-border p-4 space-y-2 bg-black/40">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border text-caption font-black uppercase text-muted-foreground tracking-widest">
                                                <span>Aper├ºu des donn├®es ({importData.length} lignes)</span>
                                            </div>
                                            {importData.slice(0, 10).map((row, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-none">
                                                    <span className="text-muted-foreground font-medium">@{row.username || row.discordId}</span>
                                                    <span className="font-black text-info italic">{row.value} Pts</span>
                                                </div>
                                            ))}
                                            {importData.length > 10 && (
                                                <p className="text-caption text-muted-foreground text-center pt-2 italic">... et {importData.length - 10} autres membres</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="ghost" onClick={() => { setImportOpen(false); setImportData([]); }} className="text-foreground hover:bg-surface">Annuler</Button>
                                    <Button onClick={confirmImport} disabled={sending || importData.length === 0} className="bg-info hover:bg-info text-info-foreground rounded-xl px-8 font-black uppercase tracking-widest">
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : `Importer ${importData.length} membres`}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="rounded-[32px] border border-border bg-surface/40 backdrop-blur-2xl overflow-hidden shadow-2xl overflow-x-auto no-scrollbar">
                    <Table className="min-w-[800px]">
                        <TableHeader className="bg-surface border-b border-border">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="pl-8 py-6 text-caption font-black uppercase text-muted-foreground tracking-[0.2em] whitespace-nowrap">Membre</TableHead>
                                <TableHead className="py-6 text-caption font-black uppercase text-muted-foreground tracking-[0.2em] whitespace-nowrap">Discord ID / Ankama</TableHead>
                                <TableHead className="py-6 text-caption font-black uppercase text-muted-foreground tracking-[0.2em] whitespace-nowrap">Inscrit</TableHead>
                                <TableHead className="py-6 text-caption font-black uppercase text-muted-foreground tracking-[0.2em] w-[200px] whitespace-nowrap">Guildaton (Edit)</TableHead>
                                <TableHead className="pr-8 text-right py-6 text-caption font-black uppercase text-muted-foreground tracking-[0.2em] whitespace-nowrap">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-4 py-10 opacity-40">
                                            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                                            <p className="text-xs font-black uppercase tracking-widest text-foreground italic">Synchronisation Guildaton...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredMembers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-xs font-bold uppercase italic">Aucun membre trouv├®</TableCell>
                                </TableRow>
                            ) : (
                                filteredMembers.map(m => (
                                    <TableRow key={m.discordId} className="group border-b border-border hover:bg-surface transition-colors">
                                        <TableCell className="pl-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center font-black text-sm text-muted-foreground group-hover:border-violet-500/50 transition-all uppercase italic rotate-3 group-hover:rotate-0">
                                                    {m.displayName.charAt(0)}
                                                </div>
                                                <div className="flex flex-col leading-tight gap-1">
                                                    <span className="font-black text-foreground group-hover:text-foreground transition-colors flex items-center gap-2">
                                                        {m.displayName}
                                                        {m.isRegistered && m.currentValue < (data.settings?.weeklyQuota || 0) && (
                                                            <div className="flex items-center gap-1 bg-danger/10 text-danger px-1.5 py-[2px] rounded-sm text-caption uppercase font-black">
                                                                <AlertCircle className="w-3 h-3" /> Glandeur
                                                            </div>
                                                        )}
                                                    </span>
                                                    <span className="text-caption text-muted-foreground font-black uppercase tracking-widest">{m.discordRoleName || "Membre de guilde"}</span>
                                                    
                                                    {/* Petit graphique d'├®volution */}
                                                    <div className="h-8 w-32 mt-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                            <AreaChart data={data.history?.filter(h => h.discordId === m.discordId).map(h => ({ value: h.value })) || []}>
                                                                <Area 
                                                                    type="monotone" 
                                                                    dataKey="value" 
                                                                    stroke="#8b5cf6" 
                                                                    fill="url(#colorVal)" 
                                                                    strokeWidth={2}
                                                                    isAnimationActive={false}
                                                                />
                                                                <defs>
                                                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                                    </linearGradient>
                                                                </defs>
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-caption font-black text-muted-foreground bg-surface px-2 py-0.5 rounded-md w-fit tabular-nums">{m.discordId}</span>
                                                {m.ankamaId && <span className="text-caption font-black text-violet-400/70">{m.ankamaId}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5">
                                                {m.isRegistered ? (
                                                    <Badge className="bg-success/10 text-success border-none text-caption font-black uppercase tracking-widest w-fit">Inscrit site</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-border text-muted-foreground text-caption font-black uppercase tracking-widest w-fit">Non-inscrit</Badge>
                                                )}
                                                {!m.isOnDiscord && (
                                                    <Badge variant="outline" className="border-warning/30 text-warning/80 text-caption font-black uppercase tracking-tighter w-fit">Pas sur Discord</Badge>
                                                )}
                                                {m.discordId.startsWith("manual_") && (
                                                    <Badge variant="outline" className="border-violet-500/30 text-violet-500/80 text-caption font-black uppercase tracking-tighter w-fit italic">Ligne Manuelle</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative w-[140px] group/input">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-md bg-elevated/50">
                                                    <img src="/assets/icons/guildatons.png" alt="Icon" className="w-3 h-3 object-contain opacity-70 group-focus-within/input:opacity-100 transition-opacity" />
                                                </div>
                                                <Input 
                                                    type="number" 
                                                    value={m.currentValue}
                                                    onChange={(e) => {
                                                        const newVal = parseInt(e.target.value) || 0;
                                                        setData(prev => ({
                                                            ...prev,
                                                            members: prev.members.map(member => 
                                                                member.discordId === m.discordId ? { ...member, currentValue: newVal } : member
                                                            )
                                                        }));
                                                    }}
                                                    onBlur={() => handleUpdateValue(m, m.currentValue)}
                                                    className="pl-10 h-10 bg-muted/40 border-border focus:border-violet-500/50 rounded-xl font-black text-foreground w-full tabular-nums"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {m.profileId && (
                                                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-lg hover:bg-violet-600/20 hover:text-violet-400 transition-all" asChild>
                                                        <a href={`/dashboard/${guildId}/members/${encodeURIComponent(m.slug || m.profileId)}`} target="_blank">
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleDeleteRecord(m.discordId)}
                                                    className="w-8 h-8 p-0 rounded-lg hover:bg-danger/20 hover:text-danger text-muted-foreground transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
