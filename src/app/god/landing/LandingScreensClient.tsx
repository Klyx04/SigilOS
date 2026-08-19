"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Upload, Trash2, ArrowUp, ArrowDown, EyeOff } from "lucide-react";
import { getLandingScreensAdmin, uploadLandingScreen, deleteLandingScreen, updateLandingScreen, reorderLandingScreens } from "@/server/actions/landing-screen-actions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ScreenRow {
    id: string;
    section: string;
    label?: string | null;
    title?: string | null;
    description?: string | null;
    imageUrl: string;
    alt?: string | null;
    sortOrder: number;
    enabled: boolean;
}

/**
 * 🖼️ #140 — Interface God : uploader / supprimer / réordonner / masquer les screens
 * de la landing à la volée.
 * - Section « product-story » : UN screen = UN onglet (le `label` devient le nom de
 *   l'onglet : « Guides », « Sorties & groupes », « Progression »…).
 * - Section « hero » : 1 seule image (la 1ʳᵉ active remplace la capture du haut de page).
 */
type LandingSection = "product-story" | "hero";

export function LandingScreensClient() {
    const [section, setSection] = useState<LandingSection>("product-story");
    const [screens, setScreens] = useState<ScreenRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [label, setLabel] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const isHero = section === "hero";

    const load = useCallback(async () => {
        const res = await getLandingScreensAdmin(section);
        if (res.success && res.data) setScreens(res.data);
        setLoading(false);
    }, [section]);

    useEffect(() => { load(); }, [load]);

    async function handleUpload(file: File) {
        if (!file) return;
        setUploading(true);
        try {
            const res = await uploadLandingScreen({
                file,
                section,
                label: label || file.name.replace(/\.[^.]+$/, ""),
                title: isHero ? undefined : (title || undefined),
                description: isHero ? undefined : (description || undefined),
                slug: (label || file.name).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || undefined,
            });
            if (res.success) {
                toast.success(isHero ? "Image du hero remplacée" : "Screen uploadé — nouvel onglet créé sur la landing");
                setLabel(""); setTitle(""); setDescription("");
                load();
            } else {
                toast.error(res.error || "Erreur lors de l'upload");
            }
        } catch (e: any) {
            toast.error(e.message || "Erreur de connexion");
        } finally {
            setUploading(false);
        }
    }

    async function handleToggle(id: string, enabled: boolean) {
        const res = await updateLandingScreen(id, { enabled });
        if (res.success) {
            setScreens(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
            toast.success(enabled ? "Screen visible sur la landing" : "Screen masqué de la landing");
        } else toast.error(res.error || "Erreur");
    }

    async function handleDelete(id: string) {
        if (!confirm("Supprimer ce screen de la landing ?")) return;
        const res = await deleteLandingScreen(id);
        if (res.success) {
            toast.success("Screen supprimé");
            setScreens(prev => prev.filter(s => s.id !== id));
        } else toast.error(res.error || "Erreur");
    }

    async function handleMove(index: number, dir: "up" | "down") {
        const target = dir === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= screens.length) return;
        const next = [...screens];
        [next[index], next[target]] = [next[target], next[index]];
        setScreens(next);
        const res = await reorderLandingScreens(next.map(s => s.id));
        if (!res.success) { load(); toast.error(res.error || "Erreur"); }
    }

    return (
        <div className="space-y-6">
            <div className="bg-background/40 border border-border rounded-2xl p-6 space-y-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-info" />
                        Screens de la landing
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        Upload à la volée, optimisation WebP automatique (max 1920px), masquage et
                        réordonnancement sans toucher au code. Tant qu'aucun screen n'est uploadé,
                        les captures par défaut sont affichées.
                    </p>
                </div>

                {/* Choix de l'emplacement */}
                <div className="inline-flex items-center gap-1 p-1 bg-black/30 border border-border rounded-xl">
                    {(["product-story", "hero"] as LandingSection[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSection(s)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-caption font-bold uppercase tracking-wide transition-colors",
                                section === s ? "bg-info/20 text-info border border-info/30" : "text-muted-foreground hover:text-foreground border border-transparent"
                            )}
                        >
                            {s === "product-story" ? "🏞️ Onglets Produit" : "🖼️ Image du hero"}
                        </button>
                    ))}
                </div>

                {isHero ? (
                    <p className="text-xs text-amber-400/90 leading-relaxed">
                        C'est l'image en haut de page, à côté de « Votre guilde mérite mieux qu'un tableur Discord ».
                        Une seule image : la première active remplace la capture par défaut. Le libellé sert de texte
                        alternatif (accessibilité).
                    </p>
                ) : (
                    <p className="text-xs text-amber-400/90 leading-relaxed">
                        Chaque screen = une image de la section « Produit ». <strong className="text-foreground">Le libellé devient le nom de l'onglet</strong>.
                        Les 3 onglets par défaut (Guides / Sorties &amp; groupes / Progression) <strong className="text-foreground">restent affichés</strong>.
                        Pour <em>remplacer</em> l'image d'un onglet par défaut : libellé identique (« Guides », « Sorties &amp; groupes », « Progression »).
                        <strong className="text-foreground">Même libellé = plusieurs images dans le même onglet (galerie cliquable)</strong>.
                        Beaucoup d'onglets = scroll horizontal propre (responsive).
                    </p>
                )}

                <div className={cn("grid grid-cols-1 gap-3", isHero ? "md:grid-cols-1" : "md:grid-cols-3")}>
                    <Input
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder={isHero ? "Libellé / texte alternatif (ex: Dashboard SigilOS)" : "Nom de l'onglet (ex: Guides, Sorties & groupes, Progression…)"}
                        className="bg-black/40 border-border h-10 rounded-xl"
                    />
                    {!isHero && (
                        <>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre affiché à côté de l'image (optionnel)" className="bg-black/40 border-border h-10 rounded-xl" />
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description courte (optionnelle)" className="bg-black/40 border-border h-10 rounded-xl" />
                        </>
                    )}
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/10 hover:bg-info/20 border border-info/30 text-info font-bold text-sm cursor-pointer transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? "Upload en cours..." : isHero ? "Remplacer l'image du hero (max 10 Mo)" : "Ajouter un onglet (max 10 Mo)"}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.target.value = "";
                        }}
                    />
                </label>
            </div>

            {loading ? (
                <div className="text-caption text-muted-foreground italic py-4">Chargement des screens...</div>
            ) : screens.length === 0 ? (
                <div className="text-caption text-muted-foreground italic py-4">
                    {isHero
                        ? "Aucune image personnalisée — le hero affiche la capture par défaut."
                        : "Aucun screen personnalisé — la landing affiche les onglets par défaut (Guides / Sorties & groupes / Progression)."}
                </div>
            ) : (
                <div className="space-y-3">
                    {screens.map((s, idx) => (
                        <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-background/40 border border-border rounded-2xl p-4">
                            <div className="w-full sm:w-40 h-24 rounded-xl overflow-hidden border border-border bg-surface shrink-0 relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.imageUrl} alt={s.alt || s.label || ""} className="w-full h-full object-cover object-top" />
                                {!s.enabled && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <EyeOff className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={isHero ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-caption" : "bg-success/10 text-success border border-success/20 text-caption"}>
                                        {isHero ? "Hero" : "Onglet"}
                                    </Badge>
                                    <span className="font-bold text-foreground text-sm truncate">{s.label || "Sans libellé"}</span>
                                    <Badge className="bg-muted/20 text-muted-foreground border border-border text-caption">{s.sortOrder}</Badge>
                                    <Badge className={s.enabled ? "bg-success/10 text-success border border-success/20 text-caption" : "bg-muted/20 text-muted-foreground border border-border text-caption"}>
                                        {s.enabled ? "Visible" : "Masqué"}
                                    </Badge>
                                </div>
                                {!isHero && s.title && <p className="text-caption text-muted-foreground mt-1 truncate">{s.title}</p>}
                                <p className="text-caption text-muted-foreground/70 truncate">{s.imageUrl}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-9 w-9" disabled={idx === 0} onClick={() => handleMove(idx, "up")} title="Monter"><ArrowUp className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9" disabled={idx === screens.length - 1} onClick={() => handleMove(idx, "down")} title="Descendre"><ArrowDown className="w-4 h-4" /></Button>
                                <div className="flex items-center gap-2 px-2">
                                    <Switch checked={s.enabled} onCheckedChange={(v) => handleToggle(s.id, v)} aria-label="Visibilité" />
                                </div>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-danger hover:text-danger" onClick={() => handleDelete(s.id)} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

