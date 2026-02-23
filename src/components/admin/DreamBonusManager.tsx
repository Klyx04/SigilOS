"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    getDreamBonuses,
    createDreamBonus,
    updateDreamBonus,
    deleteDreamBonus,
} from "@/server/actions/game-data-admin-actions";
import { Moon, Trash2, Edit2, Plus, Search, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DreamBonus {
    id: string;
    name: string;
    type: "ACTIF" | "PASSIF" | "CONSOMMABLE";
    description?: string | null;
    imageUrl?: string | null;
    costMin?: number | null;
    costMax?: number | null;
}

const TYPE_COLORS: Record<string, string> = {
    ACTIF: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    PASSIF: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    CONSOMMABLE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const TYPE_EMOJI: Record<string, string> = {
    ACTIF: "⚡",
    PASSIF: "🌙",
    CONSOMMABLE: "🧪",
};

export default function DreamBonusManager() {
    const [bonuses, setBonuses] = useState<DreamBonus[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        type: "ACTIF" as "ACTIF" | "PASSIF" | "CONSOMMABLE",
        description: "",
        imageUrl: "",
        costMin: "" as string | number,
        costMax: "" as string | number,
    });

    useEffect(() => { loadBonuses(); }, []);

    async function loadBonuses() {
        setLoading(true);
        const result = await getDreamBonuses();
        if (result.success && result.data) setBonuses(result.data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const payload = {
            name: formData.name,
            type: formData.type,
            description: formData.description || undefined,
            imageUrl: formData.imageUrl || undefined,
            costMin: formData.costMin !== "" ? Number(formData.costMin) : null,
            costMax: formData.costMax !== "" ? Number(formData.costMax) : null,
        };
        const result = editing
            ? await updateDreamBonus(editing, payload)
            : await createDreamBonus(payload);

        if (result.success) {
            toast.success(editing ? "Bonus mis à jour" : "Bonus créé");
            resetForm();
            setIsDialogOpen(false);
            loadBonuses();
        } else {
            toast.error(result.error || "Erreur");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer ce bonus de rêve ?")) return;
        const result = await deleteDreamBonus(id);
        if (result.success) { toast.success("Bonus supprimé"); loadBonuses(); }
        else toast.error(result.error);
    }

    function resetForm() {
        setFormData({ name: "", type: "ACTIF", description: "", imageUrl: "", costMin: "", costMax: "" });
        setEditing(null);
    }

    function startEdit(bonus: DreamBonus) {
        setEditing(bonus.id);
        setFormData({
            name: bonus.name,
            type: bonus.type,
            description: bonus.description || "",
            imageUrl: bonus.imageUrl || "",
            costMin: bonus.costMin ?? "",
            costMax: bonus.costMax ?? "",
        });
        setIsDialogOpen(true);
    }

    const filtered = bonuses.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by type
    const byType = {
        ACTIF: filtered.filter(b => b.type === "ACTIF"),
        PASSIF: filtered.filter(b => b.type === "PASSIF"),
        CONSOMMABLE: filtered.filter(b => b.type === "CONSOMMABLE"),
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un bonus..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                </div>
                <Button
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" /> Nouveau Bonus
                </Button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    Aucun bonus de rêve trouvé
                </div>
            ) : (
                <div className="space-y-6">
                    {(["ACTIF", "PASSIF", "CONSOMMABLE"] as const).map(type => {
                        const items = byType[type];
                        if (items.length === 0) return null;
                        return (
                            <div key={type}>
                                <h3 className={`text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-800 pb-2 ${TYPE_COLORS[type].split(" ")[1]}`}>
                                    <span>{TYPE_EMOJI[type]}</span> {type} ({items.length})
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {items.map(bonus => (
                                        <div
                                            key={bonus.id}
                                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 transition-all"
                                        >
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-slate-950/80 hover:bg-slate-800 text-slate-400">
                                                            <MoreHorizontal className="w-3 h-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                                        <DropdownMenuItem onClick={() => startEdit(bonus)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                                            <Edit2 className="w-3 h-3 mr-2 text-indigo-400" /> Modifier
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDelete(bonus.id)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                                            <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="flex flex-col items-center text-center gap-2">
                                                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                                                    {bonus.imageUrl
                                                        ? <img src={bonus.imageUrl} alt={bonus.name} className="w-full h-full object-contain rounded-lg" />
                                                        : <Moon className="w-5 h-5 text-slate-600" />
                                                    }
                                                </div>
                                                <h4 className="font-semibold text-slate-200 text-sm leading-tight">{bonus.name}</h4>
                                                {(bonus.costMin != null || bonus.costMax != null) && (
                                                    <span className="text-[10px] text-slate-500">
                                                        {bonus.costMin ?? "?"}{bonus.costMax && bonus.costMax !== bonus.costMin ? `–${bonus.costMax}` : ""} PR
                                                    </span>
                                                )}
                                                <Badge className={`text-[10px] border ${TYPE_COLORS[bonus.type]}`}>{bonus.type}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[95vw] max-w-lg bg-slate-950 border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                            <Moon className="w-6 h-6 text-indigo-400" />
                            {editing ? "Modifier le bonus" : "Nouveau bonus de rêve"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Configurez les détails du bonus de rêve (Songes).
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nom *</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Ex: Abondance"
                                className="bg-slate-900 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            >
                                <option value="ACTIF">⚡ Actif</option>
                                <option value="PASSIF">🌙 Passif</option>
                                <option value="CONSOMMABLE">🧪 Consommable</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Coût min (PR)</label>
                                <Input
                                    type="number" min={0}
                                    value={formData.costMin}
                                    onChange={e => setFormData({ ...formData, costMin: e.target.value })}
                                    placeholder="0"
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Coût max (PR)</label>
                                <Input
                                    type="number" min={0}
                                    value={formData.costMax}
                                    onChange={e => setFormData({ ...formData, costMax: e.target.value })}
                                    placeholder="0"
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                placeholder="Effets du bonus..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">URL Image</label>
                            <Input
                                value={formData.imageUrl}
                                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://..."
                                className="bg-slate-900 border-slate-700 text-white"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-bold">
                                {editing ? "💾 Enregistrer" : "➕ Créer"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                Annuler
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
