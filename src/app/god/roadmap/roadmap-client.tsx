"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Trash2, Edit, CheckCircle2, Circle, Clock, Rocket, Zap, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { createRoadmapItem, deleteRoadmapItem, toggleRoadmapVisibility, updateRoadmapItem } from "@/server/actions/god-roadmap-actions";

type RoadmapItem = {
    id: number;
    title: string;
    description: string;
    status: string; // "TODO", "PROGRESS", "DONE"
    quarter: string; // e.g. "Court Terme (En cours)", "Moyen Terme", "Vision Long Terme"
    priority: string;   
    createdAt: Date;
};

export function RoadmapClient({ initialItems, initialEnabled }: { initialItems: RoadmapItem[], initialEnabled: boolean }) {
    const [items, setItems] = useState<RoadmapItem[]>(initialItems);
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [filter, setFilter] = useState("");

    const [form, setForm] = useState({
        title: "",
        description: "",
        status: "TODO",
        quarter: "Court Terme",
        priority: "NORMAL"
    });

    const handleToggleVisibility = async (checked: boolean) => {
        setIsEnabled(checked);
        const res = await toggleRoadmapVisibility(checked);
        if (res.success) {
            toast.success(checked ? "La Roadmap est visible pour tous les membres." : "La Roadmap est cachée.");
        } else {
            setIsEnabled(!checked);
            toast.error(res.error || "Erreur.");
        }
    };

    const openCreateModal = () => {
        setEditingItemId(null);
        setForm({ title: "", description: "", status: "TODO", quarter: "Court Terme", priority: "NORMAL" });
        setIsCreateOpen(true);
    };

    const openEditModal = (item: RoadmapItem) => {
        setEditingItemId(item.id);
        setForm({
            title: item.title,
            description: item.description,
            status: item.status,
            quarter: item.quarter,
            priority: item.priority
        });
        setIsEditOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.description) return toast.error("Le titre et la description sont requis.");

        if (editingItemId) {
            const res = await updateRoadmapItem(editingItemId, form);
            if (res.success) {
                toast.success("Mis à jour avec succès.");
                setIsEditOpen(false);
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur.");
            }
        } else {
            const res = await createRoadmapItem(form);
            if (res.success) {
                toast.success("Item ajouté !");
                setIsCreateOpen(false);
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur de création.");
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Supprimer cet item ?")) return;
        const res = await deleteRoadmapItem(id);
        if (res.success) {
            setItems(prev => prev.filter(i => i.id !== id));
            toast.success("Supprimé.");
        } else {
            toast.error(res.error || "Erreur.");
        }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        const res = await updateRoadmapItem(id, { status });
        if (res.success) {
            setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        } else {
            toast.error(res.error || "Erreur.");
        }
    };

    const filteredItems = items.filter(i => {
        return i.title.toLowerCase().includes(filter.toLowerCase()) || 
               i.description.toLowerCase().includes(filter.toLowerCase()) ||
               i.quarter.toLowerCase().includes(filter.toLowerCase());
    });

    const IssueForm = () => (
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label className="text-zinc-400">Titre</Label>
                <Input className="bg-zinc-900 border-zinc-800 text-white" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
                <Label className="text-zinc-400">Période (Quarter)</Label>
                <Input className="bg-zinc-900 border-zinc-800 text-white" placeholder="Ex: Q3 2026, Court Terme..." value={form.quarter} onChange={e => setForm({ ...form, quarter: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-zinc-400">Priorité</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800">
                            <SelectItem value="HIGH" className="text-red-500">Haute</SelectItem>
                            <SelectItem value="NORMAL" className="text-blue-500">Moyenne</SelectItem>
                            <SelectItem value="LOW" className="text-zinc-400">Faible</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-zinc-400">Statut</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800">
                            <SelectItem value="TODO" className="text-zinc-400">À faire</SelectItem>
                            <SelectItem value="PROGRESS" className="text-amber-500">En cours</SelectItem>
                            <SelectItem value="DONE" className="text-emerald-500">Terminé</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-zinc-400">Description</Label>
                <Textarea className="bg-zinc-900 border-zinc-800 text-white min-h-[100px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <div className="flex flex-wrap gap-3 w-full max-w-2xl items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher..."
                            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-200"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 border border-white/5 bg-zinc-900 px-3 py-1.5 rounded-lg">
                        <Label htmlFor="roadmap-toggle" className="text-sm text-zinc-300 font-medium cursor-pointer">
                            Rendre Public
                        </Label>
                        <Switch id="roadmap-toggle" checked={isEnabled} onCheckedChange={handleToggleVisibility} />
                    </div>
                    <Button onClick={openCreateModal} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter
                    </Button>
                </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-medium text-white">Nouvel Item Roadmap</DialogTitle>
                    </DialogHeader>
                    <IssueForm />
                    <DialogFooter>
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black">Sauvegarder</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-medium text-white">Éditer Item</DialogTitle>
                    </DialogHeader>
                    <IssueForm />
                    <DialogFooter>
                        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black">Sauvegarder</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-0 bg-zinc-950/40 backdrop-blur-xl shadow-xl ring-1 ring-white/5 rounded-xl">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                <TableHead className="w-[120px] text-zinc-400">Période</TableHead>
                                <TableHead className="text-zinc-400">Sujet</TableHead>
                                <TableHead className="w-[160px] text-zinc-400">État</TableHead>
                                <TableHead className="w-[100px] text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                    <TableCell colSpan={4} className="text-center h-48 text-zinc-500">Aucun item.</TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map(item => (
                                    <TableRow key={item.id} className="border-zinc-800/30 hover:bg-white/[0.02] group">
                                        <TableCell>
                                            <Badge variant="outline" className="text-zinc-300 border-zinc-700 bg-zinc-800/50">
                                                {item.quarter}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            <div className="font-semibold text-zinc-100 flex gap-2 items-center">
                                               {item.priority === "HIGH" && <span className="text-red-500 text-xs shadow-none border border-red-500/20 bg-red-500/10 px-1 py-0.5 rounded">HIGH</span>}
                                               {item.title}
                                            </div>
                                            <div className="text-sm text-zinc-400 mt-1">{item.description}</div>
                                        </TableCell>

                                        <TableCell>
                                            <Select value={item.status} onValueChange={(v) => handleUpdateStatus(item.id, v)}>
                                                <SelectTrigger className="h-8 border-transparent hover:border-zinc-700 bg-transparent">
                                                    {item.status === "TODO" && <Badge variant="outline" className="text-zinc-400">Planifié</Badge>}
                                                    {item.status === "PROGRESS" && <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10"><Circle className="w-3 h-3 mr-1" />En cours</Badge>}
                                                    {item.status === "DONE" && <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10"><CheckCircle2 className="w-3 h-3 mr-1" />Terminé</Badge>}
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    <SelectItem value="TODO">Planifié</SelectItem>
                                                    <SelectItem value="PROGRESS">En cours</SelectItem>
                                                    <SelectItem value="DONE">Terminé</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white" onClick={() => openEditModal(item)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => handleDelete(item.id)}>
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
