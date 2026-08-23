import React, { useState } from "react";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    PieChart,
    Pie
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Mic, Activity, Maximize2, Search } from "lucide-react";
import { MemberReconciliationData, RoleStats } from "@/server/actions/member-actions";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MemberDiscordChartsProps {
    members: MemberReconciliationData[];
    roleStats: RoleStats[];
}

const CustomTooltip = ({ active, payload, label, suffix = "" }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/90 border border-violet-500/20 px-4 py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <p className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{label}</p>
                <p className="text-[18px] font-black text-foreground tabular-nums leading-none">
                    {payload[0].value.toLocaleString()}
                    <span className="text-caption text-muted-foreground uppercase font-bold ml-1.5">{suffix}</span>
                </p>
            </div>
        );
    }
    return null;
};

export function MemberDiscordCharts({ members, roleStats }: MemberDiscordChartsProps) {
    const [mounted, setMounted] = React.useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [timeframe, setTimeframe] = useState<"weekly" | "monthly" | "total">("weekly");
    const [sortKey, setSortKey] = useState<string>("messages");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [selectedRole, setSelectedRole] = useState<string>("all");

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const getKeys = () => {
        switch (timeframe) {
            case "monthly":
                return { msg: "discordMessageCountMonthly", voice: "discordVoiceTimeMonthly" };
            case "total":
                return { msg: "discordMessageCountTotal", voice: "discordVoiceTimeTotal" };
            default:
                return { msg: "discordMessageCountWeekly", voice: "discordVoiceTimeWeekly" };
        }
    };

    const keys = getKeys();

    const activeCount = members.filter(m => ((m as any)[keys.msg] || 0) > 0 || ((m as any)[keys.voice] || 0) > 0).length;
    const silentCount = Math.max(0, members.length - activeCount);

    const activityData = [
        { name: "Actifs", value: activeCount, color: "#8b5cf6" },
        { name: "Silencieux", value: silentCount, color: "#27272a" }
    ];

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[300px]">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="bg-surface/30 border-border animate-pulse rounded-[32px] overflow-hidden shadow-2xl" />
                ))}
            </div>
        );
    }

    const topTalkers = [...members]
        .sort((a, b) => ((b as any)[keys.msg] || 0) - ((a as any)[keys.msg] || 0))
        .slice(0, 5)
        .map(m => ({
            name: m.displayName.split(" ")[0].slice(0, 10),
            value: (m as any)[keys.msg] || 0
        }));

    const topVocal = [...members]
        .sort((a, b) => ((b as any)[keys.voice] || 0) - ((a as any)[keys.voice] || 0))
        .slice(0, 5)
        .map(m => ({
            name: m.displayName.split(" ")[0].slice(0, 10),
            value: Math.round(((m as any)[keys.voice] || 0) / 60)
        }));

    const sortedMembers = [...members]
        .filter(m => {
            const matchesSearch = m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                m.username.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = selectedRole === "all" || m.roles.includes(selectedRole);
            return matchesSearch && matchesRole;
        })
        .sort((a, b) => {
            let valA = 0;
            let valB = 0;
            if (sortKey === "messages") {
                valA = (a as any)[keys.msg] || 0;
                valB = (b as any)[keys.msg] || 0;
            } else if (sortKey === "vocal") {
                valA = (a as any)[keys.voice] || 0;
                valB = (b as any)[keys.voice] || 0;
            } else {
                valA = (a as any)[sortKey] || 0;
                valB = (b as any)[sortKey] || 0;
            }
            return sortOrder === "desc" ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
        });

    const timeframeLabel = timeframe === "weekly" ? "cette semaine" : timeframe === "monthly" ? "ce mois-ci" : "all-time";

    // Bar chart gradient colors per index
    const MSG_GRADIENT_ID = "msgGradient";
    const VOICE_GRADIENT_ID = "voiceGradient";

    return (
        <div className="space-y-6">
            {/* Global Timeframe Selector */}
            <div className="flex justify-end">
                <div className="bg-surface/60 p-1 rounded-2xl border border-border backdrop-blur-xl flex gap-1">
                    {[
                        { id: "weekly", label: "Semaine" },
                        { id: "monthly", label: "Mois" },
                        { id: "total", label: "Global" }
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTimeframe(t.id as any)}
                            className={`px-4 py-1.5 rounded-xl text-caption font-black uppercase tracking-widest transition-all ${
                                timeframe === t.id 
                                ? "bg-violet-600 text-foreground " 
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Overview — Donut */}
                <Card className="bg-surface/30 border-border backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground italic flex items-center gap-2">
                            <Activity className="w-4 h-4 text-violet-400" />
                            État d&apos;activité
                        </CardTitle>
                        <CardDescription className="text-caption uppercase font-bold text-muted-foreground">Membres actifs {timeframeLabel}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] relative min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={activityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={84}
                                    paddingAngle={4}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {activityData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.color} 
                                            stroke="none"
                                            style={{ filter: index === 0 ? "drop-shadow(0 0 12px rgba(139,92,246,0.5))" : "none" }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip suffix="membres" />} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                            <span className="text-3xl font-black text-foreground">{members.length > 0 ? Math.round((activeCount / members.length) * 100) : 0}%</span>
                            <span className="text-caption font-black text-violet-400 uppercase tracking-widest">Actif</span>
                        </div>
                    </CardContent>
                    {/* Legend */}
                    <div className="px-6 pb-5 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 " />
                            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Actifs <span className="text-foreground">{activeCount}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Silencieux <span className="text-foreground">{silentCount}</span></span>
                        </div>
                    </div>
                </Card>

                {/* Top Messages */}
                <Card className="bg-surface/30 border-border backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground italic flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-info" />
                                Top Bavards
                            </CardTitle>
                            <CardDescription className="text-caption uppercase font-bold text-muted-foreground">Volume messages {timeframeLabel}</CardDescription>
                        </div>
                        
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="p-2 bg-surface hover:bg-surface rounded-xl transition-all border border-border flex items-center gap-2 group/btn">
                                    <Maximize2 className="w-3.5 h-3.5 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
                                    <span className="text-caption font-black uppercase text-muted-foreground group-hover/btn:text-foreground transition-colors">Détails</span>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl bg-background border-border p-0 rounded-[32px] overflow-hidden ">
                                <DialogHeader className="p-8 border-b border-border">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground italic flex items-center gap-3">
                                        <Activity className="w-6 h-6 text-violet-500" />
                                        Audit Activité — {timeframe === "weekly" ? "Semaine" : timeframe === "monthly" ? "Mois" : "Global"}
                                    </DialogTitle>
                                    <DialogDescription className="text-caption font-black uppercase tracking-widest text-muted-foreground">Breakdown complet des statistiques Discord de la guilde</DialogDescription>
                                </DialogHeader>
                                
                                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
                                            <Input 
                                                placeholder="Filtrer par membre..." 
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-12 h-12 bg-muted/40 border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:ring-violet-500/20"
                                            />
                                        </div>
                                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                                            <SelectTrigger className="w-full md:w-[200px] h-12 bg-muted/40 border-border rounded-2xl text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                <SelectValue placeholder="Rôle Discord" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-surface border-border rounded-2xl">
                                                <SelectItem value="all" className="text-caption font-black uppercase tracking-widest">Tous les rôles</SelectItem>
                                                {roleStats.map(role => (
                                                    <SelectItem key={role.roleId} value={role.roleId} className="text-caption font-black uppercase tracking-widest">
                                                        {role.roleName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="rounded-2xl border border-border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-surface">
                                                <TableRow className="border-border hover:bg-transparent">
                                                    <TableHead className="text-caption font-black uppercase text-muted-foreground tracking-widest">Membre</TableHead>
                                                    <TableHead className="text-caption font-black uppercase text-muted-foreground tracking-widest">Rôles Mappés</TableHead>
                                                    <TableHead
                                                        className="text-caption font-black uppercase text-muted-foreground tracking-widest text-center cursor-pointer hover:text-info transition-colors"
                                                        onClick={() => { setSortKey("messages"); setSortOrder(prev => prev === "desc" ? "asc" : "desc"); }}
                                                    >
                                                        Messages {sortKey === "messages" && <span className="text-info">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                                                    </TableHead>
                                                    <TableHead
                                                        className="text-caption font-black uppercase text-muted-foreground tracking-widest text-center cursor-pointer hover:text-success transition-colors"
                                                        onClick={() => { setSortKey("vocal"); setSortOrder(prev => prev === "desc" ? "asc" : "desc"); }}
                                                    >
                                                        Vocal {sortKey === "vocal" && <span className="text-success">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                                                    </TableHead>
                                                    <TableHead className="text-caption font-black uppercase text-muted-foreground tracking-widest text-right">Dashboard</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedMembers.map(m => (
                                                    <TableRow key={m.discordId} className="border-border hover:bg-surface">
                                                        <TableCell className="font-bold text-foreground text-body-sm">
                                                            {m.displayName}
                                                            <p className="text-caption text-muted-foreground font-medium">@{m.username}</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                {m.roles.filter(rId => roleStats.some(rs => rs.roleId === rId)).map(rId => {
                                                                    const role = roleStats.find(rs => rs.roleId === rId);
                                                                    return (
                                                                        <Badge key={rId} variant="outline" className="text-caption font-black bg-surface border-border uppercase" style={{ color: role?.roleColor ? `#${role.roleColor.toString(16).padStart(6, '0')}` : undefined }}>
                                                                            {role?.roleName}
                                                                        </Badge>
                                                                    );
                                                                })}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-black text-info tabular-nums">{(m as any)[keys.msg] || 0}</TableCell>
                                                        <TableCell className="text-center font-black text-success tabular-nums">
                                                            {((m as any)[keys.voice] || 0) < 60 ? `${(m as any)[keys.voice] || 0}m` : `${Math.round(((m as any)[keys.voice] || 0) / 60)}h`}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {m.hasDashboardProfile ? (
                                                                <Badge className="bg-success/10 text-success border-none text-caption font-black uppercase">Inscrit</Badge>
                                                            ) : (
                                                                <Badge className="bg-warning/10 text-warning border-none text-caption font-black uppercase">Absent</Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="h-[250px] pt-2 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                            <BarChart data={topTalkers} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={MSG_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                                    </linearGradient>
                                </defs>
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }} 
                                />
                                <YAxis hide />
                                <Tooltip cursor={{ fill: "rgba(255,255,255,0.02)", radius: 8 }} content={<CustomTooltip suffix="msgs" />} />
                                <Bar 
                                    dataKey="value" 
                                    fill={`url(#${MSG_GRADIENT_ID})`}
                                    radius={[8, 8, 4, 4]} 
                                    barSize={28}
                                    style={{ filter: "drop-shadow(0 4px 12px rgba(59,130,246,0.3))" }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Vocal */}
                <Card className="bg-surface/30 border-border backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground italic flex items-center gap-2">
                            <Mic className="w-4 h-4 text-success" />
                            Top Vocal
                        </CardTitle>
                        <CardDescription className="text-caption uppercase font-bold text-muted-foreground">Temps parole {timeframeLabel}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] pt-2 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                            <BarChart data={topVocal} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={VOICE_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                                    </linearGradient>
                                </defs>
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }} 
                                />
                                <YAxis hide />
                                <Tooltip cursor={{ fill: "rgba(255,255,255,0.02)", radius: 8 }} content={<CustomTooltip suffix="heures" />} />
                                <Bar 
                                    dataKey="value" 
                                    fill={`url(#${VOICE_GRADIENT_ID})`}
                                    radius={[8, 8, 4, 4]} 
                                    barSize={28}
                                    style={{ filter: "drop-shadow(0 4px 12px rgba(16,185,129,0.3))" }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
