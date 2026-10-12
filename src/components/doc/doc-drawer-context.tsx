"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface DocDrawerContextType {
    isOpen: boolean;
    currentSlug: string | null;
    customTitle?: string | null;
    openDoc: (slug: string, title?: string) => void;
    closeDoc: () => void;
}

const DocDrawerContext = createContext<DocDrawerContextType | undefined>(undefined);

export function DocDrawerProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlug, setCurrentSlug] = useState<string | null>(null);
    const [customTitle, setCustomTitle] = useState<string | null>(null);

    const openDoc = useCallback((slug: string, title?: string) => {
        setCurrentSlug(slug);
        if (title) setCustomTitle(title);
        setIsOpen(true);
    }, []);

    const closeDoc = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <DocDrawerContext.Provider value={{ isOpen, currentSlug, customTitle, openDoc, closeDoc }}>
            {children}
        </DocDrawerContext.Provider>
    );
}

export function useDocDrawer() {
    const context = useContext(DocDrawerContext);
    if (!context) {
        throw new Error("useDocDrawer must be used within a DocDrawerProvider");
    }
    return context;
}
