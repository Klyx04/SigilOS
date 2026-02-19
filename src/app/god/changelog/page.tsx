'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChangelogCategory } from '@prisma/client';
import { Plus, Trash2, Edit, Eye, Save, X, Terminal, Rocket, Layout, FileText, Settings2, Sparkles, ChevronRight, Activity } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const categoryLabels: Record<ChangelogCategory, string> = {
    FEATURE: 'Fonctionnalité',
    BUGFIX: 'Correction',
    SECURITY: 'Sécurité',
    PERFORMANCE: 'Performance',
    DOCUMENTATION: 'Documentation',
};

const categoryColors: Record<ChangelogCategory, string> = {
    FEATURE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    BUGFIX: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    SECURITY: 'bg-red-500/10 text-red-400 border-red-500/20',
    PERFORMANCE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DOCUMENTATION: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function GODChangelogPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Form state
    const [form, setForm] = useState({
        version: '',
        title: '',
        summary: '',
        content: '',
        category: 'FEATURE' as ChangelogCategory,
        isInternal: false,
    });

    useEffect(() => {
        loadEntries();
    }, []);

    async function loadEntries() {
        const data = await getChangelogEntries();
        setEntries(data);
    }

    const handleChange = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    async function handleSubmit() {
        if (!form.version || !form.title || !form.summary || !form.content) {
            toast.error('Version, titre, résumé et contenu sont requis');
            return;
        }

        setLoading(true);
        if (editingId) {
            const result = await updateChangelogEntry(editingId, form);
            if (result.success) {
                toast.success('Changelog mis à jour');
                resetForm();
                loadEntries();
            } else {
                toast.error(result.error || 'Erreur');
            }
        } else {
            const result = await createChangelogEntry(form);
            if (result.success) {
                toast.success('Changelog créé');
                resetForm();
                loadEntries();
            } else {
                toast.error(result.error || 'Erreur');
            }
        }
        setLoading(false);
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

    function handleEdit(entry: any) {
        setEditingId(entry.id);
        setForm({
            version: entry.version,
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            category: entry.category,
            isInternal: entry.isInternal ?? false,
        });
        setIsCreating(true);
    }

    function resetForm() {
        setForm({
            version: '',
            title: '',
            summary: '',
            content: '',
            category: 'FEATURE',
            isInternal: false,
        });
        setIsCreating(false);
        setEditingId(null);
        setPreviewMode(false);
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 font-sans selection:bg-amber-500/30 overflow-hidden">

            {/* 🚀 FIXED TOP BAR */}
            <div className="z-30 h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-zinc-900/60 backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
                        <Terminal className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-widest leading-none flex items-center gap-3">
                            Changelog Engine
                            {!isCreating && <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 ml-2">{entries.length} Logs</Badge>}
                        </h1>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter mt-1 italic">Signature Numérique & Orchestration des Versions</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isCreating ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewMode(!previewMode)}
                                className={cn("rounded-xl border border-white/5 h-10 px-4", previewMode ? "bg-amber-500/10 text-amber-400" : "text-zinc-500 hover:text-white")}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                {previewMode ? 'Reprendre l\'édition' : 'Mode Aperçu'}
                            </Button>
                            <div className="w-px h-6 bg-white/5 mx-1" />
                            <Button type="button" variant="ghost" onClick={resetForm} className="text-zinc-500 hover:text-white font-bold h-10 px-6 rounded-xl">
                                <X className="w-4 h-4 mr-2" />
                                Annuler
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading} className="bg-amber-500 hover:bg-amber-400 text-black font-black h-10 px-8 rounded-xl shadow-xl shadow-amber-500/20 uppercase tracking-widest text-[10px]">
                                {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {editingId ? 'Envoyer Mise à Jour' : 'Déployer Version'}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsCreating(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-black h-12 px-8 rounded-2xl shadow-xl shadow-amber-500/20 uppercase tracking-widest">
                            <Plus className="w-5 h-5 mr-3" />
                            Nouvelle Release
                        </Button>
                    )}
                </div>
            </div>

            {/* 🛠️ MAIN VIEWPORT */}
            <div className="flex-1 flex overflow-hidden">
                {!isCreating ? (
                    /* LIST VIEW */
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-8 md:p-12">
                        <div className="max-w-[1400px] mx-auto space-y-12">
                            <div className="space-y-4">
                                <h2 className="text-4xl font-black text-white font-heading tracking-tighter">Flux d'Activité <span className="text-amber-500">Core</span></h2>
                                <p className="text-zinc-500 text-lg max-w-xl">Historique complet des transformations de SigilOS.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {entries.map((entry) => (
                                    <div key={entry.id} className="group relative bg-zinc-900/40 border border-white/5 rounded-[2rem] p-8 hover:bg-zinc-900/60 hover:border-amber-500/30 transition-all duration-300">
                                        <div className="absolute top-6 right-6 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400">
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(entry.id)} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black uppercase tracking-widest text-[9px]", categoryColors[entry.category as ChangelogCategory])}>
                                                    {categoryLabels[entry.category as ChangelogCategory]}
                                                </Badge>
                                                <span className="font-mono text-amber-500 text-xs font-black tracking-widest">{entry.version}</span>
                                            </div>
                                            <h3 className="text-2xl font-black text-white leading-tight pr-12 group-hover:text-amber-200 transition-colors uppercase tracking-tighter">{entry.title}</h3>
                                            <div className="flex items-center gap-3 pt-6 border-t border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                                <Activity className="w-3 h-3" />
                                                {formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true, locale: fr })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* EDITING INTERFACE */
                    <ResizablePanelGroup orientation="horizontal" className="h-full">
                        {/* FORM SIDE */}
                        <ResizablePanel defaultSize={previewMode ? 35 : 100} minSize={20} className="flex-1 flex flex-col bg-zinc-950">
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-8 space-y-12 pb-32">
                                <div className="max-w-4xl mx-auto space-y-12">
                                    {/* 📋 Section 1: Metadata */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Settings2 className="w-5 h-5 text-amber-500" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Données de Déploiement</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Archive ID (vX.Y.Z)</Label>
                                                <Input
                                                    value={form.version}
                                                    onChange={e => handleChange('version', e.target.value)}
                                                    placeholder="v1.3.0"
                                                    className="h-14 bg-zinc-900/50 border-white/10 rounded-2xl font-mono text-amber-500 px-6 brightness-110"
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Désignation de la Release</Label>
                                                <Input
                                                    value={form.title}
                                                    onChange={e => handleChange('title', e.target.value)}
                                                    placeholder="Focus: UI Engine & Security..."
                                                    className="h-14 bg-zinc-900/50 border-white/10 rounded-2xl font-black px-6 text-lg"
                                                />
                                            </div>
                                            <div className="md:col-span-3 space-y-2">
                                                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Classification Principale</Label>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                                    {(Object.keys(categoryLabels) as ChangelogCategory[]).map((cat) => (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => handleChange('category', cat)}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2",
                                                                form.category === cat
                                                                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-xl shadow-amber-500/5"
                                                                    : "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10"
                                                            )}
                                                        >
                                                            <span className="text-[9px] font-black uppercase tracking-tighter text-center">{categoryLabels[cat]}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Visibility toggle */}
                                            <div className="md:col-span-3 flex items-center gap-4 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('isInternal', !form.isInternal)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all text-sm font-bold",
                                                        form.isInternal
                                                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                                                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                    )}
                                                >
                                                    {form.isInternal ? '🔒 Interne uniquement (membres connectés)' : '🌍 Public (visible par tous)'}
                                                </button>
                                            </div>

                                            {/* 📝 Summary Field */}
                                            <div className="md:col-span-3 space-y-2 pt-4">
                                                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Résumé Marketing (Public)</Label>
                                                <Input
                                                    value={form.summary}
                                                    onChange={e => handleChange('summary', e.target.value)}
                                                    placeholder="Une phrase courte pour l'accueil et le public..."
                                                    className="h-14 bg-zinc-900/50 border-white/10 rounded-2xl px-6 text-zinc-300 italic"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 📝 Content Editor (Unified) */}
                                    <div className="space-y-6 pt-12 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-5 h-5 text-purple-500" />
                                                <h3 className="text-sm font-black text-purple-500 uppercase tracking-[0.2em]">Contenu du Changelog</h3>
                                            </div>
                                        </div>
                                        <div className="relative group p-1 bg-gradient-to-br from-purple-500/20 to-transparent rounded-[2.5rem]">
                                            <div className="bg-zinc-950 rounded-[2.4rem] overflow-hidden">
                                                <AdvancedEditor
                                                    initialContent={form.content}
                                                    onChange={(html) => handleChange('content', html)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-6 py-3 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                            <Rocket className="w-4 h-4 text-purple-400 shrink-0" />
                                            <p className="text-[10px] text-purple-500/70 font-bold italic tracking-wide">✍️ Écrivez le contenu complet de cette release. Visible selon le toggle Public/Interne.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ResizablePanel>

                        {previewMode && (
                            <>
                                <ResizableHandle withHandle className="bg-white/5 w-1.5 hover:bg-amber-500/20 transition-colors" />
                                <ResizablePanel defaultSize={65} minSize={30} className="hidden lg:flex flex-col bg-zinc-900/40">
                                    <div className="flex-1 flex flex-col h-full">
                                        <div className="h-14 flex items-center px-8 border-b border-white/5 bg-zinc-950/40">
                                            <Eye className="w-4 h-4 text-zinc-500 mr-3" />
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Digital Twin Render (Pro-Preview)</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-12 md:p-24 scrollbar-thin scrollbar-thumb-white/10 dark">
                                            <div className="max-w-3xl mx-auto space-y-16">
                                                {/* Preview Content */}
                                                <div className="space-y-8">
                                                    <div className="inline-flex items-center gap-4">
                                                        <span className="text-5xl font-black text-white font-heading tracking-tighter">{form.title || 'Titre de la Release'}</span>
                                                        <Badge variant="outline" className={cn("px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em]", categoryColors[form.category])}>
                                                            {categoryLabels[form.category]}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-zinc-500 font-bold uppercase tracking-widest text-[11px]">
                                                        <span className="text-amber-500 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">{form.version || 'vX.X.X'}</span>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                                                        <span>Aujourd'hui</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-12">
                                                    <div className="p-8 bg-zinc-800/20 border border-white/5 rounded-[2.5rem] relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-8 opacity-10">
                                                            <Sparkles className="w-16 h-16 text-emerald-400" />
                                                        </div>
                                                        <p className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">Marketing Snapshot</p>
                                                        <DocContent content={form.summary} />
                                                    </div>

                                                    <div className="space-y-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-px flex-1 bg-white/5" />
                                                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Log Technique Complet</p>
                                                            <div className="h-px flex-1 bg-white/5" />
                                                        </div>
                                                        <DocContent content={form.content} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                )}
            </div>
        </div>
    );
}
