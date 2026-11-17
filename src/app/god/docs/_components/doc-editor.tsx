"use client";

import { useRef, useState } from "react";
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
import { Shield, Globe, Save, X, Eye, Settings2, FileText, HelpCircle, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { docSlugFromTitle } from "@/lib/doc-slug";

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
        accessLevel: initialData?.accessLevel || "MEMBER",
    });

    const handleChange = (field: keyof CreateDocInput, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const htmlInputRef = useRef<HTMLInputElement>(null);

    /**
     * Import d'une page HTML **déjà mise en forme** (demande user du 10/12/2026).
     *
     * Le fichier remplit le contenu et, s'il n'y a pas encore de titre, le titre (`<title>`,
     * sinon le premier `<h1>`) — le slug s'en déduit, personne ne le gère.
     *
     * Sécurité : on ne garde que le `<body>` nettoyé de ses `script`/`style`/`link`/`meta`, et
     * le HTML est de toute façon assaini **deux fois** ensuite — au serveur (`saveDoc` →
     * `sanitizeHtml`) et au rendu (`DocContent` → `sanitizeHtml`).
     */
    async function handleHtmlImport(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = ""; // permet de réimporter le même fichier
        if (!file) return;
        if (file.size > 5_000_000) {
            toast.error("Fichier trop lourd (5 Mo maximum)");
            return;
        }

        try {
            const parsed = new DOMParser().parseFromString(await file.text(), "text/html");
            const importedTitle = (
                parsed.querySelector("title")?.textContent
                || parsed.querySelector("h1")?.textContent
                || ""
            ).trim();
            parsed.querySelectorAll("script, style, link, meta").forEach((node) => node.remove());
            const body = (parsed.body?.innerHTML || "").trim();

            if (!body) {
                toast.error("Aucun contenu lisible dans ce fichier");
                return;
            }

            setFormData(prev => ({
                ...prev,
                content: body,
                title: prev.title.trim() || importedTitle,
            }));
            toast.success(importedTitle ? `Importé : « ${importedTitle} »` : "Contenu importé");
        } catch {
            toast.error("Lecture du fichier impossible");
        }
    }

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
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background/20 pt-2">
            {/* 🚀 TOP ACTION BAR (Fixed) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/40  z-30">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide leading-none mb-1">
                            {initialData?.id ? "Mise à jour d'Archive" : "Nouvelle Entrée Documentaire"}
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-caption font-bold text-muted-foreground uppercase tracking-tighter">Status:</span>
                            <Badge status={formData.isPublished ? "online" : "draft"} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                        className={cn("rounded-xl border border-border", isPreviewOpen ? "bg-accent/10 text-accent" : "text-muted-foreground")}
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        {isPreviewOpen ? "Masquer l'aperçu" : "Afficher l'aperçu"}
                    </Button>
                    <div className="w-px h-6 bg-surface/10 mx-2" />
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-elevated font-bold px-4"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Annuler
                    </Button>
                    <Button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="rounded-xl bg-accent hover:bg-accent text-accent-foreground font-semibold px-6 shadow-sm shadow-accent/20"
                    >
                        {loading ? (
                            <div className="h-4 w-4 border-2 border-border/30 border-t-white rounded-full animate-spin" />
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
                    <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col bg-background/40">
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-8 space-y-12">

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-xl border border-border bg-elevated/[0.02]">
                                {/* TITRE */}
                                <div className="space-y-4 md:col-span-2">
                                    <Label className="text-caption font-semibold uppercase tracking-[0.2em] text-muted-foreground">Titre de la page</Label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => handleChange("title", e.target.value)}
                                        placeholder="Ex: Quête de l'Ocre"
                                        className="bg-background/40 border-border h-14 text-lg font-bold focus:border-success/50 transition-all rounded-xl"
                                    />
                                </div>

                                {/* SLUG — plus jamais saisi à la main : il se déduit du titre (le serveur
                                    suffixe en cas de doublon de titre). */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-caption font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lien d'accès</Label>
                                        <span className="text-caption text-muted-foreground font-bold uppercase tracking-tighter">Déduit du titre</span>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">/docs/</div>
                                        <div className="bg-background/40 border border-border h-12 pl-16 pr-4 flex items-center rounded-xl font-mono text-sm text-muted-foreground overflow-hidden">
                                            <span className="truncate">{formData.slug || docSlugFromTitle(formData.title) || "…"}</span>
                                        </div>
                                    </div>
                                </div>


                                {/* CATEGORY (Classification) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-caption font-semibold uppercase tracking-[0.2em] text-muted-foreground">Catégorie (Classification)</Label>
                                        <div className="group relative">
                                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                            <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-surface border border-border rounded text-caption text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-sm">
                                                Ex: <strong>Guides Utilisateurs</strong>, <strong>Administration</strong> ou <strong>Documentation Technique</strong>.
                                            </div>
                                        </div>
                                    </div>
                                    <Input
                                        value={formData.category}
                                        onChange={(e) => handleChange("category", e.target.value)}
                                        placeholder="Ex: Guides Utilisateurs"
                                        className="bg-background/40 border-border h-12 font-bold focus:border-success/50 transition-all rounded-xl"
                                    />
                                </div>

                                {/* ACCESS LEVEL */}
                                <div className="space-y-4">
                                    <Label className="text-caption font-semibold uppercase tracking-[0.2em] text-muted-foreground">Niveau d'Accès</Label>
                                    <Select
                                        value={formData.accessLevel}
                                        onValueChange={(val: any) => handleChange("accessLevel", val)}
                                    >
                                        <SelectTrigger className="bg-background/40 border-border h-12 rounded-xl focus:ring-success/20 px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-surface border-border">
                                            <SelectItem value="MEMBER" className="focus:bg-success/20 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-success" />
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-bold text-xs uppercase tracking-wide text-foreground">Membres</span>
                                                        <span className="text-caption text-muted-foreground font-medium">Tout membre connecté d&apos;une guilde</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="ADMIN" className="focus:bg-warning/20 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-warning" />
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-bold text-xs uppercase tracking-wide text-foreground">Staff</span>
                                                        <span className="text-caption text-muted-foreground font-medium">Rôle staff (RBAC) uniquement</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                            {/* `PUBLIC` n'est plus proposé : mesuré, il n'a AUCUN public propre —
                                                tout membre connecté reçoit PUBLIC *et* MEMBER (`getAllDocs`), et
                                                `/docs` exige déjà une session + une guilde. Il reste affiché pour les
                                                fiches qui le portent encore, sinon leur valeur serait blanche ET les
                                                enregistrer réécrirait la donnée à l'insu de l'auteur. */}
                                            {formData.accessLevel === "PUBLIC" && (
                                                <SelectItem value="PUBLIC" className="focus:bg-surface/20 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="w-4 h-4 text-muted-foreground" />
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-bold text-xs uppercase tracking-wide text-foreground">Membres (ancien « Public »)</span>
                                                            <span className="text-caption text-muted-foreground font-medium">Hérité — même public que « Membres »</span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {/* La doc n'est JAMAIS publique au sens « internet » : `/docs` exige une
                                        connexion ET une guilde (garde du layout). Ce réglage ne choisit qu'entre
                                        « membre » et « staff » — cf. tests/unit/doc-acces-membres.test.ts. */}
                                    <p className="text-caption text-muted-foreground leading-snug">
                                        Aucun visiteur anonyme ne lit la doc : <span className="font-mono">/docs</span> demande une
                                        connexion <em>et</em> une guilde. « Staff » suit le <strong>rôle RBAC</strong> de la guilde
                                        (permission staff), pas une liste tenue ici.
                                    </p>
                                </div>


                                {/* PUBLICATION SWITCH — « publiée » (brouillon ⇄ en ligne), jamais
                                    « visibilité publique » : la visibilité, c'est le niveau d'accès
                                    ci-dessus (RBAC), pas cette bascule. */}
                                <div className="space-y-4 flex flex-col justify-end">
                                    <div className="bg-background/40 border border-border rounded-xl p-3 flex items-center justify-between h-12">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-1.5 h-1.5 rounded-full ", formData.isPublished ? "bg-success shadow-success/50" : "bg-surface shadow-transparent")} />
                                            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Publiée</span>
                                        </div>
                                        <button
                                            onClick={() => handleChange("isPublished", !formData.isPublished)}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                                formData.isPublished ? "bg-success" : "bg-elevated"
                                            )}
                                        >
                                            <span className={cn(
                                                "inline-block h-3 w-3 transform rounded-full bg-elevated transition-transform",
                                                formData.isPublished ? "translate-x-5" : "translate-x-1"
                                            )} />
                                        </button>
                                    </div>
                                    <p className="text-caption text-muted-foreground leading-snug">
                                        {formData.isPublished
                                            ? "En ligne pour son public — le niveau d'accès (ci-dessus) décide qui la lit."
                                            : "Brouillon : invisible pour tout le monde, même le staff."}
                                    </p>
                                </div>

                            </div>

                            {/* Content Editor */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contenu (Rich Text)</Label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-caption text-muted-foreground font-mono italic">Markdown supporté</span>
                                        <button
                                            type="button"
                                            onClick={() => htmlInputRef.current?.click()}
                                            className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-success hover:text-success transition-colors"
                                            title="Importer une page .html déjà mise en forme"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            Importer un .html
                                        </button>
                                        <input
                                            ref={htmlInputRef}
                                            type="file"
                                            accept=".html,.htm,text/html"
                                            className="hidden"
                                            onChange={handleHtmlImport}
                                        />
                                    </div>
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
                            <ResizableHandle withHandle className="bg-surface/10 w-1.5 hover:bg-success/20 transition-colors" />
                            {/* RIGHT: PREVIEW */}
                            <ResizablePanel defaultSize={40} minSize={20} className="hidden lg:flex flex-col bg-surface/20 dark">
                                <div className="h-full flex flex-col">
                                    <div className="p-4 border-b border-border bg-elevated/[0.02] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-3 h-3 text-success" />
                                            <span className="text-caption font-semibold text-foreground uppercase tracking-[0.2em]">Rendu Temps Réel</span>
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
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-caption font-semibold uppercase tracking-wider border",
            status === "online"
                ? "bg-success/10 text-success border-success/20"
                : "bg-warning/10 text-warning border-warning/20"
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", status === "online" ? "bg-success animate-pulse" : "bg-warning")} />
            {status === "online" ? "En ligne" : "Brouillon / Scan"}
        </div>
    );
}
