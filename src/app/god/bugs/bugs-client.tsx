"use client";

import { useState } from "react";
import { createSystemIssue, updateSystemIssueStatus, deleteSystemIssue, updateSystemIssue } from "@/server/actions/god-bugs-actions";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Trash2, Link as LinkIcon, Edit, BugIcon, LightbulbIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
};

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
            {status.replace("_", " ")}
        </Badge>
    );
};

const IssueForm = ({ form, setForm }: { form: any, setForm: (f: any) => void }) => (
    <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label className="text-zinc-400">Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800">
                        <SelectItem value="BUG" className="focus:bg-zinc-800 cursor-pointer text-red-400"><BugIcon className="inline w-3 h-3 mr-2" />Bug</SelectItem>
                        <SelectItem value="AMELIORATION" className="focus:bg-zinc-800 cursor-pointer text-blue-400"><LightbulbIcon className="inline w-3 h-3 mr-2" />Amélioration</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-zinc-400">Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800">
                        <SelectItem value="Très important" className="focus:bg-zinc-800 cursor-pointer text-red-500">Très important</SelectItem>
                        <SelectItem value="Important" className="focus:bg-zinc-800 cursor-pointer text-orange-500">Important</SelectItem>
                        <SelectItem value="Normal" className="focus:bg-zinc-800 cursor-pointer text-blue-500">Normal</SelectItem>
                        <SelectItem value="Faible" className="focus:bg-zinc-800 cursor-pointer text-zinc-500">Faible</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="space-y-2">
            <Label className="text-zinc-400">Catégorie</Label>
            <Input className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-amber-500/30" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Combat, Quêtes, Divers" />
        </div>
        <div className="space-y-2">
            <Label className="text-zinc-400">Description</Label>
            <Textarea className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-amber-500/30 min-h-[120px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="space-y-2">
            <Label className="text-zinc-400">Lien (optionnel)</Label>
            <Input className="bg-zinc-900 border-zinc-800 text-white focus-visible:ring-amber-500/30" value={form.forumLink} onChange={e => setForm({ ...form, forumLink: e.target.value })} placeholder="https://..." />
        </div>
    </div>
);

export function BugsClient({ initialIssues }: { initialIssues: Issue[] }) {
    const [issues, setIssues] = useState<Issue[]>(initialIssues);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingIssueId, setEditingIssueId] = useState<number | null>(null);
    const [filter, setFilter] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | SystemIssueType>("ALL");

    const [form, setForm] = useState({
        type: "BUG" as SystemIssueType,
        category: "Divers",
        priority: "Normal",
        description: "",
        forumLink: ""
    });

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

    const filteredIssues = issues.filter(i => {
        const matchesFilter = i.description.toLowerCase().includes(filter.toLowerCase()) || 
                              i.category.toLowerCase().includes(filter.toLowerCase());
        const matchesType = filterType === "ALL" || i.type === filterType;
        return matchesFilter && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <div className="flex flex-wrap gap-3 w-full max-w-2xl">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher un ticket..."
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
                </div>

                <Button onClick={openCreateModal} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition-all rounded-md">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nouveau Ticket
                </Button>
            </div>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-medium text-white flex items-center">Nouveau Ticket</DialogTitle>
                    </DialogHeader>
                    <IssueForm form={form} setForm={setForm} />
                    <DialogFooter className="pt-4 border-t border-zinc-800/50">
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold w-full sm:w-auto">Créer le ticket</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT MODAL */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-medium text-white flex items-center">
                            Éditer le Ticket #{editingIssueId}
                        </DialogTitle>
                    </DialogHeader>
                    <IssueForm form={form} setForm={setForm} />
                    <DialogFooter className="pt-4 border-t border-zinc-800/50">
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold w-full sm:w-auto">Sauvegarder</Button>
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
                                <TableHead className="w-[100px] text-right text-zinc-400 font-medium px-4">Actions</TableHead>
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
                                    <TableRow key={issue.id} className={`border-zinc-800/30 hover:bg-white/[0.02] transition-colors group ${issue.status === "TERMINE" ? "opacity-60 hover:opacity-100" : ""}`}>
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
                                                <p className="truncate text-sm text-zinc-100 font-medium" title={issue.description}>
                                                    {issue.description}
                                                </p>
                                                {issue.forumLink && (
                                                    <a href={issue.forumLink} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors shrink-0">
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-1 opacity-60">
                                                Créé le {format(new Date(issue.createdAt), "dd MMM yy", { locale: fr })}
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
                                            <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md" onClick={() => openEditModal(issue)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded-md" onClick={() => handleDelete(issue.id)}>
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
