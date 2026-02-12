"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveDoc, type DocPageData, type CreateDocInput } from "@/server/actions/doc-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AdvancedEditor } from "@/components/editor/advanced-editor";
import { DocContent } from "@/components/doc/doc-content";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function DocEditor({ initialData }: { initialData?: DocPageData }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<CreateDocInput>({
        slug: initialData?.slug || "",
        title: initialData?.title || "",
        content: initialData?.content || "",
        category: initialData?.category || "Général",
        order: initialData?.order ?? 0,
        isPublished: initialData?.isPublished ?? true,
    });

    const handleChange = (field: keyof CreateDocInput, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const res = await saveDoc({ ...formData, id: initialData?.id });
        if (res.success) {
            toast.success("Page sauvegardée !");
            router.push("/god/docs");
            router.refresh();
        } else {
            toast.error("Erreur: " + res.error);
        }
        setLoading(false);
    };

    return (
        <div className="h-[calc(100vh-140px)]">
            <ResizablePanelGroup orientation="horizontal" className="rounded-lg border border-white/5 bg-zinc-950/30">
                {/* EDITOR PANEL */}
                <ResizablePanel defaultSize={60} minSize={30}>
                    <form onSubmit={handleSubmit} className="space-y-8 h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                        {/* HEADERS CARD */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-xl border border-white/5 bg-white/5">
                            <div className="space-y-2">
                                <Label>Titre de la page</Label>
                                <Input
                                    value={formData.title}
                                    onChange={e => handleChange("title", e.target.value)}
                                    placeholder="Ex: Guide du débutant"
                                    required
                                    className="bg-zinc-950/50 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug (URL)</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-zinc-500 font-mono">/docs/</span>
                                    <Input
                                        value={formData.slug}
                                        onChange={e => handleChange("slug", e.target.value)}
                                        placeholder="general/debutant"
                                        required
                                        className="bg-zinc-950/50 border-white/10 font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Catégorie</Label>
                                <Input
                                    value={formData.category}
                                    onChange={e => handleChange("category", e.target.value)}
                                    placeholder="Ex: Général"
                                    required
                                    className="bg-zinc-950/50 border-white/10"
                                />
                            </div>

                            <div className="flex items-end gap-6">
                                <div className="space-y-2 flex-1">
                                    <Label>Ordre d'affichage</Label>
                                    <Input
                                        type="number"
                                        value={formData.order}
                                        onChange={e => handleChange("order", parseInt(e.target.value))}
                                        className="bg-zinc-950/50 border-white/10"
                                    />
                                </div>
                                <div className="flex items-center gap-3 pb-2.5">
                                    <Switch
                                        checked={formData.isPublished}
                                        onCheckedChange={v => handleChange("isPublished", v)}
                                    />
                                    <Label>Publié en ligne</Label>
                                </div>
                            </div>
                        </div>

                        {/* EDITOR AREA */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-lg font-medium">Contenu</Label>
                                <span className="text-xs text-zinc-500">
                                    Tapez <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">/</kbd> pour les commandes
                                </span>
                            </div>

                            <div className="min-h-[500px]">
                                <AdvancedEditor
                                    initialContent={formData.content}
                                    onChange={(html) => handleChange("content", html)}
                                />
                            </div>
                        </div>

                        {/* ACTION BAR */}
                        <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.back()}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-white min-w-[150px]"
                            >
                                {loading ? "Sauvegarde..." : "Publier les changements"}
                            </Button>
                        </div>
                    </form>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* PREVIEW PANEL (Admin Only) */}
                <ResizablePanel defaultSize={40} minSize={20} className="hidden lg:block bg-zinc-900/20">
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                            <Label className="text-zinc-500 uppercase tracking-wider text-xs font-bold">Aperçu en direct</Label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">
                            <DocContent content={formData.content} />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
