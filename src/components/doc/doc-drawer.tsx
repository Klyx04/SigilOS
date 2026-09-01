"use client";

import React, { useEffect, useState, useRef } from "react";
import { useDocDrawer } from "./doc-drawer-context";
import { getDocBySlug, DocPageData } from "@/server/actions/doc-actions";
import { DocContent } from "./doc-content";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen,
    X,
    ExternalLink,
    Maximize2,
    Loader2,
    Hash,
    ChevronRight,
    Bookmark,
    Shield,
    Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DocDrawerProps {
    guildId?: string;
}

export function DocDrawer({ guildId }: DocDrawerProps) {
    const { isOpen, currentSlug, customTitle, closeDoc } = useDocDrawer();
    const [doc, setDoc] = useState<DocPageData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
    const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                closeDoc();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, closeDoc]);

    // Fetch doc whenever currentSlug changes and drawer is open
    useEffect(() => {
        if (!isOpen || !currentSlug) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        getDocBySlug(currentSlug, guildId)
            .then((data) => {
                if (!isMounted) return;
                if (!data) {
                    setError("Cette documentation n'est pas disponible ou vous ne disposez pas des permissions requises.");
                    setDoc(null);
                } else {
                    setDoc(data);
                    // Extract Headings
                    const parser = new DOMParser();
                    const docHtml = parser.parseFromString(data.content, "text/html");
                    const elements = Array.from(docHtml.querySelectorAll("h2, h3"));
                    const extracted = elements.map((el) => {
                        const text = el.textContent || "";
                        const id = el.id || text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
                        return {
                            id,
                            text,
                            level: parseInt(el.tagName[1]) || 2,
                        };
                    });
                    setHeadings(extracted);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError("Une erreur est survenue lors du chargement de la documentation.");
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, currentSlug, guildId]);

    const scrollToHeading = (id: string) => {
        setActiveHeadingId(id);
        if (!scrollContainerRef.current) return;
        const target = scrollContainerRef.current.querySelector(`#${id}`);
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeDoc}
                        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[90] cursor-pointer"
                        aria-hidden="true"
                    />

                    {/* Sliding Drawer Panel */}
                    <motion.aside
                        initial={{ x: "100%", opacity: 0.5 }}
                        animate={{ x: "0%", opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed top-0 right-0 h-full w-full sm:w-[540px] lg:w-[600px] xl:w-[680px] bg-surface/95 border-l border-border backdrop-blur-2xl shadow-2xl z-[100] flex flex-col overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Documentation contextuelle"
                    >
                        {/* Drawer Header */}
                        <div className="p-4 sm:p-5 border-b border-border/80 bg-surface/40 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            {doc?.category || "Documentation"}
                                        </span>
                                        {doc?.accessLevel === "ADMIN" && (
                                            <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10 font-black">
                                                <Shield className="w-2.5 h-2.5 mr-1" /> Staff
                                            </Badge>
                                        )}
                                    </div>
                                    <h2 className="text-base font-black text-foreground truncate mt-0.5 tracking-tight">
                                        {doc?.title || customTitle || "Guide & Documentation"}
                                    </h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {currentSlug && (
                                    <Link href={`/docs/${currentSlug}`}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                            title="Ouvrir la page complète"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={closeDoc}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                    title="Fermer (Échap)"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Interactive Table of Contents Bar */}
                        {headings.length > 1 && !loading && !error && (
                            <div className="px-4 py-2 border-b border-border/50 bg-background/50 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0 flex items-center gap-1 mr-1">
                                    <Hash className="w-3 h-3 text-primary" /> Sommaire :
                                </span>
                                {headings.map((h) => (
                                    <button
                                        key={h.id}
                                        onClick={() => scrollToHeading(h.id)}
                                        className={cn(
                                            "text-xs px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-all shrink-0 border",
                                            activeHeadingId === h.id
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "bg-surface border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                                        )}
                                    >
                                        {h.text}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Content Scrollable Body */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 custom-scrollbar"
                        >
                            {loading && (
                                <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    <p className="text-xs font-semibold text-muted-foreground">Chargement du guide contextuel...</p>
                                </div>
                            )}

                            {error && !loading && (
                                <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-3 my-8">
                                    <p className="text-sm font-bold text-destructive">{error}</p>
                                    <Button variant="outline" size="sm" onClick={closeDoc} className="text-xs">
                                        Fermer le panneau
                                    </Button>
                                </div>
                            )}

                            {doc && !loading && !error && (
                                <div className="space-y-6">
                                    <DocContent
                                        content={doc.content}
                                        className="prose-headings:scroll-mt-6 prose-h2:text-xl prose-h2:font-black prose-h3:text-lg prose-h3:font-bold prose-p:text-sm prose-p:leading-relaxed"
                                    />

                                    {/* Footer Tip */}
                                    <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-amber-400" />
                                            <span>Guide officiel certifié SigilOS</span>
                                        </div>
                                        <Link
                                            href={`/docs/${doc.slug}`}
                                            className="font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            Consulter la version complète
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
