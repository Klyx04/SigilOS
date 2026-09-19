"use client";

import React, { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { DiscordIcon } from "@/components/shared/icons";

interface DiscordExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    markdownText: string;
}

export function DiscordExportModal({ isOpen, onClose, markdownText }: DiscordExportModalProps) {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(markdownText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // fallback
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
            <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#5865F2]/20 text-[#5865F2]">
                            <DiscordIcon className="w-5 h-5 fill-current" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">
                                {t.raidStudio.exportDiscordBtn}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Format optimisé pour les annonces et salons Discord
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Fermer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="relative">
                    <textarea
                        readOnly
                        value={markdownText}
                        rows={12}
                        className="w-full p-3.5 rounded-xl border border-border bg-background font-mono text-xs text-foreground leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-muted-foreground">
                        Collez directement ce texte dans votre salon d'organisation Discord.
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all"
                        >
                            Fermer
                        </button>
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-bold shadow-md hover:bg-accent/90 transition-all"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{t.raidStudio.markdownCopied}</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    <span>Copier le Markdown</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
