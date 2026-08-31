"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PwaRegistration() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js").catch(() => {
                    // Silently fail if SW unsupported
                });
            });
        }
    }, []);

    return null;
}

export function PwaInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if already in standalone mode
        if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        window.addEventListener("appinstalled", () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            toast.success("Application SigilOS installée avec succès !");
        });

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        };
    }, []);

    if (isInstalled || dismissed || !deferredPrompt) {
        return null;
    }

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setDeferredPrompt(null);
        }
    };

    return (
        <div className="fixed bottom-24 right-6 z-50 max-w-sm p-3.5 rounded-3xl bg-surface/95 border border-warning/30 backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-warning" />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">Installer SigilOS App</h4>
                <p className="text-[11px] text-muted-foreground line-clamp-1">Accès instantané & mode plein écran</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <Button
                    size="sm"
                    onClick={handleInstall}
                    className="h-8 px-3 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground text-xs font-black gap-1 shadow-md"
                >
                    <Download className="w-3.5 h-3.5" />
                    Installer
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDismissed(true)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}
