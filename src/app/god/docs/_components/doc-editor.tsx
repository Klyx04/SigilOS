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
        <div className="h-[calc(100vh-180px)] space-y-8">
            <ResizablePanelGroup orientation="horizontal" className="rounded-3xl border border-white/5 bg-zinc-900/20 backdrop-blur-xl shadow-2xl overflow-hidden">
                {/* EDITOR PANEL */}
                <ResizablePanel defaultSize={60} minSize={30}>
                    <form onSubmit={handleSubmit} className="space-y-10 h-full overflow-y-auto p-10 scrollbar-thin scrollbar-thumb-white/10">
                        {/* HEADERS CARD - Premium Scale & Refined Alignment */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 p-8 rounded-3xl border border-white/5 bg-white/[0.03] shadow-inner items-end">
                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Titre du Document</Label>
                                <Input
                                    value={formData.title}
                                    onChange={e => handleChange("title", e.target.value)}
                                    placeholder="Ex: Protocoles de Sécurité"
                                    required
                                    className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl text-lg font-bold focus:ring-indigo-500/20 px-6 transition-all"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Point d'accès (Slug)</Label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-6 text-sm text-zinc-600 font-mono font-bold">/docs/</span>
                                    <Input
                                        value={formData.slug}
                                        onChange={e => handleChange("slug", e.target.value)}
                                        placeholder="securite/standard"
                                        required
                                        className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl font-mono text-sm pl-20 pr-6 focus:ring-indigo-500/20 transition-all font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Classification / Catégorie</Label>
                                <Input
                                    value={formData.category}
                                    onChange={e => handleChange("category", e.target.value)}
                                    placeholder="Ex: Sécurité"
                                    required
                                    className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl font-bold px-6 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Priorité</Label>
                                    <Input
                                        type="number"
                                        value={formData.order}
                                        onChange={e => handleChange("order", parseInt(e.target.value))}
                                        className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl font-bold px-4 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Public</Label>
                                    <div className="flex items-center justify-center bg-zinc-950/40 rounded-2xl border border-white/10 h-14">
                                        <Switch
                                            checked={formData.isPublished}
                                            onCheckedChange={v => handleChange("isPublished", v)}
                                        />
                                    </div>
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

                        {/* ACTION BAR - Scaled */}
                        <div className="flex items-center justify-end gap-6 pt-10 border-t border-white/5">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.back()}
                                className="px-8 py-6 rounded-2xl text-zinc-500 hover:text-white hover:bg-white/5 font-black uppercase tracking-widest transition-all"
                            >
                                Abandonner
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="px-12 py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-indigo-500/20 min-w-[240px]"
                            >
                                {loading ? "Phase en cours..." : "Sauvegarder dans l'Index"}
                            </Button>
                        </div>
                    </form>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* PREVIEW PANEL (Admin Only) */}
                <ResizablePanel defaultSize={50} minSize={20} className="hidden lg:block bg-zinc-900/20">
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                            <Label className="text-zinc-500 uppercase tracking-wider text-xs font-bold">Aperçu en direct</Label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-thin scrollbar-thumb-white/10">
                            <DocContent content={formData.content} />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
