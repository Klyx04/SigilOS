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
import ReactMarkdown from 'react-markdown';

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
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">📝 Gestion Changelog</h1>
                    <p className="text-zinc-400 mt-1">Créer et gérer les entrées changelog</p>
                </div>
                {!isCreating && (
                    <Button onClick={() => setIsCreating(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvelle entrée
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
                            <div className="border-2 border-emerald-500/30 bg-emerald-500/5 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <Label htmlFor="summary" className="text-emerald-400 font-bold">
                                        📣 Résumé Marketing (Landing Page)
                                    </Label>
                                </div>
                                <Textarea
                                    id="summary"
                                    placeholder="Ajout du système de changelog public + webhooks Discord automatiques. Synchronisation en temps réel des guildes et membres."
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    rows={3}
                                    className="bg-zinc-900/50 border-emerald-500/20"
                                    required
                                />
                                <p className="text-xs text-emerald-400/80 mt-2">
                                    ✨ Court et accrocheur (2-3 lignes max) - Visible par tous les visiteurs
                                </p>
                            </div>

                            {/* CONTENT - Technical (highlighted in blue) */}
                            <div className="border-2 border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <Label htmlFor="content" className="text-blue-400 font-bold">
                                        📝 Contenu Technique Complet (Markdown)
                                    </Label>
                                </div>
                                <Textarea
                                    id="content"
                                    placeholder="## Nouveautés&#10;&#10;- Auto-sync Discord (GUILD_CREATE, GUILD_DELETE)&#10;- Audit trail complet&#10;- Changelog avec markdown editor&#10;&#10;## Détails Techniques&#10;&#10;[...]"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={14}
                                    className="font-mono text-sm bg-zinc-900/50 border-blue-500/20"
                                    required
                                />
                                <p className="text-xs text-blue-400/80 mt-2">
                                    🛠️ Détails techniques avec markdown - Visible sur /changelog
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
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                <p className="text-sm font-semibold text-indigo-400 mb-1">Résumé (Landing Page)</p>
                                <p className="text-zinc-300">{summary || 'Résumé marketing...'}</p>
                            </div>

                            {/* Full Content */}
                            <div>
                                <p className="text-sm font-semibold text-zinc-400 mb-2">Contenu Complet</p>
                                <div className="prose prose-invert prose-zinc max-w-none">
                                    <ReactMarkdown>{content || '*Pas de contenu...*'}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            )}

            {/* Entries List */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">Entrées existantes ({entries.length})</h2>
                {entries.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8">Aucune entrée changelog</p>
                ) : (
                    entries.map((entry) => (
                        <div
                            key={entry.id}
                            className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-white">{entry.title}</h3>
                                        <Badge variant="outline">{categoryLabels[entry.category]}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                                        <span className="font-mono">{entry.version}</span>
                                        <span>•</span>
                                        <time>
                                            {formatDistanceToNow(new Date(entry.publishedAt), {
                                                addSuffix: true,
                                                locale: fr,
                                            })}
                                        </time>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(entry)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(entry.id)}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
