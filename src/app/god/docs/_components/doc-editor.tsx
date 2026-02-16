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
import { Shield, Globe, Save, X, Eye, Settings2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocEditor({ initialData }: { initialData?: DocPageData }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(true);

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

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        const res = await saveDoc({ ...formData, id: initialData?.id });
        if (res.success) {
            toast.success("Page sauvegardée avec succès !");
            router.push("/god/docs");
            router.refresh();
        } else {
            toast.error("Erreur de sauvegarde: " + res.error);
        }
        setLoading(false);
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950/20 pt-2">
            {/* 🚀 TOP ACTION BAR (Fixed) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/40 backdrop-blur-xl z-30">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">
                            {initialData?.id ? "Mise à jour d'Archive" : "Nouvelle Entrée Documentaire"}
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Status:</span>
                            <Badge status={formData.isPublished ? "online" : "draft"} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                        className={cn("rounded-xl border border-white/5", isPreviewOpen ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-500")}
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        {isPreviewOpen ? "Masquer l'aperçu" : "Afficher l'aperçu"}
                    </Button>
                    <div className="w-px h-6 bg-white/5 mx-2" />
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 font-bold px-4"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Annuler
                    </Button>
                    <Button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 shadow-lg shadow-indigo-500/20"
                    >
                        {loading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Publier les Changements
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* 🛠️ MAIN EDITOR INTERFACE */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup orientation="horizontal" className="h-full">
                    {/* LEFT: FORM & EDITOR */}
                    <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col bg-zinc-950/40">
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-8 space-y-12">

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Titre de la page</Label>
                                    <Input
                                        value={formData.title}
                                        onChange={e => handleChange("title", e.target.value)}
                                        placeholder="Titre explicite..."
                                        className="h-12 bg-zinc-950/50 border-white/10 rounded-xl font-bold px-4"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Point d'accès (Slug)</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600 font-mono">/docs/</span>
                                        <Input
                                            value={formData.slug}
                                            onChange={e => handleChange("slug", e.target.value)}
                                            className="h-12 bg-zinc-950/50 border-white/10 rounded-xl font-mono pl-16 pr-4"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Classification</Label>
                                    <Input
                                        value={formData.category}
                                        onChange={e => handleChange("category", e.target.value)}
                                        className="h-12 bg-zinc-950/50 border-white/10 rounded-xl font-bold px-4"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Niveau d'accès</Label>
                                    <Select value={formData.accessLevel} onValueChange={v => handleChange("accessLevel", v)}>
                                        <SelectTrigger className="h-12 bg-zinc-950/50 border-white/10 rounded-xl px-4">
                                            <div className="flex items-center gap-2">
                                                {formData.accessLevel === "PUBLIC" ? <Globe className="w-3 h-3 text-emerald-400" /> : <Shield className="w-3 h-3 text-amber-400" />}
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                            <SelectItem value="PUBLIC">Public (Tous)</SelectItem>
                                            <SelectItem value="ADMIN">Staff Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-xl border border-white/5 self-end">
                                    <div className="flex items-center gap-3">
                                        <Settings2 className="w-4 h-4 text-zinc-500" />
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Publication</span>
                                    </div>
                                    <Switch checked={formData.isPublished} onCheckedChange={v => handleChange("isPublished", v)} />
                                </div>
                            </div>

                            {/* Content Editor */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <Label className="text-sm font-black uppercase tracking-widest text-zinc-500">Contenu (Rich Text)</Label>
                                    <span className="text-[10px] text-zinc-600 font-mono italic">Markdown supporté</span>
                                </div>
                                <AdvancedEditor
                                    initialContent={formData.content}
                                    onChange={(html) => handleChange("content", html)}
                                />
                            </div>
                        </div>
                    </ResizablePanel>

                    {isPreviewOpen && (
                        <>
                            <ResizableHandle withHandle className="bg-white/5 w-1.5 hover:bg-indigo-500/20 transition-colors" />
                            {/* RIGHT: PREVIEW */}
                            <ResizablePanel defaultSize={40} minSize={20} className="hidden lg:flex flex-col bg-zinc-900/20 dark">
                                <div className="h-full flex flex-col">
                                    <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-3 h-3 text-indigo-400" />
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Rendu Temps Réel</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-12 scrollbar-thin scrollbar-thumb-white/10">
                                        <div className="max-w-3xl mx-auto">
                                            <DocContent content={formData.content} />
                                        </div>
                                    </div>
                                </div>
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </div>
        </div>
    );
}

function Badge({ status }: { status: "online" | "draft" }) {
    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border",
            status === "online"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", status === "online" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
            {status === "online" ? "En ligne" : "Brouillon / Scan"}
        </div>
    );
}
