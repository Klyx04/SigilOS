"use client";

import { useState } from "react";
type SystemIssueType = "BUG" | "AMELIORATION";
type SystemIssueStatus = "A_FAIRE" | "A_INVESTIGUER" | "EN_COURS" | "TERMINE" | "IGNORE";

import { createSystemIssue, updateSystemIssueStatus, deleteSystemIssue } from "@/server/actions/god-bugs-actions";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Trash2, Link as LinkIcon, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Issue = {
    id: number;
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    status: SystemIssueStatus;
    createdAt: Date;
    forumLink: string | null;
};

const TYPE_COLORS: Record<SystemIssueType, string> = {
    "BUG": "destructive",
    "AMELIORATION": "default",
};

const STATUS_COLORS: Record<SystemIssueStatus, string> = {
    "A_FAIRE": "secondary",
    "A_INVESTIGUER": "destructive",
    "EN_COURS": "default", // Orange/Warning in custom theme usually, let's stick to default/outline depending on your UI config
    "TERMINE": "success",  // Note: we might need custom bg
    "IGNORE": "outline"
};

const PRIORITY_COLORS: Record<string, string> = {
    "Très important": "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    "Important": "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    "Normal": "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    "Faible": "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20",
};

export function BugsClient({ initialIssues }: { initialIssues: Issue[] }) {
    const [issues, setIssues] = useState<Issue[]>(initialIssues);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | SystemIssueType>("ALL");

    const [form, setForm] = useState({
        type: "BUG" as SystemIssueType,
        category: "Divers",
        priority: "Normal",
        description: "",
        forumLink: ""
    });

    const handleCreate = async () => {
        if (!form.description) return toast.error("La description est requise.");
        const res = await createSystemIssue(form);
        if (res.success) {
            toast.success("Issue créée ! Rafraîchissez pour voir (ou revalider automatiquement).");
            setIsCreateOpen(false);
            setForm({ type: "BUG", category: "Divers", priority: "Normal", description: "", forumLink: "" });
            window.location.reload();
        } else {
            toast.error(res.error || "Erreur de création.");
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
        if (!confirm("Supprimer ce bug définitivement ?")) return;
        const res = await deleteSystemIssue(id);
        if (res.success) {
            setIssues(prev => prev.filter(i => i.id !== id));
            toast.success("Supprimé.");
        } else {
            toast.error(res.error || "Erreur.");
        }
    };

    const StatusBadge = ({ status }: { status: SystemIssueStatus }) => {
        let sc = "bg-primary text-primary-foreground";
        if (status === "A_FAIRE") sc = "bg-slate-500/20 text-slate-400";
        if (status === "A_INVESTIGUER") sc = "bg-red-500/20 text-red-500 border-red-500/50";
        if (status === "EN_COURS") sc = "bg-orange-500/20 text-orange-400 border-orange-500/50";
        if (status === "TERMINE") sc = "bg-green-500/20 text-green-500 border-green-500/50";
        if (status === "IGNORE") sc = "bg-zinc-800 text-zinc-400";

        return (
            <Badge variant="outline" className={`whitespace-nowrap ${sc}`}>
                {status.replace("_", " ")}
            </Badge>
        );
    };

    const filteredIssues = issues.filter(i => {
        const matchesFilter = i.description.toLowerCase().includes(filter.toLowerCase()) || 
                              i.category.toLowerCase().includes(filter.toLowerCase());
        const matchesType = filterType === "ALL" || i.type === filterType;
        return matchesFilter && matchesType;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                <div className="flex flex-wrap gap-2 w-full max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher (desc, catégorie)..."
                            className="pl-8 bg-zinc-950/50 border-white/10 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20 text-zinc-200"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                        <SelectTrigger className="w-[180px] bg-zinc-950/50 border-white/10 text-zinc-300">
                            <SelectValue placeholder="Tous les types" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10">
                            <SelectItem value="ALL" className="focus:bg-white/10 cursor-pointer">Tous les types</SelectItem>
                            <SelectItem value="BUG" className="focus:bg-white/10 cursor-pointer">Bugs</SelectItem>
                            <SelectItem value="AMELIORATION" className="focus:bg-white/10 cursor-pointer">Améliorations</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Signaler
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-zinc-200 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-white flex items-center">
                                <span className="text-amber-500 mr-2">✦</span> Nouveau Signalement
                            </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Type</Label>
                                    <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10">
                                            <SelectItem value="BUG" className="focus:bg-white/10 cursor-pointer">Bug</SelectItem>
                                            <SelectItem value="AMELIORATION" className="focus:bg-white/10 cursor-pointer">Amélioration</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-400">Priorité</Label>
                                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10">
                                            <SelectItem value="Très important" className="focus:bg-white/10 cursor-pointer text-red-500">Très important</SelectItem>
                                            <SelectItem value="Important" className="focus:bg-white/10 cursor-pointer text-orange-500">Important</SelectItem>
                                            <SelectItem value="Normal" className="focus:bg-white/10 cursor-pointer text-blue-500">Normal</SelectItem>
                                            <SelectItem value="Faible" className="focus:bg-white/10 cursor-pointer text-zinc-400">Faible</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400">Catégorie</Label>
                                <Input className="bg-white/5 border-white/10 text-white focus-visible:ring-amber-500/30" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Combat, Quêtes, Divers" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400">Description</Label>
                                <Textarea className="bg-white/5 border-white/10 text-white focus-visible:ring-amber-500/30 min-h-[100px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400">Lien forum (optionnel)</Label>
                                <Input className="bg-white/5 border-white/10 text-white focus-visible:ring-amber-500/30" value={form.forumLink} onChange={e => setForm({ ...form, forumLink: e.target.value })} placeholder="https://..." />
                            </div>
                        </div>
                        <DialogFooter className="pt-2 border-t border-white/10">
                            <Button onClick={handleCreate} className="bg-amber-500 hover:bg-amber-400 text-black font-bold w-full sm:w-auto">Enregistrer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-amber-500/20 bg-zinc-950/50 backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.05)] relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-white/[0.02]">
                                <TableHead className="w-[120px] text-amber-500/80 font-bold">Type</TableHead>
                                <TableHead className="w-[120px] text-amber-500/80 font-bold">Catégorie</TableHead>
                                <TableHead className="w-[80px] text-amber-500/80 font-bold">Id</TableHead>
                                <TableHead className="w-[140px] text-amber-500/80 font-bold">Priorité</TableHead>
                                <TableHead className="text-amber-500/80 font-bold">Description</TableHead>
                                <TableHead className="w-[160px] text-amber-500/80 font-bold">État</TableHead>
                                <TableHead className="w-[120px] text-amber-500/80 font-bold">Date / Lien</TableHead>
                                <TableHead className="w-[80px] text-right text-amber-500/80 font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredIssues.length === 0 ? (
                                <TableRow className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <TableCell colSpan={8} className="text-center h-32 text-zinc-500 italic">
                                        Aucun signalement trouvé.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredIssues.map(issue => (
                                    <TableRow key={issue.id} className={`border-white/5 hover:bg-white/[0.04] transition-colors group ${issue.status === "TERMINE" ? "opacity-40 hover:opacity-100" : ""}`}>
                                        <TableCell>
                                            <Badge variant={TYPE_COLORS[issue.type] as any} className="shadow-none font-bold uppercase tracking-wider text-[10px] w-full justify-center">
                                                {issue.type === "AMELIORATION" ? "Amélioration" : "Bug"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-white/10 text-zinc-300 font-medium">
                                                {issue.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-zinc-500 text-xs font-mono">
                                            #{issue.id}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${PRIORITY_COLORS[issue.priority] || "bg-secondary text-secondary-foreground shadow-none"} uppercase tracking-wider text-[10px] whitespace-nowrap border-0 w-full justify-center`}>
                                                {issue.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[400px]">
                                            <div className="flex items-center space-x-2">
                                                {issue.status === 'EN_COURS' && (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                                )}
                                                <p className="truncate group-hover:whitespace-normal transition-all text-sm text-zinc-300" title={issue.description}>
                                                    {issue.description}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select 
                                                value={issue.status} 
                                                onValueChange={(v: any) => handleUpdateStatus(issue.id, v)}
                                            >
                                                <SelectTrigger className="h-8 shadow-none border-0 px-2 group hover:bg-white/5 font-bold text-xs focus:ring-0 focus:ring-offset-0 transition-colors" style={{ background: 'transparent' }}>
                                                    <StatusBadge status={issue.status} />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-950 border-white/10">
                                                    <SelectItem value="A_FAIRE" className="focus:bg-white/10 cursor-pointer">À FAIRE</SelectItem>
                                                    <SelectItem value="A_INVESTIGUER" className="focus:bg-white/10 cursor-pointer text-red-400">À INVESTIGUER</SelectItem>
                                                    <SelectItem value="EN_COURS" className="focus:bg-white/10 cursor-pointer text-amber-400">EN COURS</SelectItem>
                                                    <SelectItem value="TERMINE" className="focus:bg-white/10 cursor-pointer text-green-400">TERMINÉ</SelectItem>
                                                    <SelectItem value="IGNORE" className="focus:bg-white/10 cursor-pointer text-zinc-500">IGNORÉ</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start text-[11px] text-zinc-500 font-mono">
                                                <span>{format(new Date(issue.createdAt), "dd MMM yy", { locale: fr })}</span>
                                                {issue.forumLink && (
                                                    <a href={issue.forumLink} target="_blank" rel="noreferrer" className="text-amber-500/70 hover:text-amber-400 flex items-center hover:underline transition-colors w-max">
                                                        <LinkIcon className="h-3 w-3 mr-1" />
                                                        Lien
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500/50 hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/20" onClick={() => handleDelete(issue.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
