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
import { CHANGELOG_CATEGORY_LABELS, CHANGELOG_CATEGORY_ORDER } from '@/lib/changelog-meta';
import { cn } from '@/lib/utils';

const categoryLabels = CHANGELOG_CATEGORY_LABELS;

const categoryColors: Record<ChangelogCategory, string> = {
    FEATURE: 'bg-success/10 text-success border-success/20',
    BUGFIX: 'bg-warning/10 text-warning border-warning/20',
    SECURITY: 'bg-destructive/10 text-destructive border-destructive/20',
    PERFORMANCE: 'bg-info/10 text-info border-info/20',
    DOCUMENTATION: 'bg-accent/10 text-accent border-accent/20',
};

const CATEGORY_ORDER = CHANGELOG_CATEGORY_ORDER;

interface ChangelogListEntry {
    id: string;
    version: string;
    title: string;
    summary: string | null;
    content: string;
    category: ChangelogCategory;
    isInternal: boolean;
    publishedAt: string;
    titleEn?: string | null;
    summaryEn?: string | null;
    contentEn?: string | null;
}

export default function GODChangelogPage() {
    const [entries, setEntries] = useState<ChangelogListEntry[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<ChangelogCategory | undefined>(undefined);
    const [search, setSearch] = useState('');
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
        // Traductions EN (facultatif) — laissées vides, l'affichage anglais
        // retombe automatiquement sur le français.
        titleEn: '',
        summaryEn: '',
        contentEn: '',
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

    const handleChange = (field: string, value: string | boolean | ChangelogCategory) => {
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

    function handleEdit(entry: ChangelogListEntry) {
        setEditingId(entry.id);
        setForm({
            version: entry.version,
            title: entry.title,
            summary: entry.summary ?? '',
            content: entry.content,
            category: entry.category,
            isInternal: entry.isInternal ?? false,
            titleEn: entry.titleEn ?? '',
            summaryEn: entry.summaryEn ?? '',
            contentEn: entry.contentEn ?? '',
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
            titleEn: '',
            summaryEn: '',
            contentEn: '',
        });
        setIsCreating(false);
        setEditingId(null);
        setPreviewMode(false);
    }

    const filteredEntries = entries.filter((e) => {
        if (filterCategory && e.category !== filterCategory) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            e.title.toLowerCase().includes(q) ||
            e.version.toLowerCase().includes(q) ||
            (e.summary ?? '').toLowerCase().includes(q)
        );
    });
    const grouped = filteredEntries.reduce<Record<string, ChangelogListEntry[]>>((acc, e) => {
        const key = new Date(e.publishedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        (acc[key] = acc[key] || []).push(e);
        return acc;
    }, {});

    return (
        <div className="flex-1 flex flex-col h-full bg-background font-sans selection:bg-warning/30 overflow-hidden">
            {/* TOP BAR */}
            <div className="z-30 h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface/60 ">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-foreground uppercase tracking-wide leading-none flex items-center gap-2">
                            Changelog Engine
                            <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20 ml-1">{entries.length} logs</Badge>
                        </h1>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-tighter mt-1">Versions publiques & diffusion Discord</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="h-10 px-4 rounded-xl bg-surface/10 hover:bg-elevated text-muted-foreground hover:text-foreground text-xs font-bold gap-2">
                                <Settings className="w-4 h-4" /> Réglages
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background border-border sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-semibold text-foreground uppercase tracking-wide flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-warning" />
                                    Configuration GOD
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide ml-1">ID Salon Discord (Hub)</Label>
                                    <Input
                                        value={hubChannelId}
                                        onChange={e => setHubChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="h-12 bg-surface/50 border-border rounded-xl font-mono text-warning px-4"
                                    />
                                    <p className="text-caption text-muted-foreground mt-2 ml-1">Ce salon recevra les annonces du changelog via le bouton de publication (Hub).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide ml-1">ID Salon État des Services</Label>
                                    <Input
                                        value={serviceStatusChannelId}
                                        onChange={e => setServiceStatusChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="h-12 bg-surface/50 border-border rounded-xl font-mono text-warning px-4"
                                    />
                                    <p className="text-caption text-muted-foreground mt-2 ml-1">Salon où pinguer automatiquement les maintenances et uptime.</p>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        onClick={handleTestPing}
                                        disabled={isTestingPing || !serviceStatusChannelId}
                                        variant="outline"
                                        className="flex-1 bg-surface border-border text-foreground font-bold h-12 rounded-xl text-xs hover:bg-elevated"
                                    >
                                        {isTestingPing ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                        Ping de test
                                    </Button>
                                    <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex-1 h-12 bg-warning hover:bg-warning text-warning-foreground font-semibold uppercase tracking-wide text-xs rounded-xl">
                                        {isSavingSettings ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        onClick={() => { resetForm(); setIsCreating(true); }}
                        className="bg-warning hover:bg-warning text-warning-foreground font-semibold h-10 px-5 rounded-xl uppercase tracking-wide text-caption"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Nouvelle Release
                    </Button>
                </div>
            </div>

            {/* MAIN : FILTRE + LISTE */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                <div className="md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-border p-3 space-y-1 md:overflow-y-auto">
                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-2">Catégories</p>
                    <div className="px-2 pb-2">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Version, titre…"
                            className="h-9 bg-surface/50 border-border rounded-lg text-xs"
                        />
                    </div>
                    <button
                        onClick={() => setFilterCategory(undefined)}
                        className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors", !filterCategory ? "bg-warning/10 text-warning" : "text-muted-foreground hover:bg-elevated hover:text-foreground")}
                    >
                        Toutes ({entries.length})
                    </button>
                    {CATEGORY_ORDER.map(cat => {
                        const count = entries.filter(e => e.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between", filterCategory === cat ? "bg-warning/10 text-warning" : "text-muted-foreground hover:bg-elevated hover:text-foreground")}
                            >
                                <span>{categoryLabels[cat]}</span>
                                <span className="text-caption text-muted-foreground">{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                    {Object.keys(grouped).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-24">
                            <Sparkles className="w-8 h-8 text-foreground" />
                            <p className="text-sm font-bold text-muted-foreground">Aucune entrée</p>
                            <p className="text-xs text-muted-foreground">Créez votre première release avec le bouton « Nouvelle Release ».</p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-10">
                            {Object.entries(grouped).map(([month, monthEntries]) => (
                                <div key={month}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="h-px flex-1 bg-surface/10" />
                                        <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide bg-background px-3 py-1 rounded-full border border-border">
                                            {month}
                                        </span>
                                        <div className="h-px flex-1 bg-surface/10" />
                                    </div>

                                    <div className="relative pl-8 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-surface/10">
                                        {monthEntries.map((entry) => {
                                            const catColor = categoryColors[entry.category as ChangelogCategory];
                                            return (
                                                <div key={entry.id} className="relative group">
                                                    <div className={cn(
                                                        "absolute -left-[23px] top-5 w-3 h-3 rounded-full border-2 border-border transition-all group-hover:scale-125",
                                                        entry.category === "FEATURE" ? "bg-success" :
                                                            entry.category === "BUGFIX" ? "bg-warning" :
                                                                entry.category === "SECURITY" ? "bg-destructive" :
                                                                    entry.category === "PERFORMANCE" ? "bg-info" :
                                                                        "bg-accent"
                                                    )} />
                                                    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface/30 hover:bg-surface/60 hover:border-warning/20 transition-all duration-200">
                                                        <div className="flex-1 min-w-0 space-y-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Badge variant="outline" className={cn("text-caption font-semibold uppercase tracking-wide shrink-0", catColor)}>
                                                                    {categoryLabels[entry.category as ChangelogCategory]}
                                                                </Badge>
                                                                <span className="font-mono text-warning text-caption font-semibold tracking-wide">{entry.version}</span>
                                                                {entry.isInternal && (
                                                                    <Badge variant="outline" className="text-muted-foreground border-border text-caption font-semibold uppercase tracking-wide">
                                                                        Interne
                                                                    </Badge>
                                                                )}
                                                                <span className="text-caption text-muted-foreground font-bold ml-auto shrink-0">
                                                                    {formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true, locale: fr })}
                                                                </span>
                                                            </div>
                                                            <h3 className="font-semibold text-foreground text-base leading-tight uppercase tracking-tight group-hover:text-warning transition-colors">
                                                                {entry.title}
                                                            </h3>
                                                            {entry.summary && (
                                                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{entry.summary}</p>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-1.5 shrink-0 opacity-100 translate-x-0 md:opacity-0 md:group-hover:opacity-100 transition-all md:translate-x-1 md:group-hover:translate-x-0">
                                                            <Button size="icon" variant="ghost" onClick={() => handlePublishDiscord(entry.id)} disabled={publishingId === entry.id || broadcastingId === entry.id} title="Publier sur le Hub (Webhook)" className="h-8 w-8 rounded-xl bg-surface/10 hover:bg-accent/10 text-muted-foreground hover:text-accent">
                                                                {publishingId === entry.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleBroadcast(entry.id)} disabled={publishingId === entry.id || broadcastingId === entry.id} title="Diffuser à TOUTES les guildes" className="h-8 w-8 rounded-xl bg-surface/10 hover:bg-warning/10 text-muted-foreground hover:text-warning">
                                                                {broadcastingId === entry.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)} className="h-8 w-8 rounded-xl bg-surface/10 hover:bg-surface/10 text-muted-foreground hover:text-foreground">
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(entry.id)} className="h-8 w-8 rounded-xl bg-surface/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
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
                <DialogContent className="max-w-4xl bg-background border-border p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <DialogHeader className="p-6 pb-4 border-b border-border shrink-0">
                        <DialogTitle className="text-lg font-semibold text-foreground uppercase tracking-wide">
                            {editingId ? 'Modifier la release' : 'Nouvelle release'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Titre, version, résumé et contenu sont requis. Le contenu est en HTML (éditeur riche).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
                        {previewMode ? (
                            <div>
                                <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aperçu — rendu utilisateur</p>
                                <div className="p-5 rounded-xl border border-border bg-surface/30">
                                    <div className="flex items-center gap-2 flex-wrap mb-3">
                                        <Badge variant="outline" className={cn("text-caption font-semibold uppercase tracking-wide", categoryColors[form.category])}>
                                            {categoryLabels[form.category]}
                                        </Badge>
                                        <span className="font-mono text-warning text-caption font-semibold">{form.version || 'vX.X.X'}</span>
                                        {form.isInternal && <Badge variant="outline" className="text-muted-foreground border-border">Interne</Badge>}
                                    </div>
                                    <h2 className="text-xl font-semibold text-foreground mb-4">{form.title || 'Titre de la release'}</h2>
                                    <ChangelogContent content={form.summary} />
                                    <div className="h-px bg-surface/10 my-4" />
                                    <ChangelogContent content={form.content} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Version</Label>
                                        <Input value={form.version} onChange={e => handleChange('version', e.target.value)} placeholder="v2.4.0" className="h-11 bg-surface/50 border-border rounded-xl font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Catégorie</Label>
                                        <Select value={form.category} onValueChange={(v) => handleChange('category', v as ChangelogCategory)}>
                                            <SelectTrigger className="h-11 bg-surface/50 border-border rounded-xl">
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
                                            <span className="text-xs font-bold text-muted-foreground">Brouillon interne (invisible des membres)</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Titre</Label>
                                    <Input value={form.title} onChange={e => handleChange('title', e.target.value)} placeholder="Ex: Refonte du Guide Ganymède" className="h-11 bg-surface/50 border-border rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Résumé (annonce Discord / aperçu)</Label>
                                    <AdvancedEditor key={`summary-${editingId ?? 'new'}`} initialContent={form.summary} onChange={(c) => handleChange('summary', c)} contentClassName="min-h-[80px]" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Contenu complet (modale utilisateur)</Label>
                                    <AdvancedEditor key={`content-${editingId ?? 'new'}`} initialContent={form.content} onChange={(c) => handleChange('content', c)} contentClassName="min-h-[220px]" />
                                </div>
                                <div className="pt-5 border-t border-border space-y-5">
                                    <div>
                                        <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Traductions anglaises (facultatif)</p>
                                        <p className="text-caption text-muted-foreground mt-1">
                                            Laissées vides, la page et la modale en anglais affichent le texte français. Le contenu EN est saisi à la main : aucune traduction automatique.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Title (EN)</Label>
                                        <Input value={form.titleEn} onChange={e => handleChange('titleEn', e.target.value)} placeholder="Ex: Dashboard V2 overhaul" className="h-11 bg-surface/50 border-border rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Summary (EN) — Discord announcement / preview</Label>
                                        <AdvancedEditor key={`summaryEn-${editingId ?? 'new'}`} initialContent={form.summaryEn} onChange={(c) => handleChange('summaryEn', c)} contentClassName="min-h-[80px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Full content (EN) — user modal</Label>
                                        <AdvancedEditor key={`contentEn-${editingId ?? 'new'}`} initialContent={form.contentEn} onChange={(c) => handleChange('contentEn', c)} contentClassName="min-h-[220px]" />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-6 pt-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setPreviewMode(!previewMode)} className="h-11 border-border bg-surface/10 hover:bg-elevated text-xs font-bold rounded-xl gap-2">
                                <Eye className="w-4 h-4" /> {previewMode ? "Reprendre l'édition" : "Mode Aperçu"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-11 text-muted-foreground hover:text-foreground text-xs font-bold rounded-xl gap-2">
                                <X className="w-4 h-4" /> Annuler
                            </Button>
                        </div>
                        <Button type="button" onClick={handleSubmit} disabled={loading} className="h-11 bg-warning hover:bg-warning text-warning-foreground font-semibold uppercase tracking-wide text-caption px-8 rounded-xl">
                            {loading ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingId ? 'Envoyer Mise à Jour' : 'Déployer Version'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}








