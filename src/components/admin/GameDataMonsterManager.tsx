"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ImageDownloader } from "./ImageDownloader";
import { Search, Plus, Edit2, Trash2, Skull, MapPin, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    getGameDataMonsters,
    upsertGameDataMonster,
    deleteGameDataMonster,
} from "@/server/actions/game-data-actions";

interface GameDataMonster {
    id: string;
    name: string;
    level: number;
    zone: string | null;
    imageUrl: string | null;
    description: string | null;
}

export function GameDataMonsterManager() {
    const [monsters, setMonsters] = useState<GameDataMonster[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: "",
        level: 0,
        zone: "",
        imageUrl: "",
        description: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getGameDataMonsters(searchQuery || undefined);
        if (res.success && res.data) setMonsters(res.data);
        setLoading(false);
    }, [searchQuery]);

    useEffect(() => {
        const t = setTimeout(() => load(), 300);
        return () => clearTimeout(t);
    }, [load, searchQuery]);

    const resetForm = () => {
        setEditing(null);
        setForm({ name: "", level: 0, zone: "", imageUrl: "", description: "" });
    };

    const startEdit = (m: GameDataMonster) => {
        setEditing(m.id);
        setForm({
            name: m.name,
            level: m.level || 0,
            zone: m.zone || "",
            imageUrl: m.imageUrl || "",
            description: m.description || "",
        });
        setIsDialogOpen(true);
    };

    const openCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Le nom est requis");
            return;
        }
        const res = await upsertGameDataMonster({
            id: editing || undefined,
            name: form.name,
            level: form.level,
            zone: form.zone,
            imageUrl: form.imageUrl,
            description: form.description,
        });
        if (res.success) {
            toast.success(editing ? "Monstre mis à jour !" : "Monstre créé !");
            resetForm();
            setIsDialogOpen(false);
            await load();
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Supprimer le monstre "${name}" ?`)) return;
        const res = await deleteGameDataMonster(id);
        if (res.success) {
            toast.success("Monstre supprimé");
            await load();
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const filteredMonsters = monsters.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un monstre spécial..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-purple-500/50"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={openCreate}
                        className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-900/20 transition-all font-medium"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau Monstre
                    </Button>
                </div>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Chargement des monstres spéciaux...</div>
            ) : filteredMonsters.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                    Aucun monstre spécial trouvé
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredMonsters.map((monster) => (
                        <div
                            key={monster.id}
                            className="group relative bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-950/50 hover:bg-slate-800 text-slate-400">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                        <DropdownMenuItem onClick={() => startEdit(monster)} className="text-slate-300 focus:bg-slate-800 cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-purple-400" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(monster.id, monster.name)} className="text-red-400 focus:bg-red-950/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex flex-col h-full gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700 group-hover:border-purple-500/50 transition-colors">
                                        {monster.imageUrl ? (
                                            <img
                                                src={monster.imageUrl}
                                                alt={monster.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <Skull className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-200 truncate group-hover:text-purple-300 transition-colors">
                                            {monster.name}
                                        </h3>
                                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                                            {monster.level > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-purple-950/30 text-purple-400 border border-purple-900/30 text-caption font-bold">
                                                    Lvl {monster.level}
                                                </span>
                                            )}
                                            {monster.zone && (
                                                <span className="flex items-center gap-1 truncate text-caption text-slate-500">
                                                    <MapPin className="w-3 h-3" />
                                                    {monster.zone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {monster.description && (
                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 pt-2 border-t border-slate-800/50 mt-auto">
                                        {monster.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent draggable className="w-[95vw] max-w-4xl max-h-[95vh] bg-slate-950 border-slate-800 p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="p-6 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-white flex items-center gap-4">
                                <Skull className="w-7 h-7 text-purple-500" />
                                {editing ? "Modifier le monstre spécial" : "Nouveau monstre spécial"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Configurer les informations affichées dans le sélecteur « Monstre Spécial » des missions événement.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6 pb-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Nom <span className="text-rose-500">*</span></Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        placeholder="Ex: Malice, Damadrya, Tofus d'Halouine..."
                                        className="h-14 bg-slate-950 border-slate-800 focus:border-purple-500/50 focus:ring-purple-500/20 text-lg font-bold transition-all rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Niveau</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={230}
                                            value={form.level || ""}
                                            onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
                                            placeholder="Ex: 120"
                                            className="h-14 bg-slate-950 border-slate-800 focus:border-purple-500/50 focus:ring-purple-500/20 text-lg font-bold transition-all rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                            <MapPin className="w-3 h-3" /> Zone
                                        </Label>
                                        <Input
                                            value={form.zone}
                                            onChange={(e) => setForm({ ...form, zone: e.target.value })}
                                            placeholder="Zone ou événement..."
                                            className="h-14 bg-slate-950 border-slate-800 focus:border-purple-500/50 focus:ring-purple-500/20 text-lg font-bold transition-all rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Description</Label>
                                    <Textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Description optionnelle..."
                                        className="bg-slate-950 border-slate-800 focus:border-purple-500/50 focus:ring-purple-500/20 min-h-[100px]"
                                    />
                                </div>
                            </div>

                            {/* Image — Galerie / Web / Uploader */}
                            <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 shadow-inner">
                                <h3 className="text-sm font-black text-purple-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4 mb-6">Illustration</h3>
                                <ImageDownloader
                                    type="monster"
                                    imageUrl={form.imageUrl}
                                    identifier={form.name}
                                    onImageDownloaded={(path) => setForm({ ...form, imageUrl: path })}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-950 py-4 shrink-0">
                                <Button type="submit" className="flex-[3] bg-purple-600 hover:bg-purple-500 h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-purple-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer le monstre"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-14 border-white/10 hover:bg-white/5 text-slate-300 text-sm font-bold uppercase tracking-widest transition-all rounded-xl"
                                >
                                    Fermer
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}