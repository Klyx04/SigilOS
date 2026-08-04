'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Skull, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    getGameDataMonsters,
    upsertGameDataMonster,
    deleteGameDataMonster,
} from '@/server/actions/game-data-actions';

type GameDataMonster = {
    id: string;
    name: string;
    level: number;
    zone: string | null;
    imageUrl: string | null;
    description: string | null;
};

export function GameDataMonsterManager() {
    const [monsters, setMonsters] = useState<GameDataMonster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);

    // Form state
    const [formId, setFormId] = useState<string | undefined>(undefined);
    const [name, setName] = useState('');
    const [level, setLevel] = useState<number>(0);
    const [zone, setZone] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        const res = await getGameDataMonsters(search || undefined);
        if (res.success && res.data) setMonsters(res.data as GameDataMonster[]);
        setIsLoading(false);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(() => load(), 300);
        return () => clearTimeout(t);
    }, [load, search]);

    const resetForm = () => {
        setFormId(undefined);
        setName('');
        setLevel(0);
        setZone('');
        setImageUrl('');
        setDescription('');
        setCreating(false);
    };

    const handleEdit = (m: GameDataMonster) => {
        setFormId(m.id);
        setName(m.name);
        setLevel(m.level || 0);
        setZone(m.zone || '');
        setImageUrl(m.imageUrl || '');
        setDescription(m.description || '');
        setCreating(true);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Le nom est requis');
            return;
        }
        setSaving(true);
        const res = await upsertGameDataMonster({
            id: formId,
            name,
            level,
            zone,
            imageUrl,
            description,
        });
        setSaving(false);
        if (res.success) {
            toast.success(formId ? 'Monstre mis à jour !' : 'Monstre créé !');
            resetForm();
            await load();
        } else {
            toast.error(res.error || 'Erreur');
        }
    };

    const handleDelete = async (m: GameDataMonster) => {
        if (!confirm(`Supprimer le monstre "${m.name}" ?`)) return;
        const res = await deleteGameDataMonster(m.id);
        if (res.success) {
            toast.success('Monstre supprimé');
            await load();
        } else {
            toast.error(res.error || 'Erreur');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Skull className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Monstres Spéciaux</h2>
                        <p className="text-xs text-zinc-500">Base game-data utilisée par le sélecteur « Monstre Spécial » des missions événement.</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/50"
                    onClick={() => (creating ? resetForm() : setCreating(true))}
                >
                    {creating ? <X className="w-3.5 h-3.5 mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    {creating ? 'Annuler' : 'Créer un monstre'}
                </Button>
            </div>

            {/* Search */}
            <Input
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs"
                placeholder="Rechercher un monstre par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* Create / Edit form */}
            {creating && (
                <div className="p-4 bg-zinc-900/60 border border-purple-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Nom <span className="text-purple-400">*</span></Label>
                            <Input className="bg-zinc-950 border-zinc-800" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Malice, Damadrya..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Niveau</Label>
                            <Input type="number" min={0} max={230} className="bg-zinc-950 border-zinc-800" value={level || ''} onChange={(e) => setLevel(parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Zone</Label>
                            <Input className="bg-zinc-950 border-zinc-800" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone ou événement..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-400">Image (URL)</Label>
                            <Input className="bg-zinc-950 border-zinc-800" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://.../monstre.png" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-400">Description</Label>
                        <Textarea className="bg-zinc-950 border-zinc-800 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description optionnelle..." />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {formId ? 'Mettre à jour' : 'Créer'}
                        </Button>
                    </div>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
                </div>
            ) : monsters.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-sm border border-dashed border-white/5 rounded-2xl">
                    Aucun monstre spécial — clique sur « Créer un monstre » pour commencer.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {monsters.map((m) => (
                        <div key={m.id} className="p-4 rounded-2xl border border-white/5 bg-zinc-900/40 flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden">
                                {m.imageUrl ? (
                                    <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Skull className="w-5 h-5 text-zinc-700" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-white font-black uppercase text-xs truncate">{m.name}</h4>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleEdit(m)} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-purple-400 text-[10px] font-bold uppercase">Éditer</button>
                                        <button onClick={() => handleDelete(m)} className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-zinc-500 font-bold mt-0.5">
                                    {m.level > 0 ? `Niv. ${m.level}` : 'Niveau ?'}
                                    {m.zone && <span> · {m.zone}</span>}
                                </div>
                                {m.description && (
                                    <p className="text-[10px] text-zinc-600 mt-1 leading-snug line-clamp-2">{m.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}