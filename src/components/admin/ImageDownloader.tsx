"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LocalImagePicker } from "./LocalImagePicker";

type Props = {
    imageUrl: string;
    type: "monster" | "achievement" | "dungeon";
    identifier: string;
    onImageDownloaded: (localPath: string) => void;
    className?: string;
};

type DownloadResult = {
    success: boolean;
    path?: string;
    error?: string;
    sizeReduction?: string;
};

export function ImageDownloader({ imageUrl, type, identifier, onImageDownloaded, className }: Props) {
    const [externalUrl, setExternalUrl] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [lastResult, setLastResult] = useState<DownloadResult | null>(null);

    const handleDownload = async () => {
        if (!externalUrl.trim()) {
            toast.error("URL requise");
            return;
        }

        // Generate slug from identifier
        const slug = identifier.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        if (!slug) {
            toast.error("Identifiant invalide");
            return;
        }

        setDownloading(true);
        setLastResult(null);

        try {
            const res = await fetch("/api/god/download-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: externalUrl,
                    type,
                    identifier: slug
                })
            });

            const data = await res.json();

            if (data.success) {
                setLastResult({
                    success: true,
                    path: data.localPath,
                    sizeReduction: data.sizeReduction
                });
                onImageDownloaded(data.localPath);
                toast.success(`Image téléchargée ! ${data.sizeReduction || ""}`);
            } else {
                setLastResult({ success: false, error: data.error });
                toast.error(data.error || "Échec du téléchargement");
            }
        } catch (error: any) {
            setLastResult({ success: false, error: error.message });
            toast.error("Erreur réseau");
        } finally {
            setDownloading(false);
        }
    };

    // Map type to directory name for LocalImagePicker
    // const directory = type === "achievement" ? "achievements" : type === "dungeon" ? "dungeons" : "monsters";

    return (
        <div className={cn("space-y-3", className)}>
            <Label>Image</Label>

            <Tabs defaultValue="gallery" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                    <TabsTrigger value="gallery" className="data-[state=active]:bg-indigo-600">
                        🖼️ Galerie
                    </TabsTrigger>
                    <TabsTrigger value="download" className="data-[state=active]:bg-indigo-600">
                        🌐 URL
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="gallery" className="space-y-3 mt-4">
                    <LocalImagePicker
                        type={type}
                        selected={imageUrl}
                        onImageSelect={(path) => {
                            onImageDownloaded(path);
                            toast.success("Image sélectionnée !");
                        }}
                        gridSize="small"
                        className="max-h-64"
                    />
                </TabsContent>

                <TabsContent value="download" className="space-y-3 mt-4">
                    <div className="flex gap-2">
                        <Input
                            type="url"
                            placeholder="https://doflex.fr/s/monsters/png/..."
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            className="flex-1 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                            disabled={downloading}
                        />
                        <Button
                            type="button"
                            onClick={handleDownload}
                            disabled={downloading || !externalUrl.trim() || !identifier.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500"
                            size="sm"
                        >
                            {downloading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Téléchargement...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Télécharger
                                </>
                            )}
                        </Button>
                    </div>

                    {lastResult && (
                        <div className={cn(
                            "flex items-center gap-2 p-3 rounded-lg text-sm border",
                            lastResult.success
                                ? "bg-green-900/20 border-green-500/30 text-green-400"
                                : "bg-red-900/20 border-red-500/30 text-red-400"
                        )}>
                            {lastResult.success ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                    <span className="flex-1 truncate">
                                        {lastResult.path}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{lastResult.error}</span>
                                </>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Current Image Preview */}
            {imageUrl && (
                <div className="flex items-center gap-2 p-2 bg-slate-800/30 rounded border border-slate-700">
                    <img src={imageUrl} alt="Preview" className="w-8 h-8 rounded bg-slate-900 p-1" />
                    <code className="text-xs text-slate-400 flex-1 truncate">{imageUrl}</code>
                </div>
            )}
        </div>
    );
}
