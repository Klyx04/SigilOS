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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Shield, Globe } from "lucide-react";

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
        accessLevel: initialData?.accessLevel || "PUBLIC",
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
                        {/* HEADERS CARD - Ultra-Stable & Spacious Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10 p-10 rounded-3xl border border-white/5 bg-white/[0.03] shadow-inner">
                            {/* Row 1: Title (Full Width) */}
                            <div className="space-y-3 lg:col-span-2">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Titre du Document</Label>
                                <Input
                                    value={formData.title}
                                    onChange={e => handleChange("title", e.target.value)}
                                    placeholder="Ex: Protocoles de Sécurité"
                                    required
                                    className="h-16 bg-zinc-950/50 border-white/10 rounded-2xl text-xl font-bold focus:ring-indigo-500/20 px-8 transition-all"
                                />
                            </div>

                            {/* Row 2: Slug (Full Width) */}
                            <div className="space-y-3 lg:col-span-2">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 text-zinc-400">Point d'accès (Slug unique)</Label>
                                <div className="relative flex items-center group">
                                    <span className="absolute left-6 text-sm text-indigo-500/60 font-mono font-black group-focus-within:text-indigo-400 transition-colors">/docs/</span>
                                    <Input
                                        value={formData.slug}
                                        onChange={e => handleChange("slug", e.target.value)}
                                        placeholder="securite/standard"
                                        required
                                        className="h-16 bg-zinc-950/50 border-white/10 rounded-2xl font-mono text-base pl-20 pr-8 focus:ring-indigo-500/20 transition-all font-black text-zinc-200"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Category & Privacy */}
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

                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 text-amber-500/80">Confidentialité & Accès</Label>
                                <Select
                                    value={formData.accessLevel}
                                    onValueChange={v => handleChange("accessLevel", v)}
                                >
                                    <SelectTrigger className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl font-bold px-6 focus:ring-indigo-500/20 transition-all">
                                        <div className="flex items-center gap-3">
                                            {formData.accessLevel === "PUBLIC" ? <Globe className="w-4 h-4 text-emerald-500" /> : <Shield className="w-4 h-4 text-amber-500" />}
                                            <SelectValue placeholder="Choisir le type" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-xl shadow-2xl">
                                        <SelectItem value="PUBLIC" className="focus:bg-zinc-800 focus:text-emerald-400 cursor-pointer">🌍 Standard (Public)</SelectItem>
                                        <SelectItem value="ADMIN" className="focus:bg-zinc-800 focus:text-amber-400 cursor-pointer">🛡️ Administration (Délégation)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Row 4: Priority & Visibility (Half Width each) */}
                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Priorité d'affichage</Label>
                                <Input
                                    type="number"
                                    value={formData.order}
                                    onChange={e => handleChange("order", parseInt(e.target.value))}
                                    className="h-14 bg-zinc-950/50 border-white/10 rounded-2xl font-bold px-6 transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 block w-full">Visibilité Globale</Label>
                                <div className="flex items-center justify-between bg-zinc-950/40 rounded-2xl border border-white/10 h-14 px-8 group hover:bg-zinc-950/60 transition-all">
                                    <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-400 transition-colors uppercase tracking-tighter">Mise en ligne</span>
                                    <Switch
                                        checked={formData.isPublished}
                                        onCheckedChange={v => handleChange("isPublished", v)}
                                    />
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
