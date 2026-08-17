"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tv, Link2, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, Loader2, Sparkles, ExternalLink, RefreshCw, ShieldAlert, FolderPlus } from "lucide-react";
import { upsertContentCreator, deleteContentCreator, upsertResourceCategory, deleteResourceCategory, upsertResourceLink, deleteResourceLink, checkResourceLinksHealth } from "@/server/actions/resources-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Creator {
    id: string;
    name: string;
    role: string;
    youtube?: string | null;
    twitch?: string | null;
    handle?: string | null;
    color: string;
    order: number;
}

interface Category {
    id: string;
    label?: string;
    title?: string;
    description?: string | null;
    icon?: string;
    color: string;
    order: number;
    links: {
        id: string;
        title: string;
        description?: string | null;
        url: string;
        emoji?: string | null;
        isOfficial?: boolean;
        order: number;
    }[];
}

export function GodResourcesClient({
    initialCreators,
    initialCategories,
    godGuildId,
}: {
    initialCreators: Creator[];
    initialCategories: Category[];
    godGuildId: string;
}) {
    const [creators, setCreators] = useState<Creator[]>(initialCreators);
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [isPending, startTransition] = useTransition();

    // Creator Modal State
    const [creatorModalOpen, setCreatorModalOpen] = useState(false);
    const [editingCreator, setEditingCreator] = useState<Partial<Creator> | null>(null);

    // Category Modal State
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<{ id?: string; label: string; color: string; order: number } | null>(null);

    // Link Modal State
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<{ id?: string; categoryId: string; title: string; description?: string; url: string; emoji?: string; isOfficial?: boolean; order?: number } | null>(null);

    // Health check state
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [healthReport, setHealthReport] = useState<{ totalChecked: number; brokenLinks: { name: string; url: string; status: number | string }[] } | null>(null);

    const handleSaveCreator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCreator?.name) return;

        startTransition(async () => {
            try {
                const res = await upsertContentCreator(godGuildId, editingCreator);
                if (res.success && res.data) {
                    toast.success("Créateur enregistré avec succès !");
                    setCreators(prev => {
                        const existing = prev.findIndex(c => c.id === res.data.id);
                        if (existing >= 0) {
                            const updated = [...prev];
                            updated[existing] = res.data as Creator;
                            return updated;
                        }
                        return [...prev, res.data as Creator];
                    });
                    setCreatorModalOpen(false);
                    setEditingCreator(null);
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur d'enregistrement");
            }
        });
    };

    const handleDeleteCreator = async (id: string) => {
        if (!confirm("Supprimer définitivement ce créateur ?")) return;
        startTransition(async () => {
            try {
                const res = await deleteContentCreator(id, godGuildId);
                if (res.success) {
                    toast.success("Créateur supprimé");
                    setCreators(prev => prev.filter(c => c.id !== id));
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur de suppression");
            }
        });
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory?.label) return;

        startTransition(async () => {
            try {
                const res = await upsertResourceCategory(godGuildId, editingCategory);
                if (res.success && res.data) {
                    toast.success("Catégorie enregistrée avec succès !");
                    setCategoryModalOpen(false);
                    setEditingCategory(null);
                    window.location.reload();
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur");
            }
        });
    };

    const handleDeleteCategory = async (id: string, label: string) => {
        if (!confirm(`Supprimer la catégorie « ${label} » et tous ses liens ?`)) return;
        startTransition(async () => {
            try {
                const res = await deleteResourceCategory(id, godGuildId);
                if (res.success) {
                    toast.success("Catégorie supprimée");
                    setCategories(prev => prev.filter(c => c.id !== id));
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur");
            }
        });
    };

    const handleSaveLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLink?.title || !editingLink.url) return;

        startTransition(async () => {
            try {
                const res = await upsertResourceLink(godGuildId, editingLink);
                if (res.success) {
                    toast.success("Lien enregistré avec succès !");
                    setLinkModalOpen(false);
                    setEditingLink(null);
                    window.location.reload();
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur");
            }
        });
    };

    const handleDeleteLink = async (id: string) => {
        if (!confirm("Supprimer ce lien ?")) return;
        startTransition(async () => {
            try {
                const res = await deleteResourceLink(id, godGuildId);
                if (res.success) {
                    toast.success("Lien supprimé");
                    window.location.reload();
                }
            } catch (err: any) {
                toast.error(err?.message || "Erreur");
            }
        });
    };

    const runHealthCheck = async () => {
        setIsCheckingHealth(true);
        try {
            const res = await checkResourceLinksHealth(godGuildId);
            if (res.success && res.data) {
                setHealthReport(res.data);
                if (res.data.brokenLinks.length === 0) {
                    toast.success(`Tous les ${res.data.totalChecked} liens sont opérationnels (200 OK) !`);
                } else {
                    toast.warning(`${res.data.brokenLinks.length} lien(s) en erreur ou indisponibles.`);
                }
            } else {
                toast.error(res.error || "Erreur du diagnostic");
            }
        } catch (err) {
            toast.error("Échec du test de santé");
        } finally {
            setIsCheckingHealth(false);
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="creators" className="w-full">
                <TabsList className="bg-surface border border-border p-1 rounded-2xl">
                    <TabsTrigger value="creators" className="rounded-xl font-bold gap-2">
                        <Tv className="w-4 h-4 text-rose-400" />
                        <span>Créateurs & Streamers Globaux ({creators.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="links" className="rounded-xl font-bold gap-2">
                        <Link2 className="w-4 h-4 text-emerald-400" />
                        <span>Liens & Outils ({categories.reduce((a, c) => a + (c.links?.length || 0), 0)})</span>
                    </TabsTrigger>
                    <TabsTrigger value="health" className="rounded-xl font-bold gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Diagnostic Santé Liens</span>
                    </TabsTrigger>
                </TabsList>

                {/* 1. CREATORS TAB */}
                <TabsContent value="creators" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Gestion des Créateurs & Streamers Officiels</h3>
                            <p className="text-xs text-muted-foreground">Ces créateurs sont distribués et visibles par défaut sur toutes les guildes de la plateforme.</p>
                        </div>
                        <Button
                            onClick={() => {
                                setEditingCreator({ name: "", role: "", color: "#3b82f6", order: creators.length });
                                setCreatorModalOpen(true);
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Ajouter un Créateur Global</span>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {creators.map(c => (
                            <Card key={c.id} className="border-border bg-surface relative overflow-hidden shadow-sm">
                                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: c.color }} />
                                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                            <span>{c.name}</span>
                                            {c.handle && <span className="text-xs text-muted-foreground font-mono">@{c.handle}</span>}
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">{c.role}</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                setEditingCreator(c);
                                                setCreatorModalOpen(true);
                                            }}
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-danger"
                                            onClick={() => handleDeleteCreator(c.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs space-y-1.5 pt-0">
                                    {c.youtube && (
                                        <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="text-red-500 dark:text-red-400 hover:underline flex items-center gap-1.5 truncate">
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{c.youtube}</span>
                                        </a>
                                    )}
                                    {c.twitch && (
                                        <a href={c.twitch} target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 truncate">
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{c.twitch}</span>
                                        </a>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* 2. LINKS TAB */}
                <TabsContent value="links" className="space-y-6 mt-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Gestion des Liens & Catégories</h3>
                            <p className="text-xs text-muted-foreground">Catégories et liens centralisés pour tous les joueurs SigilOS.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => {
                                    setEditingCategory({ label: "", color: "#10b981", order: categories.length });
                                    setCategoryModalOpen(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                            >
                                <FolderPlus className="w-4 h-4" />
                                <span>Nouvelle Catégorie</span>
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {categories.map(cat => {
                            const catLabel = cat.label || cat.title || "Catégorie";
                            const linkCount = cat.links?.length || 0;

                            return (
                                <Card key={cat.id} className="border-border bg-surface shadow-sm overflow-hidden">
                                    <div className="h-1.5 w-full" style={{ backgroundColor: cat.color || "#10b981" }} />
                                    <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#10b981" }} />
                                            <div>
                                                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                                    <span>{catLabel}</span>
                                                    <span className="text-xs text-muted-foreground font-normal">({linkCount} lien{linkCount > 1 ? "s" : ""})</span>
                                                </CardTitle>
                                                {cat.description && <CardDescription className="text-xs mt-0.5">{cat.description}</CardDescription>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-muted-foreground hover:text-foreground text-xs gap-1"
                                                onClick={() => {
                                                    setEditingCategory({ id: cat.id, label: catLabel, color: cat.color || "#10b981", order: cat.order || 0 });
                                                    setCategoryModalOpen(true);
                                                }}
                                                title="Modifier la catégorie"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                <span>Éditer</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-muted-foreground hover:text-danger text-xs gap-1"
                                                onClick={() => handleDeleteCategory(cat.id, catLabel)}
                                                title="Supprimer la catégorie"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 border-border text-xs gap-1.5 font-bold"
                                                onClick={() => {
                                                    setEditingLink({ categoryId: cat.id, title: "", url: "", description: "", emoji: "🔗", isOfficial: false, order: linkCount });
                                                    setLinkModalOpen(true);
                                                }}
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Ajouter un lien</span>
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {linkCount === 0 ? (
                                            <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-xl">
                                                Aucun lien dans cette catégorie. Cliquez sur « Ajouter un lien » pour en créer un.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {cat.links.map(link => (
                                                    <div key={link.id} className="p-3 rounded-xl border border-border bg-elevated flex items-center justify-between">
                                                        <div className="space-y-0.5 truncate pr-2 min-w-0">
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                {link.emoji && <span className="text-sm shrink-0">{link.emoji}</span>}
                                                                <span className="text-sm font-bold text-foreground truncate">{link.title}</span>
                                                                {link.isOfficial && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-black uppercase shrink-0">
                                                                        Officiel
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {link.description && (
                                                                <p className="text-caption text-muted-foreground truncate">{link.description}</p>
                                                            )}
                                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-sky-500 flex items-center gap-1 truncate font-mono">
                                                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                                <span className="truncate">{link.url}</span>
                                                            </a>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                                onClick={() => {
                                                                    setEditingLink({ id: link.id, categoryId: cat.id, title: link.title, url: link.url, description: link.description || "", emoji: link.emoji || "🔗", isOfficial: link.isOfficial || false, order: link.order || 0 });
                                                                    setLinkModalOpen(true);
                                                                }}
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-muted-foreground hover:text-danger"
                                                                onClick={() => handleDeleteLink(link.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* 3. HEALTH CHECK TAB */}
                <TabsContent value="health" className="space-y-4 mt-6">
                    <Card className="border-border bg-surface shadow-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                                        Diagnostic de Santé des Liens Externes (404 Detector)
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Teste automatiquement la connectivité et la validité de chaque lien externe répertorié.
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={runHealthCheck}
                                    disabled={isCheckingHealth}
                                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2"
                                >
                                    {isCheckingHealth ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Test en cours...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            <span>Lancer le Scan de Santé</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!healthReport ? (
                                <div className="text-center py-10 border border-dashed border-border rounded-xl">
                                    <p className="text-sm text-muted-foreground">Cliquez sur « Lancer le Scan de Santé » pour vérifier l'état des liens en direct.</p>
                                </div>
                            ) : healthReport.brokenLinks.length === 0 ? (
                                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-8 h-8 shrink-0" />
                                    <div>
                                        <p className="font-bold text-base">Parfait ! 100% des liens sont fonctionnels.</p>
                                        <p className="text-xs opacity-80">{healthReport.totalChecked} liens vérifiés avec succès.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
                                        ⚠️ {healthReport.brokenLinks.length} lien(s) nécessitent votre attention :
                                    </div>
                                    <div className="space-y-2">
                                        {healthReport.brokenLinks.map((b, idx) => (
                                            <div key={idx} className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-rose-600 dark:text-rose-300">{b.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{b.url}</p>
                                                </div>
                                                <span className="px-2 py-1 rounded bg-rose-950 text-rose-200 border border-rose-500/40 text-xs font-mono font-bold">
                                                    Status : {b.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal Créateur */}
            <Dialog open={creatorModalOpen} onOpenChange={setCreatorModalOpen}>
                <DialogContent className="sm:max-w-md border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {editingCreator?.id ? "Modifier le Créateur" : "Ajouter un Créateur Global"}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Configurez l'identité et les chaînes de streaming du créateur.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveCreator} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Nom Public</Label>
                            <Input
                                required
                                value={editingCreator?.name || ""}
                                onChange={e => setEditingCreator(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Huz"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Spécialité / Rôle</Label>
                            <Input
                                required
                                value={editingCreator?.role || ""}
                                onChange={e => setEditingCreator(prev => ({ ...prev, role: e.target.value }))}
                                placeholder="Ex: Forgemagie & Économie"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Handle (@unique)</Label>
                                <Input
                                    value={editingCreator?.handle || ""}
                                    onChange={e => setEditingCreator(prev => ({ ...prev, handle: e.target.value }))}
                                    placeholder="Ex: huzounet"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Couleur Hex</Label>
                                <Input
                                    value={editingCreator?.color || "#3b82f6"}
                                    onChange={e => setEditingCreator(prev => ({ ...prev, color: e.target.value }))}
                                    placeholder="#3b82f6"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">URL Chaîne YouTube</Label>
                            <Input
                                value={editingCreator?.youtube || ""}
                                onChange={e => setEditingCreator(prev => ({ ...prev, youtube: e.target.value }))}
                                placeholder="https://www.youtube.com/@..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">URL Chaîne Twitch</Label>
                            <Input
                                value={editingCreator?.twitch || ""}
                                onChange={e => setEditingCreator(prev => ({ ...prev, twitch: e.target.value }))}
                                placeholder="https://www.twitch.tv/..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setCreatorModalOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Catégorie */}
            <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
                <DialogContent className="sm:max-w-md border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {editingCategory?.id ? "Modifier la Catégorie" : "Créer une Nouvelle Catégorie"}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Configurez le libellé, la couleur et la position de la catégorie de ressources.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Nom de la Catégorie</Label>
                            <Input
                                required
                                value={editingCategory?.label || ""}
                                onChange={e => setEditingCategory(prev => prev ? ({ ...prev, label: e.target.value }) : null)}
                                placeholder="Ex: Métiers & Forgemagie"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Couleur Hex</Label>
                                <Input
                                    value={editingCategory?.color || "#10b981"}
                                    onChange={e => setEditingCategory(prev => prev ? ({ ...prev, color: e.target.value }) : null)}
                                    placeholder="#10b981"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Ordre d'affichage</Label>
                                <Input
                                    type="number"
                                    value={editingCategory?.order ?? 0}
                                    onChange={e => setEditingCategory(prev => prev ? ({ ...prev, order: parseInt(e.target.value) || 0 }) : null)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setCategoryModalOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Lien */}
            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent className="sm:max-w-md border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {editingLink?.id ? "Modifier le Lien" : "Ajouter un Lien Officiel"}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Ajoutez une ressource ou un outil externe accessible à la communauté.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveLink} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Titre du Lien</Label>
                            <Input
                                required
                                value={editingLink?.title || ""}
                                onChange={e => setEditingLink(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                placeholder="Ex: DofusDB"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">URL Web</Label>
                            <Input
                                required
                                type="url"
                                value={editingLink?.url || ""}
                                onChange={e => setEditingLink(prev => prev ? ({ ...prev, url: e.target.value }) : null)}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Description courte</Label>
                            <Input
                                value={editingLink?.description || ""}
                                onChange={e => setEditingLink(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                placeholder="Encyclopédie et base de données..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Emoji / Icône</Label>
                                <Input
                                    value={editingLink?.emoji || "🔗"}
                                    onChange={e => setEditingLink(prev => prev ? ({ ...prev, emoji: e.target.value }) : null)}
                                    placeholder="🔗"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Ordre</Label>
                                <Input
                                    type="number"
                                    value={editingLink?.order ?? 0}
                                    onChange={e => setEditingLink(prev => prev ? ({ ...prev, order: parseInt(e.target.value) || 0 }) : null)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setLinkModalOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
