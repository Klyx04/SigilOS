'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ChangelogCategory } from '@prisma/client';
import { Plus, Trash2, Edit, Eye, Save, X, Terminal, Settings, Activity, Send, Globe, Sparkles } from 'lucide-react';
import {
    createChangelogEntry,
    getChangelogEntries,
    deleteChangelogEntry,
    updateChangelogEntry,
    sendChangelogToDiscord,
    broadcastChangelogToGuilds,
    getPlatformConfig,
    updatePlatformConfig,
    testStatusPing,
} from '@/server/actions/changelog-actions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AdvancedEditor } from '@/components/editor/advanced-editor';
import { ChangelogContent } from '@/components/changelog/changelog-content';
import { cn } from '@/lib/utils';

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

const CATEGORY_ORDER: ChangelogCategory[] = ['FEATURE', 'BUGFIX', 'SECURITY', 'PERFORMANCE', 'DOCUMENTATION'];

export default function GODChangelogPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<ChangelogCategory | undefined>(undefined);
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [broadcastingId, setBroadcastingId] = useState<string | null>(null);

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hubChannelId, setHubChannelId] = useState('');
    const [serviceStatusChannelId, setServiceStatusChannelId] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isTestingPing, setIsTestingPing] = useState(false);

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
        loadSettings();
    }, []);

    async function loadSettings() {
        const res = await getPlatformConfig();
        if (res.success && res.config) {
            setHubChannelId(res.config.hubChannelId || '');
            setServiceStatusChannelId(res.config.serviceStatusChannelId || '');
        }
    }

    async function handleSaveSettings() {
        setIsSavingSettings(true);
        const res = await updatePlatformConfig({ hubChannelId, serviceStatusChannelId });
        if (res.success) {
            toast.success('Paramètres sauvegardés');
            setIsSettingsOpen(false);
        } else {
            toast.error(res.error || 'Erreur de sauvegarde');
        }
        setIsSavingSettings(false);
    }

    async function handleTestPing() {
        if (!serviceStatusChannelId) {
            toast.error('Veuillez sauvegarder un ID de salon d\'abord');
            return;
        }
        setIsTestingPing(true);
        const res = await testStatusPing();
        if (res.success) {
            toast.success('Ping envoyé avec succès !');
        } else {
            toast.error(res.error || 'Erreur lors de l\'envoi du ping');
        }
        setIsTestingPing(false);
    }

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

    function handlePublishDiscord(id: string) {
        if (!confirm('Publier cette release sur le Discord Principal (Webhook Hub) ?')) return;
        setPublishingId(id);
        sendChangelogToDiscord(id).then((result) => {
            if (result.success) {
                toast.success('Publié sur le Hub (Discord Officiel) !');
            } else {
                toast.error(result.error || 'Erreur Discord');
            }
        }).finally(() => setPublishingId(null));
    }

    function handleBroadcast(id: string) {
        if (!confirm('Voulez-vous vraiment diffuser cette annonce à TOUTES les guildes actives ?')) return;
        setBroadcastingId(id);
        broadcastChangelogToGuilds(id).then((result) => {
            if (result.success && result.results) {
                toast.success(`Diffusion terminée : ${result.results.success} OK, ${result.results.failed} échec(s)`);
            } else {
                toast.error(result.error || 'Erreur de diffusion');
            }
        }).finally(() => setBroadcastingId(null));
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
        setPreviewMode(false);
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

    const filteredEntries = filterCategory ? entries.filter(e => e.category === filterCategory) : entries;
    const grouped = filteredEntries.reduce<Record<string, any[]>>((acc, e) => {
        const key = new Date(e.publishedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        (acc[key] = acc[key] || []).push(e);
        return acc;
    }, {});

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 font-sans selection:bg-amber-500/30 overflow-hidden">
            {/* TOP BAR */}
            <div className="z-30 h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-zinc-900/60 backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none flex items-center gap-2">
                            Changelog Engine
                            <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 ml-1">{entries.length} logs</Badge>
                        </h1>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter mt-1">Versions publiques & diffusion Discord</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold gap-2">
                                <Settings className="w-4 h-4" /> Réglages
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/5 sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-amber-500" />
                                    Configuration GOD
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">ID Salon Discord (Hub)</Label>
                                    <Input
                                        value={hubChannelId}
                                        onChange={e => setHubChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="h-12 bg-zinc-900/50 border-white/10 rounded-xl font-mono text-amber-500 px-4"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-2 ml-1">Ce salon recevra les annonces du changelog via le bouton de publication (Hub).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">ID Salon État des Services</Label>
                                    <Input
                                        value={serviceStatusChannelId}
                                        onChange={e => setServiceStatusChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="h-12 bg-zinc-900/50 border-white/10 rounded-xl font-mono text-amber-500 px-4"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-2 ml-1">Salon où pinguer automatiquement les maintenances et uptime.</p>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        onClick={handleTestPing}
                                        disabled={isTestingPing || !serviceStatusChannelId}
                                        variant="outline"
                                        className="flex-1 bg-zinc-900 border-white/10 text-white font-bold h-12 rounded-xl text-xs hover:bg-zinc-800"
                                    >
                                        {isTestingPing ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                        Ping de test
                                    </Button>
                                    <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs rounded-xl">
                                        {isSavingSettings ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        onClick={() => { resetForm(); setIsCreating(true); }}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black h-10 px-5 rounded-xl uppercase tracking-widest text-[10px]"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Nouvelle Release
                    </Button>
                </div>
            </div>

            {/* MAIN : FILTRE + LISTE */}
            <div className="flex-1 flex min-h-0">
                <div className="w-48 shrink-0 border-r border-white/5 p-3 space-y-1 overflow-y-auto">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 pb-2">Catégories</p>
                    <button
                        onClick={() => setFilterCategory(undefined)}
                        className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors", !filterCategory ? "bg-amber-500/10 text-amber-400" : "text-zinc-500 hover:bg-white/5 hover:text-white")}
                    >
                        Toutes ({entries.length})
                    </button>
                    {CATEGORY_ORDER.map(cat => {
                        const count = entries.filter(e => e.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between", filterCategory === cat ? "bg-amber-500/10 text-amber-400" : "text-zinc-500 hover:bg-white/5 hover:text-white")}
                            >
                                <span>{categoryLabels[cat]}</span>
                                <span className="text-[9px] text-zinc-600">{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                    {Object.keys(grouped).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-24">
                            <Sparkles className="w-8 h-8 text-zinc-700" />
                            <p className="text-sm font-bold text-zinc-500">Aucune entrée</p>
                            <p className="text-xs text-zinc-600">Créez votre première release avec le bouton « Nouvelle Release ».</p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-10">
                            {Object.entries(grouped).map(([month, monthEntries]) => (
                                <div key={month}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] bg-zinc-950 px-3 py-1 rounded-full border border-white/5">
                                            {month}
                                        </span>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>

                                    <div className="relative pl-8 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                                        {monthEntries.map((entry) => {
                                            const catColor = categoryColors[entry.category as ChangelogCategory];
                                            return (
                                                <div key={entry.id} className="relative group">
                                                    <div className={cn(
                                                        "absolute -left-[23px] top-5 w-3 h-3 rounded-full border-2 border-zinc-950 transition-all group-hover:scale-125",
                                                        entry.category === "FEATURE" ? "bg-emerald-500" :
                                                            entry.category === "BUGFIX" ? "bg-amber-500" :
                                                                entry.category === "SECURITY" ? "bg-red-500" :
                                                                    entry.category === "PERFORMANCE" ? "bg-blue-500" :
                                                                        "bg-purple-500"
                                                    )} />
                                                    <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-amber-500/20 transition-all duration-200">
                                                        <div className="flex-1 min-w-0 space-y-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest shrink-0", catColor)}>
                                                                    {categoryLabels[entry.category as ChangelogCategory]}
                                                                </Badge>
                                                                <span className="font-mono text-amber-500 text-[10px] font-black tracking-widest">{entry.version}</span>
                                                                {entry.isInternal && (
                                                                    <Badge variant="outline" className="text-zinc-500 border-white/10 text-[8px] font-black uppercase tracking-widest">
                                                                        Interne
                                                                    </Badge>
                                                                )}
                                                                <span className="text-[9px] text-zinc-600 font-bold ml-auto shrink-0">
                                                                    {formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true, locale: fr })}
                                                                </span>
                                                            </div>
                                                            <h3 className="font-black text-white text-base leading-tight uppercase tracking-tight group-hover:text-amber-200 transition-colors">
                                                                {entry.title}
                                                            </h3>
                                                            {entry.summary && (
                                                                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{entry.summary}</p>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                                            <Button size="icon" variant="ghost" onClick={() => handlePublishDiscord(entry.id)} disabled={publishingId === entry.id || broadcastingId === entry.id} title="Publier sur le Hub (Webhook)" className="h-8 w-8 rounded-xl bg-white/5 hover:bg-indigo-500/10 text-zinc-400 hover:text-indigo-400">
                                                                {publishingId === entry.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleBroadcast(entry.id)} disabled={publishingId === entry.id || broadcastingId === entry.id} title="Diffuser à TOUTES les guildes" className="h-8 w-8 rounded-xl bg-white/5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400">
                                                                {broadcastingId === entry.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)} className="h-8 w-8 rounded-xl bg-white/5 hover:bg-zinc-500/10 text-zinc-400 hover:text-white">
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(entry.id)} className="h-8 w-8 rounded-xl bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ÉDITEUR — MODALE (création / modification) */}
            <Dialog open={isCreating} onOpenChange={(o) => { if (!o) resetForm(); }}>
                <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <DialogHeader className="p-6 pb-4 border-b border-white/10 shrink-0">
                        <DialogTitle className="text-lg font-black text-white uppercase tracking-widest">
                            {editingId ? 'Modifier la release' : 'Nouvelle release'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            Titre, version, résumé et contenu sont requis. Le contenu est en HTML (éditeur riche).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
                        {previewMode ? (
                            <div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Aperçu — rendu utilisateur</p>
                                <div className="p-5 rounded-2xl border border-white/5 bg-zinc-900/30">
                                    <div className="flex items-center gap-2 flex-wrap mb-3">
                                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", categoryColors[form.category])}>
                                            {categoryLabels[form.category]}
                                        </Badge>
                                        <span className="font-mono text-amber-500 text-[10px] font-black">{form.version || 'vX.X.X'}</span>
                                        {form.isInternal && <Badge variant="outline" className="text-zinc-500 border-white/10">Interne</Badge>}
                                    </div>
                                    <h2 className="text-xl font-black text-white mb-4">{form.title || 'Titre de la release'}</h2>
                                    <ChangelogContent content={form.summary} />
                                    <div className="h-px bg-white/10 my-4" />
                                    <ChangelogContent content={form.content} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Version</Label>
                                        <Input value={form.version} onChange={e => handleChange('version', e.target.value)} placeholder="v2.4.0" className="h-11 bg-zinc-900/50 border-white/10 rounded-xl font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Catégorie</Label>
                                        <Select value={form.category} onValueChange={(v) => handleChange('category', v as ChangelogCategory)}>
                                            <SelectTrigger className="h-11 bg-zinc-900/50 border-white/10 rounded-xl">
                                                <SelectValue placeholder="Catégorie" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CATEGORY_ORDER.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{categoryLabels[cat]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 flex items-end">
                                        <label className="flex items-center gap-2 h-11 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.isInternal}
                                                onChange={(e) => handleChange('isInternal', e.target.checked)}
                                                className="w-4 h-4 accent-amber-500"
                                            />
                                            <span className="text-xs font-bold text-zinc-400">Brouillon interne (invisible des membres)</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Titre</Label>
                                    <Input value={form.title} onChange={e => handleChange('title', e.target.value)} placeholder="Ex: Refonte du Guide Ganymède" className="h-11 bg-zinc-900/50 border-white/10 rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Résumé (annonce Discord / aperçu)</Label>
                                    <AdvancedEditor key={`summary-${editingId ?? 'new'}`} initialContent={form.summary} onChange={(c) => handleChange('summary', c)} contentClassName="min-h-[80px]" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contenu complet (modale utilisateur)</Label>
                                    <AdvancedEditor key={`content-${editingId ?? 'new'}`} initialContent={form.content} onChange={(c) => handleChange('content', c)} contentClassName="min-h-[220px]" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-6 pt-4 border-t border-white/10 shrink-0 flex items-center justify-between gap-3">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setPreviewMode(!previewMode)} className="h-11 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl gap-2">
                                <Eye className="w-4 h-4" /> {previewMode ? "Reprendre l'édition" : "Mode Aperçu"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-11 text-zinc-500 hover:text-white text-xs font-bold rounded-xl gap-2">
                                <X className="w-4 h-4" /> Annuler
                            </Button>
                        </div>
                        <Button type="button" onClick={handleSubmit} disabled={loading} className="h-11 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] px-8 rounded-xl">
                            {loading ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingId ? 'Envoyer Mise à Jour' : 'Déployer Version'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}








