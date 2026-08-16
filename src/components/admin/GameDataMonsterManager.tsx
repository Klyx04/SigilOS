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
            <div className="flex flex-col md:flex-row items-center gap-4 bg-surface/50 p-4 rounded-lg border border-border/50 backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un monstre spécial..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-elevated border-border text-foreground placeholder:text-muted-foreground focus:ring-info/50"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={openCreate}
                        className="w-full md:w-auto bg-info hover:bg-info shadow-lg shadow-purple-900/20 transition-all font-medium"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau Monstre
                    </Button>
                </div>
            </div>

            {/* Grid List */}
            {loading ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement des monstres spéciaux...</div>
            ) : filteredMonsters.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-surface/30 rounded-lg border border-dashed border-border">
                    Aucun monstre spécial trouvé
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredMonsters.map((monster) => (
                        <div
                            key={monster.id}
                            className="group relative bg-surface/40 border border-border rounded-xl overflow-hidden hover:border-info/30 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-300"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 hover:bg-elevated text-muted-foreground">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-surface border-border">
                                        <DropdownMenuItem onClick={() => startEdit(monster)} className="text-foreground focus:bg-elevated cursor-pointer">
                                            <Edit2 className="w-4 h-4 mr-2 text-info" /> Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(monster.id, monster.name)} className="text-danger focus:bg-danger/30 cursor-pointer">
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="p-4 flex flex-col h-full gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-elevated shrink-0 border border-border group-hover:border-info/50 transition-colors">
                                        {monster.imageUrl ? (
                                            <img
                                                src={monster.imageUrl}
                                                alt={monster.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Skull className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-foreground truncate group-hover:text-info transition-colors">
                                            {monster.name}
                                        </h3>
                                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                            {monster.level > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-info/30 text-info border border-info/30 text-caption font-bold">
                                                    Lvl {monster.level}
                                                </span>
                                            )}
                                            {monster.zone && (
                                                <span className="flex items-center gap-1 truncate text-caption text-muted-foreground">
                                                    <MapPin className="w-3 h-3" />
                                                    {monster.zone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {monster.description && (
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pt-2 border-t border-border/50 mt-auto">
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
                <DialogContent draggable className="w-[95vw] max-w-4xl max-h-[95vh] bg-background border-border p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="p-6 bg-surface/50 border-b border-border flex items-center justify-between shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-4">
                                <Skull className="w-7 h-7 text-info" />
                                {editing ? "Modifier le monstre spécial" : "Nouveau monstre spécial"}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Configurer les informations affichées dans le sélecteur « Monstre Spécial » des missions événement.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="space-y-6 pb-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Nom <span className="text-danger">*</span></Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        placeholder="Ex: Malice, Damadrya, Tofus d'Halouine..."
                                        className="h-14 bg-background border-border focus:border-info/50 focus:ring-info/20 text-lg font-bold transition-all rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Niveau</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={230}
                                            value={form.level || ""}
                                            onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
                                            placeholder="Ex: 120"
                                            className="h-14 bg-background border-border focus:border-info/50 focus:ring-info/20 text-lg font-bold transition-all rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center gap-1.5">
                                            <MapPin className="w-3 h-3" /> Zone
                                        </Label>
                                        <Input
                                            value={form.zone}
                                            onChange={(e) => setForm({ ...form, zone: e.target.value })}
                                            placeholder="Zone ou événement..."
                                            className="h-14 bg-background border-border focus:border-info/50 focus:ring-info/20 text-lg font-bold transition-all rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Description</Label>
                                    <Textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Description optionnelle..."
                                        className="bg-background border-border focus:border-info/50 focus:ring-info/20 min-h-[100px]"
                                    />
                                </div>
                            </div>

                            {/* Image — Galerie / Web / Uploader */}
                            <div className="bg-background/50 p-6 rounded-3xl border border-border shadow-inner">
                                <h3 className="text-sm font-black text-info uppercase tracking-[0.2em] border-b border-border pb-4 mb-6">Illustration</h3>
                                <ImageDownloader
                                    type="monster"
                                    imageUrl={form.imageUrl}
                                    identifier={form.name}
                                    onImageDownloaded={(path) => setForm({ ...form, imageUrl: path })}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-border sticky bottom-0 bg-background py-4 shrink-0">
                                <Button type="submit" className="flex-[3] bg-info hover:bg-info h-14 text-lg font-black uppercase tracking-widest shadow-xl shadow-purple-600/20 transition-all rounded-xl active:scale-[0.98]">
                                    {editing ? "💾 Enregistrer" : "➕ Créer le monstre"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="flex-1 h-14 border-border hover:bg-surface text-foreground text-sm font-bold uppercase tracking-widest transition-all rounded-xl"
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