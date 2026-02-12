"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ResizableSidebarProps {
    children: React.ReactNode;
    className?: string;
    initialWidth?: number;
    minWidth?: number;
    maxWidth?: number;
}

export function ResizableSidebar({
    children,
    className,
    initialWidth = 280,
    minWidth = 240,
    maxWidth = 480
}: ResizableSidebarProps) {
    const [width, setWidth] = useState(initialWidth);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedWidth = localStorage.getItem("docs-sidebar-width");
        if (savedWidth) {
            setWidth(Math.min(Math.max(parseInt(savedWidth), minWidth), maxWidth));
        }
    }, [minWidth, maxWidth]);

    const startResizing = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        if (!isResizing) return;

        const resize = (e: MouseEvent) => {
            let newWidth = e.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0);
            newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
            setWidth(newWidth);
        };

        const stopResizing = () => {
            setIsResizing(false);
            localStorage.setItem("docs-sidebar-width", width.toString());
        };

        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);

        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, minWidth, maxWidth, width]);

    return (
        <aside
            ref={sidebarRef}
            className={cn("relative group shrink-0", className)}
            style={{ width }}
        >
            <div className="h-full w-full overflow-hidden">
                {children}
            </div>

            {/* Drag Handle */}
            <div
                className={cn(
                    "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-10",
                    isResizing && "bg-indigo-500 w-1.5"
                )}
                onMouseDown={startResizing}
            />
        </aside>
    );
}
