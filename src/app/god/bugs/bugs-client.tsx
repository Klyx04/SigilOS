"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { createSystemIssue, updateSystemIssueStatus, deleteSystemIssue, updateSystemIssue } from "@/server/actions/god-bugs-actions";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Trash2, Link as LinkIcon, Edit, BugIcon, LightbulbIcon, Bell, Send, Hash, MessageSquareText, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { notifyMemberFeedbackAction } from "@/server/actions/feedback-actions";

type SystemIssueType = "BUG" | "AMELIORATION";
type SystemIssueStatus = "A_FAIRE" | "A_INVESTIGUER" | "EN_COURS" | "TERMINE" | "IGNORE";

type Issue = {
    id: number;
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    status: SystemIssueStatus;
    createdAt: Date;
    forumLink: string | null;
    feedbackType?: string | null;
    sourcePage?: string | null;
    targetSlug?: string | null;
    guildId?: string | null;
    memberName?: string | null;
    memberGuildName?: string | null;
    creatorId?: string | null;
};

const FEEDBACK_EMOJIS = ["🎉", "🏆", "💖", "👏", "👍", "⭐", "🔥", "🎁"];

const PRIORITY_COLORS: Record<string, string> = {
    "Très important": "bg-red-500/10 text-red-500 border-red-500/20",
    "Important": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Normal": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Faible": "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

const StatusBadge = ({ status }: { status: SystemIssueStatus }) => {
    let sc = "bg-primary text-primary-foreground";
    if (status === "A_FAIRE") sc = "bg-zinc-800 text-zinc-300 border-zinc-700";
    if (status === "A_INVESTIGUER") sc = "bg-red-500/20 text-red-500 border-red-500/50";
    if (status === "EN_COURS") sc = "bg-amber-500/20 text-amber-500 border-amber-500/50";
    if (status === "TERMINE") sc = "bg-emerald-500/20 text-emerald-500 border-emerald-500/50";
    if (status === "IGNORE") sc = "bg-transparent text-zinc-600 border border-zinc-800";

    return (
        <Badge variant="outline" className={`whitespace-nowrap transition-colors ${sc}`}>
            {status === "A_INVESTIGUER" ? "À INVESTIGUER" : status.replace("_", " ")}
        </Badge>
    );
};

const IssueForm = ({ form, setForm }: { form: any, setForm: (f: any) => void }) => (
    <div className="grid gap-6 py-2">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    Type
                </Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="h-12 bg-zinc-900/50 border-white/5 text-zinc-200 hover:bg-zinc-900 transition-colors focus:ring-1 focus:ring-amber-500/50">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-white/10 shadow-2xl">
                        <SelectItem value="BUG" className="focus:bg-zinc-900 cursor-pointer py-3">
                            <div className="flex items-center gap-2 text-red-400 font-medium">
                                <BugIcon className="w-4 h-4" /> Bug
                            </div>
                        </SelectItem>
                        <SelectItem value="AMELIORATION" className="focus:bg-zinc-900 cursor-pointer py-3">
                            <div className="flex items-center gap-2 text-blue-400 font-medium">
                                <LightbulbIcon className="w-4 h-4" /> Amélioration
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="h-12 bg-zinc-900/50 border-white/5 text-zinc-200 hover:bg-zinc-900 transition-colors focus:ring-1 focus:ring-amber-500/50">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-white/10 shadow-2xl">
                        <SelectItem value="Très important" className="focus:bg-zinc-900 cursor-pointer py-2">
                            <span className="flex items-center gap-2 font-medium text-red-500">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Très important
                            </span>
                        </SelectItem>
                        <SelectItem value="Important" className="focus:bg-zinc-900 cursor-pointer py-2">
                            <span className="flex items-center gap-2 font-medium text-orange-500">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                Important
                            </span>
                        </SelectItem>
                        <SelectItem value="Normal" className="focus:bg-zinc-900 cursor-pointer py-2">
                            <span className="flex items-center gap-2 font-medium text-blue-500">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                Normal
                            </span>
                        </SelectItem>
                        <SelectItem value="Faible" className="focus:bg-zinc-900 cursor-pointer py-2">
                            <span className="flex items-center gap-2 font-medium text-zinc-500">
                                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                                Faible
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Catégorie</Label>
            <div className="relative">
                <Input 
                    className="h-12 pl-4 bg-zinc-900/50 border-white/5 text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/50 placeholder:text-zinc-600 transition-colors hover:bg-zinc-900" 
                    value={form.category} 
                    onChange={e => setForm({ ...form, category: e.target.value })} 
                    placeholder="Ex: Combat, Quêtes, Interface, Divers..." 
                />
            </div>
        </div>

        <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Description détaillée</Label>
            <Textarea 
                className="bg-zinc-900/50 border-white/5 text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/50 placeholder:text-zinc-600 min-h-[140px] resize-none p-4 transition-colors hover:bg-zinc-900" 
                value={form.description} 
                onChange={e => setForm({ ...form, description: e.target.value })} 
                placeholder="Décrivez le comportement attendu et ce qu'il se passe actuellement..."
            />
        </div>

        <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5" />
                Lien de référence (Optionnel)
            </Label>
            <Input 
                className="h-12 bg-zinc-900/50 border-white/5 text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/50 placeholder:text-zinc-600 transition-colors hover:bg-zinc-900" 
                value={form.forumLink} 
                onChange={e => setForm({ ...form, forumLink: e.target.value })} 
                placeholder="https://..." 
            />
        </div>
    </div>
);

export function BugsClient({ initialIssues, initialTicketParam }: { initialIssues: Issue[], initialTicketParam?: string }) {
    const [issues, setIssues] = useState<Issue[]>(initialIssues);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingIssueId, setEditingIssueId] = useState<number | null>(null);
    const [filter, setFilter] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | SystemIssueType>("ALL");
    const [filterFeedback, setFilterFeedback] = useState<"ALL" | "FEEDBACK" | "INTERNE">("ALL");
    const [filterGuild, setFilterGuild] = useState<string>("ALL");
    const [highlightedId, setHighlightedId] = useState<number | null>(null);

    // Notif God modal state
    const [notifyIssue, setNotifyIssue] = useState<Issue | null>(null);
    const [notifyMessage, setNotifyMessage] = useState("");
    const [notifyEmoji, setNotifyEmoji] = useState("🎉");
    const [isNotifying, startNotify] = useTransition();

    const [form, setForm] = useState({
        type: "BUG" as SystemIssueType,
        category: "Divers",
        priority: "Normal",
        description: "",
        forumLink: ""
    });

    // Focus sur le ticket ciblé via ?ticket=SIG-XX
    useEffect(() => {
        if (!initialTicketParam) return;
        const numeric = parseInt(String(initialTicketParam).replace(/\D/g, ""), 10);
        if (!isNaN(numeric) && issues.some(i => i.id === numeric)) {
            setHighlightedId(numeric);
            setTimeout(() => {
                document.getElementById(`issue-row-${numeric}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 300);
            setTimeout(() => setHighlightedId(null), 4000);
        }
    }, [initialTicketParam, issues]);

    // ── Stats feedback (dérivées) ──
    const feedbackIssues = useMemo(() => issues.filter(i => !!i.feedbackType), [issues]);

    const guildCounts = useMemo(() => {
        const map = new Map<string, number>();
        feedbackIssues.forEach(i => {
            const g = i.memberGuildName || "Inconnue";
            map.set(g, (map.get(g) || 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [feedbackIssues]);

    const categoryCounts = useMemo(() => {
        const map = new Map<string, number>();
        feedbackIssues.forEach(i => {
            const c = i.feedbackType || "AUTRE";
            map.set(c, (map.get(c) || 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [feedbackIssues]);

    const topContributors = useMemo(() => {
        const map = new Map<string, { name: string; count: number }>();
        feedbackIssues.forEach(i => {
            const name = i.memberName || "Inconnu";
            const cur = map.get(name) || { name, count: 0 };
            cur.count++;
            map.set(name, cur);
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [feedbackIssues]);

    // Guildes disponibles pour le filtre
    const availableGuilds = useMemo(() => {
        const set = new Set<string>();
        feedbackIssues.forEach(i => { if (i.memberGuildName) set.add(i.memberGuildName); });
        return Array.from(set).sort();
    }, [feedbackIssues]);

    const openCreateModal = () => {
        setEditingIssueId(null);
        setForm({ type: "BUG", category: "Divers", priority: "Normal", description: "", forumLink: "" });
        setIsCreateOpen(true);
    };

    const openEditModal = (issue: Issue) => {
        setEditingIssueId(issue.id);
        setForm({
            type: issue.type,
            category: issue.category,
            priority: issue.priority,
            description: issue.description,
            forumLink: issue.forumLink || ""
        });
        setIsEditOpen(true);
    };

    const handleSave = async () => {
        if (!form.description) return toast.error("La description est requise.");

        if (editingIssueId) {
            const res = await updateSystemIssue(editingIssueId, form);
            if (res.success) {
                toast.success("Mis à jour avec succès.");
                setIssues(prev => prev.map(i => i.id === editingIssueId ? { ...i, ...form } : i));
                setIsEditOpen(false);
            } else {
                toast.error(res.error || "Erreur.");
            }
        } else {
            const res = await createSystemIssue(form);
            if (res.success) {
                toast.success("Issue créée !");
                setIsCreateOpen(false);
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur de création.");
            }
        }
    };

    const handleUpdateStatus = async (id: number, status: SystemIssueStatus) => {
        const res = await updateSystemIssueStatus(id, status);
        if (res.success) {
            setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
            toast.success("Statut mis à jour.");
        } else {
            toast.error(res.error || "Erreur.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer ce rapport définitivement ?")) return;
        const res = await deleteSystemIssue(id);
        if (res.success) {
            setIssues(prev => prev.filter(i => i.id !== id));
            toast.success("Supprimé.");
        } else {
            toast.error(res.error || "Erreur.");
        }
    };

    const handleNotify = () => {
        if (!notifyIssue) return;
        if (!notifyMessage.trim()) return toast.error("Écris un message de remerciement.");
        startNotify(async () => {
            const res = await notifyMemberFeedbackAction({
                issueId: notifyIssue.id,
                memberName: notifyIssue.memberName || "ce membre",
                emoji: notifyEmoji,
                message: notifyMessage.trim(),
            });
            if (res.success) {
                toast.success(`Notification envoyée à ${notifyIssue.memberName || "ce membre"} !`);
                setNotifyIssue(null);
                setNotifyMessage("");
                setNotifyEmoji("🎉");
            } else {
                toast.error(res.error || "Erreur d'envoi.");
            }
        });
    };

    const filteredIssues = issues.filter(i => {
        const matchesFilter = i.description.toLowerCase().includes(filter.toLowerCase()) || 
                              i.category.toLowerCase().includes(filter.toLowerCase()) ||
                              (i.memberName || "").toLowerCase().includes(filter.toLowerCase());
        const matchesType = filterType === "ALL" || i.type === filterType;
        const isFeedback = !!i.feedbackType;
        const matchesFeedback = filterFeedback === "ALL" || (filterFeedback === "FEEDBACK" ? isFeedback : !isFeedback);
        const matchesGuild = filterGuild === "ALL" || (i.memberGuildName || "Inconnue") === filterGuild;
        return matchesFilter && matchesType && matchesFeedback && matchesGuild;
    });

    return (
        <div className="space-y-6">
            {/* ── STATS FEEDBACK ── */}
            {feedbackIssues.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border border-white/5 bg-zinc-950/40 rounded-xl overflow-hidden">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                                <Trophy className="w-4 h-4 text-amber-400" />
                                Top Contributeurs
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {topContributors.slice(0, 5).map((c, idx) => (
                                    <div key={c.name} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-zinc-300 font-medium truncate">
                                            <span className="text-zinc-600 font-mono w-4">{idx + 1}</span>
                                            {c.name}
                                        </span>
                                        <span className="text-amber-400 font-black">{c.count}</span>
                                    </div>
                                ))}
                                {topContributors.length === 0 && <span className="text-zinc-600 text-sm">Aucun feedback</span>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-white/5 bg-zinc-950/40 rounded-xl overflow-hidden">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                                <MessageSquareText className="w-4 h-4 text-indigo-400" />
                                Par Catégorie
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {categoryCounts.slice(0, 6).map(([cat, count]) => (
                                    <div key={cat} className="flex items-center justify-between text-sm">
                                        <span className="text-zinc-300 font-medium truncate">{cat}</span>
                                        <span className="text-indigo-400 font-black">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-white/5 bg-zinc-950/40 rounded-xl overflow-hidden">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                                <Hash className="w-4 h-4 text-emerald-400" />
                                Par Guilde
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {guildCounts.slice(0, 6).map(([g, count]) => (
                                    <div key={g} className="flex items-center justify-between text-sm">
                                        <span className="text-zinc-300 font-medium truncate">{g}</span>
                                        <span className="text-emerald-400 font-black">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <div className="flex flex-wrap gap-3 w-full max-w-2xl">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher un ticket, un membre..."
                            className="pl-9 bg-zinc-900 border-zinc-800 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20 text-zinc-200 shadow-inner rounded-md"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                        <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-zinc-300 rounded-md shadow-sm">
                            <SelectValue placeholder="Tous les types" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="ALL" className="focus:bg-zinc-800 cursor-pointer">Tous les types</SelectItem>
                            <SelectItem value="BUG" className="focus:bg-zinc-800 cursor-pointer text-red-400">Bugs</SelectItem>
                            <SelectItem value="AMELIORATION" className="focus:bg-zinc-800 cursor-pointer text-blue-400">Améliorations</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterFeedback} onValueChange={(v: any) => setFilterFeedback(v)}>
                        <SelectTrigger className="w-[170px] bg-zinc-900 border-zinc-800 text-zinc-300 rounded-md shadow-sm">
                            <SelectValue placeholder="Toute provenance" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="ALL" className="focus:bg-zinc-800 cursor-pointer">Toute provenance</SelectItem>
                            <SelectItem value="FEEDBACK" className="focus:bg-zinc-800 cursor-pointer text-emerald-400">Feedbacks membres</SelectItem>
                            <SelectItem value="INTERNE" className="focus:bg-zinc-800 cursor-pointer text-zinc-300">Internes</SelectItem>
                        </SelectContent>
                    </Select>
                    {availableGuilds.length > 0 && (
                        <Select value={filterGuild} onValueChange={setFilterGuild}>
                            <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-zinc-300 rounded-md shadow-sm">
                                <SelectValue placeholder="Toutes les guildes" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="ALL" className="focus:bg-zinc-800 cursor-pointer">Toutes les guildes</SelectItem>
                                {availableGuilds.map(g => (
                                    <SelectItem key={g} value={g} className="focus:bg-zinc-800 cursor-pointer">{g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <Button onClick={openCreateModal} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition-all rounded-md">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nouveau Ticket
                </Button>
            </div>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 bg-zinc-950 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden rounded-2xl">
                    <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/20">
                        <DialogTitle className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <PlusCircle className="w-6 h-6 text-blue-400" />
                            </div>
                            Ouverture d'un Ticket
                        </DialogTitle>
                        <p className="text-zinc-500 text-sm mt-2 ml-[3.25rem]">
                            Documentez précisément le bug ou l'amélioration pour faciliter le travail de l'équipe de développement.
                        </p>
                    </div>
                    
                    <div className="px-6 py-2">
                        <IssueForm form={form} setForm={setForm} />
                    </div>

                    <DialogFooter className="px-6 py-5 border-t border-white/5 bg-zinc-900/30 flex gap-3 sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-white hover:bg-white/5">
                            Annuler
                        </Button>
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all">
                            Créer le ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT MODAL */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 bg-zinc-950 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden rounded-2xl">
                    <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/20">
                        <DialogTitle className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                <Edit className="w-6 h-6 text-amber-400" />
                            </div>
                            Édition du Ticket <span className="text-zinc-500 ml-2">#SIG-{editingIssueId}</span>
                        </DialogTitle>
                        <p className="text-zinc-500 text-sm mt-2 ml-[3.25rem]">
                            Mettez à jour les informations du ticket.
                        </p>
                    </div>
                    
                    <div className="px-6 py-2">
                        <IssueForm form={form} setForm={setForm} />
                    </div>

                    <DialogFooter className="px-6 py-5 border-t border-white/5 bg-zinc-900/30 flex gap-3 sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="text-zinc-400 hover:text-white hover:bg-white/5">
                            Annuler
                        </Button>
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all">
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* NOTIFY GOD MODAL */}
            <Dialog open={!!notifyIssue} onOpenChange={(v) => { if (!v) setNotifyIssue(null); }}>
                <DialogContent className="sm:max-w-[480px] p-0 bg-zinc-950 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden rounded-2xl">
                    <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/20">
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <Bell className="w-6 h-6 text-emerald-400" />
                            </div>
                            Remercier le membre
                        </DialogTitle>
                        <p className="text-zinc-500 text-sm mt-2 ml-[3.25rem]">
                            Envoyer une notification Dashboard à{" "}
                            <span className="text-white font-bold">{notifyIssue?.memberName || "ce membre"}</span>{" "}
                            pour son feedback.
                        </p>
                    </div>

                    <div className="px-6 py-4 space-y-4">
                        {/* Choix d'émoji */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">Émoji</Label>
                            <div className="flex flex-wrap gap-2">
                                {FEEDBACK_EMOJIS.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => setNotifyEmoji(e)}
                                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all ${notifyEmoji === e ? "bg-emerald-500/20 border-emerald-500/50 scale-110" : "bg-white/5 border-white/10 hover:border-white/30"}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Message</Label>
                            <Textarea
                                value={notifyMessage}
                                onChange={(e) => setNotifyMessage(e.target.value)}
                                placeholder={`Merci pour ton retour ! Ce bug est en cours de traitement.`}
                                className="bg-zinc-900/50 border-white/10 text-zinc-200 placeholder:text-zinc-600 min-h-[100px] resize-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
                            />
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-white/5 bg-zinc-900/30 flex gap-3 sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => setNotifyIssue(null)} className="text-zinc-400 hover:text-white hover:bg-white/5">
                            Annuler
                        </Button>
                        <Button onClick={handleNotify} disabled={isNotifying || !notifyMessage.trim()} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all">
                            <Send className="w-3.5 h-3.5 mr-2" />
                            {isNotifying ? "Envoi…" : "Envoyer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-0 bg-zinc-950/40 backdrop-blur-xl shadow-xl relative overflow-hidden ring-1 ring-white/5 rounded-xl">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-800/50 hover:bg-transparent bg-zinc-900/30">
                                <TableHead className="w-[80px] text-zinc-400 font-medium px-4">Ticket</TableHead>
                                <TableHead className="w-[120px] text-zinc-400 font-medium">Type</TableHead>
                                <TableHead className="w-[120px] text-zinc-400 font-medium">Priorité</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Sujet</TableHead>
                                <TableHead className="w-[160px] text-zinc-400 font-medium">État</TableHead>
                                <TableHead className="w-[190px] text-right text-zinc-400 font-medium px-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredIssues.length === 0 ? (
                                <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                    <TableCell colSpan={6} className="text-center h-48 text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <BugIcon className="h-8 w-8 opacity-20" />
                                            <p>Aucun ticket trouvé.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredIssues.map(issue => (
                                    <TableRow 
                                        key={issue.id} 
                                        id={`issue-row-${issue.id}`}
                                        className={`border-zinc-800/30 hover:bg-white/[0.02] transition-colors group ${issue.status === "TERMINE" ? "opacity-60 hover:opacity-100" : ""} ${highlightedId === issue.id ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40" : ""}`}
                                    >
                                        <TableCell className="px-4 font-mono text-zinc-500 text-xs">
                                            SIG-{issue.id}
                                        </TableCell>
                                        
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {issue.type === "BUG" ? <BugIcon className="h-3.5 w-3.5 text-red-400" /> : <LightbulbIcon className="h-3.5 w-3.5 text-blue-400" />}
                                                <span className="text-xs font-medium text-zinc-300">
                                                    {issue.category}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="outline" className={`${PRIORITY_COLORS[issue.priority] || "bg-secondary text-secondary-foreground shadow-none"} uppercase tracking-wider text-[10px] whitespace-nowrap border px-2 py-0 h-5`}>
                                                {issue.priority}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className="max-w-[400px]">
                                            <div className="flex items-center space-x-2">
                                                {issue.status === 'EN_COURS' && (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                                )}
                                                {issue.feedbackType && (
                                                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[9px] shrink-0">
                                                        Feedback membre
                                                    </Badge>
                                                )}
                                                <p className="truncate text-sm text-zinc-100 font-medium" title={issue.description}>
                                                    {issue.description}
                                                </p>
                                                {issue.forumLink && (
                                                    <a href={issue.forumLink} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors shrink-0">
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                            {/* Pseudo Discord + guilde */}
                                            {issue.feedbackType && (
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    {issue.memberName && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300">
                                                            👤 {issue.memberName}
                                                        </span>
                                                    )}
                                                    {issue.memberGuildName && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/60 border border-white/10 text-[10px] font-bold text-zinc-400">
                                                            🏷️ {issue.memberGuildName}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-zinc-500 font-mono mt-1 opacity-60">
                                                Créé le {format(new Date(issue.createdAt), "dd MMM yy", { locale: fr })}
                                                {issue.sourcePage ? ` • ${issue.sourcePage}` : ""}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <Select 
                                                value={issue.status} 
                                                onValueChange={(v: any) => handleUpdateStatus(issue.id, v)}
                                            >
                                                <SelectTrigger className="h-7 shadow-none border-0 px-2 group hover:bg-white/5 font-medium text-xs focus:ring-1 focus:ring-amber-500/50 transition-colors bg-transparent w-full">
                                                    <StatusBadge status={issue.status} />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    <SelectItem value="A_FAIRE" className="focus:bg-zinc-800 cursor-pointer">À FAIRE</SelectItem>
                                                    <SelectItem value="A_INVESTIGUER" className="focus:bg-zinc-800 cursor-pointer text-red-400">À INVESTIGUER</SelectItem>
                                                    <SelectItem value="EN_COURS" className="focus:bg-zinc-800 cursor-pointer text-amber-400">EN COURS</SelectItem>
                                                    <SelectItem value="TERMINE" className="focus:bg-zinc-800 cursor-pointer text-emerald-400">TERMINÉ</SelectItem>
                                                    <SelectItem value="IGNORE" className="focus:bg-zinc-800 cursor-pointer text-zinc-500">IGNORÉ</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        <TableCell className="text-right px-4">
                                            <div className="flex items-center justify-end gap-1 transition-opacity">
                                                {issue.feedbackType && issue.memberName && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md border border-emerald-500/30 bg-emerald-500/10" 
                                                        onClick={() => { setNotifyIssue(issue); setNotifyMessage(""); setNotifyEmoji("🎉"); }}
                                                        title="Notifier la personne du bug (Dashboard)"
                                                    >
                                                        <Bell className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md opacity-20 group-hover:opacity-100 transition-opacity" onClick={() => openEditModal(issue)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded-md opacity-20 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(issue.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}