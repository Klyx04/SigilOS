"use client";

import React, { useState, useTransition } from "react";
import { 
    Upload, 
    Sparkles, 
    CheckCircle2, 
    RefreshCw, 
    Trash2, 
    Image as ImageIcon,
    LayoutDashboard,
    Swords,
    Trophy,
    ScrollText,
    Calendar,
    Users,
    Activity,
    Gamepad2,
    Compass,
    BookOpen
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const MODULES_LIST = [
    { key: "missions", name: "Missions", defaultIcon: ScrollText },
    { key: "donjons", name: "Donjons & Quêtes", defaultIcon: Swords },
    { key: "songes", name: "Songes", defaultIcon: Sparkles },
    { key: "ladder", name: "Ladder", defaultIcon: Trophy },
    { key: "members", name: "Membres & Roster", defaultIcon: Users },
    { key: "calendar", name: "Calendrier", defaultIcon: Calendar },
    { key: "services", name: "Services Guilde", defaultIcon: Activity },
    { key: "ressources", name: "Ressources Dofus", defaultIcon: BookOpen },
    { key: "minigames", name: "Mini-Jeux", defaultIcon: Gamepad2 },
    { key: "worldmap", name: "Carte du Monde", defaultIcon: Compass },
];

export function ModuleIconsManager() {
    const [icons, setIcons] = useState<Record<string, string>>({});
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Initial check
    React.useEffect(() => {
        fetch("/api/god/list-local-images?type=module-icons")
            .then(res => res.json())
            .then(data => {
                if (data.images) {
                    const map: Record<string, string> = {};
                    data.images.forEach((img: string) => {
                        const key = img.replace(/\.webp$/, "");
                        map[key] = `/assets/module-icons/${img}?t=${Date.now()}`;
                    });
                    setIcons(map);
                }
            })
            .catch(() => {});
    }, []);

    async function handleUpload(moduleKey: string, file: File) {
        setUploadingKey(moduleKey);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", "module-icon");
            formData.append("identifier", moduleKey);

            const res = await fetch("/api/god/upload-image", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setIcons(prev => ({
                    ...prev,
                    [moduleKey]: `/assets/module-icons/${moduleKey}.webp?t=${Date.now()}`
                }));
                setMessage(`Icône "${moduleKey}" mise à jour avec succès (normalisée WebP).`);
            } else {
                setMessage(`Erreur: ${data.error || "Échec upload"}`);
            }
        } catch (err: any) {
            setMessage(`Erreur: ${err.message}`);
        } finally {
            setUploadingKey(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-warning" />
                        Personnalisation des Icônes de Modules (Navbar)
                    </h2>
                    <p className="text-caption text-muted-foreground mt-1">
                        Uploadez des visuels personnalisés (PNG, SVG, WebP) pour remplacer les icônes vectorielles par défaut de la sidebar.
                        Les images sont automatiquement optimisées, redimensionnées en 128x128 max et converties en WebP.
                    </p>
                </div>
            </div>

            {message && (
                <div className="p-3 rounded-xl border border-border bg-surface text-caption font-bold text-foreground">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES_LIST.map((mod) => {
                    const customIconUrl = icons[mod.key];
                    const DefaultIcon = mod.defaultIcon;
                    const isUploading = uploadingKey === mod.key;

                    return (
                        <div
                            key={mod.key}
                            className="p-4 rounded-2xl border border-border bg-background flex flex-col justify-between gap-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center p-1 relative flex-shrink-0">
                                    {customIconUrl ? (
                                        <Image
                                            src={customIconUrl}
                                            alt={mod.name}
                                            width={36}
                                            height={36}
                                            className="object-contain"
                                        />
                                    ) : (
                                        <DefaultIcon className="w-6 h-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-body-sm font-black text-foreground truncate">
                                        {mod.name}
                                    </div>
                                    <div className="text-caption font-mono text-muted-foreground">
                                        Clé : {mod.key}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border">
                                <span className="text-caption font-mono text-muted-foreground">
                                    {customIconUrl ? "Personnalisée" : "Par défaut"}
                                </span>

                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={isUploading}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUpload(mod.key, file);
                                        }}
                                    />
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-muted/40 text-caption font-bold text-foreground transition-colors">
                                        {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                        {customIconUrl ? "Changer" : "Upload"}
                                    </span>
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
