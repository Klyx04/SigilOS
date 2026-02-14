'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChangelogCategory } from '@prisma/client';
import { Plus, Trash2, Edit, Eye } from 'lucide-react';
import {
    createChangelogEntry,
    getChangelogEntries,
    deleteChangelogEntry,
    updateChangelogEntry
} from '@/server/actions/changelog-actions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DocContent } from '@/components/doc/doc-content';
import { AdvancedEditor } from '@/components/editor/advanced-editor';

const categoryLabels: Record<ChangelogCategory, string> = {
    FEATURE: 'Fonctionnalité',
    BUGFIX: 'Correction',
    SECURITY: 'Sécurité',
    PERFORMANCE: 'Performance',
    DOCUMENTATION: 'Documentation',
};

export default function GODChangelogPage() {
    const [entries, setEntries] = useState<Awaited<ReturnType<typeof getChangelogEntries>>>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);

    // Form state
    const [version, setVersion] = useState('');
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<ChangelogCategory>('FEATURE');

    useEffect(() => {
        loadEntries();
    }, []);

    async function loadEntries() {
        const data = await getChangelogEntries();
        setEntries(data);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!version || !title || !summary || !content) {
            toast.error('Tous les champs sont requis');
            return;
        }

        const input = { version, title, summary, content, category };

        if (editingId) {
            const result = await updateChangelogEntry(editingId, input);
            if (result.success) {
                toast.success('Changelog mis à jour');
                resetForm();
                loadEntries();
            } else {
                toast.error(result.error || 'Erreur');
            }
        } else {
            const result = await createChangelogEntry(input);
            if (result.success) {
                toast.success('Changelog créé');
                resetForm();
                loadEntries();
            } else {
                toast.error(result.error || 'Erreur');
            }
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Supprimer cette entrée ?')) return;

        const result = await deleteChangelogEntry(id);
        if (result.success) {
            toast.success('Changelog supprimé');
            loadEntries();
        } else {
            toast.error(result.error || 'Erreur');
        }
    }

    function handleEdit(entry: typeof entries[0]) {
        setEditingId(entry.id);
        setVersion(entry.version);
        setTitle(entry.title);
        setSummary(entry.summary);
        setContent(entry.content);
        setCategory(entry.category);
        setIsCreating(true);
    }

    function resetForm() {
        setVersion('');
        setTitle('');
        setSummary('');
        setContent('');
        setCategory('FEATURE');
        setIsCreating(false);
        setEditingId(null);
        setPreviewMode(false);
    }

    return (
        <div className="p-8 md:p-12 md:pt-16 space-y-16">
            {/* Header - Scaled */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-400 uppercase tracking-widest">
                        <Plus className="w-4 h-4" />
                        <span>Gestionnaire de Version</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        Changelog <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600">Engine</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Initialisez, modifiez et orchestrez les annonces de mise à jour pour la communauté.
                    </p>
                </div>
                {!isCreating && (
                    <Button onClick={() => setIsCreating(true)} className="px-8 py-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-amber-500/20">
                        <Plus className="w-6 h-6 mr-3" />
                        Nouvelle Entrée
                    </Button>
                )}
            </div>

            {/* Create/Edit Form */}
            {isCreating && (
                <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">
                            {editingId ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
                        </h2>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={previewMode ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPreviewMode(!previewMode)}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                {previewMode ? 'Édition' : 'Aperçu'}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                                Annuler
                            </Button>
                        </div>
                    </div>

                    {!previewMode ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="version">Version</Label>
                                    <Input
                                        id="version"
                                        placeholder="v1.3.0"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="category">Catégorie</Label>
                                    <Select value={category} onValueChange={(v) => setCategory(v as ChangelogCategory)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(categoryLabels).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="title">Titre</Label>
                                <Input
                                    id="title"
                                    placeholder="Automation Webhooks + Changelog"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            {/* SUMMARY - Marketing (highlighted in green) */}
                            <div className="border-2 border-emerald-500/30 bg-emerald-500/5 rounded-3xl p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    <Label htmlFor="summary" className="text-xl text-emerald-400 font-black uppercase tracking-widest">
                                        📣 Résumé Marketing (Landing Page)
                                    </Label>
                                </div>
                                <AdvancedEditor
                                    initialContent={summary}
                                    onChange={setSummary}
                                />
                                <p className="text-sm text-emerald-400/60 mt-4 font-medium italic">
                                    ✨ Court et accrocheur - Sera affiché comme accroche sur la page publique.
                                </p>
                            </div>

                            {/* CONTENT - Technical (highlighted in blue) */}
                            <div className="border-2 border-blue-500/30 bg-blue-500/5 rounded-3xl p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    <Label htmlFor="content" className="text-xl text-blue-400 font-black uppercase tracking-widest">
                                        📝 Contenu Technique Complet
                                    </Label>
                                </div>
                                <AdvancedEditor
                                    initialContent={content}
                                    onChange={setContent}
                                />
                                <p className="text-sm text-blue-400/60 mt-4 font-medium italic">
                                    🛠️ Détails techniques complets - Utilisez '/' pour insérer des blocs riches ou des callouts.
                                </p>
                            </div>

                            <Button type="submit" className="w-full">
                                {editingId ? 'Mettre à jour' : 'Créer l\'entrée'}
                            </Button>
                        </>
                    ) : (
                        <div className="border border-zinc-800 rounded-lg p-6 space-y-6">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-bold text-white">{title || 'Titre...'}</h3>
                                <Badge variant="outline">{categoryLabels[category]}</Badge>
                            </div>
                            <p className="text-sm text-zinc-400 font-mono">{version || 'Version...'}</p>

                            {/* Summary Preview */}
                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6">
                                <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4">Résumé (Public Snapshot)</p>
                                <DocContent content={summary} />
                            </div>

                            {/* Full Content */}
                            <div>
                                <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-4">Contenu Complet (Full Release)</p>
                                <div className="bg-zinc-950/30 border border-white/5 rounded-2xl p-8">
                                    <DocContent content={content} />
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            )}

            {/* Entries List - Scaled */}
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-4">
                        <div className="w-2 h-10 bg-amber-500 rounded-full" />
                        Archives du Système ({entries.length})
                    </h2>
                </div>

                {entries.length === 0 ? (
                    <div className="text-center py-24 bg-zinc-900/30 border border-white/5 rounded-3xl">
                        <p className="text-zinc-500 text-xl font-medium italic">Aucun log enregistré dans les archives temporaires.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:bg-zinc-900/60 hover:border-amber-500/30 transition-all duration-300 group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors uppercase tracking-tight">{entry.title}</h3>
                                            <Badge variant="outline" className="px-4 py-1 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-400 font-black uppercase tracking-widest text-[10px]">
                                                {categoryLabels[entry.category]}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-6 text-base text-zinc-500 font-medium">
                                            <span className="font-mono bg-zinc-800/80 px-3 py-1 rounded-lg text-amber-500/80 text-sm font-black tracking-widest uppercase">
                                                {entry.version}
                                            </span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                                            <time className="flex items-center gap-2">
                                                {formatDistanceToNow(new Date(entry.publishedAt), {
                                                    addSuffix: true,
                                                    locale: fr,
                                                })}
                                            </time>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleEdit(entry)}
                                            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 border border-transparent hover:border-amber-500/20 transition-all"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(entry.id)}
                                            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
